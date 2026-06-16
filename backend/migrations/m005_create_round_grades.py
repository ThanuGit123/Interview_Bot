"""Create round_grades collection with validator and indexes."""
import structlog
from pymongo import ASCENDING

logger = structlog.get_logger(__name__)

ROUND_GRADES_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "thread_id", "user_id", "round", "round_type", "question", "grade", "feedback_summary", "created_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "thread_id": {"bsonType": "string"},
            "user_id": {"bsonType": "string"},
            "round": {"bsonType": "int"},
            "round_type": {"bsonType": "string", "enum": ["project", "technical", "coding", "design", "behavioral"]},
            "question": {"bsonType": "string"},
            "grade": {"bsonType": "string", "enum": ["correct", "partial", "wrong"]},
            "feedback_summary": {"bsonType": "string"},
            "created_at": {"bsonType": "string"}
        }
    }
}

def up(db):
    db.create_collection("round_grades", validator=ROUND_GRADES_VALIDATOR)
    db.round_grades.create_index([("thread_id", ASCENDING), ("round", ASCENDING)], unique=True)
    logger.info("migration_applied", migration="m005_create_round_grades")
