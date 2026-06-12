(function initializeSidepanel() {
  const platforms = globalThis.CarSearchHarnessPlatforms;
  const savedCars = globalThis.CarSearchHarnessSavedCars;
  const storage = globalThis.CarSearchHarnessStorage;
  const tabs = document.getElementById("platform-tabs");
  const resultBox = document.getElementById("platform-result");
  const savedCarsPlaceholder = document.getElementById("saved-cars-placeholder");

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

  function renderPlatformResult() {
    const platform = platforms.platformRegistry[activePlatformId];
    const result = platform.buildSearchUrl(activeFilters);
    resultBox.textContent = result.status === "ok"
      ? result.url
      : `${platform.label}: ${result.status}`;
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

  renderTabs();
  renderSavedCarsPlaceholder();
  renderPlatformResult();
})();
