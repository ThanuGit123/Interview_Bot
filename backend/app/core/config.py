"""Application configuration."""

# LLM Context Limits
MAX_HISTORY_MESSAGES = 10    # cap by count first
MAX_HISTORY_TOKENS   = 4000  # then by tokens (small free models - half of the 8k production reference)
SUMMARY_THRESHOLD    = 20    # messages in thread before summarization kicks in
KEEP_RECENT          = 8     # messages always kept verbatim

# Web search (Tavily) — used by the web_search agent tool. The API key is read
# from the TAVILY_API_KEY env var at call time (see agent/tools.py).
TAVILY_URL          = "https://api.tavily.com/search"
TAVILY_MAX_RESULTS  = 5      # results requested per query
TAVILY_SEARCH_DEPTH = "basic"  # "basic" (fast) or "advanced" (deeper, slower)
TAVILY_TIMEOUT      = 10.0   # seconds before we give up on the search
TAVILY_MAX_CHARS    = 4000   # cap the formatted results fed back to the model
