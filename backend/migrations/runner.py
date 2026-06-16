"""Migration runner."""
import os
import importlib
import structlog
from datetime import datetime, timezone
from app.db.client import get_db

logger = structlog.get_logger(__name__)

def run_migrations():
    db = get_db()
    
    # Ensure schema_migrations collection exists
    if "schema_migrations" not in db.list_collection_names():
        db.create_collection("schema_migrations")
    
    # Get applied migrations
    applied_docs = db.schema_migrations.find()
    applied_ids = {doc["_id"] for doc in applied_docs}
    
    # Find migration files
    migrations_dir = os.path.dirname(__file__)
    files = sorted([f for f in os.listdir(migrations_dir) if f.startswith("m") and f.endswith(".py")])
    
    pending = [f for f in files if f[:-3] not in applied_ids]
    
    logger.info("migrations_start", pending=len(pending))
    
    applied_count = 0
    for file in pending:
        migration_id = file[:-3]
        module_name = f"migrations.{migration_id}"
        module = importlib.import_module(module_name)
        
        try:
            module.up(db)
            db.schema_migrations.insert_one({
                "_id": migration_id,
                "applied_at": datetime.now(timezone.utc).isoformat()
            })
            applied_count += 1
        except Exception as e:
            logger.error("migration_failed", migration=migration_id, error=str(e))
            raise e
            
    skipped_count = len(files) - applied_count
    logger.info("migrations_done", applied=applied_count, skipped=skipped_count)

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    run_migrations()
