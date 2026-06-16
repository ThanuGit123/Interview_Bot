import tiktoken
import structlog
import asyncio
from app.core.config import MAX_HISTORY_MESSAGES, MAX_HISTORY_TOKENS, SUMMARY_THRESHOLD, KEEP_RECENT
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

logger = structlog.get_logger(__name__)

# o200k_base serves as a fast, reasonable approximation across model providers
_encoder = tiktoken.get_encoding("o200k_base")

def count_tokens(text: str) -> int:
    """Return the number of tokens in a text string."""
    if not text:
        return 0
    return len(_encoder.encode(text))

def count_message_tokens(message) -> int:
    """Return tokens in a Langchain message, plus overhead."""
    return count_tokens(message.content) + 4

def build_context(
    system_prompt: str,
    running_summary: str,
    messages: list,
    dynamic_context: str,
    current_answer: str
) -> list:
    """
    Assembles the exact 5-part prompt structure according to cache discipline.
    """
    # 1. System Prompt (Static)
    final_messages = [SystemMessage(content=system_prompt)]
    
    # 2. Running Summary
    if running_summary:
        final_messages.append(SystemMessage(content=f"Conversation so far: {running_summary}"))
        
    # 3. Trimmed history
    # First, trim by count
    recent_messages = messages[-MAX_HISTORY_MESSAGES:] if len(messages) > MAX_HISTORY_MESSAGES else messages
    
    lc_recent = []
    for m in recent_messages:
        # Ignore hint metadata if we filter it out earlier, or do it here
        # (Assuming the caller filtered out UI-only messages already)
        if m.get("role") == "user":
            lc_recent.append(HumanMessage(content=m.get("content", "")))
        else:
            lc_recent.append(AIMessage(content=m.get("content", "")))
            
    # Second, trim by tokens (preserving at least KEEP_RECENT)
    total_history_tokens = sum(count_message_tokens(m) for m in lc_recent)
    while total_history_tokens > MAX_HISTORY_TOKENS and len(lc_recent) > KEEP_RECENT:
        removed = lc_recent.pop(0)
        total_history_tokens -= count_message_tokens(removed)
        
    final_messages.extend(lc_recent)
    
    # 4. Dynamic Context
    final_messages.append(SystemMessage(content=f"Dynamic context:\n{dynamic_context}"))
    
    # 5. Current human answer
    final_messages.append(HumanMessage(content=current_answer))
    
    total_tokens = sum(count_message_tokens(m) for m in final_messages)
    logger.debug("context_assembled", history_kept=len(lc_recent), total_tokens=total_tokens)
    
    return final_messages

async def update_summary_task(thread_id: str, user_id: str):
    """
    Background task to summarize older messages.
    Stubbed for now until LLM pool is wired in Part 5.
    """
    logger.info("summary_task_started", thread_id=thread_id)
    # Placeholder for the actual DB fetch and LLM call
    await asyncio.sleep(0.1) 
    logger.info("summary_task_completed", thread_id=thread_id, covers_until=0, tokens=0)

def trigger_summary_if_needed(thread_id: str, user_id: str, message_count: int, summary_covers_until: int):
    """
    Checks if unsummarized messages exceed the threshold and spawns a background task.
    """
    if message_count - summary_covers_until > SUMMARY_THRESHOLD:
        asyncio.create_task(update_summary_task(thread_id, user_id))
