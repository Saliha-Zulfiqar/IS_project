/**
 * PhishGuard AI - Background Script
 * Opens the dashboard when the extension toolbar icon is clicked.
 */

const ICON_PATHS = {
  16: "icon16.png",
  32: "icon32.png",
  48: "icon48.png",
  128: "icon128.png",
};

function ensureToolbarIcon() {
  chrome.action.setIcon({ path: ICON_PATHS });
  chrome.action.setTitle({ title: "PhishGuard AI — Open dashboard" });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureToolbarIcon();
});

chrome.runtime.onStartup.addListener(() => {
  ensureToolbarIcon();
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

ensureToolbarIcon();
