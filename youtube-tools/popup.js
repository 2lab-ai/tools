"use strict";

(function () {
  const STORAGE_KEYS = {
    behavior: "ytResize_behavior",
    scale: "ytResize_scale",
    fullscreenOnly: "ytResize_fullscreenOnly",
  };

  const DEFAULTS = { behavior: "zoom", scale: 1.0, fullscreenOnly: true };

  // ── Tab switching ──

  function initTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (this.disabled) return;
        const target = this.getAttribute("data-tab");
        tabs.forEach(function (t) { t.classList.remove("active"); });
        document.querySelectorAll(".tab-content").forEach(function (c) {
          c.classList.remove("active");
        });
        this.classList.add("active");
        document.getElementById("tab-" + target).classList.add("active");
      });
    });
  }

  // ── Resize controls ──

  function initResize() {
    const modeOff = document.getElementById("modeOff");
    const modeZoom = document.getElementById("modeZoom");
    const modeStretch = document.getElementById("modeStretch");
    const slider = document.getElementById("scaleSlider");
    const scaleValue = document.getElementById("scaleValue");
    const fullscreenOnly = document.getElementById("fullscreenOnly");
    const presetButtons = document.querySelectorAll(".presets button");
    const scaleControls = document.getElementById("scaleControls");

    function updateSliderTrack() {
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const pct = ((parseFloat(slider.value) - min) / (max - min)) * 100;
      slider.style.setProperty("--p", pct + "%");
    }

    function renderScale(value) {
      const n = Number(value);
      slider.value = n.toFixed(2);
      scaleValue.textContent = n.toFixed(2) + "x";
      updateSliderTrack();
    }

    function saveScale(value) {
      renderScale(value);
      chrome.storage.local.set({ [STORAGE_KEYS.scale]: Number(value) });
    }

    function renderBehavior(value) {
      modeOff.checked = value === "off";
      modeZoom.checked = value === "zoom";
      modeStretch.checked = value === "stretch";
      scaleControls.style.display = value === "off" ? "none" : "";
    }

    function saveBehavior(value) {
      renderBehavior(value);
      chrome.storage.local.set({ [STORAGE_KEYS.behavior]: value });
    }

    function renderFullscreenOnly(value) {
      fullscreenOnly.checked = value;
    }

    function saveFullscreenOnly(value) {
      renderFullscreenOnly(value);
      chrome.storage.local.set({ [STORAGE_KEYS.fullscreenOnly]: value });
    }

    // Load saved state
    chrome.storage.local.get(
      [STORAGE_KEYS.behavior, STORAGE_KEYS.scale, STORAGE_KEYS.fullscreenOnly],
      function (result) {
        const behavior = result[STORAGE_KEYS.behavior] || DEFAULTS.behavior;
        const scale = Number(result[STORAGE_KEYS.scale]) || DEFAULTS.scale;
        const fsOnly =
          typeof result[STORAGE_KEYS.fullscreenOnly] === "boolean"
            ? result[STORAGE_KEYS.fullscreenOnly]
            : DEFAULTS.fullscreenOnly;

        renderBehavior(behavior);
        renderScale(scale);
        renderFullscreenOnly(fsOnly);
      }
    );

    // Event listeners
    modeOff.addEventListener("change", function () {
      if (this.checked) saveBehavior("off");
    });
    modeZoom.addEventListener("change", function () {
      if (this.checked) saveBehavior("zoom");
    });
    modeStretch.addEventListener("change", function () {
      if (this.checked) saveBehavior("stretch");
    });

    slider.addEventListener("input", function () {
      saveScale(this.value);
    });

    fullscreenOnly.addEventListener("change", function () {
      saveFullscreenOnly(this.checked);
    });

    presetButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        saveScale(this.getAttribute("data-scale"));
      });
    });

    // Sync from external changes (e.g. keyboard shortcuts)
    var onStorageChanged = function (changes, area) {
      if (area !== "local") return;
      if (changes[STORAGE_KEYS.behavior]) {
        renderBehavior(changes[STORAGE_KEYS.behavior].newValue);
      }
      if (changes[STORAGE_KEYS.scale]) {
        renderScale(changes[STORAGE_KEYS.scale].newValue);
      }
      if (changes[STORAGE_KEYS.fullscreenOnly]) {
        renderFullscreenOnly(changes[STORAGE_KEYS.fullscreenOnly].newValue);
      }
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    window.addEventListener("unload", function () {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    initResize();
  });
})();
