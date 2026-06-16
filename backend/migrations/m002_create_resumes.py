"""Create resumes collection with validator and user_id index."""
import structlog

logger = structlog.get_logger(__name__)

RESUMES_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "user_id", "filename", "file_type", "extracted_text", "created_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "user_id": {"bsonType": "string"},
            "filename": {"bsonType": "string"},
            "file_type": {"bsonType": "string"},
            "extracted_text": {"bsonType": "string"},
            "created_at": {"bsonType": "string"}
        }
    }
}

def up(db):
    db.create_collection("resumes", validator=RESUMES_VALIDATOR)
    db.resumes.create_index("user_id")
    logger.info("migration_applied", migration="m002_create_resumes")
