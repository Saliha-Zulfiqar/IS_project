"""
Send three sample emails to POST /analyze and print formatted results.
Run with the backend server up: python main.py
"""

import json
import sys

import requests

API_URL = "http://localhost:8000/analyze"

TEST_CASES = [
    {
        "name": "Test 1 — Obvious phishing (fake PayPal suspension)",
        "payload": {
            "sender": "security-alert@paypa1-verify.net",
            "subject": "URGENT: Your PayPal account has been suspended",
            "body": (
                "Dear Customer,\n\n"
                "We detected unusual activity on your PayPal account. "
                "Your account has been SUSPENDED until you verify your identity.\n\n"
                "Click here immediately to restore access:\n"
                "http://192.168.0.99/secure/login/verify/paypal/account-update\n\n"
                "Failure to act within 24 hours will result in permanent closure.\n\n"
                "PayPal Security Team"
            ),
        },
    },
    {
        "name": "Test 2 — Legitimate business email (meeting confirmation)",
        "payload": {
            "sender": "calendar@company.com",
            "subject": "Confirmed: Project sync — Thursday 2:00 PM",
            "body": (
                "Hi team,\n\n"
                "This confirms our project sync for Thursday at 2:00 PM in Conference Room B.\n"
                "Agenda: sprint review and Q2 planning.\n\n"
                "Please reply if you need to reschedule.\n\n"
                "Best regards,\n"
                "Operations Team"
            ),
        },
    },
    {
        "name": "Test 3 — Subtle phishing (fake Amazon order + suspicious link)",
        "payload": {
            "sender": "orders@amazon-security-check.com",
            "subject": "Your Amazon order #104-8821931 — action needed",
            "body": (
                "Hello,\n\n"
                "Thank you for your recent purchase. A charge of $249.99 is pending.\n"
                "If you did not place this order, cancel it immediately:\n\n"
                "https://amazon-secure-confirm-login.xyz/order/cancel?id=8821931&verify=1\n\n"
                "Order details are attached. This message was sent from a notification-only address.\n\n"
                "Amazon Customer Service"
            ),
        },
    },
]


def print_result(name: str, data: dict) -> None:
    print("=" * 72)
    print(name)
    print("=" * 72)
    print(f"  Classification : {data.get('classification', 'N/A')}")
    print(f"  Risk score     : {data.get('risk_score', 'N/A')}/100")
    print(f"  Risk level     : {data.get('risk_level', 'N/A')}")
    print(f"  Confidence     : {data.get('confidence', 'N/A')}")
    print(f"  Recommendation : {data.get('recommendation', 'N/A')}")
    print()
    print("  Reasons:")
    reasons = data.get("reasons", "N/A")
    for line in str(reasons).split("\n"):
        print(f"    {line}")
    print()


def main() -> int:
    print("PhishGuard API test — POST /analyze\n")
    print(f"Target: {API_URL}\n")

    try:
        health = requests.get("http://localhost:8000/health", timeout=5)
        health.raise_for_status()
        print(f"Health check OK — model: {health.json().get('model')}\n")
    except requests.RequestException as exc:
        print("ERROR: Backend is not reachable on port 8000.")
        print("Start it first:  cd backend  &&  python main.py")
        print(f"Detail: {exc}")
        return 1

    for case in TEST_CASES:
        try:
            response = requests.post(
                API_URL,
                json=case["payload"],
                headers={"Content-Type": "application/json"},
                timeout=120,
            )
            response.raise_for_status()
            data = response.json()
            print_result(case["name"], data)
        except requests.RequestException as exc:
            print("=" * 72)
            print(case["name"])
            print("=" * 72)
            print(f"  REQUEST FAILED: {exc}")
            if getattr(exc, "response", None) is not None and exc.response.text:
                print(f"  Response body: {exc.response.text[:500]}")
            print()
            return 1

    print("All tests completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
