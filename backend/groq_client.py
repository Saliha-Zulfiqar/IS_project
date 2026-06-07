import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq

# Load .env from project root (IS_project/.env)
# Try standard locations for .env
for path in [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent / ".env",
    Path.cwd() / ".env",
]:
    if path.exists():
        load_dotenv(path)
        break
else:
    load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

SYSTEM_PROMPT = """You are a senior email-security analyst. Classify each email as PHISHING or LEGITIMATE with a calibrated 0–100 risk score.

=== HOW TO DECIDE (follow in order) ===

STEP 1 — VERIFY THE SENDER DOMAIN
- Parse the real email address (ignore display names like "Google Classroom").
- If is_trusted_sender is true and sender_domain is an official domain for that brand (e.g. @google.com, @accounts.google.com, @microsoft.com), the sender is VERIFIED LEGITIMATE infrastructure.
- PHISHING requires IMPERSONATION: the email pretends to BE Google/PayPal/Amazon (e.g. "Google Team", "your Google account suspended", sender display name "Google").
- NOT impersonation: a third-party vendor (e.g. smile.io, shopify.com) mentioning "Google settings", "Google integration", or "connect to Google" in their own newsletter — see domain_mismatch.referenced_brands.
- Only use domain_mismatch.mismatched_brands when domain_mismatch.has_mismatch is true. Ignore incidental brand mentions.

STEP 2 — ANALYZE EVERY URL
- If all_urls_trusted is true, every link points to a known legitimate host — this strongly supports LEGITIMATE.
- If suspicious_url_count > 0, inspect each flag (IP address, login/verify on untrusted domain, typosquatting, excessive subdomains).
- Official Google links (classroom.google.com, accounts.google.com, policies.google.com, drive.google.com, myaccount.google.com) on a @google.com sender are ALWAYS legitimate — never flag them.

STEP 3 — INTERPRET URGENCY LANGUAGE
- Use effective_urgency_score (not raw urgency_score) when is_trusted_sender is true.
- Phrases like "action required", "verify your account", "security alert", "update your payment", "reset your password" are NORMAL in real Google Classroom, Google Account, and policy-update emails.
- Urgency alone is NEVER enough for PHISHING. It must combine with: wrong sender domain, malicious/untrusted URLs, or clear credential-harvesting intent.

STEP 4 — GOOGLE SERVICE MAIL (very common false-positive area)
Mark LEGITIMATE (risk roughly 2–22, vary by context) when ANY of these apply:
- is_google_service_notification is true AND sender is @google.com or a *.google.com subdomain.
- Google Classroom: assignments, coursework, "classroom-noreply@google.com", links to classroom.google.com.
- Google policy/legal: privacy policy or terms updates from noreply@google.com with policies.google.com links.
- Google Account security: sign-in alerts, 2-step verification, recovery — from @google.com with accounts.google.com links.
- Google Workspace/Drive/Calendar/Docs sharing notifications from @google.com.

STEP 5 — WHEN TO MARK PHISHING (be specific — cite evidence)
Classify PHISHING only when you can name concrete malicious indicators:
- Sender impersonation: domain_mismatch.has_mismatch is true AND impersonation_details show the email claims to be that brand (NOT merely mentioning Google settings from a vendor email).
- Malicious links: suspicious_url_count > 0 with untrusted domains, IP-based URLs, or typosquats (paypa1.com, amazon-security-check.com).
- Credential harvesting: links to non-official domains containing login/verify/secure/confirm paths.
- Financial fraud: fake invoices, wire-transfer demands from unknown domains.
Risk guide: 76–100 = obvious phishing; 45–75 = suspicious; 0–25 = legitimate or low concern.

STEP 6 — WRITE SPECIFIC REASONS
In REASONS, always state:
(1) Sender verdict — e.g. "Sender classroom-noreply@google.com is an official Google domain (verified)."
(2) URL verdict — e.g. "All 1 link(s) point to classroom.google.com (trusted)." OR "Suspicious URL uses IP address / wrong domain."
(3) Urgency/context — e.g. "Contains 'action required' but this is standard for Google policy mail, not impersonation."
(4) Final conclusion — one sentence tying evidence to PHISHING or LEGITIMATE.

Always respond in EXACTLY this format (no extra sections or markdown):

CLASSIFICATION: [PHISHING or LEGITIMATE]
RISK SCORE: [0-100]/100
REASONS: [specific elements that triggered the decision]
CONFIDENCE: [HIGH/MEDIUM/LOW]"""

_CLASSIFICATION_RE = re.compile(
    r"CLASSIFICATION:\s*\[?(PHISHING|LEGITIMATE)\]?",
    re.IGNORECASE,
)
_RISK_SCORE_RE = re.compile(
    r"RISK\s*SCORE:\s*\[?(\d{1,3})\]?(?:\s*/\s*100)?",
    re.IGNORECASE,
)
_REASONS_RE = re.compile(
    r"REASONS:\s*\[?(.+?)\]?\s*(?=CONFIDENCE:|\Z)",
    re.IGNORECASE | re.DOTALL,
)
_CONFIDENCE_RE = re.compile(
    r"CONFIDENCE:\s*\[?(HIGH|MEDIUM|LOW)\]?",
    re.IGNORECASE,
)

_PARSE_DEFAULTS: dict[str, Any] = {
    "classification": "LEGITIMATE",
    "risk_score": 0,
    "reasons": "Could not parse model response; defaulting to low-risk outcome.",
    "confidence": "LOW",
}


