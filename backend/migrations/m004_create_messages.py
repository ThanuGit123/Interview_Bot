"""Create messages collection with validator and indexes."""
import structlog
from pymongo import ASCENDING

logger = structlog.get_logger(__name__)

MESSAGES_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "thread_id", "user_id", "role", "content", "created_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "thread_id": {"bsonType": "string"},
            "user_id": {"bsonType": "string"},
            "role": {"bsonType": "string", "enum": ["user", "assistant", "system"]},
            "content": {"bsonType": "string"},
            "metadata": {"bsonType": ["object", "null"]},
            "created_at": {"bsonType": "string"}
        }
    }
}

def up(db):
    db.create_collection("messages", validator=MESSAGES_VALIDATOR)
    db.messages.create_index([("thread_id", ASCENDING), ("created_at", ASCENDING)])
    db.messages.create_index("user_id")
    logger.info("migration_applied", migration="m004_create_messages")
