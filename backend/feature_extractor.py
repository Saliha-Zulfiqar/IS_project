import re
from typing import Any
from urllib.parse import urlparse

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

# Official domains for major senders — reduces false positives on real notifications
BRAND_OFFICIAL_DOMAINS: dict[str, tuple[str, ...]] = {
    "google": (
        "google.com",
        "gmail.com",
        "googlemail.com",
        "googleusercontent.com",
        "googleapis.com",
        "gstatic.com",
        "youtube.com",
        "classroom.google.com",
        "accounts.google.com",
        "notifications.google.com",
        "policies.google.com",
        "myaccount.google.com",
        "drive.google.com",
        "docs.google.com",
        "calendar.google.com",
        "mail.google.com",
        "workspace.google.com",
        "google.co.uk",
        "google.ca",
        "google.com.au",
    ),
    "microsoft": ("microsoft.com", "outlook.com", "live.com", "office.com", "office365.com", "microsoftonline.com"),
    "apple": ("apple.com", "icloud.com", "me.com"),
    "amazon": ("amazon.com", "amazon.co.uk", "amazon.de", "amazonaws.com"),
    "paypal": ("paypal.com", "paypal.co.uk"),
    "facebook": ("facebook.com", "facebookmail.com", "meta.com"),
    "instagram": ("instagram.com", "mail.instagram.com"),
    "netflix": ("netflix.com", "mailer.netflix.com"),
    "dropbox": ("dropbox.com", "dropboxmail.com"),
}

TRUSTED_SENDER_SUFFIXES: tuple[str, ...] = tuple(
    dict.fromkeys(
        suffix
        for domains in BRAND_OFFICIAL_DOMAINS.values()
        for suffix in domains
    )
)

# Brand appears in body but email is NOT pretending to be that brand (integrations, settings, etc.)
BRAND_REFERENCE_PATTERNS: dict[str, tuple[str, ...]] = {
    "google": (
        r"\bgoogle\s+settings\b",
        r"\bgoogle\s+integration\b",
        r"\bintegrat(e|ion|ing)\s+with\s+google\b",
        r"\bgoogle\s+calendar\b",
        r"\bgoogle\s+workspace\b",
        r"\bgoogle\s+drive\b",
        r"\bgoogle\s+sign[\s-]?in\b",
        r"\bgoogle\s+login\b",
        r"\bgoogle\s+api\b",
        r"\bconnect\s+(to\s+)?google\b",
        r"\bnew\s+settings\b.*\bgoogle\b",
        r"\bgoogle\b.*\bnew\s+settings\b",
        r"\bsettings\b.*\bgoogle\b",
        r"\bsync\b.*\bgoogle\b",
        r"\bgoogle\b.*\bsync\b",
        r"\bvia\s+google\b",
        r"\bpowered\s+by\s+google\b",
    ),
    "microsoft": (
        r"\bmicrosoft\s+teams\b",
        r"\bintegrat(e|ion|ing)\s+with\s+microsoft\b",
        r"\boffice\s+365\b",
        r"\boutlook\s+integration\b",
    ),
    "apple": (r"\bsign\s+in\s+with\s+apple\b", r"\bapple\s+login\b"),
    "amazon": (r"\bamazon\s+integration\b", r"\bconnect\s+to\s+amazon\b"),
    "paypal": (r"\bpaypal\s+integration\b", r"\baccept\s+paypal\b"),
    "facebook": (r"\bfacebook\s+login\b", r"\bsign\s+in\s+with\s+facebook\b"),
    "instagram": (r"\binstagram\s+integration\b",),
    "netflix": (r"\bnetflix\s+integration\b",),
    "dropbox": (r"\bdropbox\s+integration\b", r"\bsync\b.*\bdropbox\b"),
    "bank": (r"\bbank\s+transfer\b", r"\bbank\s+details\b", r"\bbank\s+account\s+number\b"),
}

