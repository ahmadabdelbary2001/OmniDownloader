// OmniDownloader Browser Extension - Background Script
const APP_SERVER_URL = "http://localhost:7433/add";

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToOmni",
    title: "Send to OmniDownloader",
    contexts: ["link", "video", "page"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sendToOmni") {
    const url = info.linkUrl || info.srcUrl || info.pageUrl;
    sendToApp(url, tab.title);
  }
});

// Listener for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendToApp") {
    sendToApp(request.url, request.title)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ status: "error", message: err.message }));
    return true; // Keep channel open for async response
  }
});

async function sendToApp(url, title) {
  console.log("Sending URL to OmniDownloader:", url);
  try {
    const response = await fetch(APP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: url,
        title: title || url
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to send to app:", error);
    throw error;
  }
}
