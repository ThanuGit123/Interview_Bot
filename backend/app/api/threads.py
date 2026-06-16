from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import structlog

from app.db.client import get_db
from app.core.security import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/threads", tags=["threads"])

class ThreadCreateRequest(BaseModel):
    resume_id: str
    type: Optional[str] = "interview"
    difficulty: Optional[str] = "medium"
    skills: Optional[List[str]] = []
    max_questions: Optional[int] = 5

@router.post("/")
async def create_thread(req: ThreadCreateRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Verify resume exists
    resume = db.resumes.find_one({"_id": req.resume_id, "user_id": current_user["_id"]})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    thread_id = str(uuid.uuid4())
    
    # Initialize thread document
    db.threads.insert_one({
        "_id": thread_id,
        "user_id": current_user["_id"],
        "resume_id": req.resume_id,
        "type": req.type,
        "status": "active",
        "difficulty": req.difficulty,
        "skills": req.skills,
        "max_questions": req.max_questions,
        "current_round": 1,
        "asked_questions": [],
        "running_summary": "",
        "summary_covers_until": 0,
        "counters": {
            "hints_used": 0,
            "tab_switches": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"thread_id": thread_id, "message": "Thread created successfully"}

@router.get("/")
async def get_threads(user_id: str = Depends(get_current_user)):
    db = get_db()
    threads = list(db.threads.find({"user_id": user_id}).sort("created_at", -1))
    
    history = []
    for t in threads:
        score = 100
        score -= t.get("counters", {}).get("hints_used", 0) * 5
        score -= t.get("counters", {}).get("tab_switches", 0) * 10
        
        grades = list(db.round_grades.find({"thread_id": t["_id"]}))
        wrong_count = sum(1 for g in grades if g.get("grade") == "wrong")
        partial_count = sum(1 for g in grades if g.get("grade") == "partial")
        
        score -= wrong_count * 10
        score -= partial_count * 5
        
        verdict = "Strong Hire" if score >= 80 else "Hire" if score >= 60 else "No Hire"
        
        history.append({
            "id": t["_id"],
            "date": t["created_at"][:10],
            "difficulty": t.get("difficulty", "medium"),
            "score": max(0, score),
            "verdict": verdict
        })
        
    return history
