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
    
    // Load saved options to use for context menu send
    chrome.storage.sync.get([OMNI_CONFIG.optionsKey], (data) => {
      const options = data[OMNI_CONFIG.optionsKey] || OMNI_CONFIG.defaults;
      sendToApp(url, tab?.title, options);
    });
  }
});

// ── Message relay (popup / content → background → app) ────────────────────
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'sendToApp') {
    const options = {
      quality: request.quality,
      subtitle: request.subtitle_lang || request.subtitle,
      download_path: request.download_path,
      thumbnail: request.thumbnail,
      estimated_size: request.estimated_size,
      metadata: request.metadata,
      instant: request.instant,
      selected_entries: request.selected_entries || undefined,  // 🎯 Playlist multi-add
      is_playlist: request.is_playlist || false,
    };
    
    sendToApp(request.url, request.title, options)
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
async function sendToApp(url, title, options = {}) {
  const payload = {
    url,
    title: title || url,
    quality: options.quality,
    subtitle_lang: options.subtitle,
    download_path: options.download_path,
    thumbnail: options.thumbnail,
    estimated_size: options.estimated_size,
    metadata: options.metadata,
    instant: options.instant,
    selected_entries: options.selected_entries || undefined, // 🎯 Playlist multi-add
    is_playlist: options.is_playlist || false,
  };

  const res = await fetch(OMNI_CONFIG.endpoints.add, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}