# Email claims to BE the brand (impersonation) — requires wrong sender domain to matter
BRAND_IMPERSONATION_PATTERNS: dict[str, tuple[str, ...]] = {
    "google": (
        r"\bfrom\s+google\b",
        r"\bthe\s+google\s+team\b",
        r"\bgoogle\s+team\b",
        r"\bgoogle\s+support\b",
        r"\bgoogle\s+security\b",
        r"\byour\s+google\s+account\s+(has\s+been|was|is)\s+(suspended|locked|disabled|compromised|hacked)",
        r"\bgoogle\s+account\s+(suspended|locked|disabled|compromised)",
        r"\bverify\s+your\s+google\s+account\b",
        r"\bconfirm\s+your\s+google\s+identity\b",
        r"^google[\s:—-]+",
        r"\bsecurity\s+alert\b.*\bgoogle\s+account\b",
        r"\bunusual\s+sign[\s-]?in\b.*\bgoogle\b",
        r"\bwe\s+noticed\b.*\bgoogle\s+account\b",
    ),
    "paypal": (
        r"\bfrom\s+paypal\b",
        r"\bpaypal\s+team\b",
        r"\byour\s+paypal\s+account\s+(has\s+been|was|is)\s+suspended",
        r"\bverify\s+your\s+paypal\b",
    ),
    "amazon": (
        r"\bfrom\s+amazon\b",
        r"\bamazon\s+team\b",
        r"\byour\s+amazon\s+account\b.*\b(suspended|locked|unusual)",
    ),
    "microsoft": (
        r"\bfrom\s+microsoft\b",
        r"\bmicrosoft\s+team\b",
        r"\byour\s+microsoft\s+account\b.*\b(suspended|locked|unusual)",
    ),
    "apple": (
        r"\bfrom\s+apple\b",
        r"\bapple\s+team\b",
        r"\byour\s+apple\s+id\b.*\b(suspended|locked|compromised)",
    ),
    "netflix": (r"\bfrom\s+netflix\b", r"\bnetflix\s+team\b", r"\byour\s+netflix\s+account\b.*\bsuspended"),
    "facebook": (r"\bfrom\s+facebook\b", r"\bfacebook\s+team\b", r"\byour\s+facebook\s+account\b"),
    "instagram": (r"\bfrom\s+instagram\b", r"\binstagram\s+team\b"),
    "dropbox": (r"\bfrom\s+dropbox\b", r"\bdropbox\s+team\b"),
    "bank": (r"\byour\s+bank\s+account\b.*\b(suspended|locked|compromised)", r"\bfrom\s+your\s+bank\b"),
}

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

EMAIL_IN_ANGLE_BRACKETS = re.compile(r"<([^<>@\s]+@[^<>@\s]+)>", re.IGNORECASE)
EMAIL_ANYWHERE = re.compile(r"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})")

# Common legitimate Google notification patterns (subject + body)
GOOGLE_SERVICE_PATTERNS: dict[str, tuple[str, ...]] = {
    "google_classroom": (
        "google classroom",
        "classroom.google.com",
        "classroom-noreply",
        "new assignment",
        "assignment posted",
        "course work",
        "coursework",
    ),
    "google_policy": (
        "privacy policy",
        "terms of service",
        "policies.google.com",
        "policy update",
        "we're updating our",
    ),
    "google_account": (
        "google account",
        "accounts.google.com",
        "security alert",
        "new sign-in",
        "sign-in from",
        "2-step verification",
        "recovery email",
    ),
    "google_workspace": (
        "google workspace",
        "google drive",
        "drive.google.com",
        "google docs",
        "google calendar",
        "shared a document",
    ),
}


def extract_urls(text: str) -> list[str]:
    """Find all HTTP(S) and www. URLs in plain text."""
    if not text:
        return []
    return URL_PATTERN.findall(text)


def _normalize_url_for_check(url: str) -> str:
    if url.lower().startswith("www."):
        return "http://" + url
    return url


