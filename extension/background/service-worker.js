chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel || typeof chrome.sidePanel.setPanelBehavior !== "function") {
    return;
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

let facebookSearchTabId = null;
let savedCarTabId = null;

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

function isAllowedHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function openOrUpdateSavedCarTab(url) {
  if (!isAllowedHttpUrl(url)) {
    return {
      status: "error",
      message: "Saved car URL must start with http or https.",
    };
  }

  if (savedCarTabId !== null) {
    try {
      const tab = await chrome.tabs.update(savedCarTabId, { active: true, url });
      return {
        status: "ok",
        reused: true,
        tabId: tab.id,
      };
    } catch (error) {
      savedCarTabId = null;
    }
  }

  const tab = await chrome.tabs.create({ active: true, url });
  savedCarTabId = tab.id;
  return {
    status: "ok",
    reused: false,
    tabId: tab.id,
  };
}

async function getActiveTabMetadata() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !isAllowedHttpUrl(tab.url)) {
    return {
      status: "error",
      message: "Current tab cannot be saved as a car.",
    };
  }

  return {
    status: "ok",
    title: tab.title || tab.url,
    url: tab.url,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["OPEN_SEARCH_TAB", "OPEN_SAVED_CAR_TAB", "GET_ACTIVE_TAB_METADATA"].includes(message.type)) {
    return false;
  }

  if (message.type === "GET_ACTIVE_TAB_METADATA") {
    getActiveTabMetadata()
      .then(sendResponse)
      .catch(() => {
        sendResponse({
          status: "error",
          message: "Current tab cannot be saved as a car.",
        });
      });

    return true;
  }

  if (message.type === "OPEN_SAVED_CAR_TAB") {
    openOrUpdateSavedCarTab(message.url)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: "error",
          message: error.message || "Saved car tab could not be opened.",
        });
      });

    return true;
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
