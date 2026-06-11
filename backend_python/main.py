import os
import json
from typing import TypedDict, List, Dict, Any, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    max_retries=2,
    api_key=os.environ.get("GROQ_API_KEY")
)

json_llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0.2,
    api_key=os.environ.get("GROQ_API_KEY")
).bind(response_format={"type": "json_object"})

def get_leetcode_difficulty(diff: str) -> str:
    diff = diff.lower()
    if diff == 'basic': return 'LeetCode Easy'
    if diff == 'medium': return 'LeetCode Medium'
    if diff == 'advanced': return 'LeetCode Hard'
    return 'LeetCode Medium'

class InterviewState(TypedDict):
    action: str
    resume_text: str
    difficulty: str
    max_questions: int
    chat_history: List[Dict[str, str]]
    latest_answer: str
    current_round: int
    tab_switches: int
    hint_count: int
    selected_skills: List[str]
    
    output_message: str
    report_data: Optional[Dict[str, Any]]
    hint_message: str

def generate_intro_node(state: InterviewState):
    lc_diff = get_leetcode_difficulty(state.get("difficulty", "medium"))
    resume = state.get("resume_text", "")[:3000]
    max_q = state.get("max_questions", 5)
    skills = ", ".join(state.get("selected_skills", []))
    
    prompt = f"""You are an expert technical interviewer conducting a holistic {max_q}-round interview.
Difficulty Level: {lc_diff}
Resume Context: {resume}
Target Skills: {skills}

Task: This is ROUND 1. Greet the candidate professionally, and immediately ask a "Project Deep-Dive" question based on their resume.
CRITICAL TARGET SKILLS RULE: You MUST focus your question around the Target Skills provided: [{skills}]. Do not ask about other topics.

DIFFICULTY RULES:
- If Difficulty is "LeetCode Easy" (Basic): Keep the question EXTREMELY short and simple (1-2 sentences). Just ask them to define a concept or explain a very basic part of their project.
- If Difficulty is "LeetCode Medium": Ask a standard, moderately challenging question.
- If Difficulty is "LeetCode Hard" (Executive): Ask a highly complex, multi-part question regarding system architecture, trade-offs, or scaling.

Do not ask algorithmic questions yet."""

    response = llm.invoke([HumanMessage(content=prompt)])
    return {"output_message": response.content}

def generate_hint_node(state: InterviewState):
    history = state.get("chat_history", [])
    conv = "\n\n".join([f"{'Candidate' if m['role']=='user' else 'Interviewer'}: {m['content']}" for m in history])
    
    prompt = f"""You are an expert technical interviewer. The candidate is stuck and has requested a hint for the current question.
Conversation History:
{conv}

Task: Look at the most recent question asked by the interviewer. Provide a very brief, subtle hint to nudge the candidate in the right direction. Do NOT give them the direct answer or the full code. 1-2 sentences maximum."""

    response = llm.invoke([HumanMessage(content=prompt)])
    return {"hint_message": response.content}

