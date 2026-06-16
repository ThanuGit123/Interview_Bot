import structlog
from typing import Literal
from pydantic import BaseModel
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, AIMessage, HumanMessage, ToolMessage
from app.agent.state import InterviewAgentState
from app.agent.tools import agent_tools
from app.core.llm import get_llm

logger = structlog.get_logger(__name__)

from pydantic import BaseModel, Field

class PlanOutput(BaseModel):
    round_type: str = Field(description="The type of the next round")
    target_skill: str = Field(description="The skill to test next")
    difficulty_note: str = Field(description="Note on the difficulty level")
    follow_up: bool = Field(description="Set to true (boolean, not string) if the next question should be a follow-up, false otherwise")

class ReflectOutput(BaseModel):
    ok: bool = Field(description="true (boolean) if the draft is good, false if it has problems")
    problems: list[str] = Field(description="List of problems found in the draft, if any")

def plan_node(state: InterviewAgentState, config) -> dict:
    logger.info("node_start", node="plan")
    llm = get_llm().with_structured_output(PlanOutput)
    
    prompt = """Analyze the candidate's last answer and decide the next move. Does it need a follow-up, or should we move to the next round?
CRITICAL INTERVIEW CONDUCTION RULES:
You MUST enforce the following distribution across the entire interview:
- 50% Skill-based: Theoretical/practical questions on their exact resume skills.
- 30% Project-based: Deep dives into project architecture, decision-making, and metrics.
- 20% Problem-solving: Coding/Algorithm questions (e.g., Two Sum, Merge Intervals).
Plan the 'round_type' accordingly to ensure this distribution is met."""
    
    messages = state["messages"] + [SystemMessage(content=prompt)]
    
    try:
        result = llm.invoke(messages, config=config)
    except Exception as e:
        logger.warning("plan_failed", error=str(e))
        # Fallback plan to prevent crash
        result = PlanOutput(round_type="technical", target_skill="General", difficulty_note="Proceed normally", follow_up=False)
        
    logger.info("node_end", node="plan", follow_up=result.follow_up)
    return {"plan": result.model_dump()}

def act_node(state: InterviewAgentState, config) -> dict:
    logger.info("node_start", node="act", retry_count=state.get("retry_count", 0))
    llm = get_llm().bind_tools(agent_tools)
    
    messages = state["messages"].copy()
    
    if state.get("plan"):
        plan = state["plan"]
        plan_prompt = f"EXECUTION PLAN:\nTarget Skill: {plan.get('target_skill')}\nRound Type: {plan.get('round_type')}\nFollow-up: {plan.get('follow_up')}\nDifficulty Note: {plan.get('difficulty_note')}\n\nYou MUST ask a question that exactly matches this plan. Do NOT deviate."
        messages.append(SystemMessage(content=plan_prompt))
        
    # Inject retry problems if applicable
    if state.get("retry_count", 0) > 0 and state.get("reflection"):
        problems = ", ".join(state["reflection"]["problems"])
        retry_prompt = f"Your previous draft was rejected. Fix these problems: {problems}"
        messages.append(SystemMessage(content=retry_prompt))
        
    # Internal tool loop to resolve all tools before yielding a final string draft
    while True:
        try:
            response = llm.invoke(messages, config=config)
        except Exception as e:
            logger.warning("act_failed", error=str(e))
            draft = "I encountered an error trying to process that. Could you please clarify your answer?"
            break
            
        messages.append(response)
        
        if not response.tool_calls:
            # LLM provided a final text response
            draft = response.content
            break
            
        # Execute tools synchronously
        for tool_call in response.tool_calls:
            tool = next((t for t in agent_tools if t.name == tool_call["name"]), None)
            if tool:
                logger.debug("executing_tool", tool=tool.name)
                # the tool receives config which contains user_id and thread_id injected via metadata
                tool_msg = tool.invoke(tool_call, config=config)
                messages.append(tool_msg)
            else:
                messages.append(ToolMessage(content="Unknown tool", tool_call_id=tool_call["id"]))
                
    logger.info("node_end", node="act")
    return {"draft": draft}

def reflect_node(state: InterviewAgentState, config) -> dict:
    logger.info("node_start", node="reflect")
    llm = get_llm().with_structured_output(ReflectOutput)
    
    draft = state.get("draft", "")
    prompt = f"Review the following draft reply:\n\n{draft}\n\nCheck against criteria: No leaking answers, no repeating questions. Is it ok? Output strict JSON with 'ok' and 'problems'."
    
    # Reflection only looks at the draft
    messages = [SystemMessage(content=prompt)]
    
    try:
        result = llm.invoke(messages, config=config)
    except Exception as e:
        logger.warning("reflect_failed", error=str(e))
        result = ReflectOutput(ok=True, problems=[])
        
    logger.info("node_end", node="reflect", ok=result.ok)
    return {"reflection": result.model_dump()}

def should_continue(state: InterviewAgentState) -> Literal["act", "__end__"]:
    reflection = state.get("reflection", {"ok": True})
    retry_count = state.get("retry_count", 0)
    
    if reflection.get("ok"):
        return END
    
    if retry_count == 0:
        return "act"
        
    return END

def increment_retry_count(state: InterviewAgentState) -> dict:
    """Helper node to increment retry count before looping back to act."""
    return {"retry_count": state.get("retry_count", 0) + 1}

# Build Graph
builder = StateGraph(InterviewAgentState)
builder.add_node("plan", plan_node)
builder.add_node("act", act_node)
builder.add_node("reflect", reflect_node)
builder.add_node("increment_retry", increment_retry_count)

builder.set_entry_point("plan")
builder.add_edge("plan", "act")
builder.add_edge("act", "reflect")
builder.add_conditional_edges("reflect", should_continue, {
    "act": "increment_retry",
    "__end__": END
})
builder.add_edge("increment_retry", "act")

graph = builder.compile()
