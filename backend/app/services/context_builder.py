import asyncio
from typing import List, Dict, Any, Optional
from app.services.tavily_service import TavilyService
import structlog

logger = structlog.get_logger(__name__)

class SearchContextBuilder:
    def __init__(self):
        self.tavily = TavilyService()

    def _normalize_result(self, result: Optional[Dict[str, Any]]) -> str:
        if not result:
            return ""
        
        answer = result.get("answer")
        if answer:
            return answer
        
        snippets = []
        for res in result.get("results", []):
            snippet = res.get("content", "").strip()
            if snippet:
                snippets.append(snippet)
        return "\n".join(snippets)

    async def build_context(self, skills: List[str], projects: List[str], role: str) -> Dict[str, List[str]]:
        logger.info("building_search_context", skills=len(skills), projects=len(projects), role=role)
        
        skills_context = []
        project_context = []
        industry_context = []

        tasks = []
        
        if role:
            tasks.append(("role", role, self.tavily.search_role(role)))
            
        for skill in skills[:5]:
            tasks.append(("skill", skill, self.tavily.search_skill(skill)))
            
        for proj in projects[:3]:
            tasks.append(("project", proj, self.tavily.search_project(proj)))
            
        if not tasks:
            return {
                "skills_context": [],
                "project_context": [],
                "industry_context": []
            }

        coroutines = [t[2] for t in tasks]
        results = await asyncio.gather(*coroutines, return_exceptions=True)
        
        for idx, (task_type, task_name, _) in enumerate(tasks):
            res = results[idx]
            if isinstance(res, Exception):
                logger.warning("tavily_task_failed", task_type=task_type, task_name=task_name, error=str(res))
                continue
                
            normalized = self._normalize_result(res)
            if not normalized:
                continue
                
            if task_type == "role":
                industry_context.append(f"Role ({task_name}): {normalized}")
            elif task_type == "skill":
                skills_context.append(f"Skill ({task_name}): {normalized}")
            elif task_type == "project":
                project_context.append(f"Project ({task_name}): {normalized}")

        return {
            "skills_context": skills_context,
            "project_context": project_context,
            "industry_context": industry_context
        }
