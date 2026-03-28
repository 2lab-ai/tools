"use strict";

// ── VidFit: keyboard shortcuts ──

var SCALE_STEP = 0.01;
var SCALE_MIN = 1.0;
var SCALE_MAX = 8.0;
var DEFAULT_SCALE = 1.0;

chrome.commands.onCommand.addListener(async function (command) {
  var result = await chrome.storage.local.get("ytResize_scale");
  var current = Number(result.ytResize_scale) || DEFAULT_SCALE;
  var next = current;
  if (command === "zoom_in") {
    next = Math.min(SCALE_MAX, +(current + SCALE_STEP).toFixed(2));
  } else if (command === "zoom_out") {
    next = Math.max(SCALE_MIN, +(current - SCALE_STEP).toFixed(2));
  }
  if (next !== current) {
    await chrome.storage.local.set({ ytResize_scale: next });
  }
});

// ── RelaxBlock: timers & messages ──

var relaxTimer = null;
var countdownInterval = null;

function initStorageIfEmpty() {
  chrome.storage.local.get(["blockedDomains", "relaxModeUntil"], function (res) {
    if (!Array.isArray(res.blockedDomains)) chrome.storage.local.set({ blockedDomains: [] });
    if (!res.relaxModeUntil) chrome.storage.local.set({ relaxModeUntil: 0 });
  });
}

function createContextMenu() {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: "relaxMode",
      title: "Relax Mode",
      contexts: ["all"],
    });
  });
}

function updateContextMenu() {
  chrome.storage.local.get("relaxModeUntil", function (res) {
    var now = Date.now();
    var until = res.relaxModeUntil || 0;
    var remain = Math.max(0, until - now);
    if (remain > 0) {
      var seconds = Math.floor(remain / 1000);
      var mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      var ss = String(seconds % 60).padStart(2, "0");
      chrome.contextMenus.update("relaxMode", { title: "Relax Mode (" + mm + ":" + ss + ")" });
    } else {
      chrome.contextMenus.update("relaxMode", { title: "Relax Mode" });
    }
  });
}

function startCountdown(durationSec) {
  if (countdownInterval) clearInterval(countdownInterval);
  var remainSec = durationSec;
  var blink = false;
  var canvas = new OffscreenCanvas(128, 128);
  var ctx = canvas.getContext("2d");

  countdownInterval = setInterval(function () {
    remainSec--;
    blink = !blink;
    var remainMin = Math.floor(remainSec / 60);
    if (remainMin < 0) {
      chrome.action.setIcon({ path: "icons/icon128.svg" });
      clearInterval(countdownInterval);
      return;
    }
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = blink ? "#333" : "#f00";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = blink ? "#fee" : "#0fc";
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(remainMin), 64, 64);
    chrome.action.setIcon({ imageData: { 128: ctx.getImageData(0, 0, 128, 128) } });
  }, 1000);
}

// ── Message handler ──

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === "START_RELAX") {
    var now = Date.now();
    var dur = msg.duration || 30;
    var until = now + dur * 60000;
    chrome.storage.local.set({ relaxModeUntil: until });
    if (relaxTimer) clearTimeout(relaxTimer);
    relaxTimer = setTimeout(function () {
      chrome.storage.local.set({ relaxModeUntil: 0 });
    }, dur * 60000);
    startCountdown(dur * 60);
    sendResponse({ success: true });
  } else if (msg.type === "STOP_RELAX") {
    chrome.storage.local.set({ relaxModeUntil: 0 });
    if (relaxTimer) clearTimeout(relaxTimer);
    startCountdown(0);
    sendResponse({ success: true });
  } else if (msg.type === "GET_BLOCKED") {
    chrome.storage.local.get("blockedDomains", function (res) {
      sendResponse({ blocked: res.blockedDomains || [] });
    });
    return true;
  } else if (msg.type === "SET_BLOCKED") {
    chrome.storage.local.set({ blockedDomains: msg.blockedList }, function () {
      sendResponse({ success: true });
    });
    return true;
  } else if (msg.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
  return true;
});

// ── Install / startup ──

chrome.runtime.onInstalled.addListener(function (details) {
  initStorageIfEmpty();
  createContextMenu();
  if (details.reason === "install") {
    chrome.storage.local.set({
      ytResize_behavior: "zoom",
      ytResize_scale: DEFAULT_SCALE,
      ytResize_fullscreenOnly: true,
      ytResize_offsetX: 0,
      ytResize_offsetY: 0,
    });
  }
});

chrome.runtime.onStartup.addListener(function () {
  initStorageIfEmpty();
  createContextMenu();
});

// Update context menu every second
setInterval(updateContextMenu, 1000);
