import os
import structlog
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.db.client import get_db

# Set up dedicated file logger for Tavily
os.makedirs("logs", exist_ok=True)
tavily_file_logger = logging.getLogger("tavily_dedicated")
tavily_file_logger.setLevel(logging.INFO)
if not tavily_file_logger.handlers:
    fh = logging.FileHandler("logs/tavily_search.log", encoding="utf-8")
    fh.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    tavily_file_logger.addHandler(fh)

logger = structlog.get_logger(__name__)

class TavilyService:
    def __init__(self):
        self.api_key = os.getenv("TAVILY_API_KEY")
        self.base_url = "https://api.tavily.com/search"
        if not self.api_key:
            logger.warning("tavily_api_key_missing", message="TAVILY_API_KEY is not set. Searches will fail.")

    async def _execute_search(self, query: str, cache_key: str) -> Optional[Dict[str, Any]]:
        db = get_db()
        # Check cache first
        cached = db.search_cache.find_one({"_id": cache_key})
        if cached:
            # We could check timestamp here for 24-48h invalidation, but for now just returning cached
            tavily_file_logger.info(f"CACHE HIT | Key: {cache_key}")
            return cached.get("result")

        if not self.api_key:
            tavily_file_logger.error(f"API CALL FAILED | Query: {query} | Error: Missing API Key")
            return None
        
        headers = {"Content-Type": "application/json"}
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "basic",
            "include_answer": True,
            "max_results": 3
        }

        try:
            tavily_file_logger.info(f"API CALL START | Query: {query}")
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.base_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                tavily_file_logger.info(f"API CALL SUCCESS | Query: {query} | Received results")
                
                # Save to cache
                db.search_cache.update_one(
                    {"_id": cache_key},
                    {"$set": {"result": data, "created_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True
                )
                return data
        except Exception as e:
            tavily_file_logger.error(f"tavily_search_failed | Query: {query} | Error: {str(e)}")
            return None

    async def search_skill(self, skill: str) -> Optional[Dict[str, Any]]:
        query = f"latest industry developments, best practices, and trending interview topics for {skill}"
        return await self._execute_search(query, f"skill:{skill.lower()}")

    async def search_project(self, project: str) -> Optional[Dict[str, Any]]:
        query = f"current state-of-the-art approaches, alternative architectures, and production considerations for {project}"
        return await self._execute_search(query, f"project:{project.lower()}")

    async def search_role(self, role: str) -> Optional[Dict[str, Any]]:
        query = f"current industry expectations, frequently required technologies, and market-relevant skills for a {role}"
        return await self._execute_search(query, f"role:{role.lower()}")
