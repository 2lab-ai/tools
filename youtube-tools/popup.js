"use strict";

(function () {
  const STORAGE_KEYS = {
    behavior: "ytResize_behavior",
    scale: "ytResize_scale",
    fullscreenOnly: "ytResize_fullscreenOnly",
    offsetX: "ytResize_offsetX",
    offsetY: "ytResize_offsetY",
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
    const presetButtons = document.querySelectorAll(".presets button[data-scale]");
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

    var offsetControls = document.getElementById("offsetControls");

    function renderBehavior(value) {
      modeOff.checked = value === "off";
      modeZoom.checked = value === "zoom";
      modeStretch.checked = value === "stretch";
      scaleControls.style.display = value === "off" ? "none" : "";
      offsetControls.style.display = value === "off" ? "none" : "";
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

    // ── Offset pad ──
    var offsetPad = document.getElementById("offsetPad");
    var offsetDot = document.getElementById("offsetDot");
    var draggingOffset = false;

    function renderOffset(ox, oy) {
      offsetDot.style.left = ((ox + 50) / 100) * 100 + "%";
      offsetDot.style.top = ((oy + 50) / 100) * 100 + "%";
    }

    function saveOffset(ox, oy) {
      renderOffset(ox, oy);
      chrome.storage.local.set({
        [STORAGE_KEYS.offsetX]: ox,
        [STORAGE_KEYS.offsetY]: oy,
      });
    }

    function offsetFromEvent(e) {
      var rect = offsetPad.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      var y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      return {
        x: +((x - 0.5) * 100).toFixed(1),
        y: +((y - 0.5) * 100).toFixed(1),
      };
    }

    offsetPad.addEventListener("mousedown", function (e) {
      draggingOffset = true;
      var o = offsetFromEvent(e);
      saveOffset(o.x, o.y);
      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!draggingOffset) return;
      var o = offsetFromEvent(e);
      saveOffset(o.x, o.y);
    });

    document.addEventListener("mouseup", function () {
      draggingOffset = false;
    });

    document.getElementById("offsetReset").addEventListener("click", function () {
      saveOffset(0, 0);
    });

    // Load saved state
    chrome.storage.local.get(
      [STORAGE_KEYS.behavior, STORAGE_KEYS.scale, STORAGE_KEYS.fullscreenOnly,
       STORAGE_KEYS.offsetX, STORAGE_KEYS.offsetY],
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
        renderOffset(
          Number(result[STORAGE_KEYS.offsetX]) || 0,
          Number(result[STORAGE_KEYS.offsetY]) || 0
        );
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

    // WideFit / 세로Fit buttons
    function sendFitMessage(type) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: type });
        }
      });
    }

    document.getElementById("btnWideFit").addEventListener("click", function () {
      sendFitMessage("fitWidth");
    });

    document.getElementById("btnHeightFit").addEventListener("click", function () {
      sendFitMessage("fitHeight");
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
      if (changes[STORAGE_KEYS.offsetX] || changes[STORAGE_KEYS.offsetY]) {
        chrome.storage.local.get([STORAGE_KEYS.offsetX, STORAGE_KEYS.offsetY], function (r) {
          renderOffset(Number(r[STORAGE_KEYS.offsetX]) || 0, Number(r[STORAGE_KEYS.offsetY]) || 0);
        });
      }
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    window.addEventListener("unload", function () {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    });
  }

  // ── Block tab ──

  function initBlock() {
    var blockBtn = document.getElementById("blockCurrentBtn");
    var relaxControls = document.getElementById("relaxControls");
    var stopRelaxBtn = document.getElementById("stopRelaxBtn");
    var relaxCountdown = document.getElementById("relaxCountdown");
    var manageBtn = document.getElementById("manageBlockedBtn");
    var relaxButtons = document.querySelectorAll(".relax-btn");

    var currentDomain = "";

    // Get current tab domain
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs.length || !tabs[0].url) return;
      try {
        currentDomain = new URL(tabs[0].url).hostname.replace(/^www\./, "");
        blockBtn.textContent = "Block — " + currentDomain;
      } catch (e) {
        blockBtn.textContent = "Block Current Domain";
      }

      // Check if already blocked
      chrome.storage.local.get("blockedDomains", function (res) {
        var list = res.blockedDomains || [];
        if (list.includes(currentDomain)) {
          blockBtn.style.display = "none";
          relaxControls.style.display = "";
        } else {
          blockBtn.style.display = "";
          relaxControls.style.display = "none";
        }
      });
    });

    // Block current domain — write directly to storage (no background dependency)
    blockBtn.addEventListener("click", function () {
      if (!currentDomain) return;
      chrome.storage.local.get("blockedDomains", function (res) {
        var list = res.blockedDomains || [];
        if (!list.includes(currentDomain)) {
          list.push(currentDomain);
          chrome.storage.local.set({ blockedDomains: list }, function () {
            console.log("[Popup] blocked:", currentDomain, "list:", list);
            blockBtn.style.display = "none";
            relaxControls.style.display = "";
          });
        }
      });
    });

    // Relax mode buttons — write directly to storage + notify background for icon
    relaxButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mins = parseInt(this.getAttribute("data-minutes"), 10);
        var until = Date.now() + mins * 60000;
        chrome.storage.local.set({ relaxModeUntil: until }, function () {
          console.log("[Popup] relax started:", mins, "min");
          updateBlockUI();
        });
        try { chrome.runtime.sendMessage({ type: "START_RELAX", duration: mins }); } catch (e) {}
      });
    });

    // Stop relax — write directly to storage
    stopRelaxBtn.addEventListener("click", function () {
      chrome.storage.local.set({ relaxModeUntil: 0 }, function () {
        console.log("[Popup] relax stopped");
        updateBlockUI();
      });
      try { chrome.runtime.sendMessage({ type: "STOP_RELAX" }); } catch (e) {}
    });

    // Manage blocked sites
    manageBtn.addEventListener("click", function () {
      try { chrome.runtime.openOptionsPage(); } catch (e) {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      }
    });

    function updateBlockUI() {
      chrome.storage.local.get("relaxModeUntil", function (res) {
        var until = res.relaxModeUntil || 0;
        var remain = until - Date.now();
        if (remain > 0) {
          stopRelaxBtn.style.display = "";
          relaxButtons.forEach(function (b) { b.style.display = "none"; });
          var sec = Math.floor(remain / 1000);
          var mm = String(Math.floor(sec / 60)).padStart(2, "0");
          var ss = String(sec % 60).padStart(2, "0");
          relaxCountdown.textContent = mm + ":" + ss;
        } else {
          stopRelaxBtn.style.display = "none";
          relaxButtons.forEach(function (b) { b.style.display = ""; });
          relaxCountdown.textContent = "";
        }
      });
    }

    setInterval(updateBlockUI, 1000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    initResize();
    initBlock();
  });
})();
