"""
Email parsing helpers (raw MIME / HTML exports).

Reserved for future integration; the extension currently sends
sender, subject, and body directly to the API.
"""

from __future__ import annotations


def strip_html_to_text(html: str) -> str:
    """Return plain text from HTML email body (placeholder)."""
    if not html:
        return ""
    # Full BeautifulSoup parsing can be added when MIME ingestion is implemented.
    return html
