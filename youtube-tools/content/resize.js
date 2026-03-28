"use strict";

(function youtubeToolsResize() {
  const DEFAULTS = { behavior: "zoom", scale: 1.0, fullscreenOnly: true };
  const CLASS_NAME = "yt-tools-resized";

  let state = { ...DEFAULTS };

  function computeTransform(behavior, scale) {
    if (behavior === "off" || scale <= 1.0) return "";
    if (behavior === "stretch") return `scaleX(${scale})`;
    return `scale(${scale})`;
  }

  function applyToVideos() {
    const isFullscreen = !!document.fullscreenElement;
    const shouldApply =
      state.behavior !== "off" &&
      state.scale > 1.0 &&
      (!state.fullscreenOnly || isFullscreen);

    const videos = document.getElementsByTagName("video");
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (shouldApply) {
        const transform = computeTransform(state.behavior, state.scale);
        video.style.setProperty("transform", transform, "important");
        video.style.setProperty("transform-origin", "center center", "important");
        video.classList.add(CLASS_NAME);
      } else if (video.classList.contains(CLASS_NAME)) {
        video.style.removeProperty("transform");
        video.style.removeProperty("transform-origin");
        video.classList.remove(CLASS_NAME);
      }
    }
  }

  function loadSettings() {
    chrome.storage.local.get(
      ["ytResize_behavior", "ytResize_scale", "ytResize_fullscreenOnly"],
      function (result) {
        state = {
          behavior: result.ytResize_behavior || DEFAULTS.behavior,
          scale: Number(result.ytResize_scale) || DEFAULTS.scale,
          fullscreenOnly:
            typeof result.ytResize_fullscreenOnly === "boolean"
              ? result.ytResize_fullscreenOnly
              : DEFAULTS.fullscreenOnly,
        };
        applyToVideos();
      }
    );
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    let changed = false;
    if (changes.ytResize_behavior) {
      state = { ...state, behavior: changes.ytResize_behavior.newValue };
      changed = true;
    }
    if (changes.ytResize_scale) {
      state = { ...state, scale: Number(changes.ytResize_scale.newValue) };
      changed = true;
    }
    if (changes.ytResize_fullscreenOnly) {
      state = { ...state, fullscreenOnly: changes.ytResize_fullscreenOnly.newValue };
      changed = true;
    }
    if (changed) applyToVideos();
  });

  document.addEventListener("fullscreenchange", function () {
    applyToVideos();
  });

  // YouTube is a SPA — watch for navigation
  let lastUrl = location.href;
  let navTimer = null;
  const observer = new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearTimeout(navTimer);
      navTimer = setTimeout(applyToVideos, 500);
    }
  });

  function init() {
    loadSettings();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
