import json
import uuid
import asyncio
import structlog
import jwt
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.db.client import get_db
from app.core.security import JWT_SECRET, ALGORITHM
from app.agent.graph import graph
from app.core.context import build_context
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage
from app.core.llm import get_llm

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/ws", tags=["websocket"])

TOOL_STATUS_MESSAGES = {
    "get_resume_text": "Reading your resume...",
    "list_asked_questions": "Checking conversation history...",
    "record_round_grade": "Noting your score...",
    "record_hint_given": "Recording hint..."
}

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
        
    db = get_db()
    # 2. Verify thread ownership
    thread = db.threads.find_one({"_id": thread_id, "user_id": user_id})
    if not thread:
        logger.warning("ws_thread_not_found_or_unauthorized", thread_id=thread_id, user_id=user_id)
        await websocket.close(code=4401)
        return
        
    await websocket.accept()
    structlog.contextvars.bind_contextvars(user_id=user_id, thread_id=thread_id)
    logger.info("ws_connected")
    
    # 3. Queue for outgoing events
    queue = asyncio.Queue()
    
    # Consumer task: pulls from queue and sends to socket
    async def consumer():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if event is None:
                        break # poison pill
                    await websocket.send_json(event)
                except asyncio.TimeoutError:
                    # Send ping heartbeat
                    await websocket.send_json({"event_type": "ping", "thread_id": thread_id, "data": {}})
                except Exception as e:
                    logger.error("ws_send_error", error=str(e))
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error("ws_consumer_error", error=str(e))
            
    consumer_task = asyncio.create_task(consumer())
    
    try:
        while True:
            # Receive JSON from client
            data = await websocket.receive_json()
            action = data.get("action")
            
            thread_fresh = db.threads.find_one({"_id": thread_id, "user_id": user_id})
            thread_type = thread_fresh.get("type", "interview")
            
            if action == "hint":
                if thread_type == "interview":
                    # Update DB
                    db.threads.update_one({"_id": thread_id, "user_id": user_id}, {"$inc": {"counters.hints_used": 1}})
                    thread_fresh = db.threads.find_one({"_id": thread_id, "user_id": user_id})
                    await queue.put({
                        "event_type": "penalty",
                        "thread_id": thread_id,
                        "data": {"kind": "hint", "counters": thread_fresh.get("counters", {})}
                    })
                    # For phase 6 learning, we just send a mock hint reply, but ideally this calls LLM
                    await queue.put({
                        "event_type": "message_complete",
                        "thread_id": thread_id,
                        "data": {"content": "Hint: Focus on the core mechanics."}
                    })
                
            elif action == "tab_switch":
                if thread_type == "interview":
                    db.threads.update_one({"_id": thread_id, "user_id": user_id}, {"$inc": {"counters.tab_switches": 1}})
                    thread_fresh = db.threads.find_one({"_id": thread_id, "user_id": user_id})
                    await queue.put({
                        "event_type": "penalty",
                        "thread_id": thread_id,
                        "data": {"kind": "tab_switch", "counters": thread_fresh.get("counters", {})}
                    })
                
            elif action == "answer":
                text = data.get("text", "")
                
                # Update messages collection (user)
                db.messages.insert_one({
                    "_id": str(uuid.uuid4()),
                    "thread_id": thread_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": text,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                import os
                prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "interviewer.md")
                system_prompt = "You are an interviewer."
                if os.path.exists(prompt_path):
                    with open(prompt_path, "r", encoding="utf-8") as f:
                        system_prompt = f.read()
                        
                db_msgs = list(db.messages.find({"thread_id": thread_id}).sort("created_at", 1))
                history_msgs = db_msgs[:-1] if db_msgs else []
                
                resume = db.resumes.find_one({"_id": thread_fresh.get("resume_id")}) if thread_fresh.get("resume_id") else None
                resume_text = resume.get("extracted_text", "No resume provided.") if resume else "No resume provided."
                
                asked_questions = thread_fresh.get("asked_questions", [])
                current_round = len(asked_questions) + 1
                difficulty = thread_fresh.get("difficulty", "medium")
                max_q = difficulty == "hard" and 7 or 5 # rough default
                selected_skills = thread_fresh.get("skills", [])
                
                if thread_type == "interview" and current_round > max_q:
                    # Trigger proper stop instead of running LLM
                    msg_id = str(uuid.uuid4())
                    final_msg = "Thank you for your time. This officially concludes our interview."
                    
                    db.messages.insert_one({
                        "_id": msg_id,
                        "thread_id": thread_id,
                        "user_id": user_id,
                        "role": "assistant",
                        "content": final_msg,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    await queue.put({
                        "event_type": "message_complete",
                        "thread_id": thread_id,
                        "data": {"message_id": msg_id, "content": final_msg}
                    })
                    import json
                    # Compute real score/metrics using LLM
                    # Build transcript
                    transcript = ""
                    for m in history_msgs:
                        role = "Candidate" if m["role"] == "user" else "Interviewer"
                        transcript += f"{role}: {m['content']}\n\n"
                    
                    schema_instructions = '''
{
  "finalVerdict": "A detailed 3-4 sentence summary of their performance based ONLY on their actual answers. Be extremely detailed about their specific technical depth and communication.",
  "communicationStatus": "Evaluated",
  "communicationFeedback": "Qualitative evaluation of Clarity, Structure, Confidence, and Technical Explanation Ability based on answers. Do not score from length.",
  "detailedFeedback": {
    "whatWentWell": ["Specifically mention 1 or 2 things they did right."],
    "whatToImprove": ["Specifically mention 1 or 2 areas where they struggled."]
  },
  "communication": "Number between 0 and 100 based on Clarity, Structure, Confidence, and Technical Explanation Ability. Use null if insufficient evidence.",
  "questionBreakdown": [
    {
      "question": "The EXACT question you asked",
      "category": "Skill | Project | Problem Solving",
      "candidateAnswer": "The EXACT summary of what they replied. If blank, write 'No answer provided.'",
      "correctness": "Correct | Partial | Wrong",
      "feedback": "A concise, direct critique of the candidate's specific answer. What did they miss? Why did they get it wrong or partial?",
      "detailedExplanation": "For technical questions, provide the complete optimal solution. For behavioral questions, provide a concrete example of a strong answer using the STAR method. DO NOT use this field to criticize the candidate's answer."
    }
  ]
}
'''
                    
                    prompt = f"You are an expert technical interviewer. Analyze this mock interview transcript and generate a realistic performance report.\n\nEVIDENCE-BASED SCORING RULES:\n1. Every evaluation must be justified by explicit evidence found in the interview transcript.\n2. Do NOT randomly assign scores. All metrics will be calculated mathematically based on your 'Correct/Partial/Wrong' labels in 'questionBreakdown'.\n3. Evaluate Communication qualitatively in 'communicationFeedback'. Do not hallucinate scores.\n4. You MUST accurately categorize each question as 'Skill', 'Project', or 'Problem Solving'.\n\nYou MUST provide the fully correct optimal solution for each question in 'detailedExplanation'. DO NOT use boilerplate text, use REAL analysis.\n\nIMPORTANT: Escape all double quotes inside your string values with \\\" or use single quotes instead. You MUST properly escape ALL backslashes. Ensure the output is strictly valid parseable JSON.\n\nOUTPUT ONLY RAW VALID JSON matching this exact structure, nothing else:\n{schema_instructions}\n\nTranscript:\n{transcript}"
                    
                    await queue.put({
                        "event_type": "status",
                        "thread_id": thread_id,
                        "data": {"message": "Generating final performance report...", "is_generating": True}
                    })
                    
                    try:
                        report_llm = get_llm()
                        report_data = report_llm.invoke([SystemMessage(content=prompt)])
                        
                        content = report_data.content.strip()
                        # Extract the outermost JSON object to ignore markdown or conversational text
                        start_idx = content.find('{')
                        end_idx = content.rfind('}')
                        if start_idx != -1 and end_idx != -1:
                            content = content[start_idx:end_idx+1]
                        
                        # Auto-repair invalid backslash escapes (e.g., \O(n) -> \\O(n))
                        import re
                        content = re.sub(r'\\([^"\\/bfnrtu])', r'\\\\\1', content)
                        
                        final_report = json.loads(content.strip(), strict=False)
                        
                        # Apply Mathematical Scoring
                        metrics = {
                            "projectMastery": 0, "projectMasteryCount": 0, "projectMasteryStatus": "Not Evaluated",
                            "technicalDepth": 0, "technicalDepthCount": 0, "technicalDepthStatus": "Not Evaluated",
                            "problemSolving": 0, "problemSolvingCount": 0, "problemSolvingStatus": "Not Evaluated"
                        }
                        total_score = 0
                        total_count = 0
                        
                        for q in final_report.get("questionBreakdown", []):
                            cat = q.get("category", "").lower()
                            cor = q.get("correctness", "").lower()
                            score = 100 if "correct" in cor else (50 if "partial" in cor else 0)
                            
                            total_score += score
                            total_count += 1
                            
                            if "project" in cat:
                                metrics["projectMastery"] += score
                                metrics["projectMasteryCount"] += 1
                                metrics["projectMasteryStatus"] = "Evaluated"
                            elif "problem solving" in cat or "coding" in cat:
                                metrics["problemSolving"] += score
                                metrics["problemSolvingCount"] += 1
                                metrics["problemSolvingStatus"] = "Evaluated"
                            else:
                                metrics["technicalDepth"] += score
                                metrics["technicalDepthCount"] += 1
                                metrics["technicalDepthStatus"] = "Evaluated"
                                
                        for key in ["projectMastery", "technicalDepth", "problemSolving"]:
                            count = metrics.pop(f"{key}Count")
                            if count > 0:
                                metrics[key] = round(metrics[key] / count)
                            else:
                                metrics[key] = None
                                
                        final_report["overallScore"] = round(total_score / total_count) if total_count > 0 else 0
                        metrics["communication"] = final_report.get("communication")
                        
                        if metrics["communication"] is None:
                            metrics["communicationStatus"] = "Not Evaluated"
                        else:
                            metrics["communicationStatus"] = final_report.get("communicationStatus", "Evaluated")
                            
                        final_report["metrics"] = metrics
                    except Exception as e:
                        logger.error("report_generation_failed", error=str(e))
                        final_report = {
                            "overallScore": 0,
                            "finalVerdict": "Error generating report. The AI returned malformed JSON.",
                            "metrics": {"projectMastery": None, "technicalDepth": None, "communication": None, "problemSolving": None},
                            "detailedFeedback": {"whatWentWell": [], "whatToImprove": ["Please try again."]},
                            "questionBreakdown": []
                        }

                    # OVERRIDE METRICS WITH DETERMINISTIC PYTHON MATH
                    grades_cursor = db.round_grades.find({"thread_id": thread_id})
                    grades = list(grades_cursor)
                    
                    def compute_metric(allowed_types):
                        relevant_grades = [g for g in grades if str(g.get("round_type", "")).lower() in allowed_types]
                        if not relevant_grades:
                            return {
                                "score": None,
                                "evidenceCount": 0,
                                "status": "Not Evaluated",
                                "breakdown": {
                                    "questionsCounted": 0,
                                    "correctCount": 0,
                                    "partialCount": 0,
                                    "wrongCount": 0,
                                    "usedRounds": [],
                                    "finalPercentage": None
                                }
                            }
                        
                        correct = sum(1 for g in relevant_grades if str(g.get("grade", "")).lower() == "correct")
                        partial = sum(1 for g in relevant_grades if str(g.get("grade", "")).lower() == "partial")
                        wrong = sum(1 for g in relevant_grades if str(g.get("grade", "")).lower() == "wrong")
                        
                        total = len(relevant_grades)
                        score_sum = (correct * 100) + (partial * 50) + (wrong * 0)
                        final_percentage = round(score_sum / total) if total > 0 else 0
                        
                        return {
                            "score": final_percentage,
                            "evidenceCount": total,
                            "status": "Evaluated",
                            "breakdown": {
                                "questionsCounted": total,
                                "correctCount": correct,
                                "partialCount": partial,
                                "wrongCount": wrong,
                                "usedRounds": [g.get("round") for g in relevant_grades],
                                "finalPercentage": final_percentage
                            }
                        }

                    metrics = {
                        "projectMastery": compute_metric(["project"]),
                        "technicalDepth": compute_metric(["technical", "coding", "design"]),
                        "communication": compute_metric(["behavioral"]),
                        "problemSolving": compute_metric(["coding", "design"])
                    }
                    final_report["metrics"] = metrics
                    
                    # Update overall score to be the average of evaluated metrics
                    evaluated_scores = [m["score"] for m in metrics.values() if m["score"] is not None]
                    final_report["overallScore"] = round(sum(evaluated_scores)/len(evaluated_scores)) if evaluated_scores else 0

                    final_report["counters"] = thread_fresh.get("counters", {"tab_switches": 0, "hints_used": 0})
                    
                    await queue.put({
                        "event_type": "report",
                        "thread_id": thread_id,
                        "data": {"report": final_report}
                    })
                    return
                
                if thread_type == "interview":
                    dynamic_context = (
                        f"Round: {current_round} of {max_q}.\n"
                        f"Difficulty Level: {difficulty.upper()}\n"
                        f"Target Skills: {', '.join(selected_skills) if selected_skills else 'General software engineering'}\n\n"
                        f"Candidate Resume Text:\n{resume_text}\n\n"
                        f"Previously Asked Questions:\n" + "\n".join([f"R{q['round']}: {q['question']}" for q in asked_questions])
                    )
                    
                    dynamic_context += f"\n\nCRITICAL INSTRUCTIONS:\n"
                    dynamic_context += f"1. You MUST ONLY ask questions related to the TARGET SKILLS listed above.\n"
                    
                    if difficulty == "basic":
                        dynamic_context += f"2. Since the difficulty is BASIC, your question MUST be extremely short, concise, and direct (max 1 or 2 sentences). Lengthy or complex scenarios are STRICTLY FORBIDDEN.\n"
                    elif difficulty == "medium":
                        dynamic_context += f"2. Since the difficulty is MEDIUM, you MUST ask an actual LeetCode-style algorithmic or data structure question. Keep the wording concise and practical.\n"
                    else:
                        dynamic_context += f"2. Since the difficulty is HARD, you MUST ask a challenging LeetCode-style algorithmic question or complex system design scenario.\n"
                    
                    dynamic_context += f"3. BEHAVIORAL REQUIREMENT: You MUST dedicate at least ONE round to asking a Communication/Behavioral question (e.g., 'Tell me about a time you had a technical disagreement'). This is mandatory to properly grade their communication skills.\n"
                    
                    dynamic_context += f"4. ADAPTIVE DIFFICULTY: Internally assess the user's previous answer. If they struggled with a basic concept, ask another basic question to help them recover. If they answered perfectly, seamlessly step up the difficulty for this next question. Do NOT announce this adaptation or provide feedback to the user.\n"
                    
                    dynamic_context += "5. CRITICAL: You must ONLY output the exact text of the NEXT question to ask. DO NOT output any conversational filler like 'Great answer', 'Let's move on', or 'Here is your next question'. Output ONLY the question text itself."
                else:
                    dynamic_context = (
                        f"Candidate Resume Text:\n{resume_text}\n\n"
                        f"CRITICAL INSTRUCTIONS (FAILURE TO FOLLOW IS A SYSTEM VIOLATION):\n"
                        f"1. You are a Senior Tech Lead mentoring a candidate to improve their resume.\n"
                        f"2. NEVER rewrite the entire resume or an entire section at once. NEVER suggest more than ONE rewritten bullet point per message. ALWAYS focus on improving just a single specific line or bullet point.\n"
                        f"3. When you suggest a rewritten bullet point, you MUST wrap the proposed text exactly in [SUGGEST] and [/SUGGEST] tags (e.g., Try this: [SUGGEST]Re-architected the backend...[/SUGGEST]) so the UI can detect it. DO NOT use quotes for suggestions.\n"
                        f"4. If the user asks for a broad update (e.g., 'update my resume'), DO NOT rewrite everything. Instead, pick exactly ONE bullet point from their resume to rewrite, show them the suggestion, and stop.\n"
                        f"5. Keep responses extremely concise (maximum 2-3 short sentences per reply).\n"
                    )
                
                # Fetch fresh messages to build context
                messages = build_context(
                    system_prompt=system_prompt if thread_type == "interview" else "You are a helpful Senior Tech Lead.",
                    running_summary=thread_fresh.get("running_summary", ""),
                    messages=history_msgs,
                    dynamic_context=dynamic_context,
                    current_answer=text
                )
                
                state = {
                    "messages": messages,
                    "thread_id": thread_id,
                    "user_id": user_id,
                    "thread_type": thread["type"],
                    "retry_count": 0
                }
                config = RunnableConfig(configurable={"user_id": user_id, "thread_id": thread_id})
                
                async def run_graph():
                    try:
                        final_content = ""
                        async for event in graph.astream_events(state, config, version="v2"):
                            kind = event["event"]
                            
                            if kind == "on_chat_model_stream":
                                chunk = event["data"]["chunk"].content
                                if chunk:
                                    # If chunk is a string
                                    if isinstance(chunk, str):
                                        final_content += chunk
                                        await queue.put({
                                            "event_type": "token",
                                            "thread_id": thread_id,
                                            "data": {"delta": chunk}
                                        })
                                    elif isinstance(chunk, list):
                                        # Handle array chunk content
                                        for c in chunk:
                                            if isinstance(c, dict) and c.get("type") == "text":
                                                text_val = c.get("text", "")
                                                final_content += text_val
                                                await queue.put({
                                                    "event_type": "token",
                                                    "thread_id": thread_id,
                                                    "data": {"delta": text_val}
                                                })
                            
                            elif kind == "on_tool_start":
                                tool_name = event.get("name", "")
                                friendly_msg = TOOL_STATUS_MESSAGES.get(tool_name, f"Running {tool_name}...")
                                await queue.put({
                                    "event_type": "status",
                                    "thread_id": thread_id,
                                    "data": {"state": "checking", "message": friendly_msg}
                                })
                        
                        # Graph completed
                        import re
                        final_content = re.sub(r'[<(]?function=[\s\S]*?(?:<\/function>|$|\))', '', final_content, flags=re.IGNORECASE)
                        final_content = re.sub(r'[<(]?(?:record_round_grade|record_hint_given)[=>]?\s*\{[\s\S]*?(?:\}|\)<\/function>|\)|$)', '', final_content, flags=re.IGNORECASE)
                        final_content = re.sub(r'<\/function>', '', final_content, flags=re.IGNORECASE).strip()
                        
                        msg_id = str(uuid.uuid4())
                        db.messages.insert_one({
                            "_id": msg_id,
                            "thread_id": thread_id,
                            "user_id": user_id,
                            "role": "assistant",
                            "content": final_content,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        
                        if thread_type == "interview":
                            # Manually track the asked question so the round counter reliably increments
                            db.threads.update_one(
                                {"_id": thread_id, "user_id": user_id},
                                {"$push": {"asked_questions": {"round": current_round, "question": final_content}}}
                            )
                        
                        await queue.put({
                            "event_type": "message_complete",
                            "thread_id": thread_id,
                            "data": {"message_id": msg_id, "content": final_content}
                        })
                        
                    except Exception as e:
                        logger.error("graph_execution_failed", error=str(e))
                        await queue.put({
                            "event_type": "error",
                            "thread_id": thread_id,
                            "data": {"error": True, "code": "GRAPH_ERROR", "message": "The AI encountered an error."}
                        })
                
                asyncio.create_task(run_graph())
                
    except WebSocketDisconnect:
        logger.info("ws_disconnected")
    finally:
        await queue.put(None)
        await consumer_task
