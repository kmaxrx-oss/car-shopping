importScripts("../shared/marketplace-location.js");

const marketplaceLocation = globalThis.CarSearchHarnessMarketplaceLocation;
const ACTIVE_SEARCH_STORAGE_KEY = "carShopping.extension.activeSearch.v1";

const hasChromeSidePanel =
  chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function";

chrome.runtime.onInstalled.addListener(() => {
  if (!hasChromeSidePanel) {
    return;
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

if (!hasChromeSidePanel && chrome.action && typeof chrome.action.onClicked?.addListener === "function") {
  chrome.action.onClicked.addListener(() => {
    if (chrome.sidebarAction && typeof chrome.sidebarAction.open === "function") {
      chrome.sidebarAction.open().catch(() => {});
      return;
    }

    if (chrome.sidebarAction && typeof chrome.sidebarAction.toggle === "function") {
      chrome.sidebarAction.toggle().catch(() => {});
    }
  });
}

let facebookSearchTabId = null;
let craigslistSearchTabId = null;
let savedCarTabId = null;

function isMarketplaceSearchUrl(value) {
  if (!isAllowedFacebookMarketplaceUrl(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return /^\/marketplace\/[^/]+\/search\/?/i.test(url.pathname);
  } catch (error) {
    return false;
  }
}

async function readStoredActiveSearch() {
  const result = await chrome.storage.local.get(ACTIVE_SEARCH_STORAGE_KEY);
  const value = result[ACTIVE_SEARCH_STORAGE_KEY];
  return marketplaceLocation.normalizeActiveSearch(value);
}

async function persistActiveSearchLocation(locationId, locationLabel, zip) {
  const current = await readStoredActiveSearch();
  const next = marketplaceLocation.normalizeActiveSearch({
    zip: marketplaceLocation.normalizeZip(zip) || current.zip,
    locationId: marketplaceLocation.isValidLocationId(locationId) ? locationId : current.locationId,
    locationLabel: locationLabel || current.locationLabel,
  });

  await chrome.storage.local.set({ [ACTIVE_SEARCH_STORAGE_KEY]: next });
  return next;
}

async function readMarketplaceLocationLabel(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const buttons = Array.from(document.querySelectorAll("button"));
      let filterText = "";
      let headerText = "";

      for (const button of buttons) {
        const text = (button.textContent || "").trim();
        if (!text) {
          continue;
        }

        if (/^Location:/i.test(text) || /Within\s+\d+\s*mi/i.test(text)) {
          if (text.length > filterText.length) {
            filterText = text;
          }
          continue;
        }

        if (text.includes("·") && /\b\d+\s*mi\b/i.test(text) && !headerText) {
          headerText = text;
        }
      }

      return filterText || headerText;
    },
  });

  return (results && results[0] && results[0].result) || "";
}

async function getMarketplaceSearchContext(preferredTabId) {
  const candidateTabIds = [];
  if (typeof preferredTabId === "number") {
    candidateTabIds.push(preferredTabId);
  }
  if (facebookSearchTabId !== null) {
    candidateTabIds.push(facebookSearchTabId);
  }

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab && activeTab.id) {
    candidateTabIds.push(activeTab.id);
  }

  const seen = new Set();
  for (const tabId of candidateTabIds) {
    if (seen.has(tabId)) {
      continue;
    }
    seen.add(tabId);

    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (error) {
      continue;
    }

    if (!tab || !isMarketplaceSearchUrl(tab.url)) {
      continue;
    }

    const parsed = marketplaceLocation.parseLocationFromMarketplaceUrl(tab.url);
    if (!parsed.locationId) {
      continue;
    }

    const parsedFilters = marketplaceLocation.parseFiltersFromMarketplaceUrl(tab.url);
    let locationLabel = "";
    let radiusMiles = parsedFilters.radiusMiles;
    try {
      const buttonText = await readMarketplaceLocationLabel(tab.id);
      const buttonParsed = marketplaceLocation.parseLocationButtonText(buttonText);
      if (buttonParsed.locationLabel) {
        locationLabel = buttonParsed.locationLabel;
      }
      if (Number.isFinite(buttonParsed.radiusMiles)) {
        radiusMiles = buttonParsed.radiusMiles;
      }
    } catch (error) {
      locationLabel = "";
    }

    facebookSearchTabId = tab.id;
    return {
      status: "ok",
      tabId: tab.id,
      url: tab.url,
      locationId: parsed.locationId,
      locationLabel,
      radiusMiles,
    };
  }

  const stored = await readStoredActiveSearch();
  return {
    status: "stored",
    locationId: stored.locationId,
    locationLabel: stored.locationLabel,
    zip: stored.zip,
  };
}

