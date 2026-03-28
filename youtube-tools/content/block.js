"use strict";

(function relaxBlock() {
  console.log("[Block] content script loaded:", location.hostname);

  var blocked = false;
  var relaxMode = false;
  var blockOverlay = null;
  var mediaObserver = null;

  function getDomain() {
    return location.hostname.replace(/^www\./, "");
  }

  function recheckDomain() {
    var domain = getDomain();
    chrome.storage.local.get(["blockedDomains", "relaxModeUntil"], function (res) {
      if (chrome.runtime.lastError) {
        console.error("[Block] storage error:", chrome.runtime.lastError);
        return;
      }
      var now = Date.now();
      var prevRelax = relaxMode;
      relaxMode = !!(res.relaxModeUntil && now < res.relaxModeUntil);
      var inList = Array.isArray(res.blockedDomains) && res.blockedDomains.includes(domain);
      var isBlocked = inList && !relaxMode;

      if (prevRelax && !relaxMode && inList) {
        console.log("[Block] relax expired, re-blocking:", domain);
        blockPage();
      } else if (isBlocked && !blocked) {
        console.log("[Block] BLOCKING:", domain);
        blockPage();
      } else if (!isBlocked && blocked) {
        console.log("[Block] UNBLOCKING:", domain);
        unblockPage();
      } else if (isBlocked && blocked && (!blockOverlay || !document.body || !document.body.contains(blockOverlay))) {
        console.log("[Block] re-applying overlay:", domain);
        blockPage();
      }
    });
  }

  function blockPage() {
    blocked = true;

    // Grayscale on html element (works even before body exists)
    document.documentElement.style.setProperty("filter", "grayscale(100%)", "important");
    document.documentElement.style.setProperty("pointer-events", "none", "important");
    document.documentElement.style.setProperty("user-select", "none", "important");

    if (!document.body) return; // will retry on DOMContentLoaded / interval

    document.body.addEventListener("click", stopEvent, true);
    document.body.addEventListener("keydown", stopEvent, true);
    document.body.addEventListener("wheel", stopEvent, { capture: true, passive: false });
    document.body.addEventListener("mousedown", stopEvent, true);

    if (blockOverlay) blockOverlay.remove();
    blockOverlay = document.createElement("div");
    blockOverlay.textContent = "This site is blocked by Toolbox for Brain";
    blockOverlay.style.cssText = [
      "position:fixed", "top:0", "left:0", "width:100vw", "height:100vh",
      "display:flex", "align-items:center", "justify-content:center",
      "font-size:22px", "font-family:-apple-system,sans-serif", "font-weight:500",
      "background:rgba(0,0,0,.4)", "color:rgba(255,255,255,.8)",
      "text-align:center", "z-index:2147483647",
      "pointer-events:auto", "cursor:default",
    ].join("!important;") + "!important;";

    blockOverlay.addEventListener("dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      try { chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }); } catch (err) {}
    }, true);

    document.body.appendChild(blockOverlay);
    console.log("[Block] overlay appended to body");
    muteAllMedia();
  }

  function unblockPage() {
    blocked = false;
    document.documentElement.style.removeProperty("filter");
    document.documentElement.style.removeProperty("pointer-events");
    document.documentElement.style.removeProperty("user-select");
    if (document.body) {
      document.body.removeEventListener("click", stopEvent, true);
      document.body.removeEventListener("keydown", stopEvent, true);
      document.body.removeEventListener("wheel", stopEvent, { capture: true });
      document.body.removeEventListener("mousedown", stopEvent, true);
    }
    if (blockOverlay) { blockOverlay.remove(); blockOverlay = null; }
    if (mediaObserver) { mediaObserver.disconnect(); mediaObserver = null; }
  }

  function stopEvent(e) { e.stopPropagation(); e.preventDefault(); }

  function muteAllMedia() {
    var sel = "audio, video";
    document.querySelectorAll(sel).forEach(function (m) { m.muted = true; m.pause(); });
    if (mediaObserver) mediaObserver.disconnect();
    mediaObserver = new MutationObserver(function (muts) {
      muts.forEach(function (mut) {
        mut.addedNodes.forEach(function (n) {
          if (n.nodeName === "AUDIO" || n.nodeName === "VIDEO") { n.muted = true; n.pause(); }
          if (n.querySelectorAll) n.querySelectorAll(sel).forEach(function (m) { m.muted = true; m.pause(); });
        });
      });
    });
    if (document.body) mediaObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ──
  recheckDomain();
  document.addEventListener("DOMContentLoaded", recheckDomain);
  window.addEventListener("load", recheckDomain);

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.blockedDomains || changes.relaxModeUntil) {
      console.log("[Block] storage changed, rechecking");
      recheckDomain();
    }
  });

  setInterval(recheckDomain, 1000);
})();
