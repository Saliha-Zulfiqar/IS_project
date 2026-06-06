const API_URL = "http://localhost:8000/analyze";



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
};

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
      <dt>Urgency words</dt>
      <dd>${urgencyHtml}</dd>
    </div>
    <div class="features__row">
      <dt>URL count</dt>
      <dd>${urlCountHtml}</dd>
    </div>
    <div class="features__row">
      <dt>Suspicious URLs</dt>
      <dd>${suspiciousHtml}</dd>
    </div>
    <div class="features__row">
      <dt>Domain mismatch</dt>
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

  els.classificationBadge.textContent = "LEGITIMATE";
  els.classificationBadge.className = "badge badge--legitimate";
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
      <dt>Urgency words</dt>
      <dd id="feat-urgency">—</dd>
    </div>
    <div class="features__row">
      <dt>URL count</dt>
      <dd id="feat-url-count">—</dd>
    </div>
    <div class="features__row">
      <dt>Suspicious URLs</dt>
      <dd id="feat-suspicious-urls">—</dd>
    </div>
    <div class="features__row">
      <dt>Domain mismatch</dt>
      <dd id="feat-domain-mismatch">—</dd>
    </div>
  `;
}

function showLoading(show) {
  els.loading.classList.toggle("hidden", !show);
  els.analyzeBtn.disabled = show;
}

function showError(message) {
  els.errorMessage.textContent = message;
  els.errorMessage.classList.remove("hidden");
}

function hideError() {
  els.errorMessage.classList.add("hidden");
  els.errorMessage.textContent = "";
}

function validateInputs() {
  const sender = els.sender.value.trim();
  const subject = els.subject.value.trim();
  const body = els.body.value.trim();

  if (!sender || !subject || !body) {
    showError("Please fill in sender, subject, and email body before analyzing.");
    return null;
  }

  return { sender, subject, body };
}

function displayResults(data) {
  const score = parseInt(data.risk_score ?? 0, 10) || 0;
  const classification = data.classification || "LEGITIMATE";

  els.classificationBadge.textContent = classification;
  els.classificationBadge.className =
    classification === "PHISHING"
      ? "badge badge--phishing"
      : "badge badge--legitimate";

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

  // Reveal results smoothly using the CSS-defined animation (fadeSlideIn) without transition conflicts
  els.results.classList.remove("hidden");

  animateRiskScore(score);
}

async function analyzeEmail() {
  hideError();
  clearResults();

  const payload = validateInputs();
  if (!payload) return;

  showLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    displayResults(data);
  } catch (err) {
    console.error("PhishGuard analyze error:", err);
    showError(
      "Could not reach the analysis server. Make sure the backend is running on port 8000 (python main.py in the backend folder), then try again."
    );
  } finally {
    showLoading(false);
  }
}

els.analyzeBtn.addEventListener("click", analyzeEmail);