async function syncMarketplaceLocationFromTab(preferredTabId, zip) {
  const context = await getMarketplaceSearchContext(preferredTabId);
  if (!context.locationId) {
    return {
      status: "error",
      message: "Open a Facebook Marketplace search page and set the location first.",
    };
  }

  const stored = await persistActiveSearchLocation(context.locationId, context.locationLabel, zip);
  return {
    status: "ok",
    locationId: stored.locationId,
    locationLabel: stored.locationLabel,
    zip: stored.zip,
    radiusMiles: context.radiusMiles,
    source: context.status,
  };
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || (changeInfo.status === "complete" ? tab.url : "");
  if (!url || !isMarketplaceSearchUrl(url)) {
    return;
  }

  facebookSearchTabId = tabId;
});

function isAllowedFacebookMarketplaceUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://www.facebook.com" && url.pathname.startsWith("/marketplace/");
  } catch (error) {
    return false;
  }
}

function isAllowedCraigslistSearchUrl(value) {
  try {
    const url = new URL(value);
    return /^[a-z0-9-]+\.craigslist\.org$/i.test(url.hostname) && /^\/search\//i.test(url.pathname);
  } catch (error) {
    return false;
  }
}

async function openOrUpdateTrackedSearchTab(url, options) {
  const validate = options && typeof options.validate === "function" ? options.validate : () => true;
  const getTabId = options && typeof options.getTabId === "function" ? options.getTabId : () => null;
  const setTabId = options && typeof options.setTabId === "function" ? options.setTabId : () => {};
  const invalidMessage =
    options && options.invalidMessage ? options.invalidMessage : "Search URL is not allowed.";

  if (!validate(url)) {
    return {
      status: "error",
      message: invalidMessage,
    };
  }

  const existingTabId = getTabId();
  if (existingTabId !== null) {
    try {
      const tab = await chrome.tabs.update(existingTabId, { active: true, url });
      setTabId(tab.id);
      return {
        status: "ok",
        reused: true,
        tabId: tab.id,
      };
    } catch (error) {
      setTabId(null);
    }
  }

  const tab = await chrome.tabs.create({ active: true, url });
  setTabId(tab.id);
  return {
    status: "ok",
    reused: false,
    tabId: tab.id,
  };
}

async function openOrUpdateFacebookSearchTab(url) {
  return openOrUpdateTrackedSearchTab(url, {
    validate: isAllowedFacebookMarketplaceUrl,
    getTabId: () => facebookSearchTabId,
    setTabId: (tabId) => {
      facebookSearchTabId = tabId;
    },
    invalidMessage: "Only Facebook Marketplace URLs are supported in this scaffold.",
  });
}

async function openOrUpdateCraigslistSearchTab(url) {
  return openOrUpdateTrackedSearchTab(url, {
    validate: isAllowedCraigslistSearchUrl,
    getTabId: () => craigslistSearchTabId,
    setTabId: (tabId) => {
      craigslistSearchTabId = tabId;
    },
    invalidMessage: "Only Craigslist search URLs are supported.",
  });
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

async function getTabDomData(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const getMeta = (selector) => {
        const el = document.querySelector(selector);
        return el ? (el.getAttribute("content") || "") : "";
      };
      return {
        bodyText: (document.body && document.body.innerText) || "",
        pageTitle: document.title || "",
        ogTitle: getMeta('meta[property="og:title"]') || getMeta('meta[name="og:title"]'),
        ogDescription: getMeta('meta[property="og:description"]') || getMeta('meta[name="og:description"]') || getMeta('meta[name="description"]'),
        ogImage: getMeta('meta[property="og:image"]') || getMeta('meta[name="og:image"]'),
      };
    },
  });
  return (results && results[0] && results[0].result) || null;
}

