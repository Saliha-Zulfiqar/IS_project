/**
 * PhishGuard AI — Dashboard Controller
 */

const AVATAR_COLORS = ["#3461ff", "#ff6b6b", "#f59e0b", "#22c55e", "#8b5cf6", "#ec4899", "#0ea5e9"];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function getInitials(sender) {
  const raw = (sender || "?").split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase() || "?";
}

function avatarColor(sender) {
  return AVATAR_COLORS[hashString(sender || "x") % AVATAR_COLORS.length];
}

function timeAgo(iso) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function bodySnippet(body, max = 90) {
  const t = (body || "").replace(/\s+/g, " ").trim();
  if (!t) return "No preview available for this message.";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function initPersonalization() {
  const greetingEl = document.getElementById("welcome-greeting");
  if (greetingEl) greetingEl.textContent = `${getGreeting()}, Saliha`;

  const dateEl = document.getElementById("header-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPersonalization();
  // --- State Variables ---
  let historyData = [];
  let currentFilter = "all";
  let currentPage = 1;
  const itemsPerPage = 10;
  let backendUrl = "http://localhost:8000";

  // --- Element Selectors ---
  const els = {
    navItems: document.querySelectorAll(".nav-item"),
    tabPanels: document.querySelectorAll(".tab-panel"),
    pageTitle: document.getElementById("page-title"),
    globalSearch: document.getElementById("global-search"),
    
    // Overview Panel Stats
    statTotal: document.getElementById("stat-total"),
    statTotalSub: document.getElementById("stat-total-sub"),
    statPhishing: document.getElementById("stat-phishing"),
    statPhishingSub: document.getElementById("stat-phishing-sub"),
    statLegit: document.getElementById("stat-legit"),
    statLegitSub: document.getElementById("stat-legit-sub"),
    statAvgRisk: document.getElementById("stat-avg-risk"),
    statAvgRiskSub: document.getElementById("stat-avg-risk-sub"),
    
    // Overview Charts
    donutCenterValue: document.getElementById("donut-center-value"),
    donutLegit: document.getElementById("donut-legit"),
    donutPhishing: document.getElementById("donut-phishing"),
    legendLegit: document.getElementById("legend-legit"),
    legendPhishing: document.getElementById("legend-phishing"),
    barLow: document.getElementById("bar-low"),
    barMed: document.getElementById("bar-med"),
    barHigh: document.getElementById("bar-high"),
    barLowCount: document.getElementById("bar-low-count"),
    barMedCount: document.getElementById("bar-med-count"),
    barHighCount: document.getElementById("bar-high-count"),
    activityFeed: document.getElementById("activity-feed"),
    
    // History Panel
    historyTbody: document.getElementById("history-tbody"),
    historyEmpty: document.getElementById("history-empty"),
    historyPagination: document.getElementById("history-pagination"),
    historyCountBadge: document.getElementById("history-count-badge"),
    filterAll: document.getElementById("filter-all"),
    filterPhishing: document.getElementById("filter-phishing"),
    filterLegit: document.getElementById("filter-legit"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    clearAllBtn: document.getElementById("clear-all-btn"),
    
    // Threat Intel Panel
    topSendersList: document.getElementById("top-senders-list"),
    keywordsList: document.getElementById("keywords-list"),
    suspiciousUrlsList: document.getElementById("suspicious-urls-list"),
    
    // Settings Panel
    settingApiUrl: document.getElementById("setting-api-url"),
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    settingRecordCount: document.getElementById("setting-record-count"),
    settingsClearBtn: document.getElementById("settings-clear-btn"),
    
    // Backend Status Dots
    backendStatusDot: document.getElementById("backend-status-dot"),
    backendStatusText: document.getElementById("backend-status-text"),
    settingStatusDot: document.getElementById("setting-status-dot"),
    settingStatusText: document.getElementById("setting-status-text"),
    darkModeToggle: document.getElementById("setting-dark-mode"),
  };

  // --- Theme ---
  function syncDarkModeToggle(theme) {
    if (els.darkModeToggle) {
      els.darkModeToggle.checked = theme === "dark";
    }
  }

  if (typeof PhishGuardTheme !== "undefined") {
    PhishGuardTheme.initTheme(syncDarkModeToggle);
    PhishGuardTheme.watchTheme(syncDarkModeToggle);
  }

  if (els.darkModeToggle) {
    els.darkModeToggle.addEventListener("change", () => {
      const theme = els.darkModeToggle.checked ? "dark" : "light";
      if (typeof PhishGuardTheme !== "undefined") {
        PhishGuardTheme.setTheme(theme, () => {
          showSettingsNotification(
            theme === "dark" ? "Dark mode enabled" : "Light mode enabled",
            "success"
          );
        });
      }
    });
  }

  // --- Initial Setup & Load Data ---
  loadSettingsAndData();
  checkBackendHealth();
  setInterval(checkBackendHealth, 15000); // Check every 15s

  // --- Tab Switching Logic ---
  els.navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      
      // Update nav active class
      els.navItems.forEach((n) => n.classList.remove("nav-item--active"));
      btn.classList.add("nav-item--active");
      
      // Update panels active class
      els.tabPanels.forEach((p) => p.classList.remove("tab-panel--active"));
      const targetPanel = document.getElementById(`panel-${tabId}`);
      if (targetPanel) {
        targetPanel.classList.add("tab-panel--active");
      }
      
      const tabName = btn.querySelector(".nav-item__label").textContent;
      els.pageTitle.textContent = tabName;
      const subtitles = {
        overview: "Here's how your inbox has been looking lately",
        history: "Every email you've double-checked",
        intelligence: "Trends we've picked up from your scans",
        settings: "Tweak how PhishGuard connects & stores data",
      };
      const subtitleEl = document.getElementById("page-subtitle");
      if (subtitleEl) subtitleEl.textContent = subtitles[tabId] || "";
    });
  });

  // --- Search Input Logic ---
  if (els.globalSearch) {
    els.globalSearch.addEventListener("input", () => {
      currentPage = 1;
      renderHistory();
    });
  }

  // --- History Filtering Logic ---
  const filterBtns = [els.filterAll, els.filterPhishing, els.filterLegit];
  filterBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("filter-btn--active"));
        btn.classList.add("filter-btn--active");
        currentFilter = btn.getAttribute("data-filter");
        currentPage = 1;
        renderHistory();
      });
    }
  });

  // --- Clear History Logic ---
  if (els.clearAllBtn) els.clearAllBtn.addEventListener("click", confirmClearHistory);
  if (els.settingsClearBtn) els.settingsClearBtn.addEventListener("click", confirmClearHistory);

  // --- Save Settings Logic ---
  if (els.saveSettingsBtn) {
    els.saveSettingsBtn.addEventListener("click", () => {
      let urlInput = els.settingApiUrl.value.trim();
      if (!urlInput.startsWith("http://") && !urlInput.startsWith("https://")) {
        urlInput = "http://" + urlInput;
      }
      chrome.storage.local.set({ api_url: urlInput }, () => {
        backendUrl = urlInput;
        showSettingsNotification("Settings saved successfully!", "success");
        checkBackendHealth();
      });
    });
  }

  // --- CSV Export Logic ---
  if (els.exportCsvBtn) {
    els.exportCsvBtn.addEventListener("click", exportHistoryToCSV);
  }

  // --- Functions ---

  function loadSettingsAndData() {
    chrome.storage.local.get(["api_url", "analysis_history"], (res) => {
      if (res.api_url) {
        backendUrl = res.api_url;
        if (els.settingApiUrl) els.settingApiUrl.value = backendUrl;
      }
      
      historyData = res.analysis_history || [];
      updateDashboardData();
    });
  }

  function checkBackendHealth() {
    const healthUrl = `${backendUrl.replace(/\/$/, '')}/health`;
    
    // Update loading state briefly if check takes time
    fetch(healthUrl)
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error("Degraded");
      })
      .then((data) => {
        let status = "Online";
        if (data.status !== "ok") {
          status = "Limited";
        } else if (data.groq_ready && !data.model_loaded) {
          status = "API ready";
        } else if (data.model_loaded) {
          status = "Local model ready";
        }
        updateStatusIndicators(true, status);
      })
      .catch((err) => {
        console.warn("Backend connection check failed:", err);
        updateStatusIndicators(false, "Offline");
      });
  }

  function updateStatusIndicators(isOnline, statusString) {
    const dotClasses = isOnline ? "status-dot status-dot--online" : "status-dot status-dot--offline";
    const statusText = isOnline ? `Connected — ${statusString}` : "Disconnected";

    if (els.backendStatusDot) {
      els.backendStatusDot.className = dotClasses;
      els.backendStatusText.textContent = statusText;
    }
    if (els.settingStatusDot) {
      els.settingStatusDot.className = dotClasses;
      els.settingStatusText.textContent = statusText;
    }
  }

  function updateDashboardData() {
    // Record Counts
    const total = historyData.length;
    const phishingList = historyData.filter(item => item.classification === "PHISHING");
    const legitList = historyData.filter(item => item.classification === "LEGITIMATE");
    
    const phishingCount = phishingList.length;
    const legitCount = legitList.length;
    
    const phishingPct = total > 0 ? Math.round((phishingCount / total) * 100) : 0;
    const legitPct = total > 0 ? Math.round((legitCount / total) * 100) : 0;

    // Avg Risk Score
    const avgRisk = total > 0 ? Math.round(historyData.reduce((acc, curr) => acc + (curr.risk_score || 0), 0) / total) : 0;

    // Update Sidebar Navigation Badge
    if (els.historyCountBadge) {
      if (total > 0) {
        els.historyCountBadge.textContent = total;
        els.historyCountBadge.style.display = "inline-flex";
      } else {
        els.historyCountBadge.style.display = "none";
      }
    }

    // Update Overview Stats Cards
    if (els.statTotal) els.statTotal.textContent = total;
    if (els.statTotalSub) {
      els.statTotalSub.textContent =
        total === 0 ? "Scan your first email from Gmail" : total === 1 ? "One down — nice work!" : `Across ${total} emails you've checked`;
    }

    if (els.statPhishing) els.statPhishing.textContent = phishingCount;
    if (els.statPhishingSub) {
      els.statPhishingSub.textContent =
        phishingCount === 0 ? "None flagged so far — great!" : `${phishingPct}% needed a closer look`;
    }

    if (els.statLegit) els.statLegit.textContent = legitCount;
    if (els.statLegitSub) {
      els.statLegitSub.textContent =
        legitCount === 0 ? "No clean bills yet" : `${legitPct}% looked perfectly fine`;
    }

    if (els.statAvgRisk) els.statAvgRisk.textContent = avgRisk;
    if (els.statAvgRiskSub) {
      if (total === 0) els.statAvgRiskSub.textContent = "Scan something to see this";
      else if (avgRisk >= 75) els.statAvgRiskSub.textContent = "Overall — things look risky";
      else if (avgRisk >= 45) els.statAvgRiskSub.textContent = "A few emails raised eyebrows";
      else els.statAvgRiskSub.textContent = "Mostly calm waters";
    }

    // Update Settings record count
    if (els.settingRecordCount) els.settingRecordCount.textContent = total;

    // Render Panels
    renderCharts(total, phishingCount, legitCount);
    renderActivityFeed();
    renderHistory();
    renderThreatIntel();
  }

  function renderCharts(total, phishingCount, legitCount) {
    // 1. Donut Chart (SVG)
    // Circumference = 377 (r=60)
    const circ = 377;
    if (els.donutCenterValue) els.donutCenterValue.textContent = total;
    if (els.legendLegit) els.legendLegit.textContent = legitCount;
    if (els.legendPhishing) els.legendPhishing.textContent = phishingCount;

    if (total === 0) {
      if (els.donutLegit) els.donutLegit.style.strokeDasharray = `0 ${circ}`;
      if (els.donutPhishing) els.donutPhishing.style.strokeDasharray = `0 ${circ}`;
    } else {
      const legitVal = (legitCount / total) * circ;
      const phishVal = (phishingCount / total) * circ;
      
      if (els.donutLegit) els.donutLegit.style.strokeDasharray = `${legitVal} ${circ}`;
      if (els.donutPhishing) {
        els.donutPhishing.style.strokeDasharray = `${phishVal} ${circ}`;
        els.donutPhishing.style.strokeDashoffset = `-${legitVal}`;
      }
    }

    // 2. Bar Chart (Risk Levels)
    const lowCount = historyData.filter(item => (item.risk_score || 0) < 45).length;
    const medCount = historyData.filter(item => (item.risk_score || 0) >= 45 && (item.risk_score || 0) < 75).length;
    const highCount = historyData.filter(item => (item.risk_score || 0) >= 75).length;

    if (els.barLowCount) els.barLowCount.textContent = lowCount;
    if (els.barMedCount) els.barMedCount.textContent = medCount;
    if (els.barHighCount) els.barHighCount.textContent = highCount;

    if (total === 0) {
      if (els.barLow) els.barLow.style.height = "4px";
      if (els.barMed) els.barMed.style.height = "4px";
      if (els.barHigh) els.barHigh.style.height = "4px";
    } else {
      if (els.barLow) els.barLow.style.height = `${Math.max(4, (lowCount / total) * 100)}%`;
      if (els.barMed) els.barMed.style.height = `${Math.max(4, (medCount / total) * 100)}%`;
      if (els.barHigh) els.barHigh.style.height = `${Math.max(4, (highCount / total) * 100)}%`;
    }
  }

  function renderActivityFeed() {
    if (!els.activityFeed) return;
    
    // Clear feed
    els.activityFeed.innerHTML = "";

    const recent = historyData.slice(0, 5);
    if (recent.length === 0) {
      els.activityFeed.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4V6z" stroke="currentColor" stroke-width="1.75"/><path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.75"/></svg></div>
          <div class="empty-state__title">No activity yet</div>
          <div class="empty-state__text">Open an email in Gmail and hit <strong>Check for phishing</strong> to get started.</div>
        </div>
      `;
      return;
    }

    recent.forEach((item, i) => {
      const feedItem = document.createElement("div");
      feedItem.className = "mail-card";
      feedItem.style.animationDelay = `${i * 0.06}s`;

      const sender = item.sender || "Unknown sender";
      const isPhish = item.classification === "PHISHING";
      const badgeClass = isPhish ? "badge badge--phishing" : "badge badge--legitimate";
      const badgeLabel = isPhish ? "Flagged" : "Looks OK";
      const score = item.risk_score ?? 0;
      const scoreClass =
        score >= 75 ? "mail-card__score--danger" : score >= 45 ? "mail-card__score--warn" : "mail-card__score--safe";
      const color = avatarColor(sender);
      const initials = getInitials(sender);

      feedItem.innerHTML = `
        <div class="mail-card__avatar" style="background:${color}">${initials}</div>
        <div class="mail-card__body">
          <div class="mail-card__top">
            <span class="mail-card__from">${escapeHtml(sender)}</span>
            <span class="mail-card__time">${timeAgo(item.timestamp)}</span>
          </div>
          <div class="mail-card__subject">${escapeHtml(item.subject || "(No subject)")}</div>
          <div class="mail-card__preview">${escapeHtml(bodySnippet(item.body))}</div>
          <div class="mail-card__footer">
            <span class="${badgeClass}">${badgeLabel}</span>
            <span class="mail-card__score ${scoreClass}">${score}% risk</span>
          </div>
        </div>
      `;
      els.activityFeed.appendChild(feedItem);
    });
  }

  function renderHistory() {
    if (!els.historyTbody) return;
    
    // Clear history rows
    els.historyTbody.innerHTML = "";

    // 1. Apply Search and Filters
    const searchQuery = els.globalSearch ? els.globalSearch.value.trim().toLowerCase() : "";
    
    let filtered = historyData.filter((item) => {
      // Classification filter
      if (currentFilter !== "all" && item.classification !== currentFilter) {
        return false;
      }
      // Search filter (sender, subject, body)
      if (searchQuery) {
        const sender = (item.sender || "").toLowerCase();
        const subject = (item.subject || "").toLowerCase();
        const body = (item.body || "").toLowerCase();
        return sender.includes(searchQuery) || subject.includes(searchQuery) || body.includes(searchQuery);
      }
      return true;
    });

    // Toggle empty state
    if (filtered.length === 0) {
      els.historyEmpty.style.display = "block";
      els.historyPagination.innerHTML = "";
      return;
    } else {
      els.historyEmpty.style.display = "none";
    }

    // 2. Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    // 3. Render Rows
    paginatedItems.forEach((item, index) => {
      const absoluteIndex = startIndex + index;
      const row = document.createElement("tr");
      
      const isPhish = item.classification === "PHISHING";
      const badgeClass = isPhish ? "badge badge--phishing" : "badge badge--legitimate";
      
      const riskColor = item.risk_score >= 75 ? 'var(--danger-text)' : (item.risk_score >= 45 ? 'var(--warning-text)' : 'var(--success-text)');
      
      const recordDate = new Date(item.timestamp);
      const displayTime = recordDate.toLocaleDateString() + " " + recordDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const sender = item.sender || "Unknown";
      const initials = getInitials(sender);
      const color = avatarColor(sender);

      row.innerHTML = `
        <td style="color:var(--text-secondary); font-size:0.82rem;">${displayTime}</td>
        <td>
          <div class="history-sender" title="${escapeHtml(sender)}">
            <span class="history-sender__avatar" style="background:${color}">${initials}</span>
            <span class="history-sender__email">${escapeHtml(sender)}</span>
          </div>
        </td>
        <td style="color:var(--text-secondary); font-size:0.85rem; max-width:240px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${escapeHtml(item.subject)}">${escapeHtml(item.subject || "(No Subject)")}</td>
        <td><span class="${badgeClass}" style="font-size:0.7rem;">${isPhish ? "Flagged" : "Looks OK"}</span></td>
        <td><strong style="color:${riskColor}; font-size:0.95rem;">${item.risk_score}</strong><span style="color:var(--text-muted); font-size:0.75rem;">/100</span></td>
        <td>
          <button class="delete-row-btn" data-index="${absoluteIndex}" title="Delete record" aria-label="Delete record">×</button>
        </td>
      `;
      
      // Bind delete button
      row.querySelector(".delete-row-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        const indexToDelete = parseInt(e.target.getAttribute("data-index"), 10);
        deleteHistoryItem(indexToDelete);
      });

      // Click row to show details (we can implement details overlay or alert)
      row.addEventListener("click", () => showHistoryDetails(item));
      row.style.cursor = "pointer";

      els.historyTbody.appendChild(row);
    });

    // 4. Render Pagination Elements
    renderPaginationControls(totalPages);
  }

  function renderPaginationControls(totalPages) {
    if (!els.historyPagination) return;
    els.historyPagination.innerHTML = "";

    if (totalPages <= 1) return;

    // Previous Button
    const prevBtn = document.createElement("button");
    prevBtn.className = "pagination__btn";
    prevBtn.textContent = "◀";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderHistory();
      }
    });
    els.historyPagination.appendChild(prevBtn);

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageNum = document.createElement("button");
      pageNum.className = `pagination__btn ${i === currentPage ? "pagination__btn--active" : ""}`;
      pageNum.textContent = i;
      pageNum.addEventListener("click", () => {
        currentPage = i;
        renderHistory();
      });
      els.historyPagination.appendChild(pageNum);
    }

    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.className = "pagination__btn";
    nextBtn.textContent = "▶";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderHistory();
      }
    });
    els.historyPagination.appendChild(nextBtn);
  }

  function deleteHistoryItem(index) {
    historyData.splice(index, 1);
    chrome.storage.local.set({ analysis_history: historyData }, () => {
      updateDashboardData();
    });
  }

  function confirmClearHistory() {
    if (confirm("Are you sure you want to permanently delete all email analysis history? This action cannot be undone.")) {
      chrome.storage.local.set({ analysis_history: [] }, () => {
        historyData = [];
        updateDashboardData();
        showSettingsNotification("All database records cleared.", "success");
      });
    }
  }

  function showHistoryDetails(item) {
    // Create detailed modal overlay dynamically
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(10, 10, 20, 0.8)";
    overlay.style.backdropFilter = "blur(10px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "200";
    overlay.style.padding = "20px";

    const modal = document.createElement("div");
    modal.style.background = "linear-gradient(160deg, #1c2338 0%, #0d0d1a 100%)";
    modal.style.border = "1px solid var(--border)";
    modal.style.borderRadius = "16px";
    modal.style.padding = "28px";
    modal.style.maxWidth = "600px";
    modal.style.width = "100%";
    modal.style.maxHeight = "90vh";
    modal.style.overflowY = "auto";
    modal.style.color = "var(--text-primary)";
    modal.style.boxShadow = "var(--shadow-lg), 0 0 50px rgba(59, 130, 246, 0.15)";
    modal.style.position = "relative";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "16px";
    closeBtn.style.right = "20px";
    closeBtn.style.background = "none";
    closeBtn.style.border = "none";
    closeBtn.style.color = "var(--text-secondary)";
    closeBtn.style.fontSize = "26px";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => overlay.remove());

    const isPhish = item.classification === "PHISHING";
    const badgeColor = isPhish ? '#fda4af' : '#6ee7b7';
    const badgeBg = isPhish ? 'var(--danger-soft)' : 'var(--success-soft)';
    const badgeBorder = isPhish ? 'rgba(233, 69, 96, 0.4)' : 'rgba(16, 185, 129, 0.4)';
    const riskColor = item.risk_score >= 75 ? 'var(--danger-text)' : (item.risk_score >= 45 ? 'var(--warning-text)' : 'var(--success-text)');

    let reasonsHtml = escapeHtml(item.reasons || "No indicators documented.");
    let recommendationHtml = escapeHtml(item.recommendation || "Proceed with caution.");

    modal.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 1.25rem; font-weight: 800; display:flex; align-items:center; gap:8px;">
        <span style="color:var(--accent);">◈</span> Email Threat Details
      </h3>
      
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:20px;">
        <div>
          <span style="display:inline-block; font-size:0.75rem; font-weight:800; letter-spacing:0.08em; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeBorder}; padding:4px 12px; border-radius:99px; text-transform:uppercase;">
            ${item.classification}
          </span>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Risk Rating</div>
          <div style="font-size:1.5rem; font-weight:800; color:${riskColor}; line-height:1;">${item.risk_score}<span style="font-size:10px; color:var(--text-muted); font-weight:500;">/100</span></div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px; font-size:0.88rem; background:rgba(255,255,255,0.02); padding:14px; border-radius:10px; border:1px solid var(--border);">
        <div><strong>Sender:</strong> <span style="color:var(--text-secondary); word-break:break-all;">${escapeHtml(item.sender || "Unknown")}</span></div>
        <div><strong>Subject:</strong> <span style="color:var(--text-secondary);">${escapeHtml(item.subject || "(No Subject)")}</span></div>
        <div><strong>Analyzed At:</strong> <span style="color:var(--text-secondary);">${new Date(item.timestamp).toLocaleString()}</span></div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px;">Key Indicators & Explanation</div>
        <div style="background:rgba(13,13,26,0.5); padding:12px 14px; border-radius:8px; border-left:3px solid var(--accent); font-size:0.85rem; color:var(--text-secondary); line-height:1.6; white-space:pre-wrap;">${reasonsHtml}</div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px;">Recommendation</div>
        <div style="background:${isPhish ? 'var(--danger-soft)' : 'var(--success-soft)'}; border-left:3px solid ${isPhish ? 'var(--danger)' : 'var(--success)'}; padding:12px 14px; border-radius:8px; font-size:0.85rem; color:var(--text-primary); line-height:1.6;">
          <strong>${item.risk_level} Risk:</strong> ${recommendationHtml}
        </div>
      </div>
      
      <div>
        <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px;">Raw Email Body Snippet</div>
        <div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; border:1px solid var(--border); font-family:monospace; font-size:0.8rem; color:var(--text-muted); max-height:120px; overflow-y:auto; white-space:pre-wrap;">${escapeHtml(item.body || "(Empty Body)")}</div>
      </div>
    `;

    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  function renderThreatIntel() {
    if (!els.topSendersList || !els.keywordsList || !els.suspiciousUrlsList) return;

    // Clear lists
    els.topSendersList.innerHTML = "";
    els.keywordsList.innerHTML = "";
    els.suspiciousUrlsList.innerHTML = "";

    const phishingList = historyData.filter(item => item.classification === "PHISHING");

    // 1. Group Top Senders by Phishing Count
    const senderCounts = {};
    phishingList.forEach((item) => {
      const sender = item.sender || "Unknown";
      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    });

    const sortedSenders = Object.entries(senderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedSenders.length === 0) {
      els.topSendersList.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75"/><path d="M6 20c0-4 3.5-6 7-6s7 2 7 6" stroke="currentColor" stroke-width="1.75"/></svg></div>
          <div class="empty-state__title">No phishing senders</div>
          <div class="empty-state__text">Aggregated risky senders will be listed once phishing emails are detected.</div>
        </div>
      `;
    } else {
      const maxCount = sortedSenders[0][1];
      sortedSenders.forEach(([sender, count]) => {
        const pct = Math.round((count / maxCount) * 100);
        const itemRow = document.createElement("div");
        itemRow.style.marginBottom = "14px";
        itemRow.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px; font-weight:600;">
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:220px;" title="${escapeHtml(sender)}">${escapeHtml(sender)}</span>
            <span style="color:var(--danger-text);">${count} alert${count === 1 ? "" : "s"}</span>
          </div>
          <div style="height:6px; background:#eef2f8; border-radius:10px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--amber) 0%, var(--coral) 100%); border-radius:10px;"></div>
          </div>
        `;
        els.topSendersList.appendChild(itemRow);
      });
    }

    // 2. Aggregate Keywords from Feature Extraction
    const keywordsCount = {};
    historyData.forEach((item) => {
      const words = (item.features && item.features.urgency_words) || [];
      words.forEach((w) => {
        const clean = w.toLowerCase().trim();
        if (clean) {
          keywordsCount[clean] = (keywordsCount[clean] || 0) + 1;
        }
      });
    });

    const sortedKeywords = Object.entries(keywordsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (sortedKeywords.length === 0) {
      els.keywordsList.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z" stroke="currentColor" stroke-width="1.75"/></svg></div>
          <div class="empty-state__title">No keywords logged</div>
          <div class="empty-state__text">Urgency words detected in analyzed emails will appear here.</div>
        </div>
      `;
    } else {
      const container = document.createElement("div");
      container.className = "keyword-cloud";

      sortedKeywords.forEach(([word, count]) => {
        const chip = document.createElement("span");
        chip.className = "keyword-chip";
        chip.innerHTML = `${escapeHtml(word)} <strong>${count}</strong>`;
        container.appendChild(chip);
      });
      els.keywordsList.appendChild(container);
    }

    // 3. Aggregate Suspicious URL Domains
    const suspiciousUrlsMap = {};
    historyData.forEach((item) => {
      const urls = (item.features && item.features.suspicious_urls) || [];
      urls.forEach((u) => {
        if (u.is_suspicious) {
          const urlStr = u.url || "";
          suspiciousUrlsMap[urlStr] = {
            count: (suspiciousUrlsMap[urlStr]?.count || 0) + 1,
            flags: u.flags || []
          };
        }
      });
    });

    const sortedUrls = Object.entries(suspiciousUrlsMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    if (sortedUrls.length === 0) {
      els.suspiciousUrlsList.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M10 14h4M8 10l-2 2a3 3 0 004 4l1-1M16 10l2 2a3 3 0 01-4 4l-1-1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></div>
          <div class="empty-state__title">No malicious URLs</div>
          <div class="empty-state__text">Aggregated flagged URLs from analyzed emails will be shown here.</div>
        </div>
      `;
    } else {
      sortedUrls.forEach(([url, data]) => {
        const itemRow = document.createElement("div");
        itemRow.style.display = "flex";
        itemRow.style.flexDirection = "column";
        itemRow.style.padding = "10px 12px";
        itemRow.className = "intel-list__item";
        itemRow.style.flexDirection = "column";
        itemRow.style.alignItems = "stretch";
        itemRow.style.marginBottom = "8px";
        
        const flagsHtml = data.flags.map(f => `<span style="background:var(--danger-soft); color:var(--danger-text); border:1px solid rgba(233,69,96,0.3); font-size:0.65rem; font-weight:700; padding:1px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(f)}</span>`).join("");

        itemRow.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-family:monospace; font-size:0.8rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:320px; color:var(--text-secondary);" title="${escapeHtml(url)}">${escapeHtml(url)}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Flagged ${data.count}x</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${flagsHtml || '<span style="font-size:0.65rem; color:var(--text-muted);">Suspicious content</span>'}
          </div>
        `;
        els.suspiciousUrlsList.appendChild(itemRow);
      });
    }
  }

  function formatTimestamp(isoStr) {
    if (!isoStr) return "Just now";
    try {
      const date = new Date(isoStr);
      const diffMs = new Date() - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return "Recently";
    }
  }

  function showSettingsNotification(msg, type) {
    // Check if there is an existing notification area
    let notif = document.getElementById("settings-notif");
    if (!notif) {
      notif = document.createElement("div");
      notif.id = "settings-notif";
      notif.style.marginTop = "14px";
      notif.style.padding = "10px 14px";
      notif.style.borderRadius = "6px";
      notif.style.fontSize = "0.85rem";
      notif.style.fontWeight = "600";
      notif.style.transition = "opacity 0.3s";
      
      const btnContainer = els.saveSettingsBtn.parentNode;
      btnContainer.appendChild(notif);
    }
    
    if (type === "success") {
      notif.style.background = "var(--success-soft)";
      notif.style.border = "1px solid rgba(16,185,129,0.3)";
      notif.style.color = "var(--success-text)";
    } else {
      notif.style.background = "var(--danger-soft)";
      notif.style.border = "1px solid rgba(233,69,96,0.3)";
      notif.style.color = "var(--danger-text)";
    }
    
    notif.textContent = msg;
    notif.style.opacity = "1";
    notif.style.display = "block";
    
    setTimeout(() => {
      notif.style.opacity = "0";
      setTimeout(() => { notif.style.display = "none"; }, 300);
    }, 4000);
  }

  function exportHistoryToCSV() {
    if (historyData.length === 0) {
      alert("No analysis history to export.");
      return;
    }

    const headers = ["Timestamp", "Sender", "Subject", "Classification", "Risk Score", "Confidence", "Key Reasons", "Recommendation"];
    const rows = historyData.map((item) => [
      item.timestamp || "",
      item.sender || "",
      item.subject || "",
      item.classification || "",
      item.risk_score ?? 0,
      item.confidence || "",
      (item.reasons || "").replace(/"/g, '""'),
      (item.recommendation || "").replace(/"/g, '""')
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `phishguard_analysis_history_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); // Required for FF

    link.click();
    document.body.removeChild(link);
  }

  function escapeHtml(text) {
    if (!text) return "";
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // --- Realtime Sync ---
  // Listen for changes in chrome.storage to sync history logs on open pages in real time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.analysis_history) {
      historyData = changes.analysis_history.newValue || [];
      updateDashboardData();
    }
  });
});
