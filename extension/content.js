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
  // YouTube standard rounded button base classes
  btn.className = "yt-spec-button-shape-next yt-spec-button-shape-next--outline yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m";
  
  // Bespoke Premium Styles
  btn.style.marginLeft = "8px";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.gap = "8px";
  btn.style.background = "rgba(123, 104, 160, 0.15)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.color = "#E8E0F5";
  btn.style.border = "1px solid rgba(149, 128, 192, 0.3)";
  btn.style.padding = "0 18px";
  btn.style.borderRadius = "20px";
  btn.style.cursor = "pointer";
  btn.style.fontWeight = "800";
  btn.style.fontSize = "12px";
  btn.style.fontFamily = "inherit";
  btn.style.height = "36px";
  btn.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
  btn.style.textTransform = "uppercase";
  btn.style.letterSpacing = "0.05em";
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";

  const iconPlus = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>`;
  const iconCheck = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  btn.innerHTML = `
    <span style="display: flex; align-items: center; gap: 8px;">
      ${iconPlus}
      <span>Download via Omni</span>
    </span>
  `;

  btn.onmouseover = () => {
    btn.style.background = "linear-gradient(135deg, #7B68A0 0%, #5BBAB3 100%)";
    btn.style.borderColor = "transparent";
    btn.style.color = "white";
    btn.style.transform = "translateY(-1px) scale(1.02)";
    btn.style.boxShadow = "0 6px 16px rgba(123, 104, 160, 0.4)";
  };

  btn.onmouseout = () => {
    btn.style.background = "rgba(123, 104, 160, 0.15)";
    btn.style.borderColor = "rgba(149, 128, 192, 0.3)";
    btn.style.color = "#E8E0F5";
    btn.style.transform = "translateY(0) scale(1)";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
  };

  btn.onclick = () => {
    const videoTitle = document.querySelector("h1.ytd-video-primary-info-renderer, ytd-watch-metadata h1")?.textContent?.trim();
    
    // Disable to prevent spam
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";
    
    chrome.runtime.sendMessage({
      action: "sendToApp",
      url: window.location.href,
      title: videoTitle,
      instant: true // Mark as instant for bypass logic
    }, (response) => {
      if (response && response.status === "ok") {
        btn.style.background = "linear-gradient(135deg, #7ECAC4, #3AA9A1)";
        btn.innerHTML = `
          <span style="display: flex; align-items: center; gap: 8px;">
            ${iconCheck}
            <span>Added!</span>
          </span>
        `;
        setTimeout(() => {
          btn.style.pointerEvents = "auto";
          btn.style.opacity = "1";
          btn.style.background = "rgba(123, 104, 160, 0.15)";
          btn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px;">
              ${iconPlus}
              <span>Download via Omni</span>
            </span>
          `;
        }, 3000);
      } else {
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
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
