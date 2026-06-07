const isEmbedded = new URLSearchParams(window.location.search).has("embedded");
let loadingStepTimer = null;

const els = {
  sender: document.getElementById("sender"),
  subject: document.getElementById("subject"),
  body: document.getElementById("body"),
  analyzeBtn: document.getElementById("analyze-btn"),
  loading: document.getElementById("loading"),
  errorMessage: document.getElementById("error-message"),
  results: document.getElementById("results"),
  riskCircle: document.getElementById("risk-circle"),
  riskScoreValue: document.getElementById("risk-score-value"),
  classificationBadge: document.getElementById("classification-badge"),
  riskLevel: document.getElementById("risk-level"),
  confidence: document.getElementById("confidence"),
  reasons: document.getElementById("reasons"),
  recommendation: document.getElementById("recommendation"),
  featuresBreakdown: document.getElementById("features-breakdown"),
  headerStatus: document.getElementById("header-status"),
  headerStatusText: document.querySelector(".header__status-text"),
  closePanelBtn: document.getElementById("close-panel-btn"),
  extractHint: document.getElementById("extract-hint"),
  previewFrom: document.getElementById("preview-from"),
  previewSubject: document.getElementById("preview-subject"),
  verdictStrip: document.getElementById("verdict-strip"),
};

function syncMailPreview() {
  const sender = els.sender?.value.trim();
  const subject = els.subject?.value.trim();
  if (els.previewFrom) {
    els.previewFrom.textContent = sender || "Waiting for sender…";
  }
  if (els.previewSubject) {
    els.previewSubject.textContent = subject || "Subject will appear here";
  }
}

const FEATURE_ICONS = {
  urgency: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5M12 16v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/></svg>',
  urls: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 14L14 10M14 10h-4M14 10v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.75"/></svg>',
  suspicious: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4M12 16v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 3h4l1 4H9l1-4z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><rect x="5" y="7" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.75"/></svg>',
  domain: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="1.75"/><path d="M6 20c0-3.5 2.5-5 6-5s6 1.5 6 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M16 8l3-2M8 8L5 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
};

function setHeaderStatus(state, text) {
  if (!els.headerStatus) return;
  els.headerStatus.classList.remove(
    "header__status--scanning",
    "header__status--done",
    "header__status--alert"
  );
  if (state) els.headerStatus.classList.add(`header__status--${state}`);
  if (text && els.headerStatusText) els.headerStatusText.textContent = text;
}

function getBadgeHtml(classification) {
  const isPhishing = classification === "PHISHING";
  const label = isPhishing ? "Possible phishing" : "Looks safe";
  const icon = isPhishing
    ? '<svg class="badge__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4M12 16v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/></svg>'
    : '<svg class="badge__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/></svg>';
  return { label, icon, className: isPhishing ? "badge badge--phishing" : "badge badge--legitimate" };
}

function animateLoadingSteps() {
  const steps = els.loading?.querySelectorAll(".loading__step");
  if (!steps?.length) return;
  let index = 0;
  steps.forEach((s, i) => s.classList.toggle("loading__step--active", i === 0));
  loadingStepTimer = setInterval(() => {
    index = (index + 1) % steps.length;
    steps.forEach((s, i) => s.classList.toggle("loading__step--active", i === index));
  }, 1400);
}

