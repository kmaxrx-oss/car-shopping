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
  const savedCarFields = {
    id: document.getElementById("saved-car-id"),
    title: document.getElementById("saved-car-title"),
    url: document.getElementById("saved-car-url"),
    price: document.getElementById("saved-car-price"),
    location: document.getElementById("saved-car-location"),
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

  function resetSavedCarForm() {
    savedCarFields.id.value = "";
    savedCarFields.title.value = "";
    savedCarFields.url.value = "";
    savedCarFields.price.value = "";
    savedCarFields.location.value = "";
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
        const facts = [car.price, car.location, car.sellerName, car.mileage, car.transmission, car.fuelType, car.statusHint]
          .filter(Boolean)
          .map((fact) => escapeHtml(fact))
          .join(" | ");
        const meta = car.updatedAt ? `Updated ${new Date(car.updatedAt).toLocaleString()}` : "";

        return `
          <article class="saved-car-card" data-saved-car-id="${escapeHtml(car.id)}">
            <div class="saved-car-card__title">${escapeHtml(car.title)}</div>
            ${facts ? `<div class="saved-car-card__facts">${facts}</div>` : ""}
            <div class="saved-car-card__facts">${escapeHtml(car.status)}</div>
            ${car.notes ? `<div class="saved-car-card__notes">${escapeHtml(car.notes)}</div>` : ""}
            ${meta ? `<div class="saved-car-card__meta">${escapeHtml(meta)}</div>` : ""}
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
