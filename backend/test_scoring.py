"""
Offline tests for risk scoring and classification (no API / Groq required).
Run: python test_scoring.py
"""

from __future__ import annotations

import sys

from feature_extractor import (
    compute_heuristic_risk_score,
    compute_legitimate_baseline,
    derive_classification,
    extract_features,
    has_strong_phishing_signals,
    is_clearly_legitimate_context,
)
from risk_scoring import finalize_analysis

SAMPLES = [
    {
        "name": "PayPal phishing",
        "sender": "security-alert@paypa1-verify.net",
        "subject": "URGENT: Your PayPal account has been suspended",
        "body": (
            "Click here immediately: http://192.168.0.99/secure/login/verify/paypal/account-update\n"
            "Failure to act within 24 hours will result in permanent closure."
        ),
        "expect_class": "PHISHING",
        "min_score": 45,
    },
    {
        "name": "Amazon phishing",
        "sender": "orders@amazon-security-check.com",
        "subject": "Your Amazon order — action needed",
        "body": (
            "Cancel it immediately:\n"
            "https://amazon-secure-confirm-login.xyz/order/cancel?id=8821931&verify=1"
        ),
        "expect_class": "PHISHING",
        "min_score": 45,
    },
    {
        "name": "Google Classroom",
        "sender": "classroom-noreply@google.com",
        "subject": "New assignment posted in CS 101",
        "body": "Open Classroom:\nhttps://classroom.google.com/c/NTg2MjM4MjM4",
        "expect_class": "LEGITIMATE",
        "max_score": 24,
    },
    {
        "name": "Google policy",
        "sender": "noreply@google.com",
        "subject": "We're updating our Privacy Policy",
        "body": "Read the updated policy:\nhttps://policies.google.com/privacy/update",
        "expect_class": "LEGITIMATE",
        "max_score": 24,
    },
    {
        "name": "Google security alert",
        "sender": "no-reply@accounts.google.com",
        "subject": "Security alert: new sign-in on your Google Account",
        "body": (
            "We noticed a new sign-in.\n"
            "Review activity:\nhttps://accounts.google.com/AccountChooser"
        ),
        "expect_class": "LEGITIMATE",
        "max_score": 24,
    },
    {
        "name": "Smile.io vendor reference",
        "sender": "Smile.io <noreply@customer-mail.smile.io>",
        "subject": "Two new settings to help you work better with Google",
        "body": "Customize how reviews sync with your Google Business Profile.",
        "expect_class": "LEGITIMATE",
        "max_score": 24,
    },
    {
        "name": "Plain business mail",
        "sender": "calendar@company.com",
        "subject": "Confirmed: Project sync — Thursday 2:00 PM",
        "body": "This confirms our project sync for Thursday at 2:00 PM.",
        "expect_class": "LEGITIMATE",
        "max_score": 54,
    },
]


def run_tests() -> int:
    failures: list[str] = []
    legit_scores: list[tuple[str, int]] = []

    for sample in SAMPLES:
        features = extract_features(sample["sender"], sample["subject"], sample["body"])
        heuristic = compute_heuristic_risk_score(features)
        classification = derive_classification(heuristic, features)

        fake_llm = {
            "classification": "LEGITIMATE",
            "risk_score": 8,
            "reasons": "LLM stub response for testing.",
            "confidence": "HIGH",
        }
        finalized = finalize_analysis(features, fake_llm)
        final_score = finalized["risk_score"]
        final_class = finalized["classification"]

        if final_class != sample["expect_class"]:
            failures.append(
                f"{sample['name']}: expected {sample['expect_class']}, got {final_class} "
                f"(score={final_score}, heuristic={heuristic})"
            )
        if "min_score" in sample and final_score < sample["min_score"]:
            failures.append(
                f"{sample['name']}: score {final_score} below min {sample['min_score']}"
            )
        if "max_score" in sample and final_score > sample["max_score"]:
            failures.append(
                f"{sample['name']}: score {final_score} above max {sample['max_score']}"
            )

        if sample["expect_class"] == "LEGITIMATE" and is_clearly_legitimate_context(features):
            legit_scores.append((sample["name"], final_score))

    unique_legit = {score for _, score in legit_scores}
    if len(unique_legit) < 3:
        failures.append(
            f"Legitimate emails produced too few distinct scores: {dict(legit_scores)}"
        )

  # Classroom vs security alert should differ
    classroom = next(s for s in legit_scores if "Classroom" in s[0])[1]
    security = next(s for s in legit_scores if "security" in s[0].lower())[1]
    if classroom == security:
        failures.append(
            f"Google Classroom ({classroom}) and security alert ({security}) should not share the same score"
        )

    if failures:
        print("FAILED:")
        for msg in failures:
            print(f"  - {msg}")
        return 1

    print("All scoring tests passed.")
    print("Legitimate email scores (varied):")
    for name, score in legit_scores:
        sample = next(s for s in SAMPLES if s["name"] == name)
        feats = extract_features(sample["sender"], sample["subject"], sample["body"])
        baseline = compute_legitimate_baseline(feats)
        print(f"  {name}: {score}/100 (baseline {baseline})")
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
