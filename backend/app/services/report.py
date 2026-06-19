import structlog
from typing import Dict, Any
from app.db.client import get_db
from app.db import repositories as repo
from app.core.llm import get_llm
from app.services.scoring import compute_overall_score
from langchain_core.messages import SystemMessage, HumanMessage
import json

logger = structlog.get_logger(__name__)

async def generate_interview_report(user_id: str, thread_id: str) -> Dict[str, Any]:
    db = get_db()
    thread = repo.get_thread(user_id, thread_id)
    if not thread:
        raise ValueError("Thread not found")

    resume_id = thread.get("resume_id")
    resume = repo.get_resume(user_id, resume_id) if resume_id else {}
    search_context = resume.get("search_context", {}) if resume else {}
    resume_text = resume.get("extracted_text", "") if resume else ""

    round_grades = list(db.round_grades.find({"thread_id": thread_id}).sort("round", 1))
    counters = thread.get("counters", {"hints_used": 0, "tab_switches": 0})
    
    score_data = compute_overall_score(round_grades, counters.get("tab_switches", 0), counters.get("hints_used", 0))

    llm = get_llm()

    # Formulate prompt for advanced insights
    prompt_str = f"""
You are an elite Tech Lead and Hiring Manager evaluating a candidate.
Based on the candidate's interview performance, their resume, and the latest industry trends, generate a JSON report containing deep insights.

CANDIDATE RESUME:
{resume_text[:4000]}

TAVILY SEARCH CONTEXT (Industry Trends, Skills, Projects):
{json.dumps(search_context)[:4000]}

INTERVIEW PERFORMANCE:
{json.dumps([{
    "round": g.get("round"),
    "type": g.get("round_type"),
    "question": g.get("question"),
    "grade": g.get("grade"),
    "feedback": g.get("feedback_summary")
} for g in round_grades])}

Your task is to generate a JSON response with EXACTLY the following keys:
1. "finalVerdict": A 2-3 sentence executive summary of the candidate's performance.
2. "communicationFeedback": A detailed paragraph evaluating their communication style.
3. "atsInsights": String containing Markdown bullet points detailing how well their resume aligns with current industry expectations (based on Tavily context).
4. "skillGapAnalysis": String containing Markdown bullet points highlighting what skills they lack compared to market demands.
5. "learningRoadmap": String containing Markdown of a week-by-week actionable plan (e.g., Week 1: ..., Week 2: ...) to bridge their gaps.
6. "metrics": An object with integer scores (0-100) for: "projectMastery", "technicalDepth", "communication", "problemSolving".

DO NOT output any markdown blocks or text outside the JSON object. Output RAW JSON ONLY.
"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt_str)])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
        
        ai_insights = json.loads(content)
    except Exception as e:
        logger.error("report_generation_failed", error=str(e))
        ai_insights = {
            "finalVerdict": "Candidate completed the interview. AI insights generation failed.",
            "communicationFeedback": "Not evaluated.",
            "atsInsights": "Not evaluated.",
            "skillGapAnalysis": "Not evaluated.",
            "learningRoadmap": "Not evaluated.",
            "metrics": {
                "projectMastery": score_data["base_score"],
                "technicalDepth": score_data["base_score"],
                "communication": score_data["base_score"],
                "problemSolving": score_data["base_score"]
            }
        }

    question_breakdown = []
    # We will just map the round grades
    for g in round_grades:
        question_breakdown.append({
            "correctness": g.get("grade", "wrong"),
            "question": g.get("question", ""),
            "candidateAnswer": "Recorded in chat.",
            "feedback": g.get("feedback_summary", ""),
            "detailedExplanation": "Refer to the conversation for the optimal solution."
        })

    return {
        "overallScore": score_data["overall_score"],
        "finalVerdict": ai_insights.get("finalVerdict", "Completed."),
        "metrics": ai_insights.get("metrics", {}),
        "questionBreakdown": question_breakdown,
        "communicationFeedback": ai_insights.get("communicationFeedback", ""),
        "atsInsights": ai_insights.get("atsInsights", ""),
        "skillGapAnalysis": ai_insights.get("skillGapAnalysis", ""),
        "learningRoadmap": ai_insights.get("learningRoadmap", ""),
        "counters": counters
    }
