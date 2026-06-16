"""Scoring service for computing final interview grades."""

def compute_overall_score(round_grades: list[dict], tab_switches: int, hints_used: int) -> dict:
    if not round_grades:
        return {"overall_score": 0, "verdict": "no_hire"}
        
    grade_map = {
        "correct": 100,
        "partial": 50,
        "wrong": 0
    }
    
    total = sum(grade_map.get(g.get("grade", "wrong"), 0) for g in round_grades)
    base = total / len(round_grades)
    
    penalty = (10 * tab_switches) + (5 * hints_used)
    overall = max(0, round(base) - penalty)
    
    if overall >= 75:
        verdict = "hire"
    elif overall >= 55:
        verdict = "lean_hire"
    else:
        verdict = "no_hire"
        
    return {
        "base_score": round(base),
        "penalty": penalty,
        "overall_score": overall,
        "verdict": verdict
    }
