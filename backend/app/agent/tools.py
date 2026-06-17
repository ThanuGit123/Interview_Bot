import structlog
from datetime import datetime, timezone
from uuid import uuid4
from langchain_core.tools import tool
from app.db.client import get_db
from app.db import repositories as repo

logger = structlog.get_logger(__name__)

from langchain_core.runnables import RunnableConfig

@tool
def get_resume_text(config: RunnableConfig) -> str:
    """Gets the extracted text of the candidate's resume for the current thread."""
    user_id = config["configurable"]["user_id"]
    thread_id = config["configurable"]["thread_id"]
    logger.info("tool_call", tool="get_resume_text", thread_id=thread_id)
    thread = repo.get_thread(user_id, thread_id)
    if not thread or not thread.get("resume_id"):
        return "No resume provided."
    resume = repo.get_resume(user_id, thread.get("resume_id"))
    return resume.get("extracted_text", "No resume content found.") if resume else "No resume found."

@tool
def list_asked_questions(config: RunnableConfig) -> str:
    """Lists the topics/questions already asked in this thread to avoid repeating them."""
    user_id = config["configurable"]["user_id"]
    thread_id = config["configurable"]["thread_id"]
    logger.info("tool_call", tool="list_asked_questions", thread_id=thread_id)
    thread = repo.get_thread(user_id, thread_id)
    if not thread:
        return "No questions asked yet."
    questions = thread.get("asked_questions", [])
    if not questions:
        return "No questions asked yet."
    return "\n".join([f"Round {q.get('round')}: {q.get('question')}" for q in questions])

from pydantic import BaseModel, Field

class RecordRoundGradeInput(BaseModel):
    round_num: int = Field(description="The current round number.")
    round_type: str = Field(description="Must be exactly one of: 'project', 'technical', 'coding', 'design', 'behavioral'.")
    question: str = Field(description="The question asked.")
    grade: str = Field(description="Performance grade. Must be exactly one of: 'correct', 'partial', 'wrong'.")
    feedback_summary: str = Field(description="Brief summary of feedback for the candidate.")

@tool("record_round_grade", args_schema=RecordRoundGradeInput)
def record_round_grade(round_num: int, round_type: str, question: str, grade: str, feedback_summary: str, config: RunnableConfig) -> str:
    """
    Records the performance grade for the candidate's last answer.
    This tool MUST be called during the 'act' step.
    """
    user_id = config["configurable"]["user_id"]
    thread_id = config["configurable"]["thread_id"]
    logger.info("tool_call", tool="record_round_grade", thread_id=thread_id, round=round_num, grade=grade)
    
    valid_types = ['project', 'technical', 'coding', 'design', 'behavioral']
    valid_grades = ['correct', 'partial', 'wrong']
    
    if str(round_type).lower() not in valid_types or str(grade).lower() not in valid_grades:
        logger.info("invalid_enum_skipped", round_type=round_type, grade=grade)
        return "Grade skipped (no previous answer to grade, or invalid enum)."
        
    db = get_db()
    
    db.round_grades.update_one(
        {"thread_id": thread_id, "round": round_num},
        {
            "$set": {
                "user_id": user_id,
                "round_type": str(round_type).lower(),
                "question": question,
                "grade": str(grade).lower(),
                "feedback_summary": feedback_summary,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "_id": str(uuid4())
            }
        },
        upsert=True
    )
    
    db.threads.update_one(
        {"_id": thread_id, "user_id": user_id},
        {"$push": {"asked_questions": {"round": round_num, "question": question}}}
    )
    
    return "Grade recorded successfully."

@tool
def record_hint_given(config: RunnableConfig) -> str:
    """Records that a hint was given, adding a penalty to the final score."""
    user_id = config["configurable"]["user_id"]
    thread_id = config["configurable"]["thread_id"]
    logger.info("tool_call", tool="record_hint_given", thread_id=thread_id)
    db = get_db()
    db.threads.update_one(
        {"_id": thread_id, "user_id": user_id},
        {"$inc": {"counters.hints_used": 1}}
    )
    return "Hint penalty applied."

# NOTE: The small free-tier model (llama-3.1-8b) emits tool calls as literal text
# instead of native tool_calls, which leaks XML-ish tags into the chat. The resume
# and full conversation are already injected into context, so the agent needs no
# tools — we run tool-less for reliability. (Re-enable on a stronger model.)
agent_tools = []
