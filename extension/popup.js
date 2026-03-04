// OmniDownloader Browser Extension - Popup Script v2.4

const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const downloadBtn = document.getElementById('downloadBtn');
const currentUrlEl = document.getElementById('currentUrl');

// Show the current tab's URL in the card
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab?.url) {
    currentUrlEl.textContent = tab.url.replace(/^https?:\/\//, '').slice(0, 52) + (tab.url.length > 56 ? '…' : '');
  }
});

async function checkStatus() {
  try {
    const res = await fetch('http://localhost:7433/status', { method: 'GET' }).catch(() => null);
    if (res && res.ok) {
      statusDot.className  = 'dot online';
      statusText.className = 'online';
      statusText.textContent = 'Online';
      downloadBtn.disabled = false;
    } else {
      throw new Error('offline');
    }
  } catch {
    statusDot.className  = 'dot offline';
    statusText.className = 'offline';
    statusText.textContent = 'Offline';
  }
}

downloadBtn.onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    chrome.runtime.sendMessage(
      { action: 'sendToApp', url: tab.url, title: tab.title },
      (response) => {
        if (response && response.status === 'ok') {
          downloadBtn.classList.add('success');
          downloadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Sent to App!
          `;
          setTimeout(() => {
            downloadBtn.classList.remove('success');
            downloadBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>
              </svg>
              Send to OmniDownloader
            `;
          }, 2500);
        } else {
          statusDot.className  = 'dot offline';
          statusText.className = 'offline';
          statusText.textContent = 'Not Running';
        }
      }
    );
  });
};

// Run on open and poll every 5s
checkStatus();
setInterval(checkStatus, 5000);
