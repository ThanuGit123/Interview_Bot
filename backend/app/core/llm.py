import os
import structlog
from langchain_groq import ChatGroq
from langchain_cerebras import ChatCerebras
from langchain_mistralai import ChatMistralAI

logger = structlog.get_logger(__name__)

# Ordered provider pool, built from whatever keys are present in .env.
# Order: Groq (primary) -> Mistral -> Cerebras. Each entry's model is overridable
# via env. A rate-limited/down provider automatically falls through to the next.
_models = []
_initialized = False


def _init():
    global _models, _initialized
    if _initialized:
        return

    groq_key = os.environ.get("GROQ_API_KEY", "")
    mistral_key = os.environ.get("MISTRAL_API", "")
    cerebras_key = os.environ.get("CEREBRAS_API", "")

    if groq_key:
        _models.append(("groq", ChatGroq(
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
            api_key=groq_key, temperature=0.6, max_retries=2)))
    if mistral_key:
        _models.append(("mistral", ChatMistralAI(
            model=os.environ.get("MISTRAL_MODEL", "mistral-large-latest"),
            api_key=mistral_key, temperature=0.6, max_retries=2)))
    if cerebras_key:
        _models.append(("cerebras", ChatCerebras(
            model=os.environ.get("CEREBRAS_MODEL", "gpt-oss-120b"),
            api_key=cerebras_key, temperature=0.6, max_retries=2)))

    if not _models:
        raise ValueError("No LLM API keys provided. Set GROQ_API_KEY / MISTRAL_API / CEREBRAS_API.")

    _initialized = True
    logger.info("llm_pool_initialized", pool=[name for name, _ in _models])


def _chat_models():
    _init()
    return [m for _, m in _models]


def get_llm():
    """Chat model with the provider fallback chain (no tools)."""
    models = _chat_models()
    return models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]


def get_llm_with_tools(tools):
    """Tool-bound chat model. Binds tools to each provider BEFORE wrapping
    with_fallbacks, so fallbacks retain tool-calling."""
    bound = [m.bind_tools(tools) for m in _chat_models()]
    return bound[0].with_fallbacks(bound[1:]) if len(bound) > 1 else bound[0]