function stopLoadingSteps() {
  if (loadingStepTimer) {
    clearInterval(loadingStepTimer);
    loadingStepTimer = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format the features dict into readable HTML for the breakdown section.
 */
function formatFeaturesHtml(features) {
  if (!features || typeof features !== "object") {
    return "<p class=\"feat-none\">No feature data available.</p>";
  }

  const urgencyWords = features.urgency_words || [];
  const urgencyHtml = urgencyWords.length
    ? escapeHtml(urgencyWords.join(", "))
    : '<span class="feat-none">None detected</span>';

  const urlCount = features.url_count ?? 0;
  const urlCountHtml = `<strong>${urlCount}</strong> URL${urlCount === 1 ? "" : "s"} detected`;

  const suspiciousList = (features.suspicious_urls || []).filter(
    (item) => item.is_suspicious
  );
  const suspiciousCount = features.suspicious_url_count ?? suspiciousList.length;

  let suspiciousHtml;
  if (suspiciousCount === 0) {
    suspiciousHtml = '<span class="feat-none">No suspicious URLs flagged</span>';
  } else {
    const items = suspiciousList
      .map((item) => {
        const flags = (item.flags || []).join(", ") || "flagged";
        const url = escapeHtml(item.url || "(unknown)");
        return `<li><span class="feat-url">${url}</span><br><span class="feat-flags">${escapeHtml(flags)}</span></li>`;
      })
      .join("");
    suspiciousHtml = `<p class="feat-summary"><strong>${suspiciousCount}</strong> suspicious URL${suspiciousCount === 1 ? "" : "s"}</p><ul class="feat-list">${items}</ul>`;
  }

  const mismatch = features.domain_mismatch || {};
  let domainHtml;
  if (mismatch.has_mismatch && (mismatch.mismatched_brands || []).length) {
    const brands = escapeHtml(mismatch.mismatched_brands.join(", "));
    const domain = escapeHtml(mismatch.sender_domain || "unknown");
    domainHtml = `<span class="feat-warning">⚠ Brand impersonation possible</span><br>Sender domain: <strong>${domain}</strong><br>Mismatched brands: <strong>${brands}</strong>`;
  } else {
    domainHtml = '<span class="feat-none">No domain mismatch detected</span>';
  }

  return `
    <div class="features__row">
      <dt>${FEATURE_ICONS.urgency} Urgency words</dt>
      <dd>${urgencyHtml}</dd>
    </div>
    <div class="features__row">
      <dt>${FEATURE_ICONS.urls} URL count</dt>
      <dd>${urlCountHtml}</dd>
    </div>
    <div class="features__row">
      <dt>${FEATURE_ICONS.suspicious} Suspicious URLs</dt>
      <dd>${suspiciousHtml}</dd>
    </div>
    <div class="features__row">
      <dt>${FEATURE_ICONS.domain} Domain mismatch</dt>
      <dd>${domainHtml}</dd>
    </div>
  `;
}

function getRiskCircleClass(score) {
  if (score >= 75) return "risk-circle--high";
  if (score >= 45) return "risk-circle--medium";
  return "risk-circle--low";
}

function setRiskCircleFill(score) {
  const degrees = Math.min(100, Math.max(0, score)) * 3.6;
  els.riskCircle.style.setProperty("--fill-degrees", `${degrees}deg`);
}

function animateRiskScore(targetScore, durationMs = 900) {
  const start = performance.now();
  const from = 0;
  const to = Math.min(100, Math.max(0, targetScore));

  els.riskCircle.classList.remove(
    "risk-circle--low",
    "risk-circle--medium",
    "risk-circle--high"
  );
  els.riskCircle.classList.add(getRiskCircleClass(to));

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (to - from) * eased);

    els.riskScoreValue.textContent = String(current);
    setRiskCircleFill(current);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      els.riskScoreValue.textContent = String(to);
      setRiskCircleFill(to);
    }
  }

  requestAnimationFrame(frame);
}

