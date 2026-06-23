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
    current_answer: str,
    user_profile_context: str = ""
) -> list:
    """
    Assembles the exact 5-part prompt structure according to cache discipline.
    """
    # 1. System Prompt (Static)
    final_messages = [SystemMessage(content=system_prompt)]
    
    # 1.5. User Profile Context
    if user_profile_context:
        final_messages.append(SystemMessage(content=f"User Context:\n{user_profile_context}"))
        
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

SUMMARY_PROMPT = """You maintain a concise running memory of a chat between a candidate and Caliber (an AI interview & resume coach).
Merge the OLD SUMMARY with the NEW MESSAGES into one updated summary, 4-8 sentences, past tense.
KEEP: topics discussed, facts established from the resume, interview questions asked and how the candidate performed, strengths/weaknesses shown, and anything still pending.
DROP: greetings, filler, raw code dumps.

OLD SUMMARY:
{old}

NEW MESSAGES:
{new}

Updated running summary:"""


async def update_summary_task(thread_id: str, user_id: str):
    """Background, non-blocking: compress older messages into threads.running_summary.

    Window = messages from summary_covers_until up to len-KEEP_RECENT (the most
    recent KEEP_RECENT stay verbatim in context). Uses the LLM pool's cheapest path.
    """
    from app.db.client import get_db
    from app.core.llm import get_llm

    logger.info("summary_task_started", thread_id=thread_id)
    try:
        db = get_db()
        thread = db.threads.find_one({"_id": thread_id, "user_id": user_id})
        if not thread:
            return
        covered = thread.get("summary_covers_until", 0)
        msgs = list(db.messages.find({"thread_id": thread_id, "user_id": user_id}).sort("created_at", 1))
        window_end = max(0, len(msgs) - KEEP_RECENT)
        window = msgs[covered:window_end]
        if not window:
            return

        rendered = "\n".join(
            f"{'Candidate' if m.get('role') == 'user' else 'Caliber'}: {m.get('content', '')}" for m in window
        )
        prompt = SUMMARY_PROMPT.format(old=thread.get("running_summary") or "(none yet)", new=rendered[:8000])
        resp = await get_llm().ainvoke([SystemMessage(content=prompt)])
        new_summary = (resp.content or "").strip()
        if not new_summary:
            return
        db.threads.update_one(
            {"_id": thread_id, "user_id": user_id},
            {"$set": {"running_summary": new_summary, "summary_covers_until": window_end}},
        )
        logger.info("summary_updated", thread_id=thread_id, covers_until=window_end, tokens=count_tokens(new_summary))
    except Exception as e:
        # Summary is "color", never truth — a failure must never break the chat.
        logger.warning("summary_failed", thread_id=thread_id, error=str(e))


def trigger_summary_if_needed(thread_id: str, user_id: str, message_count: int, summary_covers_until: int):
    """Spawn the summary task when unsummarized messages exceed the threshold."""
    if message_count - summary_covers_until > SUMMARY_THRESHOLD:
        asyncio.create_task(update_summary_task(thread_id, user_id))


async def maybe_generate_title(thread_id: str, user_id: str):
    """Generate a concise conversation title from the first exchange (once per thread).

    Returns the new title (str) if generated, else None. Avoids naive titles like "hi".
    """
    from app.db import repositories as repo
    from app.core.llm import get_llm

    thread = repo.get_thread(user_id, thread_id)
    if not thread or thread.get("title_generated"):
        return None
    msgs = repo.list_messages(thread_id, user_id)
    if len(msgs) < 2:  # need at least one user + one assistant turn
        return None

    convo = "\n".join(f"{m.get('role')}: {m.get('content', '')[:300]}" for m in msgs[:4])
    prompt = (
        "Generate a SHORT 3-6 word title that summarizes what this conversation is about. "
        "No quotes, no trailing punctuation, Title Case. If it's a resume review say e.g. "
        "'Resume Review – Backend'. Conversation:\n\n" + convo + "\n\nTitle:"
    )
    try:
        resp = await get_llm().ainvoke([SystemMessage(content=prompt)])
        title = (resp.content or "").strip().strip('"').strip().splitlines()[0][:60]
        if title:
            repo.update_thread(user_id, thread_id, {"title": title, "title_generated": True})
            logger.info("title_generated", thread_id=thread_id, title=title)
            return title
    except Exception as e:
        logger.warning("title_gen_failed", thread_id=thread_id, error=str(e))
    return None