function waitForTabLoad(tabId, timeoutMs) {
  const limit = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId).then((tab) => {
      if (!tab) { reject(new Error("Tab not found.")); return; }
      if (tab.status === "complete") { resolve(); return; }

      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        reject(new Error("Tab load timed out."));
      }, limit);

      function onUpdated(id, changeInfo) {
        if (id === tabId && changeInfo.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
    }).catch(reject);
  });
}

async function extractListingFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !isAllowedHttpUrl(tab.url)) {
    return { status: "error", message: "Current tab cannot be saved as a car." };
  }

  let domData;
  try {
    domData = await getTabDomData(tab.id);
  } catch (error) {
    return { status: "error", message: "Could not read the listing page. Make sure you are on the listing tab." };
  }

  if (!domData) {
    return { status: "error", message: "Could not read the listing page." };
  }

  return {
    status: "ok",
    title: tab.title || domData.pageTitle || tab.url,
    url: tab.url,
    bodyText: domData.bodyText,
    pageTitle: domData.pageTitle,
    ogTitle: domData.ogTitle,
    ogDescription: domData.ogDescription,
    ogImage: domData.ogImage,
  };
}

async function openAndExtractListing(url, options) {
  const active = Boolean(options && options.active);
  const keepTab = Boolean(options && options.keepTab);

  let tab;
  if (keepTab && savedCarTabId !== null) {
    try {
      tab = await chrome.tabs.update(savedCarTabId, { active, url });
    } catch {
      savedCarTabId = null;
    }
  }
  if (!tab) {
    tab = await chrome.tabs.create({ active, url });
    if (keepTab) {
      savedCarTabId = tab.id;
    }
  }

  try {
    await waitForTabLoad(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const domData = await getTabDomData(tab.id);
    if (!domData) {
      return { status: "error", message: "Could not read the listing page.", tabId: tab.id };
    }

    const updatedTab = await chrome.tabs.get(tab.id).catch(() => tab);
    return {
      status: "ok",
      url,
      title: updatedTab.title || domData.pageTitle || url,
      bodyText: domData.bodyText,
      pageTitle: domData.pageTitle,
      ogTitle: domData.ogTitle,
      ogDescription: domData.ogDescription,
      ogImage: domData.ogImage,
      tabId: tab.id,
    };
  } catch (error) {
    return { status: "error", message: error.message || "Could not read the listing page.", tabId: tab.id };
  } finally {
    if (!keepTab) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["OPEN_SEARCH_TAB", "OPEN_SAVED_CAR_TAB", "GET_ACTIVE_TAB_METADATA", "EXTRACT_LISTING_FROM_TAB", "OPEN_AND_EXTRACT_LISTING", "GET_MARKETPLACE_SEARCH_CONTEXT", "SYNC_MARKETPLACE_LOCATION"].includes(message.type)) {
    return false;
  }

  if (message.type === "GET_MARKETPLACE_SEARCH_CONTEXT") {
    getMarketplaceSearchContext(message.tabId)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: "error",
          message: error.message || "Marketplace location could not be read.",
        });
      });
    return true;
  }

  if (message.type === "SYNC_MARKETPLACE_LOCATION") {
    syncMarketplaceLocationFromTab(message.tabId, message.zip)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: "error",
          message: error.message || "Marketplace location could not be synced.",
        });
      });
    return true;
  }

  if (message.type === "EXTRACT_LISTING_FROM_TAB") {
    extractListingFromActiveTab()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ status: "error", message: error.message || "Could not extract listing." });
      });
    return true;
  }

  if (message.type === "OPEN_AND_EXTRACT_LISTING") {
    if (!isAllowedHttpUrl(message.url)) {
      sendResponse({ status: "error", message: "A valid http or https URL is required." });
      return false;
    }
    openAndExtractListing(message.url, { active: !!message.active, keepTab: !!message.keepTab })
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ status: "error", message: error.message || "Could not extract listing." });
      });
    return true;
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

  if (message.platformId === "facebook") {
    openOrUpdateFacebookSearchTab(message.url)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: "error",
          message: error.message || "Facebook search tab could not be opened.",
        });
      });
    return true;
  }

  if (message.platformId === "craigslist") {
    openOrUpdateCraigslistSearchTab(message.url)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: "error",
          message: error.message || "Craigslist search tab could not be opened.",
        });
      });
    return true;
  }

  sendResponse({
    status: "not_implemented",
    message: "This platform does not open search tabs yet.",
  });
  return false;
});