def evaluate_and_next_node(state: InterviewState):
    lc_diff = get_leetcode_difficulty(state.get("difficulty", "medium"))
    history = state.get("chat_history", [])
    conv = "\n\n".join([f"{'Candidate' if m['role']=='user' else 'Interviewer'}: {m['content']}" for m in history])
    answer = state.get("latest_answer", "")
    current = state.get("current_round", 1)
    skills = ", ".join(state.get("selected_skills", []))
    
    round_type = ((current - 1) % 5) + 1
    round_instruction = ""
    
    if round_type == 1:
        round_instruction = f"This is ROUND {current}: Project Deep-Dive. Ask a challenging question about another project from their resume."
    elif round_type == 2:
        round_instruction = f"This is ROUND {current}: Core Technical Skills. Ask a conceptual/trivia question."
    elif round_type == 3:
        round_instruction = f"This is ROUND {current}: Algorithmic Problem Solving. Ask a classic {lc_diff} algorithmic coding problem. Tell them to provide logic/code and time/space complexity."
    elif round_type == 4:
        round_instruction = f"This is ROUND {current}: Architecture & Scenario. Ask them how they would design a specific system or handle a scaling/architecture scenario relevant to their experience."
    else:
        round_instruction = f"This is ROUND {current}: Behavioral. Ask a classic 'Tell me about a time when...' behavioral question to assess culture fit and soft skills."

    prompt = f"""You are an expert technical interviewer conducting a holistic interview.
Previous Conversation:
{conv}

Candidate's Latest Answer:
{answer}
Target Skills to test: [{skills}]

Task: 
1. FEEDBACK RULE: Evaluate their latest answer. You MUST provide a DETAILED solution explanation. Tell them exactly why they were right or wrong, and provide a clear, detailed code snippet or architectural explanation for the optimal solution. Do not just say "Good job" - explain the core concept thoroughly.
2. NEXT QUESTION RULE: {round_instruction} 
   - CRITICAL TARGET SKILLS RULE: You MUST focus your question around the Target Skills provided: [{skills}]. Do not ask about other technologies.
   - If the difficulty is "LeetCode Easy" (Basic): Keep the next question EXTREMELY short and simple (1-2 sentences maximum). Stick strictly to the basics.
   - If the difficulty is "LeetCode Hard": Make the question rigorous and complex.

CRITICAL RULE AGAINST REPETITION: You MUST review the "Complete Interview Conversation". 
1. Do NOT ask a question that is identical or even slightly similar to any question you have already asked.
2. If this is an Algorithmic/LeetCode round, you are STRICTLY FORBIDDEN from asking a coding problem that has already been asked.

FORMATTING RULE: You MUST format your response with exactly two markdown headers:
### Feedback
(Put your detailed evaluation and optimal solution explanation here)
### Next Question
(Put your next question here)"""

    response = llm.invoke([HumanMessage(content=prompt)])
    return {"output_message": response.content}

def final_review_node(state: InterviewState):
    lc_diff = get_leetcode_difficulty(state.get("difficulty", "medium"))
    resume = state.get("resume_text", "")[:2000]
    history = state.get("chat_history", [])
    conv = "\n\n".join([f"{'Candidate' if m['role']=='user' else 'Interviewer'}: {m['content']}" for m in history])
    answer = state.get("latest_answer", "")
    max_q = state.get("max_questions", 5)
    tab_switches = state.get("tab_switches", 0)
    hint_count = state.get("hint_count", 0)
    
    prompt = f"""You are an expert technical interviewer evaluating a candidate after a comprehensive {max_q}-round interview ({lc_diff} difficulty).
Resume Context: {resume}
Complete Interview Conversation:
{conv}
Candidate's Final Answer:
{answer}
Anti-Cheat System: The candidate switched tabs {tab_switches} times.
Hint System: The candidate requested {hint_count} hints.

Task: The interview is over. Evaluate the candidate's performance holistically across all rounds.
CRITICAL: You MUST severely penalize their overallScore if they switched tabs (deduct ~10 pts per switch) and if they used hints (deduct ~5 pts per hint).

You MUST respond with ONLY a valid JSON object matching this exact structure:
{{
"overallScore": (a number out of 100),
"metrics": {{
    "projectExplanation": "Strong | Average | Weak",
    "technicalKnowledge": "Strong | Average | Weak",
    "problemSolving": "Strong | Average | Weak",
    "communication": "Strong | Average | Weak"
}},
"detailedFeedback": {{
    "whatWentWell": ["2-3 specific points they did well"],
    "whatToImprove": ["2-3 specific areas for improvement (mention tab switches and hints if applicable)"]
}},
"recommendedTopicsToStudy": ["2-3 specific CS/Framework topics to practice"],
"finalVerdict": "Hire | Lean Hire | No Hire",
"questionBreakdown": [
    {{
    "question": "The exact question you asked",
    "candidateAnswer": "Summary of what they answered",
    "correctness": "Correct | Partial | Wrong",
    "detailedExplanation": "A VERY detailed explanation of the optimal, correct answer and why they were right/wrong."
    }}
]
}}"""

    response = json_llm.invoke([HumanMessage(content=prompt)])
    try:
        report_data = json.loads(response.content)
    except json.JSONDecodeError:
        report_data = {"overallScore": 50, "finalVerdict": "Error processing JSON"}
    
    return {"report_data": report_data}

