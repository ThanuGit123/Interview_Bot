"""Application configuration."""

# LLM Context Limits
MAX_HISTORY_MESSAGES = 10    # cap by count first
MAX_HISTORY_TOKENS   = 4000  # then by tokens (small free models - half of the 8k production reference)
SUMMARY_THRESHOLD    = 20    # messages in thread before summarization kicks in
KEEP_RECENT          = 8     # messages always kept verbatim
