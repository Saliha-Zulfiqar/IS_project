/**
 * PhishGuard AI — content script for Gmail / Outlook.
 * Auto-extracting open email into the popup can be added here later.
 */
(function () {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
  console.debug("[PhishGuard AI] content script active:", window.location.hostname);
})();