def router(state: InterviewState):
    action = state.get("action")
    if action == "start":
        return "generate_intro_node"
    elif action == "hint":
        return "generate_hint_node"
    elif action == "evaluate":
        return "evaluate_and_next_node"
    elif action == "final":
        return "final_review_node"
    return END

workflow = StateGraph(InterviewState)
workflow.add_node("generate_intro_node", generate_intro_node)
workflow.add_node("generate_hint_node", generate_hint_node)
workflow.add_node("evaluate_and_next_node", evaluate_and_next_node)
workflow.add_node("final_review_node", final_review_node)

workflow.set_conditional_entry_point(router)
workflow.add_edge("generate_intro_node", END)
workflow.add_edge("generate_hint_node", END)
workflow.add_edge("evaluate_and_next_node", END)
workflow.add_edge("final_review_node", END)

app_graph = workflow.compile()


class ExtractSkillsRequest(BaseModel):
    resumeText: str

class GenerateQuestionsRequest(BaseModel):
    resumeText: str
    difficulty: str
    maxQuestions: int
    selectedSkills: List[str]

class HintRequest(BaseModel):
    chatHistory: List[Dict[str, str]]

class EvaluateAnswerRequest(BaseModel):
    resumeText: str
    difficulty: str
    chatHistory: List[Dict[str, str]]
    latestAnswer: str
    isFinalQuestion: bool
    tabSwitches: int
    hintCount: int
    currentRound: int
    maxQuestions: int
    selectedSkills: List[str]

@app.post("/api/extract-skills")
async def api_extract_skills(req: ExtractSkillsRequest):
    prompt = f"""Analyze the following resume and extract the top 10-15 technical skills, frameworks, languages, and tools.
Resume: {req.resumeText[:3000]}

Respond ONLY with a valid JSON object matching this exact structure:
{{
  "skills": ["Skill 1", "Skill 2", "Skill 3"]
}}"""
    
    response = json_llm.invoke([HumanMessage(content=prompt)])
    try:
        data = json.loads(response.content)
        return {"skills": data.get("skills", [])}
    except Exception:
        return {"skills": ["Python", "JavaScript", "React", "Node.js"]}

@app.post("/api/generate-questions")
async def api_generate_questions(req: GenerateQuestionsRequest):
    result = app_graph.invoke({
        "action": "start",
        "resume_text": req.resumeText,
        "difficulty": req.difficulty,
        "max_questions": req.maxQuestions,
        "selected_skills": req.selectedSkills
    })
    return {"message": result["output_message"], "context": "Interview started."}

@app.post("/api/get-hint")
async def api_get_hint(req: HintRequest):
    result = app_graph.invoke({
        "action": "hint",
        "chat_history": req.chatHistory
    })
    return {"hint": result["hint_message"]}

@app.post("/api/evaluate-answer")
async def api_evaluate_answer(req: EvaluateAnswerRequest):
    action = "final" if req.isFinalQuestion else "evaluate"
    
    result = app_graph.invoke({
        "action": action,
        "resume_text": req.resumeText,
        "difficulty": req.difficulty,
        "chat_history": req.chatHistory,
        "latest_answer": req.latestAnswer,
        "is_final_question": req.isFinalQuestion,
        "tab_switches": req.tabSwitches,
        "hint_count": req.hintCount,
        "current_round": req.currentRound,
        "max_questions": req.maxQuestions,
        "selected_skills": req.selectedSkills
    })
    
    if req.isFinalQuestion:
        return {"isReport": True, "reportData": result["report_data"]}
    else:
        return {"message": result["output_message"], "isReport": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
