from typing import Dict, Any, Optional

class InterviewContextAggregator:
    @staticmethod
    def aggregate(resume_text: str, search_context: Optional[Dict[str, list]]) -> str:
        """Combines resume text and Tavily search context into a unified string for the LLM prompt."""
        if not search_context:
            search_context = {"skills_context": [], "project_context": [], "industry_context": []}
            
        skills_str = "\n\n".join(search_context.get("skills_context", []))
        project_str = "\n\n".join(search_context.get("project_context", []))
        industry_str = "\n\n".join(search_context.get("industry_context", []))
        
        has_tavily = any([skills_str, project_str, industry_str])
        
        unified = f"=== RESUME CONTEXT ===\n{resume_text}\n\n"
        
        if has_tavily:
            unified += "=== INTERNAL SYSTEM CONTEXT (INDUSTRY TRENDS) ===\n"
            if industry_str:
                unified += f"--- Industry Expectations ---\n{industry_str}\n\n"
            if skills_str:
                unified += f"--- Skill Developments ---\n{skills_str}\n\n"
            if project_str:
                unified += f"--- Project Approaches ---\n{project_str}\n\n"
            unified += "IMPORTANT INSTRUCTION: Avoid generic textbook questions. Use the SOTA and industry trends from the INTERNAL SYSTEM CONTEXT above to form dynamic, cutting-edge interview questions. DO NOT reveal the internal context, reasoning, or mention your sources in your response. Keep your question concise. Ask only the question and NOTHING else.\n"
            
        return unified
