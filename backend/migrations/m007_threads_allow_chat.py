"""Expand threads.type enum to include 'chat' (v3 single-agent chat) + allow title."""
import structlog

logger = structlog.get_logger(__name__)

THREADS_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "user_id", "type", "status", "current_round", "counters", "running_summary", "summary_covers_until", "asked_questions", "created_at", "updated_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "user_id": {"bsonType": "string"},
            "type": {"bsonType": "string", "enum": ["interview", "coaching", "chat"]},
            "title": {"bsonType": ["string", "null"]},
            "resume_id": {"bsonType": ["string", "null"]},
            "status": {"bsonType": "string", "enum": ["active", "completed", "abandoned"]},
            "settings": {"bsonType": ["object", "null"]},
            "difficulty": {"bsonType": ["string", "null"]},
            "skills": {"bsonType": ["array", "null"]},
            "max_questions": {"bsonType": ["int", "null"]},
            "current_round": {"bsonType": "int"},
            "counters": {
                "bsonType": "object",
                "required": ["tab_switches", "hints_used"],
                "properties": {
                    "tab_switches": {"bsonType": "int"},
                    "hints_used": {"bsonType": "int"},
                },
            },
            "running_summary": {"bsonType": "string"},
            "summary_covers_until": {"bsonType": "int"},
            "asked_questions": {"bsonType": "array"},
            "started_at": {"bsonType": ["string", "null"]},
            "created_at": {"bsonType": "string"},
            "updated_at": {"bsonType": "string"},
        },
    }
}


def up(db):
    db.command("collMod", "threads", validator=THREADS_VALIDATOR)
    logger.info("migration_applied", migration="m007_threads_allow_chat")
