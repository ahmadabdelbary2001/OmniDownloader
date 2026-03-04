// extension/popup.js — Popup UI controller for OmniDownloader Extension v2.4

// ── DOM refs ───────────────────────────────────────────────────────────────
const downloadBtn  = document.getElementById('downloadBtn');
const currentUrlEl = document.getElementById('currentUrl');

// ── Show current tab URL ───────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url) {
    const raw = tab.url.replace(/^https?:\/\//, '');
    currentUrlEl.textContent = raw.length > 54 ? raw.slice(0, 53) + '…' : raw;
  }
});

// ── Download button ────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;

    downloadBtn.disabled = true;

    chrome.runtime.sendMessage(
      { action: 'sendToApp', url: tab.url, title: tab.title },
      (response) => {
        downloadBtn.disabled = false;

        if (response?.status === 'ok') {
          downloadBtn.classList.add('success');
          downloadBtn.innerHTML = iconCheck + ' Sent to App!';
          setTimeout(() => {
            downloadBtn.classList.remove('success');
            downloadBtn.innerHTML = iconDownload + ' Send to OmniDownloader';
          }, 2500);
        } else {
          // Brief shake to indicate failure — app may not be running
          downloadBtn.style.animation = 'none';
          downloadBtn.offsetHeight; // reflow
          downloadBtn.innerHTML = iconDownload + ' App not running!';
          setTimeout(() => {
            downloadBtn.innerHTML = iconDownload + ' Send to OmniDownloader';
          }, 2000);
        }
      }
    );
  });
});

// ── Icon SVG helpers ───────────────────────────────────────────────────────
const iconDownload = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"
  stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>
</svg>`;

const iconCheck = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"
  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;
