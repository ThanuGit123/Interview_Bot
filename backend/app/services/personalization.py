import structlog
from app.db.client import get_db

logger = structlog.get_logger(__name__)

def get_user_coaching_context(user_id: str) -> str:
    """Aggregates a user's past ATS scores and interview struggles to build a deep context profile."""
    try:
        db = get_db()
        context_lines = []

        # 1. Fetch latest ATS reports
        # Find the most recently updated resume with an ats_report
        latest_resume = db.resumes.find_one(
            {"user_id": user_id, "ats_report": {"$exists": True, "$ne": None}},
            sort=[("created_at", -1)]
        )

        if latest_resume and "ats_report" in latest_resume:
            report = latest_resume["ats_report"]
            score = report.get("atsScore", 0)
            weaknesses = report.get("resumeWeaknesses", [])
            
            context_lines.append(f"- Last ATS Score: {score}/100")
            if weaknesses:
                weakness_str = ", ".join(weaknesses[:2])  # Only take top 2 so we don't overwhelm the prompt
                context_lines.append(f"- Known Resume Weaknesses: {weakness_str}")

        # 2. Fetch past low-scoring topics and max difficulty reached
        past_grades = list(db.round_grades.find(
            {"user_id": user_id, "grade": {"$in": ["wrong", "partial"]}}
        ).sort("created_at", -1).limit(5))
        
        if past_grades:
            weak_topics = list(set([g.get("round_type", "technical") for g in past_grades]))
            context_lines.append(f"- Topics where score was low: {', '.join(weak_topics)} (Focus next session)")
            
        all_grades = list(db.round_grades.find({"user_id": user_id}).sort("round", -1).limit(1))
        if all_grades:
            max_round = all_grades[0].get("round", 1)
            context_lines.append(f"- Max Difficulty Level Reached (Rounds): {max_round} (Start there next time)")

        # 3. Fetch past asked questions to avoid repetition
        all_threads = list(db.threads.find(
            {"user_id": user_id, "deleted_at": None},
            {"asked_questions": 1}
        ))
        
        past_questions = []
        for t in all_threads:
            for q in t.get("asked_questions", []):
                if q.get("question"):
                    past_questions.append(q["question"])
                    
        if past_questions:
            # deduplicate and keep last 5 to not blow up prompt
            unique_qs = list(set(past_questions))[-5:]
            q_list = " | ".join(unique_qs)
            context_lines.append(f"- Questions already asked: {q_list} (DO NOT REPEAT THESE)")

        if not context_lines:
            return "Context: This is a new user with no past ATS scores or mock interview history yet. Be encouraging!"

        context_body = "\n".join(context_lines)
        return (
            f"Context: This is a returning user. We have some data on their past struggles to help you personalize this session:\n"
            f"{context_body}\n"
            f"CRITICAL COACHING RULE: If they ask for a mock interview, test them specifically on the areas they struggled with last time. "
            f"Acknowledge their past performance naturally. Do NOT repeat past questions."
        )
    except Exception as e:
        logger.error("get_user_coaching_context_failed", error=str(e))
        return "Context: Error fetching user history. Treat as a standard session."
