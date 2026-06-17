"""Caliber agent — a single tool-calling loop.

The model decides everything (general chat, resume analysis/ATS, adaptive
interviewing); tools execute side effects. No hardcoded round logic.
Loop: agent -> (tools -> agent)* -> END, bounded by recursion_limit.
"""
import structlog
from typing import Literal
from langgraph.graph import StateGraph, END
from langchain_core.messages import ToolMessage

from app.agent.state import InterviewAgentState
from app.agent.tools import agent_tools
from app.core.llm import get_llm_with_tools, get_llm

logger = structlog.get_logger(__name__)

_tools_by_name = {t.name: t for t in agent_tools}


def agent_node(state: InterviewAgentState, config) -> dict:
    logger.info("agent_node_start", messages=len(state["messages"]))
    llm = get_llm_with_tools(agent_tools) if agent_tools else get_llm()
    response = llm.invoke(state["messages"], config=config)
    return {"messages": [response]}


def tool_node(state: InterviewAgentState, config) -> dict:
    last = state["messages"][-1]
    outputs = []
    for tc in getattr(last, "tool_calls", []) or []:
        tool = _tools_by_name.get(tc["name"])
        logger.info("tool_call", tool=tc["name"])
        if tool is None:
            outputs.append(ToolMessage(content=f"Unknown tool: {tc['name']}", tool_call_id=tc["id"]))
            continue
        try:
            outputs.append(tool.invoke(tc, config=config))
        except Exception as e:  # tools must never crash the graph
            logger.warning("tool_failed", tool=tc["name"], error=str(e))
            outputs.append(ToolMessage(content=f"Tool error: {e}", tool_call_id=tc["id"]))
    return {"messages": outputs}


def route(state: InterviewAgentState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END


builder = StateGraph(InterviewAgentState)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)
builder.set_entry_point("agent")
builder.add_conditional_edges("agent", route, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")

graph = builder.compile()
