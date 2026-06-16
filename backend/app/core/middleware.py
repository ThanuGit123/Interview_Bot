"""Trace middleware for request correlation."""
import uuid
import time
import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)

class TraceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = str(uuid.uuid4())
        
        # Bind the trace_id to all logs in the current context
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        
        start_time = time.perf_counter()
        logger.info("request_started", method=request.method, url=str(request.url.path))
        
        try:
            response = await call_next(request)
            process_time = time.perf_counter() - start_time
            logger.info(
                "request_finished", 
                method=request.method, 
                url=str(request.url.path),
                status_code=response.status_code,
                duration_s=process_time
            )
            return response
        except Exception as e:
            process_time = time.perf_counter() - start_time
            logger.error(
                "request_failed", 
                method=request.method, 
                url=str(request.url.path),
                duration_s=process_time,
                error=str(e)
            )
            raise e
