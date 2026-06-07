# Security

## Reporting issues

If you discover a security vulnerability, please report it privately to the repository maintainer (do not open a public issue with exploit details).

## Secrets

- Never commit `.env` or API keys.
- Use `.env.example` as a template only.
- Rotate `GROQ_API_KEY` or `HF_TOKEN` immediately if they are exposed.
- The Chrome extension does not embed API keys; all inference runs through your local backend.

## Local API

The backend binds to `0.0.0.0:8000` for development. Do not expose this port to the public internet without authentication and TLS.

CORS is configured with `allow_origins=["*"]` for local development so the extension iframe and dashboard can call the API. Restrict origins before any production deployment.

## Data flow and privacy

| Step | What is sent | Where |
|------|----------------|-------|
| Gmail/Outlook page | Sender, subject, body (extracted by content script) | Extension in-tab panel |
| Extension → backend | Same fields as JSON `POST /analyze` | `http://localhost:8000` |
| Backend → Groq (default) | Email text + heuristic feature JSON in the LLM prompt | Groq API |
| Backend (optional HF path) | Email text processed locally | Your machine only |

Email content is never sent directly from the extension to Groq. With the default configuration, your **local backend** forwards the analysis prompt to Groq's API — review [Groq's data policies](https://groq.com) before processing sensitive mail.

Heuristic features sent to Groq include urgency words, parsed sender domain, URL flags, trusted-sender status, and impersonation/reference brand signals. These are used for classification only and are returned in the API response under `features`.

## Chrome extension

| Surface | Behavior |
|---------|----------|
| **Content script** | Runs only on Gmail and Outlook URLs listed in `manifest.json` |
| **API calls** | `POST http://localhost:8000/analyze` from the in-tab panel |
| **Storage** | `chrome.storage.local` holds analysis history and optional `api_url` override |
| **Web accessible resources** | Panel assets (`popup.html`, `popup.js`, `style.css`, `human-ui.css`, `dev-profile.css`, `dev-profile.js`, `overlay.css`) exposed only to matched mail domains for the in-tab iframe |
| **External links** | Developer profile card opens [GitHub](https://github.com/Saliha-Zulfiqar/IS_project) and [Hugging Face model page](https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora) in a new tab — no email data is transmitted to those sites |

## Classification safeguards

The backend applies post-LLM calibration to reduce false positives. This is a **usability** measure, not a security guarantee:

- Verified official senders (e.g. `@google.com`) with no suspicious URLs are capped to low risk.
- Third-party emails that mention brands in integration/settings context are not treated as impersonation.
- Actual phishing indicators (malicious URLs, sender impersonation, typosquatted domains) still classify as PHISHING.

Do not rely solely on the risk score for security decisions on high-value accounts. When in doubt, verify through the official service website directly.

## Third-party services

- **Groq API** (default): email fields and heuristic features are included in the LLM prompt. Model: `llama-3.3-70b-versatile`.
- **Hugging Face Hub** (optional local path): model weights are downloaded using `HF_TOKEN`. Adapter: [omerfarooq223/phishing-detector-phi3-lora](https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora).

## License

Academic / project use — add your course or institutional license as required.
