import os
import re
import uuid
import asyncio
import structlog
import jwt
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from langchain_core.runnables import RunnableConfig

from app.db.client import get_db
from app.core.security import JWT_SECRET, ALGORITHM
from app.agent.graph import graph
from app.core.context import build_context, trigger_summary_if_needed, maybe_generate_title
from app.db import repositories as repo

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/ws", tags=["websocket"])

PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "agent.md")

TOOL_STATUS = {
    "get_resume_text": "Reading your resume…",
    "list_asked_questions": "Reviewing what we've covered…",
    "record_round_grade": "Noting your performance…",
}


def _now():
    return datetime.now(timezone.utc).isoformat()


_TOOL_NAMES = r"(?:list_asked_questions|get_resume_text|record_round_grade|function|tool_call|invoke|parameter)"


def _clean_reply(text: str) -> str:
    """Defensively strip artifacts a small model can emit as text: leaked tool-call
    tags/syntax and standby filler. The agent runs tool-less, but this guarantees a
    clean chat even if the model hallucinates tool syntax."""
    if not text:
        return ""
    import re
    # <list_asked_questions>...</list_asked_questions>, <|function...|>, <invoke ...> etc.
    text = re.sub(rf"<\|?/?\s*{_TOOL_NAMES}[^>]*\|?>", "", text, flags=re.IGNORECASE)
    # stray "*list_asked_questions>" / "[record_round_grade]" / "record_round_grade(...)"
    text = re.sub(rf"[*\[(]?\s*\b{_TOOL_NAMES}\b\s*\([^)]*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(rf"[*\[(]?\s*\b{_TOOL_NAMES}\b\s*[>\])]?", "", text, flags=re.IGNORECASE)
    # standby / waiting filler
    text = re.sub(r"\(?\s*waiting for your response\s*[.…]*\s*\)?", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?im)^\s*also,?\s*i'?ll list the questions already asked.*$", "", text)
    # collapse excess blank lines left behind
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _load_system_prompt():
    try:
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return "You are Caliber, a senior engineer who reviews resumes and runs mock interviews."


@router.websocket("/threads/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str, token: str = Query(...)):
    # 1. Verify token BEFORE accept
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4401)
            return
    except Exception as e:
        logger.warning("ws_auth_failed", error=str(e))
        await websocket.close(code=4401)
        return

    # 2. Verify thread ownership (scoped + soft-delete aware)
    thread = repo.get_thread(user_id, thread_id)
    if not thread:
        logger.warning("ws_thread_unauthorized", thread_id=thread_id)
        await websocket.close(code=4401)
        return

    await websocket.accept()
    structlog.contextvars.bind_contextvars(user_id=user_id, thread_id=thread_id)
    logger.info("ws_connected")

    queue = asyncio.Queue()

    # Consumer: drains the queue to the socket, with a 15s heartbeat ping.
    async def consumer():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if event is None:
                        break
                    await websocket.send_json(event)
                except asyncio.TimeoutError:
                    await websocket.send_json({"event_type": "ping", "thread_id": thread_id, "data": {}})
        except Exception as e:
            logger.error("ws_consumer_error", error=str(e))

    consumer_task = asyncio.create_task(consumer())

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") != "answer":
                continue
            text = (data.get("text") or "").strip()
            if not text:
                continue

            # Persist the user message first (so nothing is lost if we crash).
            attach_meta = None
            rid = data.get("resume_id")
            if rid:
                r = repo.get_resume(user_id, rid)
                if r:
                    attach_meta = {"attachment": {"resume_id": rid, "filename": r.get("filename")}}
            repo.insert_message(thread_id, user_id, "user", text, metadata=attach_meta)

            thread_fresh = repo.get_thread(user_id, thread_id)
            if not thread_fresh:
                continue
            repo.update_thread(user_id, thread_id, {} if thread_fresh.get("title") else {"title": text[:40]})

            # Assemble context: system prompt + summary + history + dynamic (resume) + current turn.
            system_prompt = _load_system_prompt()
            all_msgs = repo.list_messages(thread_id, user_id)
            history_msgs = all_msgs[:-1] if all_msgs else []

            resume = repo.get_resume(user_id, thread_fresh["resume_id"]) if thread_fresh.get("resume_id") else None

            if resume:
                dynamic_context = (
                    "A resume IS attached to this conversation. Use it to ground every claim.\n"
                    'Resume text:\n"""\n' + (resume.get("extracted_text", "")[:12000]) + '\n"""'
                )
            else:
                dynamic_context = (
                    "No resume is attached yet. If the user wants resume analysis or a "
                    "resume-grounded interview, ask them to upload one with the 📎 button."
                )

            messages = build_context(
                system_prompt=system_prompt,
                running_summary=thread_fresh.get("running_summary", ""),
                messages=history_msgs,
                dynamic_context=dynamic_context,
                current_answer=text,
            )

            state = {"messages": messages, "thread_id": thread_id, "user_id": user_id}
            config = RunnableConfig(
                configurable={"user_id": user_id, "thread_id": thread_id},
                recursion_limit=12,
            )

            async def run_graph():
                final_content = ""
                try:
                    async for event in graph.astream_events(state, config, version="v2"):
                        kind = event["event"]
                        if kind == "on_chat_model_stream":
                            chunk = event["data"]["chunk"].content
                            if not chunk:
                                continue
                            if isinstance(chunk, str):
                                final_content += chunk
                                await queue.put({"event_type": "token", "thread_id": thread_id, "data": {"delta": chunk}})
                            elif isinstance(chunk, list):
                                for c in chunk:
                                    if isinstance(c, dict) and c.get("type") == "text":
                                        tv = c.get("text", "")
                                        final_content += tv
                                        await queue.put({"event_type": "token", "thread_id": thread_id, "data": {"delta": tv}})
                        elif kind == "on_tool_start":
                            name = event.get("name", "")
                            await queue.put({
                                "event_type": "status",
                                "thread_id": thread_id,
                                "data": {"message": TOOL_STATUS.get(name, f"Working ({name})…")},
                            })

                    # Defensive cleanup of any leaked tool syntax / standby filler.
                    final_content = _clean_reply(final_content)
                    if not final_content:
                        final_content = "Sorry — I couldn't generate a response. Please try again."

                    asst = repo.insert_message(thread_id, user_id, "assistant", final_content)
                    msg_id = asst["_id"]
                    repo.update_thread(user_id, thread_id, {})  # bump updated_at

                    await queue.put({
                        "event_type": "message_complete",
                        "thread_id": thread_id,
                        "data": {"message_id": msg_id, "content": final_content},
                    })

                    # Auto-name the conversation from the first exchange.
                    new_title = await maybe_generate_title(thread_id, user_id)
                    if new_title:
                        await queue.put({
                            "event_type": "title_update",
                            "thread_id": thread_id,
                            "data": {"title": new_title},
                        })

                    # Background, non-blocking: roll up older messages once over threshold.
                    fresh = repo.get_thread(user_id, thread_id)
                    msg_count = repo.count_messages(thread_id, user_id)
                    trigger_summary_if_needed(thread_id, user_id, msg_count, (fresh or {}).get("summary_covers_until", 0))
                except Exception as e:
                    logger.error("graph_execution_failed", error=str(e))
                    await queue.put({
                        "event_type": "error",
                        "thread_id": thread_id,
                        "data": {"error": True, "code": "GRAPH_ERROR", "message": "The assistant hit an error. Please try again."},
                    })

            asyncio.create_task(run_graph())

    except WebSocketDisconnect:
        logger.info("ws_disconnected")
    except Exception as e:
        logger.error("ws_error", error=str(e))
    finally:
        await queue.put(None)
        await consumer_task
