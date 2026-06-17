"""Logging configuration.

App logs use structlog's human-readable ConsoleRenderer:
    2026-06-16T14:55:37.992888Z [info     ] request_started   func_name=dispatch lineno=42 module=middleware method=GET path=/api/threads/

uvicorn keeps its own standard logging format:
    2026-06-16 20:25:38,320 - uvicorn.access - INFO - 127.0.0.1 - "GET /api/threads/ HTTP/1.1" 200
"""
import logging
import sys
import structlog

SHARED_PROCESSORS = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_log_level,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
    structlog.processors.CallsiteParameterAdder(
        {
            structlog.processors.CallsiteParameter.FUNC_NAME,
            structlog.processors.CallsiteParameter.LINENO,
            structlog.processors.CallsiteParameter.MODULE,
        }
    ),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.format_exc_info,
]


def setup_logging():
    structlog.configure(
        processors=SHARED_PROCESSORS + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Pretty, colored console renderer for our app logs.
    console_formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=SHARED_PROCESSORS,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(colors=True),
        ],
    )
    app_handler = logging.StreamHandler(sys.stdout)
    app_handler.setFormatter(console_formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(app_handler)
    root.setLevel(logging.INFO)

    # uvicorn keeps its own standard logging format (separate from structlog).
    uvicorn_formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    uvicorn_handler = logging.StreamHandler(sys.stdout)
    uvicorn_handler.setFormatter(uvicorn_formatter)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.addHandler(uvicorn_handler)
        lg.propagate = False
