"use strict";

const SCALE_STEP = 0.01;
const SCALE_MIN = 1.0;
const SCALE_MAX = 8.0;
const DEFAULT_SCALE = 1.0;

chrome.commands.onCommand.addListener(async function (command) {
  const result = await chrome.storage.local.get("ytResize_scale");
  const current = Number(result.ytResize_scale) || DEFAULT_SCALE;

  let next = current;
  if (command === "zoom_in") {
    next = Math.min(SCALE_MAX, +(current + SCALE_STEP).toFixed(2));
  } else if (command === "zoom_out") {
    next = Math.max(SCALE_MIN, +(current - SCALE_STEP).toFixed(2));
  }

  if (next !== current) {
    await chrome.storage.local.set({ ytResize_scale: next });
  }
});

chrome.runtime.onInstalled.addListener(function (details) {
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
