"use strict";

var domainInput = document.getElementById("domainInput");
var addBtn = document.getElementById("addBtn");
var blockedListEl = document.getElementById("blockedList");
var exportBtn = document.getElementById("exportBtn");
var importBtn = document.getElementById("importBtn");
var importFile = document.getElementById("importFile");

function renderList(blocked) {
  blockedListEl.innerHTML = "";
  if (blocked.length === 0) {
    var p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No blocked domains yet.";
    blockedListEl.appendChild(p);
    return;
  }
  blocked.forEach(function (d, i) {
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.textContent = d;
    var btn = document.createElement("button");
    btn.textContent = "Unblock";
    btn.className = "btn btn-remove";
    btn.addEventListener("click", function () {
      blocked.splice(i, 1);
      saveBlocked(blocked);
    });
    li.appendChild(span);
    li.appendChild(btn);
    blockedListEl.appendChild(li);
  });
}

function loadBlocked() {
  chrome.storage.local.get("blockedDomains", function (res) {
    renderList(res.blockedDomains || []);
  });
}

function saveBlocked(blocked) {
  chrome.storage.local.set({ blockedDomains: blocked }, function () {
    renderList(blocked);
  });
}

addBtn.addEventListener("click", function () {
  var domain = domainInput.value.trim();
  if (!domain) return;
  chrome.storage.local.get("blockedDomains", function (res) {
    var list = res.blockedDomains || [];
    if (!list.includes(domain)) list.push(domain);
    saveBlocked(list);
    domainInput.value = "";
  });
});

domainInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addBtn.click();
});

exportBtn.addEventListener("click", function () {
  chrome.storage.local.get("blockedDomains", function (res) {
    var blob = new Blob([JSON.stringify(res.blockedDomains || [], null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "blocked-domains.json";
    a.click();
    URL.revokeObjectURL(url);
  });
});

importBtn.addEventListener("click", function () {
  importFile.click();
});

importFile.addEventListener("change", function (e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (ev) {
    try {
      var imported = JSON.parse(ev.target.result);
      if (Array.isArray(imported)) saveBlocked(imported);
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});

loadBlocked();
