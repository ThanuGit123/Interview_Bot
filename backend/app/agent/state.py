"""LangGraph state definition for the interview agent."""
from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages

class InterviewAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    thread_id: str
    user_id: str
    thread_type: str        # "interview" | "coaching"
    
    plan: Optional[dict]              # output of plan node
    draft: Optional[str]              # output of act node
    reflection: Optional[dict]        # output of reflect node
    retry_count: int
