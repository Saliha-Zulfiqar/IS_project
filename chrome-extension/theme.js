/**
 * PhishGuard — shared theme (light / dark)
 * Mirrors theme to localStorage for instant apply before paint.
 */
(function (global) {
  const THEME_KEY = "phishguard_theme";
  const STORAGE_KEY = "theme";

  function applyTheme(theme) {
    const resolved = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", resolved);
    try {
      localStorage.setItem(THEME_KEY, resolved);
    } catch (_) {
      /* private browsing */
    }
    return resolved;
  }

  function getStoredTheme() {
    try {
      const cached = localStorage.getItem(THEME_KEY);
      if (cached === "dark" || cached === "light") return cached;
    } catch (_) {
      /* ignore */
    }
    return "light";
  }

  // Apply immediately to avoid flash of wrong theme
  applyTheme(getStoredTheme());

  function initTheme(callback) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        const theme = res[STORAGE_KEY] || getStoredTheme();
        applyTheme(theme);
        if (typeof callback === "function") callback(theme);
      });
    } else if (typeof callback === "function") {
      callback(getStoredTheme());
    }
  }

  function setTheme(theme, callback) {
    const resolved = applyTheme(theme);
    const payload = { [STORAGE_KEY]: resolved };
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set(payload, () => {
        if (typeof callback === "function") callback(resolved);
      });
    } else if (typeof callback === "function") {
      callback(resolved);
    }
  }

  function watchTheme(onChange) {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        const theme = applyTheme(changes[STORAGE_KEY].newValue);
        if (typeof onChange === "function") onChange(theme);
      }
    });
  }

  global.PhishGuardTheme = { applyTheme, initTheme, setTheme, watchTheme, getStoredTheme };
})(typeof window !== "undefined" ? window : globalThis);