function clearResults() {
  els.results.classList.add("hidden");
  if (els.verdictStrip) els.verdictStrip.classList.add("hidden");
  els.errorMessage.classList.add("hidden");
  els.errorMessage.textContent = "";

  els.riskScoreValue.textContent = "0";
  els.riskCircle.classList.remove(
    "risk-circle--low",
    "risk-circle--medium",
    "risk-circle--high"
  );
  els.riskCircle.classList.add("risk-circle--low");
  setRiskCircleFill(0);

  const defaultBadge = getBadgeHtml("LEGITIMATE");
  els.classificationBadge.className = defaultBadge.className;
  els.classificationBadge.innerHTML = `${defaultBadge.icon}${defaultBadge.label}`;
  els.riskLevel.textContent = "LOW";
  els.confidence.textContent = "—";
  const levelChip = els.riskLevel.closest(".meta-chip");
  if (levelChip) {
    levelChip.classList.remove("meta-chip--high", "meta-chip--medium", "meta-chip--low");
    levelChip.classList.add("meta-chip--low");
  }

  els.reasons.innerHTML =
    '<p class="panel-box__placeholder">Reasons will appear here after analysis.</p>';
  els.recommendation.innerHTML =
    '<p class="panel-box__placeholder">Action guidance will appear here.</p>';

  els.featuresBreakdown.innerHTML = `
    <div class="features__row">
      <dt>${FEATURE_ICONS.urgency} Urgency words</dt>
      <dd id="feat-urgency">—</dd>
    </div>
    <div class="features__row">
      <dt>${FEATURE_ICONS.urls} URL count</dt>
      <dd id="feat-url-count">—</dd>
    </div>
    <div class="features__row">
      <dt>${FEATURE_ICONS.suspicious} Suspicious URLs</dt>
      <dd id="feat-suspicious-urls">—</dd>
    </div>
    <div class="features__row">
      <dt>${FEATURE_ICONS.domain} Domain mismatch</dt>
      <dd id="feat-domain-mismatch">—</dd>
    </div>
  `;
}

function showLoading(show) {
  els.loading.classList.toggle("hidden", !show);
  els.analyzeBtn.disabled = show;
  if (show) {
    setHeaderStatus("scanning", "Scanning in progress — this usually takes a few seconds");
    animateLoadingSteps();
  } else {
    stopLoadingSteps();
  }
}

function showError(message) {
  els.errorMessage.textContent = message;
  els.errorMessage.classList.remove("hidden");
  setHeaderStatus("alert", "Something went wrong — see the message below");
}

function hideError() {
  els.errorMessage.classList.add("hidden");
  els.errorMessage.textContent = "";
}

function validateInputs() {
  const sender = els.sender.value.trim();
  const subject = els.subject.value.trim();
  const body = els.body.value.trim();

  if (!subject || !body) {
    showError("We need the subject and message body to run a scan. Fill in any missing fields above.");
    return null;
  }

  if (!sender) {
    showError(
      "We couldn't read who sent this email from Gmail. Add the sender address in the field above, then scan again."
    );
    return null;
  }

  return { sender, subject, body };
}

function displayResults(data) {
  const score = parseInt(data.risk_score ?? 0, 10) || 0;
  const classification = data.classification || "LEGITIMATE";

  const badge = getBadgeHtml(classification);
  els.classificationBadge.className = badge.className;
  els.classificationBadge.innerHTML = `${badge.icon}${badge.label}`;

  const level = (data.risk_level || "LOW").toUpperCase();
  els.riskLevel.textContent = level;
  els.confidence.textContent = data.confidence || "—";

  const levelChip = els.riskLevel.closest(".meta-chip");
  if (levelChip) {
    levelChip.classList.remove("meta-chip--high", "meta-chip--medium", "meta-chip--low");
    levelChip.classList.add(`meta-chip--${level.toLowerCase()}`);
  }

  els.reasons.innerHTML = `<p>${escapeHtml(data.reasons || "No explanation provided.")}</p>`;
  els.recommendation.innerHTML = `<p>${escapeHtml(data.recommendation || "")}</p>`;

  els.featuresBreakdown.innerHTML = formatFeaturesHtml(data.features);

  els.results.classList.remove("hidden");

  if (els.verdictStrip) {
    const isPhish = classification === "PHISHING";
    els.verdictStrip.classList.remove("hidden", "verdict-strip--safe", "verdict-strip--danger");
    els.verdictStrip.classList.add(isPhish ? "verdict-strip--danger" : "verdict-strip--safe");
    els.verdictStrip.textContent = isPhish
      ? "I'd be careful with this one — something about it doesn't add up."
      : "This one passed our checks. Still trust your gut if anything feels off.";
  }

  const statusMsg =
    classification === "PHISHING"
      ? "Heads up — this email shows signs of a phishing attempt"
      : "All clear — no major red flags detected in this email";
  setHeaderStatus(classification === "PHISHING" ? "alert" : "done", statusMsg);

  animateRiskScore(score);
}