def _host_from_url(url: str) -> str:
    try:
        normalized = _normalize_url_for_check(url.strip())
        host = urlparse(normalized).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def is_trusted_host(host: str) -> bool:
    """True if hostname belongs to a known legitimate service."""
    if not host:
        return False
    host = host.lower().strip(".")
    for suffix in TRUSTED_SENDER_SUFFIXES:
        if host == suffix or host.endswith("." + suffix):
            return True
    return False


def is_trusted_sender(sender: str) -> bool:
    return is_trusted_host(_sender_domain(sender))


def _brand_matches_sender(brand: str, sender_domain: str) -> bool:
    """True when the sender domain is an official domain for the mentioned brand."""
    official = BRAND_OFFICIAL_DOMAINS.get(brand, ())
    if not sender_domain:
        return False
    for domain in official:
        if sender_domain == domain or sender_domain.endswith("." + domain):
            return True
    return brand in sender_domain


def check_suspicious_url(url: str) -> dict[str, Any]:
    """
    Flag a single URL for common phishing indicators.
    Returns { url, flags, is_suspicious }.
    """
    flags: list[str] = []
    raw = url.strip()

    if is_trusted_host(_host_from_url(raw)):
        return {"url": raw, "flags": [], "is_suspicious": False}

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


def _extract_sender_email(sender: str) -> str:
    """Parse a bare email from display names like 'Google Classroom <noreply@google.com>'."""
    if not sender:
        return ""
    text = sender.strip()
    bracket = EMAIL_IN_ANGLE_BRACKETS.search(text)
    if bracket:
        return bracket.group(1).lower()
    anywhere = EMAIL_ANYWHERE.search(text)
    if anywhere:
        return anywhere.group(1).lower()
    return text.lower()


def _sender_domain(sender: str) -> str:
    """Extract lowercase domain from a From address."""
    email = _extract_sender_email(sender)
    if not email or "@" not in email:
        return ""
    domain = email.split("@", 1)[1].lower()
    return domain.rstrip(">.,;)")


def _detect_google_service_notification(
    sender: str,
    subject: str,
    body: str,
    sender_domain: str,
    trusted_sender: bool,
    trusted_org: str,
) -> dict[str, Any]:
    """Identify common Google service mail when sender or links align with Google."""
    combined = f"{sender or ''} {subject or ''} {body or ''}".lower()
    is_google_context = trusted_org == "google" or "google" in sender_domain
    matched: list[str] = []

    for service, phrases in GOOGLE_SERVICE_PATTERNS.items():
        if any(phrase in combined for phrase in phrases):
            matched.append(service)

    urls = extract_urls(f"{subject or ''}\n{body or ''}")
    google_urls = sum(1 for u in urls if is_trusted_host(_host_from_url(u)) and "google" in _host_from_url(u))

    is_notification = bool(matched) and (is_google_context or google_urls > 0 or trusted_sender)
    return {
        "is_google_service_notification": is_notification,
        "google_service_types": matched,
        "google_trusted_urls": google_urls,
    }


def _brand_mentioned(brand: str, text: str) -> bool:
    return bool(re.search(rf"\b{re.escape(brand)}\b", text, re.IGNORECASE))


def _is_casual_brand_reference(brand: str, subject: str, body: str) -> bool:
    """True when a brand is discussed in context (integration/settings), not impersonated."""
    combined = f"{subject or ''} {body or ''}"
    for pattern in BRAND_REFERENCE_PATTERNS.get(brand, ()):
        if re.search(pattern, combined, re.IGNORECASE):
            return True
    return False


