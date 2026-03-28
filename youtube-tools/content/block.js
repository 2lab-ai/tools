"use strict";

(function relaxBlock() {
  var blocked = false;
  var relaxMode = false;
  var blockOverlay = null;
  var mediaObserver = null;
  var mutedElements = new WeakSet();

  function recheckDomain() {
    var domain = location.hostname.replace("www.", "");
    chrome.storage.local.get(["blockedDomains", "relaxModeUntil"], function (res) {
      var now = Date.now();
      var prevRelax = relaxMode;
      relaxMode = res.relaxModeUntil && now < res.relaxModeUntil;
      var isBlocked =
        Array.isArray(res.blockedDomains) &&
        res.blockedDomains.includes(domain) &&
        !relaxMode;

      if (prevRelax && !relaxMode && res.blockedDomains && res.blockedDomains.includes(domain)) {
        blockPage();
      } else if (isBlocked && !blocked) {
        blockPage();
      } else if (!isBlocked && blocked) {
        unblockPage();
      } else if (isBlocked && blocked) {
        if (!blockOverlay || !document.body || !document.body.contains(blockOverlay)) {
          blockPage();
        }
      }
    });
  }

  function blockPage() {
    blocked = true;
    document.documentElement.style.cssText =
      "filter: grayscale(100%) !important; pointer-events: none !important; user-select: none !important;";

    if (document.body) {
      document.body.addEventListener("click", stopEvent, true);
      document.body.addEventListener("keydown", stopEvent, true);
      document.body.addEventListener("wheel", stopEvent, { capture: true, passive: false });
      document.body.addEventListener("mousedown", stopEvent, true);

      if (blockOverlay) blockOverlay.remove();
      blockOverlay = document.createElement("div");
      blockOverlay.textContent = "This site is blocked. (Double-click to open options)";
      blockOverlay.style.cssText =
        "position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;" +
        "display:flex!important;align-items:center!important;justify-content:center!important;" +
        "font-size:24px!important;background:rgba(0,0,0,.3)!important;color:#fff!important;" +
        "text-align:center!important;z-index:2147483647!important;pointer-events:auto!important;cursor:pointer!important;";

      blockOverlay.addEventListener("dblclick", function (e) {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
      }, true);

      document.body.appendChild(blockOverlay);
      muteAllMedia();
    }
  }

  function unblockPage() {
    blocked = false;
    document.documentElement.style.cssText = "";
    if (document.body) {
      document.body.removeEventListener("click", stopEvent, true);
      document.body.removeEventListener("keydown", stopEvent, true);
      document.body.removeEventListener("wheel", stopEvent, { capture: true });
      document.body.removeEventListener("mousedown", stopEvent, true);
    }
    if (blockOverlay) {
      blockOverlay.remove();
      blockOverlay = null;
    }
    if (mediaObserver) {
      mediaObserver.disconnect();
      mediaObserver = null;
    }
  }

  function stopEvent(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function muteAllMedia() {
    document.querySelectorAll("audio, video").forEach(function (m) {
      m.muted = true;
      m.pause();
      mutedElements.add(m);
    });
    if (mediaObserver) mediaObserver.disconnect();
    mediaObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mut) {
        mut.addedNodes.forEach(function (node) {
          if (node.nodeName === "AUDIO" || node.nodeName === "VIDEO") {
            node.muted = true;
            node.pause();
          }
          if (node.querySelectorAll) {
            node.querySelectorAll("audio, video").forEach(function (m) {
              m.muted = true;
              m.pause();
            });
          }
        });
      });
    });
    if (document.body) {
      mediaObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Init
  recheckDomain();

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.relaxModeUntil || changes.blockedDomains) {
      recheckDomain();
    }
  });

  window.addEventListener("load", recheckDomain);
  setInterval(recheckDomain, 1000);
})();
