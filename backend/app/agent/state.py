"""LangGraph state for the Caliber chat agent (single tool-calling loop)."""
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages


class InterviewAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    thread_id: str
    user_id: str