def parse_groq_response(response_text: str) -> dict[str, Any]:
    """
    Parse the structured Groq reply into classification, risk_score, reasons, confidence.
    Returns safe defaults if parsing fails.
    """
    if not response_text or not response_text.strip():
        return dict(_PARSE_DEFAULTS)

    try:
        classification_match = _CLASSIFICATION_RE.search(response_text)
        risk_match = _RISK_SCORE_RE.search(response_text)
        reasons_match = _REASONS_RE.search(response_text)
        confidence_match = _CONFIDENCE_RE.search(response_text)

        if not all([classification_match, risk_match, confidence_match]):
            return dict(_PARSE_DEFAULTS)

        classification = classification_match.group(1).upper()
        risk_score = int(risk_match.group(1))
        risk_score = max(0, min(100, risk_score))
        reasons = (reasons_match.group(1) if reasons_match else "").strip()
        reasons = reasons.strip("[]").strip() or _PARSE_DEFAULTS["reasons"]
        confidence = confidence_match.group(1).upper()

        return {
            "classification": classification,
            "risk_score": risk_score,
            "reasons": reasons,
            "confidence": confidence,
        }
    except (ValueError, AttributeError):
        return dict(_PARSE_DEFAULTS)


def _build_verdict_guidance(features: dict[str, Any]) -> str:
    """Pre-computed hints so the model applies the rubric consistently."""
    lines: list[str] = []

    trusted = features.get("is_trusted_sender", False)
    org = features.get("trusted_sender_org") or "unknown"
    domain = features.get("sender_domain") or "unknown"
    parsed = features.get("sender_email_parsed") or "not parsed"

    if trusted:
        lines.append(f"- Sender VERIFIED: {parsed} uses official {org} domain ({domain}).")
    else:
        lines.append(f"- Sender NOT verified as a known brand domain ({domain}).")

    susp = int(features.get("suspicious_url_count") or 0)
    url_count = int(features.get("url_count") or 0)
    if url_count == 0:
        lines.append("- URLs: none found in the message.")
    elif features.get("all_urls_trusted"):
        lines.append(f"- URLs: all {url_count} link(s) resolve to trusted official hosts.")
    elif susp > 0:
        lines.append(f"- URLs: {susp} suspicious link(s) detected — inspect suspicious_urls in features.")
    else:
        lines.append(f"- URLs: {url_count} link(s); none matched trusted-brand hosts.")

    mismatch = features.get("domain_mismatch") or {}
    if mismatch.get("has_mismatch"):
        brands = ", ".join(mismatch.get("mismatched_brands") or [])
        lines.append(f"- Brand IMPERSONATION detected: email pretends to be {brands} from wrong domain.")
    else:
        lines.append("- Brand impersonation: none detected.")
    referenced = mismatch.get("referenced_brands") or []
    if referenced:
        lines.append(
            f"- Brand reference only ({', '.join(referenced)}): mentioned in integration/settings context — "
            "this is NOT impersonation; do not penalize."
        )

    if features.get("is_google_service_notification"):
        types = ", ".join(features.get("google_service_types") or [])
        lines.append(f"- Google service notification detected ({types}). Default to LEGITIMATE if sender is @google.com.")

    eff_urgency = features.get("effective_urgency_score", features.get("urgency_score", 0))
    raw_urgency = features.get("urgency_score", 0)
    if raw_urgency and eff_urgency != raw_urgency:
        lines.append(
            f"- Urgency words present ({raw_urgency}) but discounted for verified sender "
            f"(effective_urgency_score={eff_urgency})."
        )
    elif raw_urgency:
        lines.append(f"- Urgency words found: {features.get('urgency_words', [])}.")

    if trusted and susp == 0 and not mismatch.get("has_mismatch"):
        lines.append(
            "- STRONG LEGITIMATE SIGNAL: verified sender, no suspicious URLs, no brand mismatch. "
            "Use a LOW score (roughly 2–22) that reflects subtle differences: "
            "more urgency words or links → slightly higher within that band; "
            "plain policy/classroom notices → lower end."
        )

    return "\n".join(lines)


def _build_user_prompt(
    sender: str,
    subject: str,
    body: str,
    features: dict[str, Any],
) -> str:
    guidance = _build_verdict_guidance(features)
    return f"""Analyze this email for phishing using the rubric in your instructions.

=== EMAIL ===
From: {sender or "(unknown)"}
Parsed sender email: {features.get("sender_email_parsed") or "(unknown)"}
Subject: {subject or "(empty)"}
Body:
{body or "(empty)"}

=== ANALYST PRE-CHECK (use this with features below) ===
{guidance}

=== EXTRACTED FEATURES (heuristics) ===
{json.dumps(features, indent=2, default=str)}

Apply all six decision steps. Be specific in REASONS (sender, URLs, urgency context, conclusion). Respond in the required format only."""


def analyze_with_groq(
    sender: str,
    subject: str,
    body: str,
    features: dict[str, Any],
) -> dict[str, Any]:
    """
    Send email + features to Groq and return a parsed analysis dict.
    """
    if client is None:
        return {
            **dict(_PARSE_DEFAULTS),
            "reasons": "GROQ_API_KEY is not configured in .env",
            "raw_response": "",
            "error": "missing_api_key",
        }

    user_prompt = _build_user_prompt(sender, subject, body, features)

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
        )
        raw_response = completion.choices[0].message.content or ""
    except Exception as exc:
        return {
            **dict(_PARSE_DEFAULTS),
            "reasons": f"Groq API call failed: {exc}",
            "raw_response": "",
            "error": "api_error",
        }

    parsed = parse_groq_response(raw_response)
    return {
        **parsed,
        "raw_response": raw_response,
    }
