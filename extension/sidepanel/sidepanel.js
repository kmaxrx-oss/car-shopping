(function initializeSidepanel() {
  const platforms = globalThis.CarSearchHarnessPlatforms;
  const savedCars = globalThis.CarSearchHarnessSavedCars;
  const storage = globalThis.CarSearchHarnessStorage;
  const tabs = document.getElementById("platform-tabs");
  const resultBox = document.getElementById("platform-result");
  const searchButton = document.getElementById("search-button");
  const searchStatus = document.getElementById("search-status");
  const savedCarForm = document.getElementById("saved-car-form");
  const savedCarList = document.getElementById("saved-cars-list");
  const savedCarStatusLine = document.getElementById("saved-car-status-line");
  const cancelEditButton = document.getElementById("cancel-edit-button");
  const saveCurrentTabButton = document.getElementById("save-current-tab-button");
  const savedCarFields = {
    id: document.getElementById("saved-car-id"),
    title: document.getElementById("saved-car-title"),
    url: document.getElementById("saved-car-url"),
    price: document.getElementById("saved-car-price"),
    location: document.getElementById("saved-car-location"),
    sellerName: document.getElementById("saved-car-seller-name"),
    mileage: document.getElementById("saved-car-mileage"),
    status: document.getElementById("saved-car-status"),
    notes: document.getElementById("saved-car-notes"),
  };
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
  let savedCarRecords = [];

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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setSavedCarStatus(message) {
    savedCarStatusLine.textContent = message;
  }

  function formatTimestamp(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function compactUrl(url) {
    const normalized = savedCars.normalizeSavedCarUrl(url);
    if (!normalized) {
      return "";
    }

    const compact = normalized.replace(/^https?:\/\//i, "");
    return compact.length > 58 ? `${compact.slice(0, 55)}...` : compact;
  }

  function formatMileage(mileage) {
    const trimmed = String(mileage || "").trim();
    if (!trimmed) {
      return "";
    }

    return /(mile| mi\b)/i.test(trimmed) ? trimmed : `Driven ${trimmed} miles`;
  }

  function getMissingCriticalFields(car) {
    const missing = [];
    if (!car.price) {
      missing.push("price");
    }
    if (!car.location) {
      missing.push("town");
    }
    if (!car.sellerName) {
      missing.push("seller");
    }
    if (!car.mileage) {
      missing.push("mileage");
    }
    return missing;
  }

  function getSavedCarSourceType(car) {
    const sourceText = String(car.sourceText || "").trim();
    if (!sourceText) {
      return "";
    }

    if (sourceText.startsWith("Saved from active tab:")) {
      return "active_tab";
    }

    const sourceWithoutShortcutWrapper = sourceText
      .replace(/^\s*\[InternetShortcut\]\s*$/gim, "")
      .replace(/^\s*URL=/gim, "")
      .trim();

    if (
      sourceWithoutShortcutWrapper &&
      savedCars.normalizeSavedCarUrl(sourceWithoutShortcutWrapper) === savedCars.normalizeSavedCarUrl(car.url)
    ) {
      return "url_only";
    }

    return "capture";
  }

  function getIncompleteSavedCarNote(car) {
    const missingFields = getMissingCriticalFields(car);
    if (!missingFields.length) {
      return "";
    }

    const sourceType = getSavedCarSourceType(car);
    if (sourceType === "active_tab" || sourceType === "url_only") {
      return `Saved URL only - missing ${missingFields.join(", ")}`;
    }

    if (!car.price && !car.location && !car.sellerName && !car.mileage) {
      return `Saved listing is incomplete - missing ${missingFields.join(", ")}`;
    }

    return "";
  }

  function getSavedCarSourceNote(car) {
    const sourceType = getSavedCarSourceType(car);
    if (sourceType === "active_tab") {
      return "Source: Saved from active tab";
    }

    if (sourceType === "url_only") {
      return `Source: ${compactUrl(car.url) || "Listing URL only"}`;
    }

    if (car.sourceText && /facebook\.com\/marketplace/i.test(car.sourceText)) {
      return "Source: Facebook Marketplace capture";
    }

    if (car.sourceText) {
      return "Source: Listing capture text saved";
    }

    return "";
  }

  function resetSavedCarForm() {
    savedCarFields.id.value = "";
    savedCarFields.title.value = "";
    savedCarFields.url.value = "";
    savedCarFields.price.value = "";
    savedCarFields.location.value = "";
    savedCarFields.sellerName.value = "";
    savedCarFields.mileage.value = "";
    savedCarFields.status.value = "Interested";
    savedCarFields.notes.value = "";
    cancelEditButton.hidden = true;
    document.getElementById("save-car-button").textContent = "Save car";
  }

  function populateStatusOptions() {
    savedCarFields.status.innerHTML = savedCars.savedCarStatuses
      .map((status) => `<option>${escapeHtml(status)}</option>`)
      .join("");
  }

  function getSavedCarFormDraft() {
    return {
      id: savedCarFields.id.value,
      title: savedCarFields.title.value,
      url: savedCarFields.url.value,
      price: savedCarFields.price.value,
      location: savedCarFields.location.value,
      sellerName: savedCarFields.sellerName.value,
      mileage: savedCarFields.mileage.value,
      status: savedCarFields.status.value,
      notes: savedCarFields.notes.value,
    };
  }

  function renderSavedCars() {
    if (!savedCarRecords.length) {
      savedCarList.innerHTML = '<p class="saved-cars-empty">No saved cars yet. Add a listing URL to start the extension shortlist.</p>';
      return;
    }

    savedCarList.innerHTML = savedCarRecords
      .map((car) => {
        const meta = formatTimestamp(car.updatedAt);
        const incompleteNote = getIncompleteSavedCarNote(car);
        const sourceNote = getSavedCarSourceNote(car);
        const extraFacts = [car.transmission, car.fuelType, car.statusHint]
          .filter(Boolean)
          .map((fact) => `<div class="saved-car-card__detail saved-car-card__detail--muted">${escapeHtml(fact)}</div>`)
          .join("");

        return `
          <article class="saved-car-card" data-saved-car-id="${escapeHtml(car.id)}">
            <div class="saved-car-card__title">${escapeHtml(car.title)}</div>
            ${car.price ? `<div class="saved-car-card__detail">${escapeHtml(car.price)}</div>` : ""}
            ${car.location ? `<div class="saved-car-card__detail">${escapeHtml(car.location)}</div>` : ""}
            ${car.sellerName ? `<div class="saved-car-card__detail">${escapeHtml(car.sellerName)}</div>` : ""}
            <div class="saved-car-card__status">${escapeHtml(car.status)}</div>
            ${car.mileage ? `<div class="saved-car-card__detail">${escapeHtml(formatMileage(car.mileage))}</div>` : ""}
            ${extraFacts}
            ${incompleteNote ? `<div class="saved-car-card__hint">${escapeHtml(incompleteNote)}</div>` : ""}
            ${sourceNote ? `<div class="saved-car-card__source">${escapeHtml(sourceNote)}</div>` : ""}
            ${car.notes ? `<div class="saved-car-card__notes">${escapeHtml(car.notes)}</div>` : ""}
            ${meta ? `<div class="saved-car-card__meta">${escapeHtml(`Updated ${meta}`)}</div>` : ""}
            <div class="saved-car-card__actions">
              <button type="button" data-action="open" data-id="${escapeHtml(car.id)}">Open</button>
              <button type="button" data-action="edit" data-id="${escapeHtml(car.id)}">Edit</button>
              <button class="is-danger" type="button" data-action="delete" data-id="${escapeHtml(car.id)}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function persistSavedCars(message) {
    await storage.setSavedCars(savedCarRecords);
    renderSavedCars();
    setSavedCarStatus(message);
  }

  async function loadSavedCars() {
    const storedCars = await storage.getSavedCars();
    savedCarRecords = storedCars.map(savedCars.normalizeStoredSavedCar).filter(Boolean);
    renderSavedCars();
  }

  function findSavedCarByUrl(url) {
    const normalizedUrl = savedCars.normalizeSavedCarUrl(url);
    if (!normalizedUrl) {
      return null;
    }

    return savedCarRecords.find((car) => savedCars.normalizeSavedCarUrl(car.url) === normalizedUrl) || null;
  }

  function editSavedCar(id) {
    const car = savedCarRecords.find((savedCar) => savedCar.id === id);
    if (!car) {
      return;
    }

    savedCarFields.id.value = car.id;
    savedCarFields.title.value = car.title;
    savedCarFields.url.value = car.url;
    savedCarFields.price.value = car.price;
    savedCarFields.location.value = car.location;
    savedCarFields.sellerName.value = car.sellerName;
    savedCarFields.mileage.value = car.mileage;
    savedCarFields.status.value = car.status;
    savedCarFields.notes.value = car.notes;
    cancelEditButton.hidden = false;
    document.getElementById("save-car-button").textContent = "Update car";
    setSavedCarStatus(`Editing ${car.title}.`);
  }

  async function deleteSavedCar(id) {
    const car = savedCarRecords.find((savedCar) => savedCar.id === id);
    savedCarRecords = savedCarRecords.filter((savedCar) => savedCar.id !== id);
    await persistSavedCars(car ? `Deleted ${car.title}.` : "Saved car deleted.");
    resetSavedCarForm();
  }

  async function openSavedCar(id) {
    const car = savedCarRecords.find((savedCar) => savedCar.id === id);
    if (!car) {
      setSavedCarStatus("Saved car was not found.");
      return;
    }

    if (!savedCars.isHttpUrl(car.url)) {
      setSavedCarStatus("Saved car URL must start with http or https.");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "OPEN_SAVED_CAR_TAB",
      url: car.url,
    });

    setSavedCarStatus(response && response.status === "ok" ? `Opened ${car.title}.` : response?.message || "Saved car could not be opened.");
  }

  async function saveCurrentTab() {
    saveCurrentTabButton.disabled = true;
    setSavedCarStatus("Reading current tab...");

    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_METADATA" });
      if (!response || response.status !== "ok" || !savedCars.isHttpUrl(response.url)) {
        setSavedCarStatus("Current tab cannot be saved as a car.");
        return;
      }

      if (findSavedCarByUrl(response.url)) {
        setSavedCarStatus("Already saved.");
        return;
      }

      const result = savedCars.createSavedCar({
        title: response.title || response.url,
        url: response.url,
        status: "Interested",
        sourceText: `Saved from active tab: ${response.url}`,
      });

      if (result.error) {
        setSavedCarStatus(result.error);
        return;
      }

      savedCarRecords = [result.value, ...savedCarRecords];
      await persistSavedCars(`Saved current tab: ${result.value.title}.`);
      resetSavedCarForm();
    } catch (error) {
      setSavedCarStatus(error.message || "Current tab cannot be saved as a car.");
    } finally {
      saveCurrentTabButton.disabled = false;
    }
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

  savedCarForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const draft = getSavedCarFormDraft();
    const existingCar = savedCarRecords.find((car) => car.id === draft.id);
    const result = existingCar
      ? savedCars.updateSavedCar(existingCar, draft)
      : savedCars.createSavedCar(draft);

    if (result.error) {
      setSavedCarStatus(result.error);
      return;
    }

    if (existingCar) {
      savedCarRecords = savedCarRecords.map((car) => (car.id === existingCar.id ? result.value : car));
      await persistSavedCars(`Updated ${result.value.title}.`);
    } else {
      savedCarRecords = [result.value, ...savedCarRecords];
      await persistSavedCars(`Saved ${result.value.title}.`);
    }

    resetSavedCarForm();
  });

  cancelEditButton.addEventListener("click", () => {
    resetSavedCarForm();
    setSavedCarStatus("");
  });

  saveCurrentTabButton.addEventListener("click", saveCurrentTab);

  savedCarList.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const id = actionButton.dataset.id;
    if (actionButton.dataset.action === "open") {
      await openSavedCar(id);
    }

    if (actionButton.dataset.action === "edit") {
      editSavedCar(id);
    }

    if (actionButton.dataset.action === "delete") {
      await deleteSavedCar(id);
    }
  });

  renderTabs();
  populateStatusOptions();
  resetSavedCarForm();
  renderPlatformResult();
  loadSavedCars().catch((error) => {
    setSavedCarStatus(error.message || "Saved cars could not be loaded.");
    renderSavedCars();
  });
})();
