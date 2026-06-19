import structlog
import json
from typing import Dict, Any
from app.core.llm import get_llm
from app.db.client import get_db
from langchain_core.messages import HumanMessage

logger = structlog.get_logger(__name__)

async def generate_ats_report(resume_id: str, user_id: str, provided_role: str = None) -> Dict[str, Any]:
    from app.db import repositories as repo
    db = get_db()
    
    # Fetch the resume document
    resume = db.resumes.find_one({"_id": resume_id, "user_id": user_id})
    if not resume:
        raise ValueError("Resume not found")

    # If an ATS report was already generated, return it
    if "ats_report" in resume and resume["ats_report"]:
        return resume["ats_report"]

    resume_text = resume.get("extracted_text", "")
    
    if not resume_text:
        raise ValueError("Resume text is empty. Cannot generate report.")

    llm = get_llm()

    target_role = provided_role

    if not target_role:
        # --- NEW ROLE EXTRACTION LOGIC ---
        # Find the most recent thread that has this resume attached
        thread = db.threads.find_one(
            {"user_id": user_id, "resume_ids": resume_id},
            sort=[("updated_at", -1)]
        )
        
        if not thread:
            raise ValueError("NO_ROLE")

        # Get recent messages
        messages = repo.list_messages(str(thread["_id"]), user_id)
        chat_history = "\n".join([f"{m.get('role', 'unknown')}: {m.get('content', '')}" for m in messages[-10:]])

        role_prompt = f"""
        Based on the following chat history, what job role is the user applying for or targeting?
        If the user has not explicitly stated a role or job title yet, output exactly "UNKNOWN".
        Otherwise, output JUST the job title and nothing else.
        
        CHAT HISTORY:
        {chat_history}
        """
        
        role_resp = await llm.ainvoke([HumanMessage(content=role_prompt)])
        target_role = role_resp.content.strip()
        
        if target_role.upper() == "UNKNOWN" or not target_role:
            raise ValueError("NO_ROLE")

    # Update the resume with the target role so other services (like the interview) can use it
    db.resumes.update_one(
        {"_id": resume_id, "user_id": user_id},
        {"$set": {"extracted_role": target_role}}
    )

    # --- END ROLE EXTRACTION ---

    prompt_str = f"""
You are an elite Technical Recruiter and ATS (Applicant Tracking System) Expert.
Your task is to deeply analyze the candidate's resume against the latest industry trends and output a highly detailed ATS Analysis Report in JSON format.

The candidate is specifically applying for the following role: {target_role}

CANDIDATE RESUME:
{resume_text[:15000]}

CRITICAL INSTRUCTION: Analyze the ACTUAL resume text provided above. Do NOT output generic examples. You must extract REAL missing keywords, REAL weaknesses, and REAL bullet points from the text. 
Focus your analysis on how well the candidate fits the {target_role} role.

Generate a JSON response with EXACTLY the following keys. The values below are JUST AN EXAMPLE FORMAT. You MUST replace them with your own realistic analysis based purely on the candidate's actual resume:

{{
  "atsScore": <integer between 0 and 100 based on the actual resume quality for the {target_role} role>,
  "missingKeywords": ["<keyword 1>", "<keyword 2>"],
  "resumeWeaknesses": ["<specific weakness 1>", "<specific weakness 2>"],
  "improvedBullets": [
    {{
      "original": "<a real bullet point pulled exactly from the candidate's resume>",
      "improved": "<how you would rewrite that exact bullet point>",
      "reason": "<why this is better>"
    }}
  ],
  "recommendations": ["<actionable recommendation 1>", "<actionable recommendation 2>"]
}}

DO NOT output any markdown blocks or text outside the JSON object. Output RAW JSON ONLY.
"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt_str)])
        content = response.content
        
        # Clean up JSON formatting if the model adds markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
        
        import json_repair
        ats_report = json_repair.loads(content)
        
        # Cache the report in the database so we don't have to generate it again
        db.resumes.update_one(
            {"_id": resume_id, "user_id": user_id},
            {"$set": {"ats_report": ats_report}}
        )
        
        return ats_report

    except Exception as e:
        logger.error("ats_report_generation_failed", error=str(e))
        return {
            "atsScore": 0,
            "missingKeywords": ["Failed to generate report"],
            "resumeWeaknesses": ["Failed to generate report"],
            "improvedBullets": [],
            "recommendations": ["Failed to generate report"]
        }
