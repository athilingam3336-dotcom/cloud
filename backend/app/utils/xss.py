"""
=========================================
CloudCrackers
XSS Protection Utility
=========================================
"""

import html
import re


def sanitize_text(text: str) -> str:
    """
    Sanitizes string inputs to prevent XSS injection.
    Escapes HTML tags and filters script attributes.
    """
    if not isinstance(text, str):
        return text

    # Escape HTML tags
    escaped = html.escape(text)

    # Filter out potential javascript: protocol URLs
    sanitized = re.sub(r"javascript\s*:", "", escaped, flags=re.IGNORECASE)

    # Filter out inline event handlers
    sanitized = re.sub(r"\s+on\w+\s*=", "", sanitized, flags=re.IGNORECASE)

    return sanitized
