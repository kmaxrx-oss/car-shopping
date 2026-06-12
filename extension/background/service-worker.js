chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel || typeof chrome.sidePanel.setPanelBehavior !== "function") {
    return;
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
