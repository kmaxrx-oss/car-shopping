(function initializeSidepanel() {
  const platforms = globalThis.CarSearchHarnessPlatforms;
  const savedCars = globalThis.CarSearchHarnessSavedCars;
  const storage = globalThis.CarSearchHarnessStorage;
  const tabs = document.getElementById("platform-tabs");
  const resultBox = document.getElementById("platform-result");
  const savedCarsPlaceholder = document.getElementById("saved-cars-placeholder");
  const searchButton = document.getElementById("search-button");
  const searchStatus = document.getElementById("search-status");
  const filterFields = {
    query: document.getElementById("search-query"),
    minPrice: document.getElementById("min-price"),
    maxPrice: document.getElementById("max-price"),
    minYear: document.getElementById("min-year"),
    radius: document.getElementById("radius"),
    daysListed: document.getElementById("days-listed"),
    exact: document.getElementById("exact-match"),
    zip: document.getElementById("active-zip"),
  };

  const activeFilters = {
    query: "hybrid",
    minPrice: 1500,
    maxPrice: 4000,
    minYear: 2013,
    radius: 100,
    daysListed: 7,
    exact: true,
    zip: "",
  };

  let activePlatformId = platforms.defaultPlatformId;
  let currentPlatformResult = null;

  function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function syncFiltersFromControls() {
    activeFilters.query = filterFields.query.value.trim();
    activeFilters.minPrice = positiveNumber(filterFields.minPrice.value, 1500);
    activeFilters.maxPrice = positiveNumber(filterFields.maxPrice.value, 4000);
    activeFilters.minYear = positiveNumber(filterFields.minYear.value, 2013);
    activeFilters.radius = positiveNumber(filterFields.radius.value, 100);
    activeFilters.daysListed = positiveNumber(filterFields.daysListed.value, 7);
    activeFilters.exact = filterFields.exact.checked;
    activeFilters.zip = filterFields.zip.value.trim();
  }

  function renderPlatformResult() {
    syncFiltersFromControls();
    const platform = platforms.platformRegistry[activePlatformId];
    const result = platform.buildSearchUrl(activeFilters);
    currentPlatformResult = result;
    resultBox.textContent = result.status === "ok"
      ? result.url
      : `${platform.label}: ${result.status}`;
    searchButton.disabled = result.status !== "ok" || activePlatformId !== platforms.defaultPlatformId;
    searchButton.textContent = activePlatformId === platforms.defaultPlatformId
      ? "Search Facebook"
      : `${platform.label} not implemented`;
  }

  function renderTabs() {
    tabs.innerHTML = Object.entries(platforms.platformRegistry)
      .map(([platformId, platform]) => {
        const selected = platformId === activePlatformId ? "true" : "false";
        return `<button class="platform-tab" type="button" role="tab" aria-selected="${selected}" data-platform-id="${platformId}">${platform.label}</button>`;
      })
      .join("");
  }

  function renderSavedCarsPlaceholder() {
    savedCarsPlaceholder.textContent =
      `Preserve ${savedCars.savedCarFields.length} saved-car fields from ${storage.storageKeys.savedCars}.`;
  }

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform-id]");
    if (!button) {
      return;
    }

    activePlatformId = button.dataset.platformId;
    renderTabs();
    renderPlatformResult();
  });

  Object.values(filterFields).forEach((field) => {
    field.addEventListener("input", renderPlatformResult);
    field.addEventListener("change", renderPlatformResult);
  });

  searchButton.addEventListener("click", async () => {
    renderPlatformResult();
    if (activePlatformId !== platforms.defaultPlatformId || !currentPlatformResult || currentPlatformResult.status !== "ok") {
      searchStatus.textContent = "Only Facebook search is active in this scaffold.";
      return;
    }

    searchButton.disabled = true;
    searchStatus.textContent = "Opening Facebook Marketplace...";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "OPEN_SEARCH_TAB",
        platformId: activePlatformId,
        url: currentPlatformResult.url,
      });

      if (!response || response.status !== "ok") {
        throw new Error(response?.message || "Search tab could not be opened.");
      }

      searchStatus.textContent = response.reused ? "Updated existing Facebook search tab." : "Opened Facebook search tab.";
    } catch (error) {
      searchStatus.textContent = error.message || "Search tab could not be opened.";
    } finally {
      renderPlatformResult();
    }
  });

  renderTabs();
  renderSavedCarsPlaceholder();
  renderPlatformResult();
})();
