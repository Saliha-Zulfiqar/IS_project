import os
import re
from pathlib import Path
from typing import Any

import torch
from dotenv import load_dotenv
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

HF_TOKEN = os.getenv("HF_TOKEN")

BASE_MODEL = "microsoft/Phi-3-mini-4k-instruct"
LORA_MODEL = "omerfarooq223/phishing-detector-phi3-lora"
MAX_SEQ_LENGTH = 1024

_cached_model = None
_cached_tokenizer = None

_CLASSIFICATION_RE = re.compile(
    r"CLASSIFICATION:\s*\[?(PHISHING|LEGITIMATE)\]?",
    re.IGNORECASE,
)
_RISK_SCORE_RE = re.compile(
    r"RISK\s*SCORE:\s*\[?(\d{1,3})\]?/?100?",
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


def _hf_kwargs() -> dict[str, Any]:
    return {"token": HF_TOKEN} if HF_TOKEN else {}


def load_model():
    """
    Load Phi-3 base model + LoRA adapter once and cache for reuse.
    Returns (model, tokenizer).
    """
    global _cached_model, _cached_tokenizer

    if _cached_model is not None and _cached_tokenizer is not None:
        return _cached_model, _cached_tokenizer

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.float16 if device.type == "cuda" else torch.float32
    hf_kwargs = _hf_kwargs()

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, **hf_kwargs)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=dtype,
        trust_remote_code=True,
        **hf_kwargs,
    )

    model = PeftModel.from_pretrained(base_model, LORA_MODEL, **hf_kwargs)
    model = model.to(device)
    model.eval()

    _cached_model = model
    _cached_tokenizer = tokenizer
    return model, tokenizer


def parse_response(text: str) -> dict[str, Any]:
    """
    Extract CLASSIFICATION, RISK SCORE, REASONS, and CONFIDENCE from model text.
    Returns safe defaults if parsing fails.
    """
    if not text or not text.strip():
        return dict(_PARSE_DEFAULTS)

    try:
        classification_match = _CLASSIFICATION_RE.search(text)
        risk_match = _RISK_SCORE_RE.search(text)
        reasons_match = _REASONS_RE.search(text)
        confidence_match = _CONFIDENCE_RE.search(text)

        classification = None
        if classification_match:
            classification = classification_match.group(1).upper()
        else:
            upper = text.upper()
            if "PHISHING" in upper and "LEGITIMATE" not in upper:
                classification = "PHISHING"
            elif "LEGITIMATE" in upper:
                classification = "LEGITIMATE"

        risk_score = None
        if risk_match:
            risk_score = max(0, min(100, int(risk_match.group(1))))

        confidence = confidence_match.group(1).upper() if confidence_match else None

        reasons = ""
        if reasons_match:
            reasons = reasons_match.group(1).strip().strip("[]")
        elif classification:
            reasons = text.strip()[:500]

        if not classification or risk_score is None or not confidence:
            return dict(_PARSE_DEFAULTS)

        return {
            "classification": classification,
            "risk_score": risk_score,
            "reasons": reasons or _PARSE_DEFAULTS["reasons"],
            "confidence": confidence,
        }
    except (ValueError, AttributeError):
        return dict(_PARSE_DEFAULTS)


def _build_prompt(
    sender: str,
    subject: str,
    body: str,
    features: dict[str, Any],
) -> str:
    urgency_words = features.get("urgency_words") or []
    urgency_str = ", ".join(urgency_words) if urgency_words else "none"

    url_count = features.get("url_count", 0)
    suspicious_url_count = features.get("suspicious_url_count", 0)

    domain_mismatch = features.get("domain_mismatch") or {}
    mismatch_yes_no = "Yes" if domain_mismatch.get("has_mismatch") else "No"

    body_snippet = (body or "")[:500]

    user_block = f"""Analyze this email and determine if it is phishing or legitimate.
SENDER: {sender or "(unknown)"}
SUBJECT: {subject or "(empty)"}
BODY: {body_snippet}
EXTRACTED SIGNALS:
- Urgency words detected: {urgency_str}
- URL count: {url_count}
- Suspicious URL flags: {suspicious_url_count}
- Domain mismatch detected: {mismatch_yes_no}
Based on the above, classify this email and explain which specific elements triggered your decision."""

    return f"<|user|>\n{user_block}<|end|>\n<|assistant|>\n"


def analyze_with_model(
    sender: str,
    subject: str,
    body: str,
    features: dict[str, Any],
) -> dict[str, Any]:
    """
    Run local Phi-3 + LoRA inference and return parsed analysis fields.
    """
    if not HF_TOKEN:
        return {
            **dict(_PARSE_DEFAULTS),
            "raw_response": "",
            "error": "missing_hf_token",
            "reasons": "HF_TOKEN is not configured in .env",
        }

    try:
        model, tokenizer = load_model()
        device = next(model.parameters()).device
        prompt = _build_prompt(sender, subject, body, features)

        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_SEQ_LENGTH,
        )
        inputs = {key: value.to(device) for key, value in inputs.items()}
        input_len = inputs["input_ids"].shape[1]

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=150,
                temperature=0.1,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
                use_cache=True,
            )

        new_tokens = outputs[0][input_len:]
        raw_response = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        parsed = parse_response(raw_response)

        return {
            **parsed,
            "raw_response": raw_response,
        }
    except Exception as exc:
        return {
            **dict(_PARSE_DEFAULTS),
            "raw_response": "",
            "error": "inference_error",
            "reasons": f"Local model inference failed: {exc}",
        }
