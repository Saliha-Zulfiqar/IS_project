# PhishGuard AI — Presentation Source Document

> **Instructions for NotebookLM:** This document is structured as a 12-slide presentation guide for an Information Security course project. Each section corresponds to one slide. Generate slides using the **Slide Title**, **Bullet Points** (for on-slide content), and **Speaker Notes** (for the presenter's talking points). Include the **Visual** descriptions as diagram/image placeholders on each slide.

---

## SLIDE 1 — Title Slide

### Slide Title
**PhishGuard AI: AI-Powered Phishing Email Detection System**

### Bullet Points
- Developer: **Saliha Zulfiqar**
- Course: Information Security
- Date: June 2026
- GitHub: github.com/Saliha-Zulfiqar/IS_project
- Fine-tuned Model: huggingface.co/omerfarooq223/phishing-detector-phi3-lora

### Speaker Notes
PhishGuard AI is a full-stack phishing email analysis system that combines heuristic rule-based analysis with large language model reasoning. It operates as a Chrome browser extension integrated directly into Gmail and Outlook, backed by a Python FastAPI server that performs the analysis. The project was built for the Information Security course to address the problem of real-time phishing detection with transparent, explainable results.

### Visual
A shield icon with a checkmark inside it, representing email protection. The PhishGuard AI logo. Gradient background in dark blue/teal tones for a premium, security-themed feel.

---

## SLIDE 2 — Problem Statement & Motivation

### Slide Title
**The Phishing Problem**

### Bullet Points
- Phishing is the #1 attack vector — 3.4 billion spam emails sent daily worldwide
- Attackers impersonate trusted brands (PayPal, Google, Amazon, Microsoft) to steal credentials
- Existing email filters fail against zero-day phishing, sophisticated brand impersonation, and social engineering
- Users lack real-time, in-context analysis that explains *why* an email is suspicious
- Gap: no tool provides transparent AI reasoning + heuristic precision inside the inbox

### Speaker Notes
Phishing remains the most prevalent cybersecurity threat. Attackers craft emails that look like they are from PayPal, Google, Amazon, or Microsoft — using typosquatted domains like "paypa1-verify.net" (with a number one instead of letter L) or "amazon-security-check.com" to trick users. Traditional spam filters use static rules and signature matching, which fail against new, unseen phishing patterns. Even machine learning-based filters operate as black boxes — they flag or pass an email without explaining why. PhishGuard AI addresses this gap by combining rule-based heuristics with LLM reasoning to provide transparent, explainable phishing verdicts directly inside Gmail and Outlook, so users understand exactly what triggered the alert.

### Visual
A diagram showing three email icons — one legitimate (green checkmark), one obviously spam (red X), and one sophisticated phishing email (yellow question mark) that slips past a wall labeled "Traditional Filters". An arrow points from the phishing email through the wall to the user.

---

## SLIDE 3 — Project Goals & Solution Overview

### Slide Title
**What PhishGuard AI Does**

### Bullet Points
- **Browser-integrated:** Works inside Gmail and Outlook — no separate tool needed
- **Hybrid AI:** Combines 25+ heuristic rules with Groq LLM (llama-3.3-70b-versatile) reasoning
- **False-positive smart:** Distinguishes brand impersonation from brand references — won't flag a Smile.io email about "Google settings" as phishing
- **Graduated scoring:** Risk scores 0–100 where similar emails get distinct, nuanced scores (not flat caps)
- **Explainable:** Every verdict includes specific reasons citing sender, URLs, urgency, and conclusion
- **Privacy-first:** Local backend on localhost; optional fully offline Phi-3 + LoRA model

### Speaker Notes
PhishGuard AI has six core design goals. First, it works inside the user's inbox — a floating button appears on every email in Gmail or Outlook, and analysis happens in a slide-in panel within the same tab. Second, it uses a hybrid approach: 25 urgency keywords, URL analysis, trusted sender verification, and brand impersonation detection as heuristics, combined with a 70-billion parameter LLM that follows a structured 6-step analyst rubric. Third, and this is a key innovation, it distinguishes between brand impersonation (an email pretending to BE Google) and brand reference (a third-party vendor mentioning Google settings) — drastically reducing false positives. Fourth, the scoring is graduated: a Google Classroom assignment gets a different score than a Google security alert, which gets a different score than a Google policy update. Fifth, every verdict explains exactly what triggered the decision. Sixth, all analysis runs through a local backend — email data never goes directly to any cloud service from the browser.

### Visual
A horizontal flow diagram: Email Inbox (Gmail/Outlook icon) → Floating "Is this email safe?" Button → Slide-in Analysis Panel → Verdict (Shield with score). Below it, two badges: "PHISHING — Risk 78/100" (red) and "LEGITIMATE — Risk 8/100" (green).

---

## SLIDE 4 — System Architecture

### Slide Title
**Three-Layer Architecture**

### Bullet Points
- **Layer 1 — Chrome Extension (Frontend):** Content script extracts email from Gmail/Outlook DOM → floating button → in-tab slide-in panel with iframe
- **Layer 2 — FastAPI Backend (localhost:8000):** Email parsing → heuristic feature extraction → LLM analysis → blended risk scoring
- **Layer 3 — AI Analysis:** Groq API (llama-3.3-70b) default OR local Phi-3 + LoRA (fully offline)
- **Data Flow:** Extension sends `POST /analyze` to local backend → backend sends analysis prompt (not raw email) to Groq → returns verdict to extension
- **Storage:** chrome.storage.local (up to 100 scans, no server database)

### Speaker Notes
The architecture has three layers. The Chrome extension is a Manifest V3 extension with a content script that injects into Gmail and Outlook pages. It extracts the sender, subject, and body from the email DOM — using specific selectors like `span[email]` for Gmail sender and `.a3s` for the message body, carefully scoping to the open message to avoid picking up wrong senders from inbox rows or footers. When the user clicks the floating button, the extension sends a POST request to the local FastAPI backend at localhost:8000. The backend runs a four-stage pipeline: parsing, feature extraction, LLM analysis, and blended scoring. The default AI path uses Groq's llama-3.3-70b-versatile model via API, but there's an optional fully local path using Microsoft Phi-3-mini with a LoRA adapter fine-tuned for phishing detection on Hugging Face. Importantly, the extension never communicates directly with Groq — the local backend mediates all AI calls. Results are stored in the browser's local storage (up to 100 scans) with no server-side database.

### Visual
A three-tier architecture diagram with arrows showing data flow:
- Top tier: "Chrome Extension" box containing: content.js (email extraction) → popup.js (analysis UI) → dashboard.js (history/stats)
- Middle tier: "FastAPI Backend :8000" box containing: email_parser.py → feature_extractor.py → groq_client.py → risk_scoring.py
- Bottom tier: "AI Layer" with two options: "Groq API (llama-3.3-70b)" and "Local Phi-3 + LoRA (optional)"
- Arrows: Extension → POST /analyze → Backend → LLM prompt → AI Layer → Verdict → Extension

---

## SLIDE 5 — Technology Stack

### Slide Title
**Technology Stack**

### Bullet Points

| Layer | Technologies |
|-------|-------------|
| Backend | Python 3.10+, FastAPI 0.115.6, Uvicorn, Pydantic 2.10.3 |
| AI / LLM (Default) | Groq API, llama-3.3-70b-versatile, temperature 0.1 |
| AI / LLM (Optional) | PyTorch 2.7.1, Transformers 4.46.3, PEFT 0.13.2, Phi-3 + LoRA |
| Parsing | Python email.parser (RFC 5322), BeautifulSoup4, Requests |
| Frontend | Chrome Extension Manifest V3, vanilla HTML/CSS/JS |
| Storage | chrome.storage.local — no server database |

### Speaker Notes
The backend is built with FastAPI, a modern Python web framework, running on Uvicorn with Pydantic for request/response validation. The default AI path uses the Groq API with the llama-3.3-70b-versatile model at temperature 0.1 for consistent, deterministic outputs. The optional local model path uses PyTorch with Hugging Face Transformers and PEFT for LoRA adapter loading — the base model is Microsoft Phi-3-mini-4k-instruct with a LoRA adapter fine-tuned specifically for phishing detection, available on Hugging Face as omerfarooq223/phishing-detector-phi3-lora. CPU-only PyTorch is pinned for lighter installs. Email parsing uses Python's built-in email library for RFC 5322/MIME compliance. The Chrome extension is built with Manifest V3 using vanilla HTML, CSS, and JavaScript — no build step or framework. All analysis history is stored client-side in chrome.storage.local.

### Visual
A clean table or icon grid showing each technology with its logo. Group them by layer with visual separators. Use technology logos: Python, FastAPI, Chrome, PyTorch, Hugging Face.

---

## SLIDE 6 — Classification Pipeline (4 Stages)

### Slide Title
**4-Stage Classification Pipeline**

### Bullet Points
1. **PARSE** — Accept structured fields (sender, subject, body) OR raw `.eml` text (RFC 5322 MIME) via email_parser.py
2. **EXTRACT** — Run 657 lines of heuristic analysis: 25 urgency keywords, URL pattern analysis, trusted sender verification against 9-brand official domain registry, brand impersonation vs. reference distinction, Google service notification detection
3. **ANALYZE** — Send email + features to Groq LLM with a structured 6-step analyst rubric: verify sender → analyze URLs → interpret urgency → check Google services → identify phishing signals → write specific reasons
4. **SCORE** — Blend LLM and heuristic scores: strong phishing → max(LLM, heuristic); legitimate → 20% LLM + 25% heuristic + 55% baseline (capped at 24); ambiguous → 40% LLM + 60% heuristic

### Speaker Notes
The pipeline has four stages. Stage 1 is parsing — the system accepts either structured JSON fields or raw .eml email source text, which is parsed using Python's BytesParser with RFC 5322 MIME compliance, handling multipart messages and HTML-to-text conversion. Stage 2 is the heuristic feature extraction — the largest module at 657 lines. It checks for 25 urgency trigger phrases, extracts and analyzes all URLs for suspicious patterns (IP addresses, suspicious keywords like login/verify in untrusted domains, excessive subdomains), verifies the sender against an official domain registry covering 9 major brands with 40+ official domains, and critically distinguishes between brand impersonation and brand reference. Stage 3 sends everything to the Groq LLM with a detailed system prompt that acts as a senior email-security analyst following a 6-step decision rubric. The LLM response is parsed via regex to extract classification, risk score, reasons, and confidence. Stage 4 blends the scores — the blending strategy changes based on context: strong phishing evidence uses the maximum of both scores; clearly legitimate emails use a weighted blend heavily favoring the baseline (55%) and capped at 24; ambiguous cases weight heuristics at 60%.

### Visual
A horizontal pipeline diagram with four colored stages connected by arrows:
- Stage 1 (blue): "PARSE" with email icon → 
- Stage 2 (orange): "EXTRACT" with magnifying glass icon → 
- Stage 3 (purple): "ANALYZE" with AI brain icon → 
- Stage 4 (green): "SCORE" with gauge/meter icon → 
- Output: "VERDICT" with shield icon

---

## SLIDE 7 — Heuristic Feature Extraction (Deep Dive)

### Slide Title
**Heuristic Feature Extraction — The Intelligence Layer**

### Bullet Points
- **25 Urgency Keywords:** "urgent", "act now", "account suspended", "verify your account", "click here", "wire transfer", "unauthorized access", etc. — matched case-insensitively in subject + body
- **URL Analysis:** Regex extraction → per-URL checks for IP addresses, length > 75 chars, > 4 subdomains, suspicious path keywords (login, verify, secure, confirm) → trusted host matching
- **9-Brand Domain Registry:** 40+ official domains — Google (20 domains incl. classroom.google.com, accounts.google.com), Microsoft (6), Apple (3), Amazon (4), PayPal (2), Facebook (3), Instagram (2), Netflix (2), Dropbox (2)
- **Impersonation vs. Reference:** "Your Google account is suspended" from a non-Google domain = IMPERSONATION ❌. "New settings to work better with Google" from Smile.io = REFERENCE ✅. This distinction is a key innovation.
- **Google Service Detection:** Classroom, Policy, Account, Workspace — verified sender + official URLs → not phishing
- **Urgency Discounting:** Effective urgency = 0 for verified senders with clean URLs (because "action required" is normal in real Google mail)

### Speaker Notes
The feature extraction module is the backbone of the system. It extracts 15+ features from each email. The urgency detector checks for 25 common phishing trigger phrases — but crucially, urgency alone never triggers a phishing verdict. The URL analyzer extracts every URL via regex, then checks each one for red flags: IP addresses instead of domain names, URL length over 75 characters, more than 4 subdomains (a common obfuscation technique), and suspicious path keywords. Each URL is also checked against the trusted host registry — if all URLs point to known official domains, the email gets a strong legitimacy signal. The brand domain registry covers 9 major brands with over 40 official domains — for example, Google alone has 20 entries covering classroom.google.com, accounts.google.com, policies.google.com, drive.google.com, and regional variants. The most important innovation is the impersonation vs. reference distinction: the system checks if an email merely mentions a brand in a settings or integration context (brand reference — not phishing) versus claiming to BE that brand with impersonation phrases like "from Google", "the Google Team", "your Google account has been suspended" (brand impersonation — phishing if sender domain is wrong). This prevents false positives on emails like "Two new settings to help you work better with Google" from Smile.io.

### Visual
A feature breakdown diagram with six boxes arranged in a grid (2x3), each with an icon:
- 🔤 "25 Urgency Keywords" (alarm bell icon)
- 🔗 "URL Analysis" (link chain icon)
- 🏢 "9-Brand Registry (40+ domains)" (building/shield icon)
- 🎭 "Impersonation vs. Reference" (two masks icon — this one highlighted as KEY INNOVATION)
- 📧 "Google Service Detection" (Google icon + email)
- ⏱️ "Urgency Discounting" (timer with down arrow)

---

## SLIDE 8 — LLM Prompt Engineering & Blended Scoring

### Slide Title
**AI Analysis — 6-Step Analyst Rubric & Blended Scoring**

### Bullet Points
- **LLM Role:** "You are a senior email-security analyst" — Groq llama-3.3-70b at temperature 0.1
- **6-Step Rubric:** (1) Verify sender domain → (2) Analyze every URL → (3) Interpret urgency language → (4) Check Google service mail → (5) Identify phishing signals with evidence → (6) Write specific reasons
- **Prompt Injection:** Pre-computed verdict guidance hints + full JSON feature dump sent alongside the email text
- **Blended Scoring Strategy:**
  - Strong phishing signals → `max(LLM, heuristic)` — never underscores real threats
  - Clearly legitimate → `20% LLM + 25% heuristic + 55% baseline` — capped at 24
  - Ambiguous → `40% LLM + 60% heuristic` — heuristics weighted heavier for reliability
- **Post-blend alignment:** PHISHING always ≥ 45; LEGITIMATE at ≥ 45 without clear legitimacy → reclassified

### Speaker Notes
The Groq LLM receives a carefully engineered system prompt that defines a 6-step decision rubric. Step 1 verifies the sender domain — it must check is_trusted_sender and sender_domain, not just the display name. Step 2 analyzes every URL against the all_urls_trusted and suspicious_url_count features. Step 3 interprets urgency language — using effective_urgency_score (not raw) for trusted senders, because phrases like "action required" are normal in real Google mail. Step 4 handles Google service mail as a common false-positive area. Step 5 only marks PHISHING with concrete evidence — impersonation with has_mismatch true, malicious URLs on untrusted domains, or credential harvesting. Step 6 requires structured reasons citing sender verdict, URL verdict, urgency context, and final conclusion. The prompt also includes pre-computed "analyst pre-check" guidance and the full extracted features as JSON. After the LLM responds, the risk_scoring module blends the LLM score with the heuristic score using different strategies based on context. For strong phishing signals, it takes the maximum of both scores to ensure threats are never underscored. For clearly legitimate emails, it uses a weighted blend heavily favoring the verified baseline (55%), capped at score 24. For ambiguous cases, it weights heuristics at 60% because they're more reliable than LLM on edge cases. Post-blend alignment ensures PHISHING classification always has at least a score of 45, and LEGITIMATE classification at score 45+ without clear legitimacy evidence gets reclassified as PHISHING.

### Visual
Two-panel layout:
- Left panel: A numbered list showing the 6 analyst rubric steps as a flowchart going downward with decision diamonds.
- Right panel: A scoring blend diagram showing three paths (Strong Phishing → red, Legitimate → green, Ambiguous → yellow) converging into a final score gauge (0–100).

---

## SLIDE 9 — False-Positive Safeguards (Key Innovation)

### Slide Title
**False-Positive Safeguards — The Key Innovation**

### Bullet Points

| Scenario | Handling | Result |
|----------|----------|--------|
| Google Classroom assignment from `classroom-noreply@google.com` | Verified sender + official URL + service detection | ✅ LEGITIMATE, score ~8 |
| Google security alert: "new sign-in" from `accounts.google.com` | Verified sender + urgency discounted + official URL | ✅ LEGITIMATE, score ~14 |
| Google privacy policy update from `noreply@google.com` | Verified sender + policies.google.com link | ✅ LEGITIMATE, score ~10 |
| Smile.io email: "work better with Google" | Brand *reference*, NOT impersonation — no mismatch | ✅ LEGITIMATE, score ~16 |
| Fake PayPal from `paypa1-verify.net` with IP-based URL | Impersonation detected + suspicious URL | ❌ PHISHING, score ≥ 78 |
| Fake Amazon from `amazon-security-check.com` | Typosquatted domain + suspicious URL with login/verify | ❌ PHISHING, score ≥ 65 |

- **Graduated scoring:** Google Classroom (~8) ≠ Security alert (~14) ≠ Policy update (~10) — each gets a distinct score, not a flat cap
- **Urgency discounting:** "action required", "verify your account", "security alert" → effective urgency = 0 for verified senders

### Speaker Notes
False-positive reduction is the most important innovation in PhishGuard AI. Traditional systems either flag all emails mentioning "Google" from non-Google domains (too aggressive) or miss actual impersonation (too lenient). PhishGuard solves this with three mechanisms. First, the impersonation vs. reference distinction: when a Smile.io email says "Two new settings to help you work better with Google", the system detects that the word "Google" appears in a settings/integration context — matching patterns like "Google settings", "Google integration", "sync with Google" — and classifies it as a brand reference, not impersonation. But when an email from "paypa1-verify.net" says "Your PayPal account has been suspended", it matches impersonation patterns like "your PayPal account has been suspended" and the sender domain doesn't match PayPal's official domains — so it's flagged as brand impersonation. Second, urgency discounting: phrases like "action required" and "security alert" are normal in real Google Classroom, Account, and policy emails, so the effective urgency score is set to 0 for verified senders with no suspicious URLs. Third, graduated scoring: instead of giving all Google emails the same score, the legitimate baseline varies by service type (Classroom weight=0, Policy=2, Account=6, Workspace=1), URL count, urgency word count, and other factors. This means a Google Classroom assignment gets score ~8, a policy update gets ~10, and a security alert gets ~14 — all legitimate, but each with a proportionally different assessment.

### Visual
A comparison diagram with two columns:
- Left column (green, ✅): "Correctly identified as LEGITIMATE" — showing 4 email examples (Google Classroom, Security Alert, Policy Update, Smile.io vendor) with their scores on a green gradient bar.
- Right column (red, ❌): "Correctly identified as PHISHING" — showing 2 email examples (Fake PayPal, Fake Amazon) with their scores on a red gradient bar.
- Center callout bubble: "KEY: Impersonation ≠ Reference"

---

## SLIDE 10 — Chrome Extension & User Experience

### Slide Title
**Chrome Extension — Seamless In-Browser Experience**

### Bullet Points
- **Manifest V3** — modern Chrome extension standard with service worker
- **Gmail + Outlook support** — content script injects into mail.google.com, outlook.live.com, outlook.office.com, outlook.office365.com
- **Floating button:** "Is this email safe?" — appears on every email with shield icon and hint "Quick scan · takes ~5 sec"
- **In-tab slide-in panel:** Analysis happens in an iframe overlay within the same tab — no popup, no new page
- **Auto-extraction:** Sender, subject, body extracted from the email DOM automatically — user just clicks the button
- **Security Dashboard:** Full-page history, statistics, threat intel, dark mode, API settings — accessible from toolbar icon
- **Privacy:** Only permission is `http://localhost:8000/*` — no access to browsing data or external servers

### Speaker Notes
The Chrome extension provides a seamless user experience. It uses Manifest V3, Chrome's latest extension standard, with a service worker for the background script. The content script injects into Gmail and Outlook pages and creates a floating action button labeled "Is this email safe?" with a shield checkmark icon. When clicked, it automatically extracts the sender (from `span[email]` attributes in Gmail, from ARIA-labeled elements in Outlook), subject (from `h2.hP` heading in Gmail), and body (from the `.a3s` message container). The extracted data is passed to an in-tab slide-in panel — an iframe overlay that slides in from the right with a CSS animation, showing the analysis UI. This design means users never leave their inbox. The analysis UI shows an animated risk score circle (using CSS conic gradient with an eased 900ms animation), classification badge, risk level chip, confidence indicator, detailed reasons panel, actionable recommendation, and a full feature breakdown (urgency words, URL count, suspicious URLs with flags, domain mismatch details). A human-friendly verdict strip says things like "I'd be careful with this one — something about it doesn't add up" for phishing or "This one passed our checks. Still trust your gut if anything feels off" for legitimate emails. The Security Dashboard is a separate full-page tab with analysis history (up to 100 scans), aggregated statistics, threat intelligence patterns, and settings (API URL, dark mode toggle, clear data). The extension only has host permission for localhost:8000 — no external server access, no browsing data access.

### Visual
A mockup/screenshot layout showing:
- Left: Gmail inbox with a floating green button "Is this email safe?" at the bottom right
- Center: The slide-in analysis panel showing: animated risk score circle (78/100 in red), "PHISHING" badge, risk level "HIGH", reasons panel, feature breakdown
- Right: Dashboard page showing history list, statistics chart, dark mode toggle

---

## SLIDE 11 — Security, Privacy & Testing

### Slide Title
**Security, Privacy & Validation**

### Bullet Points
- **Data flow:** Extension → local backend (localhost:8000) → Groq API prompt (not raw email)
- **No embedded API keys** in the extension — all inference via local backend
- **Optional fully offline:** Phi-3 + LoRA model runs entirely on user's machine — zero external calls
- **Testing — Offline (7 emails):** PayPal phishing ✓, Amazon phishing ✓, Google Classroom ✓, Google policy ✓, Google security alert ✓, Smile.io vendor ✓, business email ✓
- **Testing — Live API (8 emails):** Above + Google Classroom with urgency words, Google security alert with display name sender
- **Validation:** Verified graduated scoring — at least 3 distinct scores for legitimate emails; Classroom score ≠ security alert score

### Speaker Notes
Security and privacy were core design priorities. The extension never sends email data directly to any cloud service — it only communicates with the local backend at localhost:8000. The backend then sends an analysis prompt (containing email text plus heuristic features) to the Groq API — not the raw email. For maximum privacy, the optional Phi-3 + LoRA local model path processes everything on the user's machine with zero external API calls. The extension doesn't embed any API keys — those stay in the backend's .env file, which is gitignored. The extension only requests host permissions for localhost. For testing, we have two test suites. The offline scoring tests (test_scoring.py) run without any API key and validate the heuristic logic with 7 sample emails — verifying that PayPal and Amazon phishing emails score at least 45, while Google Classroom, policy, security, Smile.io vendor, and business emails score at most 24. It also validates graduated scoring by checking that at least 3 distinct scores are produced for legitimate emails, and that Classroom and security alert scores differ. The live API tests (test_api.py) hit the running server with 8 emails including edge cases like Google Classroom with urgency words ("Action required: New coursework") and display name senders ("Google <no-reply@accounts.google.com>").

### Visual
Two-panel layout:
- Left panel: A data flow diagram showing the privacy model — Extension → Local Backend → Groq (with a dotted alternative line to "Local Phi-3 + LoRA" on the user's machine)
- Right panel: A test results matrix/table showing 8 test cases with checkmarks, their expected vs. actual classification, and score ranges

---

## SLIDE 12 — Conclusion, Limitations & Future Work

### Slide Title
**Conclusion & Future Work**

### Bullet Points
- **Key Contributions:**
  1. Hybrid AI + heuristic approach outperforms either method alone
  2. Impersonation vs. reference distinction eliminates major false-positive category
  3. Graduated scoring provides nuanced, distinguishable verdicts
  4. In-browser integration for frictionless user experience
  5. Privacy-first architecture with optional fully offline mode

- **Limitations:** Groq API dependency (rate limits/costs), static trusted domain list, Gmail/Outlook only, no attachment analysis, English-focused

- **Future Work:** Fine-tune on larger datasets, attachment scanning, more email clients (Yahoo, ProtonMail), real-time threat intelligence feeds (PhishTank, Google Safe Browsing API), header analysis (SPF/DKIM/DMARC), hosted cloud deployment

### Speaker Notes
To conclude, PhishGuard AI bridges the gap between simple spam filters and expensive enterprise security solutions. Its five key contributions are: first, the hybrid approach that combines the precision of heuristic rules with the reasoning power of a 70-billion parameter LLM — catching both hard indicators that rules handle well and nuanced social engineering that requires AI reasoning. Second, the impersonation vs. reference distinction is a significant innovation that eliminates an entire category of false positives — vendor emails mentioning Google, Microsoft, or other brands in integration contexts are correctly recognized as harmless. Third, graduated scoring provides nuanced verdicts where similar-but-different emails get distinct scores, not flat caps. Fourth, the in-browser slide-in panel integration means users never leave their inbox. Fifth, the privacy-first design keeps all data local with an optional fully offline model. Current limitations include dependency on the Groq API for the default path, a static trusted domain list that requires manual updates, support for only Gmail and Outlook, no attachment analysis, and English-only urgency patterns. Future work includes fine-tuning on larger phishing datasets, adding attachment scanning, supporting more email clients, integrating real-time threat intelligence feeds like PhishTank and Google Safe Browsing API, analyzing email authentication headers (SPF, DKIM, DMARC), and deploying as a hosted cloud service with multi-user authentication. Thank you — I'm happy to take questions.

### Visual
Two-column layout:
- Left column: A summary infographic with 5 key contribution icons and brief labels
- Right column: A roadmap timeline showing future work items in chronological order (Near-term → Mid-term → Long-term)

---

# APPENDIX — Technical Reference (for Q&A preparation)

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Status — ok/degraded, model info, groq_ready |
| `POST` | `/analyze` | Main analysis — accepts email JSON, returns verdict |

## Request Format
```json
{
  "sender": "security@paypa1-verify.net",
  "subject": "URGENT: verify your PayPal account",
  "body": "Click now: http://192.168.0.99/secure/login/verify"
}
```
Alternative: `"raw_text"` field for `.eml` / RFC 5322 source (overrides structured fields).

## Response Format
```json
{
  "classification": "PHISHING",
  "risk_score": 78,
  "risk_level": "HIGH",
  "confidence": "HIGH",
  "reasons": "Sender domain paypa1-verify.net does not match PayPal. URL uses IP address 192.168.0.99 instead of domain. Contains urgency: 'urgent', 'verify your account'. Conclusion: phishing impersonation.",
  "recommendation": "Do NOT click any links. Delete this email immediately.",
  "features": {
    "sender_email_parsed": "security@paypa1-verify.net",
    "urgency_score": 3,
    "effective_urgency_score": 3,
    "urgency_words": ["urgent", "verify your account"],
    "url_count": 1,
    "suspicious_url_count": 1,
    "all_urls_trusted": false,
    "is_trusted_sender": false,
    "domain_mismatch": {
      "has_mismatch": true,
      "mismatched_brands": ["paypal"],
      "referenced_brands": []
    },
    "is_google_service_notification": false
  }
}
```

## Risk Level Thresholds
| Score | Level | Action |
|-------|-------|--------|
| ≥ 75 | HIGH | "Do NOT click any links. Delete this email immediately." |
| 45–74 | MEDIUM | "Proceed with caution. Verify sender before any action." |
| < 45 | LOW | "This email appears safe." |

## Project File Structure
```
IS_project/
├── backend/
│   ├── main.py              # FastAPI app (181 lines)
│   ├── email_parser.py      # RFC 5322 parsing (78 lines)
│   ├── feature_extractor.py # Heuristic analysis (657 lines — largest module)
│   ├── groq_client.py       # Groq LLM + 6-step rubric (268 lines)
│   ├── risk_scoring.py      # Blended scoring (122 lines)
│   ├── hf_client.py         # Phi-3 + LoRA local model (244 lines)
│   ├── test_api.py          # 8 live API tests (194 lines)
│   ├── test_scoring.py      # 7 offline scoring tests (157 lines)
│   └── requirements.txt
├── chrome-extension/
│   ├── manifest.json        # Manifest V3
│   ├── background.js        # Service worker
│   ├── content.js           # Gmail/Outlook extraction (248 lines)
│   ├── popup.html/js        # Analysis panel UI (469 lines JS)
│   ├── dashboard.html/js    # Security Dashboard
│   ├── theme.js/css         # Dark mode
│   └── *.css / *.png        # Styles and icons
├── .env.example
├── README.md
├── SECURITY.md
└── LICENSE
```

## 25 Urgency Keywords (Full List)
urgent, act now, immediately, click here, verify now, account suspended, limited time, expires today, confirm your identity, unusual activity, security alert, update your payment, wire transfer, password expired, login required, verify your account, action required, final notice, your account will be closed, claim your reward, you have won, tax refund, invoice overdue, unauthorized access, reset your password

## 9-Brand Official Domain Registry
- **Google (20):** google.com, gmail.com, googlemail.com, googleusercontent.com, googleapis.com, gstatic.com, youtube.com, classroom.google.com, accounts.google.com, notifications.google.com, policies.google.com, myaccount.google.com, drive.google.com, docs.google.com, calendar.google.com, mail.google.com, workspace.google.com, google.co.uk, google.ca, google.com.au
- **Microsoft (6):** microsoft.com, outlook.com, live.com, office.com, office365.com, microsoftonline.com
- **Apple (3):** apple.com, icloud.com, me.com
- **Amazon (4):** amazon.com, amazon.co.uk, amazon.de, amazonaws.com
- **PayPal (2):** paypal.com, paypal.co.uk
- **Facebook (3):** facebook.com, facebookmail.com, meta.com
- **Instagram (2):** instagram.com, mail.instagram.com
- **Netflix (2):** netflix.com, mailer.netflix.com
- **Dropbox (2):** dropbox.com, dropboxmail.com

## Blended Scoring Weights (Detail)
| Context | LLM Weight | Heuristic Weight | Baseline Weight | Score Cap |
|---------|-----------|-----------------|----------------|-----------|
| Strong phishing | max(LLM, heuristic) | — | — | 100 |
| Clearly legitimate | 20% | 25% | 55% | 24 |
| Ambiguous | 40% | 60% | — | 100 |
| LLM unavailable | — | 100% | — | 100 |

## Legitimate Baseline Service Weights
| Google Service | Weight Added to Base Score |
|---------------|--------------------------|
| Classroom | +0 |
| Workspace | +1 |
| Policy | +2 |
| Account (security) | +6 |
