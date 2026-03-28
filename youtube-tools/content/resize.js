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
    if (behavior === "off" || scale <= 1.0) return "";
    var parts = [];
    if (ox !== 0 || oy !== 0) {
      parts.push("translate(" + (-ox) + "%, " + (-oy) + "%)");
    }
    parts.push(behavior === "stretch" ? "scaleX(" + scale + ")" : "scale(" + scale + ")");
    return parts.join(" ");
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
    var shouldApply =
      state.behavior !== "off" &&
      state.scale > 1.0 &&
      (!state.fullscreenOnly || isFullscreen);

    if (shouldApply) {
      var t = computeTransform(state.behavior, state.scale, state.offsetX, state.offsetY);
      style.textContent =
        "#movie_player video { transform: " + t + " !important; transform-origin: center center !important; }";
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

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === "fitWidth" || message.type === "fitHeight") {
      applyFit(message.type);
      sendResponse({ ok: true });
    }
  });

  // ── Fullscreen overlay ──

  function injectOverlayStyle() {
    if (document.getElementById(OVERLAY_STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = OVERLAY_STYLE_ID;
    s.textContent = [
      ".yt-tools-fs { position:absolute !important; top:10px !important; right:12px !important; z-index:2147483647 !important; display:none !important; pointer-events:none !important; box-sizing:border-box !important; }",
      ".ytp-fullscreen .yt-tools-fs { display:flex !important; }",
      ".yt-tools-fs-bar { display:flex !important; gap:6px; opacity:0; transition:opacity .25s; pointer-events:none !important; }",
      ".ytp-fullscreen:not(.ytp-autohide) .yt-tools-fs-bar { opacity:1 !important; pointer-events:auto !important; }",
      ".yt-tools-fs-btn { all:initial; display:inline-block !important; background:rgba(255,255,255,.08) !important; border:1px solid rgba(255,255,255,.15) !important; color:rgba(255,255,255,.6) !important; padding:6px 14px !important; border-radius:4px !important; font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif !important; cursor:pointer !important; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); transition:background .15s,color .15s,border-color .15s; letter-spacing:.02em !important; box-sizing:border-box !important; }",
      ".yt-tools-fs-btn:hover { background:rgba(255,255,255,.2) !important; border-color:rgba(255,255,255,.35) !important; color:#fff !important; }",
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

    var btnWide = document.createElement("button");
    btnWide.className = "yt-tools-fs-btn";
    btnWide.textContent = "WideFit";
    btnWide.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      applyFit("fitWidth");
    });

    var btnTall = document.createElement("button");
    btnTall.className = "yt-tools-fs-btn";
    btnTall.textContent = "TallFit";
    btnTall.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      applyFit("fitHeight");
    });

    bar.appendChild(btnWide);
    bar.appendChild(btnTall);
    container.appendChild(bar);
    player.appendChild(container);
    return true;
  }

  // Retry until #movie_player exists (used for both init and SPA nav)
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
