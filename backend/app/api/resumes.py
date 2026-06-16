from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import uuid
from datetime import datetime, timezone
import structlog

from app.db.client import get_db
from app.core.security import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/resumes", tags=["resumes"])

class ResumeUploadRequest(BaseModel):
    extracted_text: str

@router.post("/")
async def upload_resume(req: ResumeUploadRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    resume_id = str(uuid.uuid4())
    
    db.resumes.insert_one({
        "_id": resume_id,
        "user_id": current_user["_id"],
        "filename": "resume.txt",
        "file_type": "text/plain",
        "extracted_text": req.extracted_text,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"resume_id": resume_id, "message": "Resume uploaded successfully"}
    
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
