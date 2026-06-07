"""Blend LLM analysis with feature-based risk scoring and classification."""

from __future__ import annotations

from typing import Any

import feature_extractor


def _format_trusted_reason(features: dict[str, Any], org: str) -> str:
    parsed = features.get("sender_email_parsed") or features.get("sender_domain") or "unknown sender"
    domain = features.get("sender_domain") or "unknown domain"
    url_count = int(features.get("url_count") or 0)
    google_types = features.get("google_service_types") or []

    parts = [f"Sender: {parsed} — verified official {org} domain ({domain})."]
    if features.get("is_google_service_notification") and google_types:
        label = google_types[0].replace("google_", "Google ").replace("_", " ")
        parts.append(f"Content matches a legitimate {label} notification.")
    if url_count > 0 and features.get("all_urls_trusted"):
        parts.append(f"All {url_count} link(s) point to trusted {org} infrastructure.")
    elif url_count == 0:
        parts.append("No links were found in the message body.")
    urgency = features.get("urgency_words") or []
    if urgency and features.get("effective_urgency_score", 0) == 0:
        words = ", ".join(f'"{w}"' for w in urgency[:4])
        parts.append(
            f"Urgency phrases ({words}) are normal for official {org} transactional mail, not impersonation."
        )
    parts.append("Conclusion: legitimate service notification — not phishing.")
    return " ".join(parts)


def _format_reference_reason(features: dict[str, Any], referenced: list[str]) -> str:
    parsed = features.get("sender_email_parsed") or features.get("sender_domain") or "unknown sender"
    brands = ", ".join(referenced)
    return (
        f"Sender: {parsed} — this is a third-party email, not pretending to be {brands}. "
        f"The message only references {brands} (e.g. integration or settings), which is normal. "
        f"No suspicious links or impersonation phrases found. "
        f"Conclusion: legitimate email — not phishing."
    )


def _llm_analysis_usable(analysis: dict[str, Any]) -> bool:
    reasons = analysis.get("reasons") or ""
    return not (
        analysis.get("error")
        or "Could not parse model response" in reasons
        or "GROQ_API_KEY is not configured" in reasons
        or "Groq API call failed" in reasons
    )


def finalize_analysis(features: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    """
    Blend LLM output with feature-based scoring.
    Avoids flat caps (10/15) so similar email types still get distinct scores.
    """
    result = dict(analysis)
    heuristic = feature_extractor.compute_heuristic_risk_score(features)
    llm_ok = _llm_analysis_usable(analysis)
    llm_score = int(analysis.get("risk_score", 0))
    org = features.get("trusted_sender_org") or "trusted service"
    mismatch = features.get("domain_mismatch") or {}
    referenced = mismatch.get("referenced_brands") or []

    if not llm_ok:
        final_score = heuristic
        result["reasons"] = (
            f"Feature-based analysis (AI unavailable or unparseable): score {heuristic}/100. "
            f"Urgency hits: {len(features.get('urgency_words') or [])}, "
            f"suspicious URLs: {features.get('suspicious_url_count', 0)}, "
            f"brand impersonation: {mismatch.get('has_mismatch', False)}."
        )
        result["confidence"] = "MEDIUM" if heuristic >= 45 else "LOW"
    elif feature_extractor.has_strong_phishing_signals(features):
        final_score = max(heuristic, llm_score)
        result["confidence"] = analysis.get("confidence") or ("HIGH" if final_score >= 70 else "MEDIUM")
    elif feature_extractor.is_clearly_legitimate_context(features):
        baseline = feature_extractor.compute_legitimate_baseline(features)
        final_score = round(0.20 * llm_score + 0.25 * heuristic + 0.55 * baseline)
        final_score = max(1, min(24, final_score))

        if referenced and not mismatch.get("has_mismatch"):
            result["reasons"] = _format_reference_reason(features, referenced)
        elif llm_score > 35 or analysis.get("classification") == "PHISHING":
            result["reasons"] = _format_trusted_reason(features, org)
        elif len(analysis.get("reasons") or "") < 40:
            result["reasons"] = _format_trusted_reason(features, org)
        result["confidence"] = "HIGH" if final_score <= 16 else "MEDIUM"
    else:
        final_score = round(0.40 * llm_score + 0.60 * heuristic)
        final_score = max(0, min(100, final_score))
        result["confidence"] = analysis.get("confidence") or "MEDIUM"

    classification = feature_extractor.derive_classification(final_score, features)

    susp_count = int(features.get("suspicious_url_count") or 0)
    if features.get("is_trusted_sender") and susp_count > 0:
        final_score = max(final_score, min(58, 38 + susp_count * 8))
        classification = "PHISHING" if final_score >= 45 else "LEGITIMATE"
        result["confidence"] = "MEDIUM"
        if not mismatch.get("has_mismatch"):
            result["reasons"] = (
                f"Verified {org} sender, but {susp_count} link(s) had unusual flags — "
                f"review URLs before clicking. {analysis.get('reasons', '')}"
            ).strip()

    if classification == "PHISHING" and final_score < 45:
        final_score = max(final_score, 45)
    if (
        classification == "LEGITIMATE"
        and final_score >= 45
        and not feature_extractor.is_clearly_legitimate_context(features)
    ):
        classification = "PHISHING"

    result["classification"] = classification
    result["risk_score"] = int(final_score)
    return result
