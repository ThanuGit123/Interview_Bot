"""Authentication endpoints."""
import uuid
import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.core.errors import AppError
from app.db.client import get_db

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=TokenResponse)
def signup(user_data: UserCreate):
    db = get_db()
    email_lower = user_data.email.lower()
    
    if db.users.find_one({"email": email_lower}):
        raise AppError(code="EMAIL_EXISTS", message="Email is already registered", status_code=400)
        
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    new_user = {
        "_id": user_id,
        "email": email_lower,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "created_at": now,
        "updated_at": now
    }
    
    db.users.insert_one(new_user)
    logger.info("user_signed_up", user_id=user_id)
    
    token = create_access_token({"sub": user_id})
    return {"access_token": token, "user": new_user}

@router.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin):
    db = get_db()
    email_lower = user_data.email.lower()
    
    user = db.users.find_one({"email": email_lower})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise AppError(code="UNAUTHORIZED", message="Invalid email or password", status_code=401)
        
    logger.info("user_logged_in", user_id=user["_id"])
    token = create_access_token({"sub": user["_id"]})
    return {"access_token": token, "user": user}

@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    logger.info("user_logged_out", user_id=current_user["_id"])
    return {"ok": True}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.get("/crash")
def force_crash():
    raise ValueError("Intentional crash for trace_id testing")
