chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel || typeof chrome.sidePanel.setPanelBehavior !== "function") {
    return;
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

let facebookSearchTabId = null;

function isAllowedFacebookMarketplaceUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://www.facebook.com" && url.pathname.startsWith("/marketplace/");
  } catch (error) {
    return false;
  }
}

async function openOrUpdateFacebookSearchTab(url) {
  if (!isAllowedFacebookMarketplaceUrl(url)) {
    return {
      status: "error",
      message: "Only Facebook Marketplace URLs are supported in this scaffold.",
    };
  }

  if (facebookSearchTabId !== null) {
    try {
      const tab = await chrome.tabs.update(facebookSearchTabId, { active: true, url });
      return {
        status: "ok",
        reused: true,
        tabId: tab.id,
      };
    } catch (error) {
      facebookSearchTabId = null;
    }
  }

  const tab = await chrome.tabs.create({ active: true, url });
  facebookSearchTabId = tab.id;
  return {
    status: "ok",
    reused: false,
    tabId: tab.id,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "OPEN_SEARCH_TAB") {
    return false;
  }

  if (message.platformId !== "facebook") {
    sendResponse({
      status: "not_implemented",
      message: "Only Facebook search opens tabs in this scaffold.",
    });
    return false;
  }

  openOrUpdateFacebookSearchTab(message.url)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        status: "error",
        message: error.message || "Facebook search tab could not be opened.",
      });
    });

  return true;
});
