from app.core.context import build_context

def test_context_assembly():
    messages = []
    for i in range(25):
        role = "user" if i % 2 == 0 else "assistant"
        # Each message is around 250 tokens
        content = f"Message {i} " * 125
        messages.append({"role": role, "content": content})
        
    system_prompt = "You are an interviewer."
    running_summary = "Candidate knows Python."
    dynamic_context = "Round 3. Medium difficulty."
    current_answer = "Here is my answer."
    
    result = build_context(
        system_prompt=system_prompt,
        running_summary=running_summary,
        messages=messages,
        dynamic_context=dynamic_context,
        current_answer=current_answer
    )
    
    print("Total parts in context:", len(result))
    print("Part 1:", type(result[0]).__name__, result[0].content)
    print("Part 2:", type(result[1]).__name__, result[1].content)
    
    # 1 system, 1 summary, history..., 1 dynamic, 1 human
    history_len = len(result) - 4
    print(f"Kept {history_len} history messages.")
    
    assert history_len <= 10, "Should cap at MAX_HISTORY_MESSAGES=10"
    
    print("Penultimate msg:", type(result[-2]).__name__, result[-2].content)
    print("Last msg:", type(result[-1]).__name__, result[-1].content)
    
    print("\nSUCCESS!")

if __name__ == "__main__":
    import logging
    import sys
    import structlog
    from app.core.logging import setup_logging
    
    setup_logging()
    test_context_assembly()
