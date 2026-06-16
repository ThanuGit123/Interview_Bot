import os
import structlog
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.language_models.chat_models import BaseChatModel

logger = structlog.get_logger(__name__)

_pool = None

def get_llm() -> BaseChatModel:
    global _pool
    if _pool is not None:
        return _pool
        
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
    
    primary = None
    if groq_api_key:
        primary = ChatGroq(
            model="llama-3.1-8b-instant",
            api_key=groq_api_key,
            temperature=0.7,
            max_retries=2
        )
        
    fallback = None
    if gemini_api_key:
        fallback = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            api_key=gemini_api_key,
            temperature=0.7,
            max_retries=2
        )
        
    if primary and fallback:
        _pool = primary.with_fallbacks([fallback])
    elif primary:
        _pool = primary
    elif fallback:
        _pool = fallback
    else:
        # Fallback to something locally if needed or raise
        raise ValueError("No LLM API keys provided. Set GROQ_API_KEY or GEMINI_API_KEY.")
        
    logger.info("llm_pool_initialized", primary_set=bool(primary), fallback_set=bool(fallback))
    return _pool
