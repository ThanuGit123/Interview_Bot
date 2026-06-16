import os
import structlog
from pymongo import MongoClient

logger = structlog.get_logger(__name__)
_client: MongoClient | None = None

import certifi

def get_db():
    global _client
    if _client is None:
        _client = MongoClient(os.environ["MONGODB_URI"], tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")  # fail loudly at startup, not on first query
        logger.info("mongodb_connected", db=os.environ["MONGODB_DB"])
    return _client[os.environ["MONGODB_DB"]]
