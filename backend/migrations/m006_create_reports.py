"""Create reports collection with validator and indexes."""
import structlog
from pymongo import ASCENDING, DESCENDING

logger = structlog.get_logger(__name__)

REPORTS_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "thread_id", "user_id", "overall_score", "metrics", "detailed_feedback", "recommended_topics", "verdict", "penalties", "question_breakdown", "created_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "thread_id": {"bsonType": "string"},
            "user_id": {"bsonType": "string"},
            "overall_score": {"bsonType": "int"},
            "metrics": {
                "bsonType": "object",
                "patternProperties": {
                    "^.*$": {"bsonType": "string", "enum": ["strong", "average", "weak"]}
                }
            },
            "detailed_feedback": {
                "bsonType": "object",
                "required": ["what_went_well", "what_to_improve"],
                "properties": {
                    "what_went_well": {"bsonType": "array"},
                    "what_to_improve": {"bsonType": "array"}
                }
            },
            "recommended_topics": {"bsonType": "array"},
            "verdict": {"bsonType": "string", "enum": ["hire", "lean_hire", "no_hire"]},
            "penalties": {
                "bsonType": "object",
                "required": ["tab_switches", "hints_used", "points_deducted"],
                "properties": {
                    "tab_switches": {"bsonType": "int"},
                    "hints_used": {"bsonType": "int"},
                    "points_deducted": {"bsonType": "int"}
                }
            },
            "question_breakdown": {"bsonType": "array"},
            "created_at": {"bsonType": "string"}
        }
    }
}

def up(db):
    db.create_collection("reports", validator=REPORTS_VALIDATOR)
    db.reports.create_index("thread_id", unique=True)
    db.reports.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    logger.info("migration_applied", migration="m006_create_reports")
