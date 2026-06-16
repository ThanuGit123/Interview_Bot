"""Main application entry point."""
from dotenv import load_dotenv
load_dotenv()

import traceback
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.errors import AppError
from app.api.auth import router as auth_router
from app.api.ws import router as ws_router
from app.core.logging import setup_logging
from app.core.middleware import TraceMiddleware

setup_logging()

logger = structlog.get_logger(__name__)

app = FastAPI(title="Interview Bot v2")

app.add_middleware(TraceMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_trace_id():
    return structlog.contextvars.get_contextvars().get("trace_id", "unknown")

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "code": exc.code, "message": exc.message, "trace_id": get_trace_id()}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc), traceback=traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"error": True, "code": "INTERNAL", "message": "An unexpected error occurred", "trace_id": get_trace_id()}
    )

from app.api.resumes import router as resumes_router
from app.api.threads import router as threads_router

app.include_router(auth_router)
app.include_router(ws_router)
app.include_router(resumes_router)
app.include_router(threads_router)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
