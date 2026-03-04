// extension/background.js — Service Worker for OmniDownloader Extension v2.4
import OMNI_CONFIG from './config.js';

// ── Context menu setup ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'sendToOmni',
    title:    'Send to OmniDownloader',
    contexts: ['link', 'video', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sendToOmni') {
    const url = info.linkUrl || info.srcUrl || info.pageUrl;
    sendToApp(url, tab?.title);
  }
});

// ── Message relay (popup / content → background → app) ────────────────────
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'sendToApp') {
    sendToApp(request.url, request.title)
      .then(result  => sendResponse(result))
      .catch(err    => sendResponse({ status: 'error', message: err.message }));
    return true; // keep channel open for async response
  }
});

// ── Health check (silent — keeps server warm, no badge/UI) ────────────────
async function checkHealth() {
  try {
    await fetch(OMNI_CONFIG.endpoints.status, { method: 'GET' });
  } catch {
    // silently ignore — app may not be running yet
  }
}

checkHealth();
chrome.alarms.create('omni-health-check', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'omni-health-check') checkHealth();
});

// ── Send URL to app ────────────────────────────────────────────────────────
async function sendToApp(url, title) {
  const res = await fetch(OMNI_CONFIG.endpoints.add, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, title: title || url }),
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}
