"""
Parse pasted raw email text (RFC 5322 / MIME) into sender, subject, and body.
"""

from __future__ import annotations

import html
import re
from email import policy
from email.parser import BytesParser
from typing import Any

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html_to_text(raw_html: str) -> str:
    if not raw_html:
        return ""
    text = _TAG_RE.sub(" ", raw_html)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_body(message: Any) -> str:
    if message.is_multipart():
        plain_parts: list[str] = []
        html_parts: list[str] = []
        for part in message.walk():
            if part.get_content_disposition() == "attachment":
                continue
            content_type = part.get_content_type()
            try:
                payload = part.get_content()
            except Exception:
                continue
            if not payload:
                continue
            if content_type == "text/plain":
                plain_parts.append(str(payload).strip())
            elif content_type == "text/html":
                html_parts.append(strip_html_to_text(str(payload)))
        if plain_parts:
            return "\n\n".join(plain_parts)
        if html_parts:
            return "\n\n".join(html_parts)
        return ""

    try:
        payload = message.get_content()
    except Exception:
        return ""
    if not payload:
        return ""
    if message.get_content_type() == "text/html":
        return strip_html_to_text(str(payload))
    return str(payload).strip()


def parse_raw_email(raw_text: str) -> dict[str, str]:
    """
    Parse a raw .eml export or pasted email source into structured fields.
    Raises ValueError if the text cannot be parsed as an email message.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("raw_text is empty")

    data = raw_text.encode("utf-8", errors="replace")
    message = BytesParser(policy=policy.default).parsebytes(data)

    sender = str(message.get("From", "") or "").strip()
    subject = str(message.get("Subject", "") or "").strip()
    body = _extract_body(message)

    if not sender and not subject and not body:
        raise ValueError("Could not extract sender, subject, or body from raw_text")

    return {"sender": sender, "subject": subject, "body": body}