async function analyzeEmail() {
  hideError();
  clearResults();

  const payload = validateInputs();
  if (!payload) return;

  showLoading(true);

  chrome.storage.local.get("api_url", async (res) => {
    const baseUrl = res.api_url || "http://localhost:8000";
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/analyze`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      displayResults(data);
      saveToHistory(payload, data);
    } catch (err) {
      console.error("PhishGuard analyze error:", err);
      showError(
        `Could not reach the analysis server at ${apiUrl}. Make sure the backend is running and Settings are correct.`
      );
    } finally {
      showLoading(false);
    }
  });
}

function saveToHistory(payload, data) {
  chrome.storage.local.get("analysis_history", (res) => {
    let history = res.analysis_history || [];
    const newRecord = {
      timestamp: new Date().toISOString(),
      sender: payload.sender,
      subject: payload.subject,
      body: payload.body,
      classification: data.classification || "LEGITIMATE",
      risk_score: parseInt(data.risk_score ?? 0, 10) || 0,
      risk_level: data.risk_level || "LOW",
      confidence: data.confidence || "LOW",
      reasons: data.reasons || "",
      recommendation: data.recommendation || "",
      features: data.features || {}
    };

    history.unshift(newRecord);

    // Keep last 100 entries
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    chrome.storage.local.set({ analysis_history: history });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if (typeof PhishGuardTheme !== "undefined") {
    PhishGuardTheme.initTheme();
    PhishGuardTheme.watchTheme();
  }

  if (isEmbedded) {
    document.body.classList.add("embedded");
    if (els.closePanelBtn) {
      els.closePanelBtn.classList.remove("hidden");
      els.closePanelBtn.addEventListener("click", () => {
        window.parent.postMessage({ type: "phishguard-close" }, "*");
      });
    }
  }

  chrome.storage.local.get("pending_analysis", (res) => {
    if (res.pending_analysis) {
      const email = res.pending_analysis;
      els.sender.value = email.sender || "";
      els.subject.value = email.subject || "";
      els.body.value = email.body || "";
      syncMailPreview();

      const hasSubject = Boolean(email.subject?.trim());
      const hasBody = Boolean(email.body?.trim());
      const hasSender = Boolean(email.sender?.trim());
      if (els.extractHint) {
        if (hasSubject && hasBody && hasSender) {
          els.extractHint.textContent = "Pulled from the email you're viewing";
        } else if (hasSubject || hasBody) {
          els.extractHint.textContent = hasSender
            ? "Some fields missing — check sender, subject, and body"
            : "Couldn't read the sender — check the From line in Gmail and edit above";
        } else {
          els.extractHint.textContent = "Couldn't auto-detect — paste the email details below";
        }
      }

      if (!hasSubject && !hasBody) {
        showError("We couldn't read this email automatically. Paste the subject and body above, then scan.");
        setHeaderStatus("alert", "Auto-extract didn't find email content");
      } else if (!hasSender) {
        setHeaderStatus("alert", "Sender not detected — confirm the From address above");
      } else {
        setHeaderStatus("scanning", "Email loaded — starting your scan now…");
        analyzeEmail();
      }

      chrome.storage.local.remove("pending_analysis");
    }
  });
});

["input", "change"].forEach((evt) => {
  els.sender?.addEventListener(evt, syncMailPreview);
  els.subject?.addEventListener(evt, syncMailPreview);
});

els.analyzeBtn.addEventListener("click", analyzeEmail);

// Dashboard button logic
const openDashboardBtn = document.getElementById("open-dashboard-btn");
if (openDashboardBtn) {
  openDashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });
}
