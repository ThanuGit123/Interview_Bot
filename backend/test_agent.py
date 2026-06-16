import os
import uuid
import structlog
from dotenv import load_dotenv

load_dotenv()
from app.core.logging import setup_logging
setup_logging()

from app.agent.graph import graph
from app.db.client import get_db
from app.services.scoring import compute_overall_score
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig

logger = structlog.get_logger(__name__)

def test_scoring():
    res = compute_overall_score(
        round_grades=[{"grade": "correct"}, {"grade": "partial"}, {"grade": "wrong"}],
        tab_switches=1,
        hints_used=1
    )
    assert res["overall_score"] == 35
    assert res["verdict"] == "no_hire"
    print("Scoring tests passed.")

def test_agent_loop():
    db = get_db()
    
    user_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    
    db.users.insert_one({"_id": user_id, "email": f"test_{user_id}@test.com", "password_hash": "dummy", "created_at": "2024-01-01T00:00:00Z"})
    db.threads.insert_one({
        "_id": thread_id, 
        "user_id": user_id, 
        "type": "interview", 
        "status": "active",
        "current_round": 1,
        "running_summary": "",
        "summary_covers_until": 0,
        "counters": {"hints_used": 0, "tab_switches": 0},
        "asked_questions": [],
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    })
    
    config = RunnableConfig(configurable={"user_id": user_id, "thread_id": thread_id})
    
    state = {
        "messages": [
            SystemMessage(content="You are Interview Bot."),
            SystemMessage(content="Dynamic context: Round 1. Question: What is a list in python?"),
            HumanMessage(content="A list is a mutable array.")
        ],
        "thread_id": thread_id,
        "user_id": user_id,
        "thread_type": "interview",
        "retry_count": 0
    }
    
    logger.info("running_graph")
    
    result = graph.invoke(state, config=config)
    
    print("\n--- GRAPH OUTPUT ---")
    print(f"PLAN: {result.get('plan')}")
    print(f"DRAFT: {result.get('draft')}")
    print(f"REFLECTION: {result.get('reflection')}")
    print(f"RETRY COUNT: {result.get('retry_count')}")
    
    grades = list(db.round_grades.find({"thread_id": thread_id}))
    print("\n--- GRADES IN DB ---")
    print(grades)

if __name__ == "__main__":
    test_scoring()
    test_agent_loop()
