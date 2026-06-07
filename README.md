# PhishGuard AI

AI-powered phishing email detection with heuristic feature extraction, Groq LLM analysis (default), optional local Phi-3 LoRA inference, and a Chrome extension that scans emails in Gmail and Outlook without leaving the tab.

**Developer:** Saliha Zulfiqar · [GitHub](https://github.com/Saliha-Zulfiqar/IS_project) · [Fine-tuned model on Hugging Face](https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora)

## Architecture

```mermaid
flowchart LR
  subgraph ext [Chrome Extension]
    CS[content.js]
    Panel[In-tab slide-in panel]
    Dash[dashboard.html]
    CS -->|auto-extract email| Panel
    Panel -->|POST /analyze| API
    Dash -->|history from storage| User[User]
  end
  subgraph api [FastAPI Backend :8000]
    FE[feature_extractor.py]
    GQ[groq_client.py]
    CAL[calibrate_analysis]
    HF[hf_client.py optional]
    FE --> GQ
    GQ --> CAL
    FE -.-> HF
  end
  CAL --> Result[Risk score & classification]
  GQ -->|llama-3.3-70b-versatile| CAL
```

| Layer | Role |
|-------|------|
| **content.js** | Floating “Check for phishing” button on Gmail/Outlook; extracts sender, subject, and body |
| **In-tab panel** | Slide-in drawer (iframe) with analysis UI — no separate popup window |
| **dashboard.html** | Full-page history, stats, and settings (opened from toolbar icon) |
| **feature_extractor.py** | Urgency keywords, URLs, trusted-sender detection, brand impersonation vs reference, Google service patterns |
| **groq_client.py** | Default inference via Groq API (`llama-3.3-70b-versatile`) with a structured 6-step analyst rubric |
| **calibrate_analysis** (`main.py`) | Post-processing to reduce false positives on verified senders and third-party brand references |
| **hf_client.py** | Optional local Phi-3 + LoRA path (disabled by default in `main.py`) |

## Classification pipeline

Each email goes through three stages:

1. **Heuristic features** — urgency words, URL analysis, trusted-host checks, domain impersonation detection, Google Classroom/policy/account pattern matching.
2. **Groq LLM analysis** — structured prompt with sender verification, URL review, urgency context, and specific reason formatting.
3. **Calibration** — backend overrides that cap risk when signals clearly indicate legitimate mail.

### False-positive safeguards

| Scenario | Handling |
|----------|----------|
| **Google Classroom / policy / account mail** from `@google.com` | Trusted sender + official Google URLs → LEGITIMATE, risk capped at 10 |
| **Verified brand senders** (Microsoft, PayPal, etc.) with clean URLs | LEGITIMATE, risk capped at 15 |
| **Third-party vendor mail** mentioning “Google settings” or integrations (e.g. Smile.io) | Treated as brand *reference*, not impersonation → LEGITIMATE, risk capped at 15 |
| **Actual impersonation** | Wrong sender domain + impersonation phrases (“Google Team”, “account suspended”) or malicious URLs → PHISHING |

Impersonation is only flagged when the email **pretends to be** a brand — not when it merely **mentions** a brand in product/integration context.

## Prerequisites

- **Python 3.10+**
- **Google Chrome** (for the extension)
- **Groq API key** — required for the default backend ([console.groq.com](https://console.groq.com))
- **Hugging Face account** — only if you enable the local Phi-3 + LoRA path:
  - [microsoft/Phi-3-mini-4k-instruct](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct)
  - [omerfarooq223/phishing-detector-phi3-lora](https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora)
  - ~8 GB disk for first-time model download (CPU weights)

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/Saliha-Zulfiqar/IS_project.git
cd IS_project
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `.env` and set `GROQ_API_KEY`. Do **not** commit `.env`.

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

Optionally set `HF_TOKEN` if you switch `main.py` to use the local Hugging Face model.

### 2. Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt
```

From the **project root** (`IS_project/`), start the API:

```bash
# Activate the venv first, then:
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  
- Root: http://localhost:8000/

With the default Groq backend, `/health` returns `"status": "ok"` and `"groq_ready": true` when `GROQ_API_KEY` is configured. `"model_loaded": false` is expected — the local Phi-3 model is not loaded unless you enable `hf_client`.

If you enable the local HF model in `main.py`, wait until logs show **Model loaded successfully.** The first run can take several minutes while weights download.

### 3. Run API tests (optional)

In a second terminal:

```bash
cd backend
.\.venv\Scripts\Activate.ps1
set PYTHONIOENCODING=utf-8   # Windows — avoids Unicode print errors
python test_api.py
```

Tests cover obvious phishing, legitimate business mail, Google Classroom, Google policy updates, Google security alerts, third-party vendor mail mentioning Google, and subtle Amazon phishing.

### 4. Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `chrome-extension` folder
4. Open Gmail or Outlook and open an email
5. Click the floating **Check for phishing** button (bottom-right)
6. The analysis panel slides in from the right **within the same tab**
7. Click the toolbar extension icon to open the **dashboard** in a new tab

Ensure the backend stays on **http://localhost:8000**.

**Panel controls:** close with the × button, click the backdrop, or press `Esc`.

**Developer profile:** click the **Saliha Zulfiqar** chip in the dashboard header or the compact chip in the analysis panel footer to open the profile card with links to the [GitHub repository](https://github.com/Saliha-Zulfiqar/IS_project) and the [fine-tuned Hugging Face model](https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora).

## API

### `POST /analyze`

```json
{
  "sender": "alert@example.com",
  "subject": "URGENT: verify your account",
  "body": "Click here to verify..."
}
```

**Response:** `classification`, `risk_score` (0–100), `risk_level` (HIGH/MEDIUM/LOW), `reasons`, `confidence`, `features`, `recommendation`

The `features` object includes useful fields for debugging:

| Field | Description |
|-------|-------------|
| `is_trusted_sender` | Sender domain matches a known official brand domain |
| `all_urls_trusted` | Every URL in the email points to a trusted host |
| `domain_mismatch.has_mismatch` | True only for brand **impersonation**, not casual mentions |
| `domain_mismatch.referenced_brands` | Brands mentioned in integration/settings context |
| `is_google_service_notification` | Google Classroom, policy, account, or Workspace patterns detected |
| `effective_urgency_score` | Urgency discounted for verified senders |

| Risk score | Level | Recommendation |
|------------|-------|----------------|
| ≥ 75 | HIGH | Do not click links; delete email |
| 45–74 | MEDIUM | Proceed with caution; verify sender |
| &lt; 45 | LOW | Appears safe |

### `GET /health`

Returns `status`, `model`, `model_loaded`, and `groq_ready`.

```json
{
  "status": "ok",
  "model": "Groq API (no fine-tuned model)",
  "model_loaded": false,
  "groq_ready": true
}
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes (default app) | Groq API key for LLM analysis |
| `HF_TOKEN` | No | Hugging Face token — only if enabling `hf_client` in `main.py` |

## Project structure

```
IS_project/
├── backend/
│   ├── main.py              # FastAPI app, calibration, Groq by default
│   ├── feature_extractor.py # Heuristics, trusted senders, impersonation detection
│   ├── groq_client.py       # Groq API inference + analyst rubric prompt
│   ├── hf_client.py         # Optional Phi-3 + LoRA inference
│   ├── test_api.py          # 8 sample requests (phishing + legitimate cases)
│   └── requirements.txt
├── chrome-extension/
│   ├── manifest.json
│   ├── background.js        # Toolbar icon → dashboard
│   ├── content.js           # Gmail/Outlook inject + in-tab panel
│   ├── overlay.css          # Floating button & slide-in panel styles
│   ├── popup.html/js/css    # Analysis UI (embedded in panel)
│   ├── dashboard.html/js/css
│   ├── human-ui.css         # Shared light-theme tokens
│   ├── dev-profile.css/js   # Developer profile modal card
│   └── icon*.png
├── scripts/
│   └── generate_icons.py
├── .env.example
├── README.md
└── SECURITY.md
```

## Regenerate extension icons

```bash
python scripts/generate_icons.py
```

## Notes

- `phishing_detector_FINAL.zip` is **gitignored**; the local HF path pulls the LoRA adapter from [Hugging Face Hub](https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora).
- CPU PyTorch is pinned for a lighter install; local inference is slower than GPU but needs no CUDA.
- Analysis history is stored in `chrome.storage.local` (up to 100 entries) and viewable in the dashboard.
- The extension requests `host_permissions` for `http://localhost:8000/*` only.
- After backend changes, restart uvicorn and reload the extension at `chrome://extensions`.

## License

Academic / project use — add your course or institutional license as required.
