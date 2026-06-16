"""Create users collection with validator and unique email index."""
import structlog

logger = structlog.get_logger(__name__)

USERS_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "email", "password_hash", "created_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "email": {"bsonType": "string"},
            "password_hash": {"bsonType": "string"},
            "name": {"bsonType": "string"},
            "created_at": {"bsonType": "string"},
            "updated_at": {"bsonType": "string"}
        }
    }
}

def up(db):
    db.create_collection("users", validator=USERS_VALIDATOR)
    db.users.create_index("email", unique=True)
    logger.info("migration_applied", migration="m001_create_users")
