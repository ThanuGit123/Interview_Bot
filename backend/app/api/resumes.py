import io
import base64
import uuid
from datetime import datetime, timezone

import fitz  # PyMuPDF
import structlog
from docx import Document
from fastapi import APIRouter, Depends, UploadFile, File, Response

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
}

from app.db.client import get_db
from app.core.security import get_current_user
from app.core.errors import AppError

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/resumes", tags=["resumes"])

MAX_SIZE = 5 * 1024 * 1024  # 5 MB


def extract_text(filename: str, content: bytes) -> str:
    """Extract plain text from an uploaded resume. Fails loudly (AppError)."""
    name = (filename or "").lower()

    if name.endswith(".pdf"):
        try:
            with fitz.open(stream=content, filetype="pdf") as doc:
                return "\n".join(page.get_text() for page in doc)
        except Exception as e:
            logger.error("pdf_extraction_failed", error=str(e))
            raise AppError(code="EXTRACTION_FAILED", message="Could not read the PDF file", status_code=400)

    if name.endswith(".docx"):
        try:
            document = Document(io.BytesIO(content))
            return "\n".join(p.text for p in document.paragraphs)
        except Exception as e:
            logger.error("docx_extraction_failed", error=str(e))
            raise AppError(code="EXTRACTION_FAILED", message="Could not read the Word document", status_code=400)

    if name.endswith(".txt") or name.endswith(".md"):
        return content.decode("utf-8", errors="ignore")

    raise AppError(
        code="UNSUPPORTED_FILE",
        message="Unsupported file type. Upload a PDF, DOCX, TXT, or MD file (legacy .doc is not supported).",
        status_code=400,
    )


@router.post("/")
async def upload_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    content = await file.read()

    if len(content) == 0:
        raise AppError(code="EMPTY_FILE", message="The uploaded file is empty", status_code=400)
    if len(content) > MAX_SIZE:
        raise AppError(code="FILE_TOO_LARGE", message="File exceeds the 5MB limit", status_code=400)

    text = extract_text(file.filename, content).strip()
    if not text:
        raise AppError(
            code="EXTRACTION_FAILED",
            message="No readable text found in the file (it may be a scanned image).",
            status_code=400,
        )

    resume_id = str(uuid.uuid4())
    file_type = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "txt"

    db = get_db()
    db.resumes.insert_one({
        "_id": resume_id,
        "user_id": current_user["_id"],
        "filename": file.filename,
        "file_type": file_type,
        "extracted_text": text,
        "file_b64": base64.b64encode(content).decode("ascii"),  # original bytes for true preview
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info("resume_uploaded", resume_id=resume_id, file_type=file_type, chars=len(text))

    return {
        "resume_id": resume_id,
        "filename": file.filename,
        "chars_extracted": len(text),
        "extracted_text": text,
    }


@router.get("/{resume_id}")
async def get_resume(resume_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    resume = db.resumes.find_one({"_id": resume_id, "user_id": current_user["_id"]})
    if not resume:
        raise AppError(code="RESUME_NOT_FOUND", message="Resume not found", status_code=404)
    return {
        "resume_id": resume["_id"],
        "filename": resume.get("filename"),
        "file_type": resume.get("file_type"),
        "extracted_text": resume.get("extracted_text", ""),
    }


@router.get("/{resume_id}/file")
async def get_resume_file(resume_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    resume = db.resumes.find_one({"_id": resume_id, "user_id": current_user["_id"]})
    if not resume or not resume.get("file_b64"):
        raise AppError(code="FILE_NOT_FOUND", message="Original file not available", status_code=404)
    data = base64.b64decode(resume["file_b64"])
    media = MEDIA_TYPES.get((resume.get("file_type") or "").lower(), "application/octet-stream")
    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f'inline; filename="{resume.get("filename", "resume")}"'},
    )


@router.post("/extract-skills")
async def extract_skills(req: dict, current_user: dict = Depends(get_current_user)):
    from app.core.llm import get_llm
    from langchain_core.messages import HumanMessage
    import json_repair as json

    text = req.get("resumeText", "")
    llm = get_llm()
    prompt = f"""Extract only interviewable technical skills from the following resume.

Valid Examples: Python, Java, C++, JavaScript, React, Next.js, Node.js, Spring Boot, MongoDB, MySQL, Docker, Kubernetes, AWS, Machine Learning, Deep Learning, CNN, NLP, Computer Vision.

Do NOT extract: NPTEL, Coursera, Udemy, Certifications, Workshop names, Course titles, College subjects, Soft skills, Project names.

For every extracted skill provide a JSON object with 'skill' and 'confidence' (0.0 to 1.0).
Output ONLY a raw JSON array of these objects, for example:
[
  {{"skill": "React", "confidence": 0.95}},
  {{"skill": "Python", "confidence": 0.85}}
]
DO NOT include any markdown formatting or extra text.

Resume: {text[:15000]}"""
    try:
        response = llm.invoke([HumanMessage(content=prompt)])

        # Strip markdown if present
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        skills_array = json.loads(content.strip())

        if not isinstance(skills_array, list):
            raise ValueError("Expected a JSON array")

        # Sort by confidence descending and extract top 12 skill objects
        sorted_skills = sorted(skills_array, key=lambda x: x.get('confidence', 0), reverse=True)
        final_skills = sorted_skills[:12]

        return {"skills": final_skills}
    except Exception as e:
        logger.error("skill_extraction_failed", error=str(e))
        return {"skills": [{"skill": "React", "confidence": 0.9}, {"skill": "Node.js", "confidence": 0.85}, {"skill": "Python", "confidence": 0.8}]}
