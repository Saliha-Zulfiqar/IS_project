import re
from typing import Any

# 25 urgency / phishing trigger phrases (matched case-insensitively in subject + body)
URGENCY_KEYWORDS = [
    "urgent",
    "act now",
    "immediately",
    "click here",
    "verify now",
    "account suspended",
    "limited time",
    "expires today",
    "confirm your identity",
    "unusual activity",
    "security alert",
    "update your payment",
    "wire transfer",
    "password expired",
    "login required",
    "verify your account",
    "action required",
    "final notice",
    "your account will be closed",
    "claim your reward",
    "you have won",
    "tax refund",
    "invoice overdue",
    "unauthorized access",
    "reset your password",
]

TRUSTED_BRANDS = [
    "paypal",
    "amazon",
    "apple",
    "microsoft",
    "google",
    "netflix",
    "bank",
    "instagram",
    "facebook",
    "dropbox",
]

URL_PATTERN = re.compile(
    r"https?://[^\s<>\"')\]]+|www\.[^\s<>\"')\]]+",
    re.IGNORECASE,
)

IP_IN_URL_PATTERN = re.compile(
    r"https?://(?:\d{1,3}\.){3}\d{1,3}|(?:\d{1,3}\.){3}\d{1,3}(?:/|:)",
    re.IGNORECASE,
)

SUSPICIOUS_URL_KEYWORDS = ("login", "verify", "secure", "confirm")

HTML_LINK_PATTERN = re.compile(
    r"<a\s+[^>]*href\s*=\s*['\"]?([^'\">\s]+)",
    re.IGNORECASE,
)

RE_FWD_PREFIX_PATTERN = re.compile(r"^\s*(re|fwd)\s*:", re.IGNORECASE)


def extract_urls(text: str) -> list[str]:
    """Find all HTTP(S) and www. URLs in plain text."""
    if not text:
        return []
    return URL_PATTERN.findall(text)


def _normalize_url_for_check(url: str) -> str:
    if url.lower().startswith("www."):
        return "http://" + url
    return url


def check_suspicious_url(url: str) -> dict[str, Any]:
    """
    Flag a single URL for common phishing indicators.
    Returns { url, flags, is_suspicious }.
    """
    flags: list[str] = []
    raw = url.strip()

    if IP_IN_URL_PATTERN.search(raw):
        flags.append("ip_address_instead_of_domain")

    if len(raw) > 75:
        flags.append("url_too_long")

    dot_count = raw.count(".")
    if dot_count > 4:
        flags.append("too_many_subdomains")

    url_lower = raw.lower()
    for keyword in SUSPICIOUS_URL_KEYWORDS:
        if keyword in url_lower:
            flags.append(f"contains_{keyword}")

    return {
        "url": raw,
        "flags": flags,
        "is_suspicious": len(flags) > 0,
    }


def _sender_domain(sender: str) -> str:
    """Extract lowercase domain from a From address."""
    if not sender:
        return ""
    match = re.search(r"@([^\s>]+)", sender.strip())
    if not match:
        return ""
    domain = match.group(1).lower()
    # Strip trailing punctuation sometimes attached to emails in headers
    return domain.rstrip(">.,;)")


def check_domain_mismatch(
    sender: str,
    body: str,
    subject: str,
) -> dict[str, Any]:
    """
    If a trusted brand name appears in the email but not in the sender domain,
    treat it as a possible impersonation (brand in body, wrong sender).
    """
    sender_domain = _sender_domain(sender)
    combined = f"{subject or ''} {body or ''}".lower()
    mismatched_brands: list[str] = []

    for brand in TRUSTED_BRANDS:
        if brand in combined and brand not in sender_domain:
            mismatched_brands.append(brand)

    return {
        "sender_domain": sender_domain,
        "mismatched_brands": mismatched_brands,
        "has_mismatch": len(mismatched_brands) > 0,
    }


def _find_urgency_words(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    found: list[str] = []
    for phrase in URGENCY_KEYWORDS:
        if phrase in text_lower:
            found.append(phrase)
    return found


def _html_link_count(body: str) -> int:
    if not body:
        return 0
    return len(HTML_LINK_PATTERN.findall(body))


def _subject_all_caps(subject: str) -> bool:
    if not subject or not subject.strip():
        return False
    letters = [c for c in subject if c.isalpha()]
    if not letters:
        return False
    return all(c.isupper() for c in letters)


def _has_re_fwd_prefix(subject: str) -> bool:
    if not subject:
        return False
    return bool(RE_FWD_PREFIX_PATTERN.match(subject))


def extract_features(sender: str, subject: str, body: str) -> dict[str, Any]:
    """
    Run all feature extractors and return a single analysis dict for the API/LLM.
    """
    combined_text = f"{subject or ''}\n{body or ''}"
    urgency_words = _find_urgency_words(combined_text)
    urgency_score = len(urgency_words)

    urls_found = extract_urls(combined_text)
    url_count = len(urls_found)

    suspicious_urls = [check_suspicious_url(u) for u in urls_found]
    suspicious_url_count = sum(1 for u in suspicious_urls if u["is_suspicious"])

    domain_mismatch = check_domain_mismatch(sender, body or "", subject or "")

    return {
        "urgency_score": urgency_score,
        "urgency_words": urgency_words,
        "url_count": url_count,
        "urls_found": urls_found,
        "suspicious_urls": suspicious_urls,
        "suspicious_url_count": suspicious_url_count,
        "domain_mismatch": domain_mismatch,
        "html_link_count": _html_link_count(body or ""),
        "subject_all_caps": _subject_all_caps(subject or ""),
        "has_re_fwd_prefix": _has_re_fwd_prefix(subject or ""),
    }
