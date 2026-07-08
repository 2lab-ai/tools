"use strict";

(function youtubeToolsResize() {
  var DEFAULTS = { behavior: "zoom", scale: 1.0, fullscreenOnly: true, offsetX: 0, offsetY: 0 };
  var STYLE_ID = "yt-tools-transform";
  var OVERLAY_STYLE_ID = "yt-tools-fs-style";

  var state = {
    behavior: DEFAULTS.behavior,
    scale: DEFAULTS.scale,
    fullscreenOnly: DEFAULTS.fullscreenOnly,
    offsetX: 0,
    offsetY: 0,
  };

  // ── Transform via <style> element ──

  function computeTransform(behavior, scale, ox, oy) {
    if (behavior === "off") return "";
    var parts = [];
    // Offset: factor = max(1, scale-1) so pad edge always reaches video edge
    // At 1x: factor=1 → ±50% range (allows panning even without zoom)
    // At 2x: factor=1 → ±50% (exactly reaches edge)
    // At 4x: factor=3 → ±150% (exactly reaches edge)
    // At 8x: factor=7 → ±350% (exactly reaches edge)
    if (ox !== 0 || oy !== 0) {
      var factor = Math.max(1, scale - 1);
      parts.push("translate(" + (-ox * factor) + "%, " + (-oy * factor) + "%)");
    }
    if (scale > 1.0) {
      parts.push(behavior === "stretch" ? "scaleX(" + scale + ")" : "scale(" + scale + ")");
    }
    return parts.length > 0 ? parts.join(" ") : "";
  }

  function getStyleElement(id) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
    return el;
  }

  function applyTransform() {
    var style = getStyleElement(STYLE_ID);
    var isFullscreen = !!document.fullscreenElement;
    var hasOffset = state.offsetX !== 0 || state.offsetY !== 0;
    var shouldApply =
      state.behavior !== "off" &&
      (state.scale > 1.0 || hasOffset) &&
      (!state.fullscreenOnly || isFullscreen);

    if (shouldApply) {
      var t = computeTransform(state.behavior, state.scale, state.offsetX, state.offsetY);
      if (t) {
        style.textContent =
          "#movie_player video { transform: " + t + " !important; transform-origin: center center !important; }";
      } else {
        style.textContent = "";
      }
    } else {
      style.textContent = "";
    }
  }

  // ── Settings ──

  function loadSettings() {
    chrome.storage.local.get(
      ["ytResize_behavior", "ytResize_scale", "ytResize_fullscreenOnly",
       "ytResize_offsetX", "ytResize_offsetY"],
      function (result) {
        state.behavior = result.ytResize_behavior || DEFAULTS.behavior;
        state.scale = Number(result.ytResize_scale) || DEFAULTS.scale;
        state.fullscreenOnly =
          typeof result.ytResize_fullscreenOnly === "boolean"
            ? result.ytResize_fullscreenOnly
            : DEFAULTS.fullscreenOnly;
        state.offsetX = Number(result.ytResize_offsetX) || 0;
        state.offsetY = Number(result.ytResize_offsetY) || 0;
        applyTransform();
      }
    );
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    var changed = false;
    if (changes.ytResize_behavior) { state.behavior = changes.ytResize_behavior.newValue; changed = true; }
    if (changes.ytResize_scale) { state.scale = Number(changes.ytResize_scale.newValue); changed = true; }
    if (changes.ytResize_fullscreenOnly) { state.fullscreenOnly = changes.ytResize_fullscreenOnly.newValue; changed = true; }
    if (changes.ytResize_offsetX) { state.offsetX = Number(changes.ytResize_offsetX.newValue) || 0; changed = true; }
    if (changes.ytResize_offsetY) { state.offsetY = Number(changes.ytResize_offsetY.newValue) || 0; changed = true; }
    if (changed) applyTransform();
  });

  document.addEventListener("fullscreenchange", function () {
    applyTransform();
  });

  // ── Fit helpers ──

  function applyFit(type) {
    var videos = document.getElementsByTagName("video");
    if (videos.length === 0) return;
    var video = videos[0];
    if (video.clientWidth === 0 || video.clientHeight === 0) return;
    var scale;
    if (type === "fitWidth") {
      scale = window.innerWidth / video.clientWidth;
    } else {
      scale = window.innerHeight / video.clientHeight;
    }
    scale = Math.min(8.0, Math.max(1.0, +scale.toFixed(2)));
    chrome.storage.local.set({
      ytResize_behavior: "zoom",
      ytResize_scale: scale,
      ytResize_offsetX: 0,
      ytResize_offsetY: 0,
    });
  }

  // Scroll wheel zoom
  function adjustScale(delta) {
    var step = 0.05;
    var next = state.scale + (delta > 0 ? -step : step);
    next = Math.min(8.0, Math.max(1.0, +next.toFixed(2)));
    if (next !== state.scale) {
      chrome.storage.local.set({ ytResize_scale: next, ytResize_behavior: "zoom" });
    }
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === "fitWidth" || message.type === "fitHeight") {
      applyFit(message.type);
      sendResponse({ ok: true });
    }
  });

  // ── Fullscreen overlay — bottom center, flat modern ──

  function injectOverlayStyle() {
    if (document.getElementById(OVERLAY_STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = OVERLAY_STYLE_ID;
    s.textContent = [
      // Container: bottom center
      ".yt-tools-fs { position:absolute !important; bottom:60px !important; left:50% !important; transform:translateX(-50%) !important; z-index:2147483647 !important; display:none !important; pointer-events:none !important; }",
      ".ytp-fullscreen .yt-tools-fs { display:flex !important; }",
      // Bar
      ".yt-tools-fs-bar { display:flex !important; align-items:center !important; gap:8px !important; opacity:0; transition:opacity .25s; pointer-events:none !important; background:rgba(0,0,0,.45) !important; backdrop-filter:blur(12px) !important; -webkit-backdrop-filter:blur(12px) !important; padding:6px 12px !important; border-radius:8px !important; }",
      ".ytp-fullscreen:not(.ytp-autohide) .yt-tools-fs-bar { opacity:1 !important; pointer-events:auto !important; }",
      // Scale label
      ".yt-tools-fs-scale { all:initial !important; color:rgba(255,255,255,.5) !important; font:500 11px/1 -apple-system,sans-serif !important; padding:0 4px !important; min-width:36px !important; text-align:center !important; pointer-events:none !important; }",
      // Buttons
      ".yt-tools-fs-btn { all:initial !important; display:inline-block !important; background:rgba(255,255,255,.06) !important; border:1px solid rgba(255,255,255,.12) !important; color:rgba(255,255,255,.55) !important; padding:5px 12px !important; border-radius:5px !important; font:500 11px/1 -apple-system,sans-serif !important; cursor:pointer !important; transition:background .15s,color .15s !important; letter-spacing:.02em !important; }",
      ".yt-tools-fs-btn:hover { background:rgba(255,255,255,.15) !important; color:#fff !important; }",
    ].join("\n");
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    var player = document.getElementById("movie_player");
    if (!player) return false;
    if (player.querySelector(".yt-tools-fs")) return true;

    injectOverlayStyle();

    var container = document.createElement("div");
    container.className = "yt-tools-fs";

    var bar = document.createElement("div");
    bar.className = "yt-tools-fs-bar";

    // Scale label
    var scaleLabel = document.createElement("span");
    scaleLabel.className = "yt-tools-fs-scale";
    scaleLabel.textContent = state.scale.toFixed(2) + "x";

    // Update scale label on storage change
    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.ytResize_scale) {
        scaleLabel.textContent = Number(changes.ytResize_scale.newValue).toFixed(2) + "x";
      }
    });

    var btnWide = document.createElement("button");
    btnWide.className = "yt-tools-fs-btn";
    btnWide.textContent = "WideFit";
    btnWide.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); applyFit("fitWidth"); });

    var btnTall = document.createElement("button");
    btnTall.className = "yt-tools-fs-btn";
    btnTall.textContent = "TallFit";
    btnTall.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); applyFit("fitHeight"); });

    var btnReset = document.createElement("button");
    btnReset.className = "yt-tools-fs-btn";
    btnReset.textContent = "Reset";
    btnReset.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      chrome.storage.local.set({ ytResize_scale: 1.0, ytResize_offsetX: 0, ytResize_offsetY: 0 });
    });

    bar.appendChild(scaleLabel);
    bar.appendChild(btnWide);
    bar.appendChild(btnTall);
    bar.appendChild(btnReset);
    container.appendChild(bar);

    // Scroll wheel zoom on the overlay bar
    bar.addEventListener("wheel", function (e) {
      e.preventDefault();
      e.stopPropagation();
      adjustScale(e.deltaY);
    }, { passive: false });

    player.appendChild(container);
    return true;
  }

  function ensureOverlayWithRetry(maxAttempts) {
    var attempts = 0;
    var max = maxAttempts || 20;
    function tryAttach() {
      if (ensureOverlay()) return;
      attempts++;
      if (attempts < max) setTimeout(tryAttach, 500);
    }
    tryAttach();
  }

  // ── SPA navigation ──

  var lastUrl = location.href;
  var navTimer = null;

  var spaObserver = new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearTimeout(navTimer);
      navTimer = setTimeout(function () {
        applyTransform();
        ensureOverlayWithRetry(10);
      }, 500);
    }
  });

  // ── Init ──

  function init() {
    console.log("[YT-Tools] Content script loaded:", location.href);
    loadSettings();
    spaObserver.observe(document.body, { childList: true, subtree: true });
    ensureOverlayWithRetry(20);
  }

  if (document.readyState !== "loading") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