def _impersonation_signals(brand: str, sender: str, subject: str, body: str) -> list[str]:
    """Return concrete impersonation indicators for a brand (empty = no impersonation)."""
    signals: list[str] = []
    combined = f"{subject or ''} {body or ''}"
    sender_domain = _sender_domain(sender)

    if _brand_matches_sender(brand, sender_domain):
        return []

    # Display name says "Google" but domain is not Google
    display_part = sender.split("<")[0].strip().lower() if sender and "<" in sender else (sender or "").lower()
    if brand in display_part and not _brand_matches_sender(brand, sender_domain):
        signals.append("sender_display_name_uses_brand")

    for pattern in BRAND_IMPERSONATION_PATTERNS.get(brand, ()):
        if re.search(pattern, combined, re.IGNORECASE):
            signals.append(f"impersonation_phrase")

    # Subject heavily branded as if from the company (not a casual product mention)
    subj = (subject or "").strip()
    if subj and _brand_mentioned(brand, subj):
        if re.match(rf"^{re.escape(brand)}\b", subj, re.IGNORECASE):
            if not _is_casual_brand_reference(brand, subject, body):
                signals.append("subject_pretends_to_be_brand")

    return list(dict.fromkeys(signals))


def check_domain_mismatch(
    sender: str,
    body: str,
    subject: str,
) -> dict[str, Any]:
    """
    Flag impersonation only when the email claims to BE a brand, not when it merely
    mentions a brand (e.g. Smile.io email about Google settings).
    """
    sender_domain = _sender_domain(sender)
    combined = f"{subject or ''} {body or ''}"
    impersonated_brands: list[str] = []
    referenced_brands: list[str] = []
    impersonation_details: dict[str, list[str]] = {}

    for brand in TRUSTED_BRANDS:
        if not _brand_mentioned(brand, combined):
            continue
        if _brand_matches_sender(brand, sender_domain):
            continue

        signals = _impersonation_signals(brand, sender, subject or "", body or "")
        if signals:
            impersonated_brands.append(brand)
            impersonation_details[brand] = signals
        elif _is_casual_brand_reference(brand, subject or "", body or ""):
            referenced_brands.append(brand)
        # else: incidental mention in body only — not impersonation, not flagged

    return {
        "sender_domain": sender_domain,
        "mismatched_brands": impersonated_brands,
        "referenced_brands": referenced_brands,
        "impersonation_details": impersonation_details,
        "has_mismatch": len(impersonated_brands) > 0,
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


def has_strong_phishing_signals(features: dict[str, Any]) -> bool:
    """True when hard evidence of impersonation or malicious URLs exists."""
    mismatch = features.get("domain_mismatch") or {}
    if mismatch.get("has_mismatch"):
        return True
    return int(features.get("suspicious_url_count") or 0) > 0


def is_clearly_legitimate_context(features: dict[str, Any]) -> bool:
    """Verified sender or benign brand reference — no impersonation or bad links."""
    if has_strong_phishing_signals(features):
        return False
    mismatch = features.get("domain_mismatch") or {}
    if features.get("is_trusted_sender", False):
        return True
    referenced = mismatch.get("referenced_brands") or []
    return bool(referenced) and not mismatch.get("has_mismatch")


def compute_legitimate_baseline(features: dict[str, Any]) -> int:
    """
    Graduated low risk (1–22) for verified mail.
    Varies by service type, link count, and urgency wording — not a flat cap.
    """
    score = 4

    if features.get("is_google_service_notification"):
        type_weights = {
            "google_classroom": 0,
            "google_policy": 2,
            "google_account": 6,
            "google_workspace": 1,
        }
        for service in features.get("google_service_types") or []:
            score += type_weights.get(service, 1)

    url_count = int(features.get("url_count") or 0)
    if features.get("all_urls_trusted") and url_count:
        score += min(5, url_count + 1)
    elif url_count == 0:
        score += 1

    raw_urgency = len(features.get("urgency_words") or [])
    score += min(7, raw_urgency * 2)

    if features.get("subject_all_caps"):
        score += 4

    referenced = (features.get("domain_mismatch") or {}).get("referenced_brands") or []
    score += min(5, len(referenced) * 2)

    if features.get("has_re_fwd_prefix"):
        score += 1

    org = features.get("trusted_sender_org") or ""
    if org == "google" and "google_account" not in (features.get("google_service_types") or []):
        score = max(2, score - 1)

    return max(1, min(22, score))


def compute_threat_score(features: dict[str, Any]) -> int:
    """Threat component (0–100) from impersonation, URLs, and urgency on untrusted senders."""
    score = 0
    mismatch = features.get("domain_mismatch") or {}

    if mismatch.get("has_mismatch"):
        brands = mismatch.get("mismatched_brands") or []
        details = mismatch.get("impersonation_details") or {}
        score += 26 + min(16, len(brands) * 7)
        for signals in details.values():
            score += min(14, len(signals) * 4)

    for item in features.get("suspicious_urls") or []:
        if not item.get("is_suspicious"):
            continue
        flags = item.get("flags") or []
        score += 15 + min(14, len(flags) * 3)

    urgency = int(features.get("effective_urgency_score", features.get("urgency_score", 0)) or 0)
    score += min(22, urgency * 5)

    if not features.get("is_trusted_sender"):
        raw = int(features.get("urgency_score") or 0)
        score += min(12, max(0, raw - urgency) * 3)

    if features.get("subject_all_caps"):
        score += 9

    url_count = int(features.get("url_count") or 0)
    susp = int(features.get("suspicious_url_count") or 0)
    if url_count > 0 and susp == 0 and not features.get("all_urls_trusted"):
        score += min(16, url_count * 4)

    if not features.get("is_trusted_sender") and url_count == 0 and urgency >= 2:
        score += 10

    return max(0, min(100, score))


def compute_heuristic_risk_score(features: dict[str, Any]) -> int:
    """
    Feature-based risk score — varied per email, not flat caps for whole categories.
    """
    threat = compute_threat_score(features)

    if has_strong_phishing_signals(features):
        return max(threat, 50)

    if is_clearly_legitimate_context(features):
        baseline = compute_legitimate_baseline(features)
        if threat < 12:
            return baseline
        return min(28, max(baseline, threat))

    # Unknown sender with mild signals
    mild = 14 + min(30, threat)
    mild += min(10, int(features.get("urgency_score") or 0) * 2)
    return min(54, max(threat, mild))


def derive_classification(score: int, features: dict[str, Any]) -> str:
    """Align label with score bands and hard phishing evidence."""
    if has_strong_phishing_signals(features):
        return "PHISHING"
    if score >= 45:
        return "PHISHING"
    return "LEGITIMATE"


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
    sender_domain = domain_mismatch.get("sender_domain", "")
    trusted_sender = is_trusted_sender(sender)
    trusted_org = ""
    if trusted_sender:
        for brand, domains in BRAND_OFFICIAL_DOMAINS.items():
            if _brand_matches_sender(brand, sender_domain):
                trusted_org = brand
                break

    all_urls_trusted = url_count > 0 and suspicious_url_count == 0 and all(
        is_trusted_host(_host_from_url(u)) for u in urls_found
    )
    google_service = _detect_google_service_notification(
        sender, subject or "", body or "", sender_domain, trusted_sender, trusted_org
    )
    effective_urgency = 0 if (trusted_sender and suspicious_url_count == 0) else urgency_score

    return {
        "sender_email_parsed": _extract_sender_email(sender),
        "urgency_score": urgency_score,
        "effective_urgency_score": effective_urgency,
        "urgency_words": urgency_words,
        "url_count": url_count,
        "urls_found": urls_found,
        "suspicious_urls": suspicious_urls,
        "suspicious_url_count": suspicious_url_count,
        "all_urls_trusted": all_urls_trusted,
        "domain_mismatch": domain_mismatch,
        "html_link_count": _html_link_count(body or ""),
        "subject_all_caps": _subject_all_caps(subject or ""),
        "has_re_fwd_prefix": _has_re_fwd_prefix(subject or ""),
        "is_trusted_sender": trusted_sender,
        "trusted_sender_org": trusted_org,
        "sender_domain": sender_domain,
        **google_service,
    }
