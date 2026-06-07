/**
 * Developer profile card — shared between dashboard & analysis panel.
 */
(function () {
  const GITHUB_REPO = "https://github.com/Saliha-Zulfiqar/IS_project";
  const HF_MODEL_URL = "https://huggingface.co/omerfarooq223/phishing-detector-phi3-lora";

  function getOverlay() {
    return document.getElementById("dev-profile-overlay");
  }

  function openProfile() {
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.add("dev-profile-overlay--open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeProfile() {
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.remove("dev-profile-overlay--open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function initDevProfile() {
    const overlay = getOverlay();
    if (!overlay) return;

    document.querySelectorAll("[data-open-dev-profile]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openProfile();
      });
    });

    overlay.querySelector(".dev-profile-card__close")?.addEventListener("click", closeProfile);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeProfile();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("dev-profile-overlay--open")) {
        closeProfile();
      }
    });

    const repoBtn = document.getElementById("dev-profile-github-repo");
    const hfBtn = document.getElementById("dev-profile-hf-model");
    if (repoBtn) repoBtn.href = GITHUB_REPO;
    if (hfBtn) hfBtn.href = HF_MODEL_URL;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDevProfile);
  } else {
    initDevProfile();
  }
})();
