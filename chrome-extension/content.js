/**
 * PhishGuard AI — content script for Gmail / Outlook.
 * Injects a floating analyze button and opens analysis in a slide-in panel within the tab.
 */
(function () {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;

  const PANEL_URL = chrome.runtime.getURL("popup.html?embedded=1");
  let overlayEl = null;

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function formatSender(displayName, email) {
    const name = (displayName || "").trim();
    const addr = (email || "").trim();
    if (!addr) return name;
    if (!name || name === addr || name.includes("@")) return addr;
    return `${name} <${addr}>`;
  }

  function isGmail() {
    return /mail\.google\.com|gmail\.com/i.test(window.location.hostname);
  }

  function isOutlook() {
    return /outlook\.(live|office|office365)\.com/i.test(window.location.hostname);
  }

  /**
   * Gmail: scope to the open message — never use the first [email] on the page
   * (inbox rows and footer addresses like rewards@customer-mail.smile.io are wrong).
   */
  function extractGmailEmailData() {
    const main = document.querySelector('div[role="main"]');
    if (!main) return null;

    const subjectEl =
      main.querySelector("h2.hP[data-thread-perm-id]") ||
      main.querySelector("h2.hP[data-legacy-thread-id]") ||
      main.querySelector("h2[data-thread-id]") ||
      main.querySelector("h2.hP");
    const subject = subjectEl?.innerText?.trim() || "";

    const visibleBodies = [...main.querySelectorAll(".a3s")].filter(isVisible);
    const bodyEl = visibleBodies.length
      ? visibleBodies[visibleBodies.length - 1]
      : main.querySelector(".a3s");
    const body = bodyEl?.innerText?.trim() || "";

    let sender = "";
    const messageRoot =
      bodyEl?.closest(".gs") ||
      bodyEl?.closest("[data-message-id]") ||
      bodyEl?.closest("[data-legacy-message-id]") ||
      main;

    if (messageRoot) {
      const headerSpans = [...messageRoot.querySelectorAll("span[email]")].filter(
        (el) => !bodyEl?.contains(el)
      );

      for (const el of headerSpans) {
        const email = el.getAttribute("email")?.trim();
        if (email && email.includes("@")) {
          sender = formatSender(el.textContent, email);
          break;
        }
      }

      if (!sender) {
        const fromChip =
          messageRoot.querySelector("span.gD[email]") ||
          messageRoot.querySelector("[data-hovercard-id][email]");
        const email = fromChip?.getAttribute("email")?.trim();
        if (email?.includes("@")) {
          sender = formatSender(fromChip.textContent, email);
        }
      }
    }

    return { sender, subject, body };
  }

  function extractOutlookEmailData() {
    const main =
      document.querySelector('div[role="main"]') ||
      document.querySelector('[role="region"][aria-label*="Reading"]') ||
      document.body;

    const subjectEl =
      main.querySelector('[role="heading"][aria-level="2"]') ||
      main.querySelector('span[id*="Subject"]') ||
      document.querySelector('[aria-label^="Subject"]');
    const subject = subjectEl?.innerText?.trim() || subjectEl?.textContent?.trim() || "";

    const bodyEl =
      main.querySelector('div[aria-label="Message body"]') ||
      main.querySelector(".allowTextSelection") ||
      main.querySelector('[role="document"]');
    const body = bodyEl?.innerText?.trim() || "";

    let sender = "";
    const fromEl =
      main.querySelector('[aria-label^="From:"]') ||
      main.querySelector('span[title*="@"]') ||
      main.querySelector('[data-testid="message-header-from"]');
    if (fromEl) {
      const title = fromEl.getAttribute("title") || fromEl.getAttribute("aria-label") || "";
      const emailMatch = title.match(/[\w.+-]+@[\w.-]+\.\w+/);
      sender = emailMatch?.[0] || fromEl.innerText?.trim() || "";
    }

    return { sender, subject, body };
  }

  function extractEmailData() {
    if (isGmail()) {
      const gmail = extractGmailEmailData();
      if (gmail) return gmail;
    }
    if (isOutlook()) {
      const outlook = extractOutlookEmailData();
      if (outlook) return outlook;
    }

    // Fallback: still scope to main pane if present
    const main = document.querySelector('div[role="main"]') || document.body;
    const bodyEl = main.querySelector(".a3s") || main.querySelector('[role="document"]');
    const body = bodyEl?.innerText?.trim() || "";

    let sender = "";
    const messageRoot = bodyEl?.closest(".gs") || main;
    const headerEmail = [...messageRoot.querySelectorAll("span[email]")].find(
      (el) => !bodyEl?.contains(el) && el.getAttribute("email")?.includes("@")
    );
    if (headerEmail) {
      sender = formatSender(headerEmail.textContent, headerEmail.getAttribute("email"));
    }

    const subjectEl = main.querySelector("h2.hP, h2[data-thread-id], [role=heading][aria-level='2']");
    const subject = subjectEl?.innerText?.trim() || "";

    return { sender, subject, body };
  }

  function closePanel(immediate = false) {
    if (!overlayEl) return;
    const el = overlayEl;
    overlayEl = null;
    document.body.style.overflow = "";

    if (immediate) {
      el.parentNode?.removeChild(el);
      return;
    }

    el.classList.remove("pg-overlay--open");
    setTimeout(() => el.parentNode?.removeChild(el), 380);
  }

  function openPanel(emailData) {
    if (overlayEl) {
      closePanel(true);
    }

    chrome.storage.local.set({ pending_analysis: emailData }, () => {
      overlayEl = document.createElement("div");
      overlayEl.id = "phishguard-overlay";
      overlayEl.setAttribute("role", "dialog");
      overlayEl.setAttribute("aria-label", "PhishGuard email analysis");
      overlayEl.innerHTML = `
        <div class="pg-backdrop" data-pg-close></div>
        <div class="pg-panel">
          <iframe
            class="pg-panel__iframe"
            src="${PANEL_URL}"
            title="PhishGuard AI Analysis"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </div>
      `;

      document.body.appendChild(overlayEl);
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        overlayEl.classList.add("pg-overlay--open");
      });

      overlayEl.querySelector("[data-pg-close]").addEventListener("click", closePanel);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.data?.type === "phishguard-close") {
      closePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlayEl) {
      closePanel();
    }
  });

  if (!document.querySelector('link[data-phishguard-font]')) {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&display=swap";
    fontLink.setAttribute("data-phishguard-font", "");
    document.head.appendChild(fontLink);
  }

  const root = document.createElement("div");
  root.id = "phishguard-root";

  const btn = document.createElement("button");
  btn.id = "phishguard-analyze-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Analyze this email with PhishGuard AI");
  btn.innerHTML = `
    <span class="pg-fab__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.35C16.6 22.15 20 17.25 20 12V6l-8-4z"
          stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
        <path d="M9 12l2 2 4-4"
          stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
    <span class="pg-fab__label">
      Is this email safe?
      <span class="pg-fab__hint">Quick scan · takes ~5 sec</span>
    </span>
  `;

  btn.addEventListener("click", () => {
    openPanel(extractEmailData());
  });

  root.appendChild(btn);
  document.body.appendChild(root);
})();
