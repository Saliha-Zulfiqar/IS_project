import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq

# Load .env from project root (IS_project/.env)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

SYSTEM_PROMPT = """You are a cybersecurity expert specializing in phishing detection.
Analyze the email and extracted heuristic features carefully.

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
    r"RISK\s*SCORE:\s*\[?(\d{1,3})\]?/100",
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


def _build_user_prompt(
    sender: str,
    subject: str,
    body: str,
    features: dict[str, Any],
) -> str:
    return f"""Analyze this email for phishing.

=== EMAIL ===
From: {sender or "(unknown)"}
Subject: {subject or "(empty)"}
Body:
{body or "(empty)"}

=== EXTRACTED FEATURES (heuristics) ===
{json.dumps(features, indent=2, default=str)}

Use the features and email content together. Respond in the required format only."""


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
