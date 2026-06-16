import asyncio
import websockets
import json
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from app.db.client import get_db
from app.core.security import create_access_token

async def test_ws():
    db = get_db()
    
    user_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())
    
    db.users.insert_one({
        "_id": user_id, 
        "email": f"ws_test_{user_id}@test.com", 
        "password_hash": "dummy", 
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    db.threads.insert_one({
        "_id": thread_id, 
        "user_id": user_id, 
        "type": "interview", 
        "status": "active",
        "current_round": 1,
        "running_summary": "",
        "summary_covers_until": 0,
        "counters": {"hints_used": 0, "tab_switches": 0},
        "asked_questions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    token = create_access_token({"sub": user_id})
    
    uri = f"ws://localhost:5000/api/ws/threads/{thread_id}?token={token}"
    print(f"Connecting to {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            await websocket.send(json.dumps({
                "action": "answer",
                "text": "A list is a mutable collection of items in Python."
            }))
            
            print("Answer sent. Waiting for response stream...")
            
            while True:
                response = await websocket.recv()
                data = json.loads(response)
                
                event_type = data.get("event_type")
                if event_type == "token":
                    print(data["data"]["delta"], end="", flush=True)
                elif event_type == "status":
                    print(f"\n[STATUS] {data['data']['message']}")
                elif event_type == "message_complete":
                    print(f"\n\n[COMPLETE] Message saved: {data['data'].get('message_id')}")
                    break
                elif event_type == "error":
                    print(f"\n[ERROR] {data['data']}")
                    break
                else:
                    print(f"\n[OTHER EVENT] {event_type}")
                    
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
