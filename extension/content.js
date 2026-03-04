// OmniDownloader Browser Extension - Content Script (YouTube)

function injectDownloadButton() {
  const targetSelector = "#top-level-buttons-computed, #menu-container #top-level-buttons";
  const existingButton = document.querySelector("#omni-download-btn");
  
  if (existingButton) return;

  const target = document.querySelector(targetSelector);
  if (!target) {
    // Retry after delay if element not found yet
    setTimeout(injectDownloadButton, 2000);
    return;
  }

  const btn = document.createElement("button");
  btn.id = "omni-download-btn";
  btn.className = "yt-spec-button-shape-next yt-spec-button-shape-next--outline yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m";
  btn.style.marginLeft = "8px";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.gap = "6px";
  btn.style.backgroundColor = "#7B68A0"; // Lavender Tech Primary
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.padding = "0 16px";
  btn.style.borderRadius = "18px";
  btn.style.cursor = "pointer";
  btn.style.fontWeight = "bold";
  btn.style.height = "36px";

  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-11v4h3l-4 4-4-4h3V9h2z"/>
    </svg>
    <span>Download via Omni</span>
  `;

  btn.onclick = () => {
    const videoTitle = document.querySelector("h1.ytd-video-primary-info-renderer, ytd-watch-metadata h1")?.textContent?.trim();
    chrome.runtime.sendMessage({
      action: "sendToApp",
      url: window.location.href,
      title: videoTitle
    }, (response) => {
      if (response && response.status === "ok") {
        btn.style.backgroundColor = "#7ECAC4"; // Teal Mint Success
        btn.querySelector("span").textContent = "Added!";
        setTimeout(() => {
          btn.style.backgroundColor = "#7B68A0";
          btn.querySelector("span").textContent = "Download via Omni";
        }, 3000);
      } else {
        alert("Make sure OmniDownloader is running!");
      }
    });
  };

  target.appendChild(btn);
}

// Initial injection
injectDownloadButton();

// Listen for navigation changes (YouTube is a SPA)
let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(injectDownloadButton, 1000);
  }
}, 2000);
