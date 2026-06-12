(function initializeSidepanel() {
  const platforms = globalThis.CarSearchHarnessPlatforms;
  const savedCars = globalThis.CarSearchHarnessSavedCars;
  const captureParser = globalThis.CarSearchHarnessCaptureParser;
  const listingReader = globalThis.CarSearchHarnessListingReaderClient;
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
  const listingCaptureBox = document.getElementById("listing-capture-box");
  const listingCaptureTextarea = document.getElementById("listing-capture");
  const useCaptureButton = document.getElementById("use-capture-button");
  const clearCaptureButton = document.getElementById("clear-capture-button");
  const captureStatusLine = document.getElementById("capture-status-line");
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

  function setCaptureStatus(message) {
    captureStatusLine.textContent = message;
  }

  function getMissingCaptureFields(capture) {
    return ["price", "location", "sellerName", "mileage"].filter((field) => !capture[field]);
  }

  function shouldTryReader(capture) {
    return Boolean(
      listingReader &&
        capture &&
        capture.url &&
        listingReader.isFacebookMarketplaceListingUrl(capture.url) &&
        getMissingCaptureFields(capture).length
    );
  }

  function mergeCaptureWithReader(capture, readerCapture, fallbackTitle) {
    return {
      title: capture.title || readerCapture.title || fallbackTitle || capture.url,
      url: capture.url,
      price: capture.price || readerCapture.price || "",
      location: capture.location || readerCapture.location || "",
      sellerName: capture.sellerName || readerCapture.sellerName || "",
      mileage: capture.mileage || readerCapture.mileage || "",
      transmission: capture.transmission || readerCapture.transmission || "",
      fuelType: capture.fuelType || readerCapture.fuelType || "",
      description: capture.description || readerCapture.description || "",
      imageUrl: capture.imageUrl || readerCapture.imageUrl || "",
      readStatus: readerCapture.readStatus || capture.readStatus || "",
      statusHint: capture.statusHint || readerCapture.statusHint || "",
      sourceText: capture.sourceText,
    };
  }

  function createReaderSourceText(sourceText, readStatus) {
    const trimmed = String(sourceText || "").trim();
    if (!readStatus || readStatus === "ok") {
      return trimmed;
    }

    const statusLine = `Reader status: ${readStatus}`;
    return trimmed ? `${trimmed}\n${statusLine}` : statusLine;
  }

  async function enrichCaptureWithReader(capture, options = {}) {
    const fallbackTitle = options.fallbackTitle || "";
    const statusTarget = options.statusTarget || "capture";

    if (!shouldTryReader(capture)) {
      return {
        capture: {
          ...capture,
          title: capture.title || fallbackTitle || capture.url,
        },
        attempted: false,
        enriched: false,
        message: "",
      };
    }

    if (statusTarget === "saved") {
      setSavedCarStatus("Reading listing details...");
    } else {
      setCaptureStatus("Reading listing details...");
    }

    const response = await listingReader.readListingFromLocalReader(capture.url);
    const readerCapture = listingReader.normalizeReaderResponse(
      response,
      capture.url,
      createReaderSourceText(capture.sourceText, response.readStatus)
    );

    if (response.readStatus === "ok" || listingReader.hasReaderCaptureFields(readerCapture)) {
      return {
        capture: mergeCaptureWithReader(capture, readerCapture, fallbackTitle),
        attempted: true,
        enriched: true,
        readStatus: response.readStatus,
        message: "",
      };
    }

    return {
      capture: {
        ...capture,
        title: capture.title || fallbackTitle || capture.url,
        readStatus: response.readStatus || capture.readStatus || "",
        sourceText: createReaderSourceText(capture.sourceText, response.readStatus),
      },
      attempted: true,
      enriched: false,
      readStatus: response.readStatus,
      message: listingReader.getReaderFailureMessage(response.readStatus),
    };
  }

  async function saveCaptureAsCar(capture, options = {}) {
    const isUrlOnly = Boolean(options.isUrlOnly);
    const statusTarget = options.statusTarget || "capture";

    if (findSavedCarByUrl(capture.url)) {
      const duplicateMessage = "Already saved.";
      if (statusTarget === "saved") {
        setSavedCarStatus(duplicateMessage);
      } else {
        setCaptureStatus(duplicateMessage);
      }
      return { saved: false, duplicate: true };
    }

    const carResult = savedCars.createSavedCar({
      title: capture.title || capture.url,
      url: capture.url,
      price: capture.price || "",
      location: capture.location || "",
      sellerName: capture.sellerName || "",
      mileage: capture.mileage || "",
      transmission: capture.transmission || "",
      fuelType: capture.fuelType || "",
      description: capture.description || "",
      imageUrl: capture.imageUrl || "",
      readStatus: capture.readStatus || "",
      statusHint: capture.statusHint || "",
      status: "Interested",
      sourceText: capture.sourceText || "",
    });

    if (carResult.error) {
      if (statusTarget === "saved") {
        setSavedCarStatus(carResult.error);
      } else {
        setCaptureStatus(carResult.error);
      }
      return { saved: false, error: carResult.error };
    }

    savedCarRecords = [carResult.value, ...savedCarRecords];

    let message = `Saved: ${carResult.value.title}.`;
    if (options.enriched) {
      message = `Saved with reader details: ${carResult.value.title}.`;
    } else if (options.readerAttempted && options.readerMessage) {
      message = `Saved URL only. ${options.readerMessage}`;
    } else if (isUrlOnly) {
      message = `Saved URL only: ${carResult.value.title}.`;
    }

    await persistSavedCars(message);
    if (statusTarget === "capture") {
      setCaptureStatus(message);
    }

    return { saved: true, value: carResult.value, message };
  }

  function setCaptureDragState(active) {
    listingCaptureBox.classList.toggle("is-drag-over", active);
  }

  function getDroppedHtmlUrl(html) {
    if (!html) {
      return "";
    }
    const hrefMatch = html.match(/\shref=["']([^"']+)["']/i);
    return hrefMatch ? hrefMatch[1] : "";
  }

  function getDroppedText(dataTransfer) {
    if (!dataTransfer || typeof dataTransfer.getData !== "function") {
      return "";
    }
    return (
      dataTransfer.getData("text/plain") ||
      dataTransfer.getData("text/uri-list") ||
      getDroppedHtmlUrl(dataTransfer.getData("text/html"))
    );
  }

  async function handleCaptureUse() {
    if (!captureParser) {
      setCaptureStatus("Capture parser unavailable. Reload the extension and try again.");
      return;
    }

    useCaptureButton.disabled = true;

    try {
      const rawText = listingCaptureTextarea.value;

      const result = captureParser.parseSavedCarCapture(rawText);
      if (result.error) {
        setCaptureStatus(result.error);
        return;
      }

      const capture = result.value;

      if (!capture.url) {
        setCaptureStatus("Capture needs a listing URL. Add the Facebook Marketplace URL to the text.");
        return;
      }

      if (findSavedCarByUrl(capture.url)) {
        setCaptureStatus("Already saved.");
        return;
      }

      const isUrlOnly = captureParser.isUrlOnlyCapture(rawText, capture);
      const enrichment = await enrichCaptureWithReader(capture, { statusTarget: "capture" });
      const saveResult = await saveCaptureAsCar(enrichment.capture, {
        isUrlOnly,
        enriched: enrichment.enriched,
        readerAttempted: enrichment.attempted,
        readerMessage: enrichment.message,
        statusTarget: "capture",
      });
      if (saveResult.saved) {
        listingCaptureTextarea.value = "";
      }
    } catch (error) {
      setCaptureStatus(error.message || "Capture could not be saved.");
    } finally {
      useCaptureButton.disabled = false;
    }
  }

  async function handleCaptureDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setCaptureDragState(false);

    const droppedText = getDroppedText(event.dataTransfer);
    if (!droppedText) {
      setCaptureStatus("Drop text or a listing URL into the capture box.");
      return;
    }

    listingCaptureTextarea.value = droppedText.trim();
    await handleCaptureUse();
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

  function hasReaderDetailFields(car) {
    return Boolean(
      car.price ||
        car.location ||
        car.sellerName ||
        car.mileage ||
        car.transmission ||
        car.fuelType ||
        car.description ||
        car.imageUrl ||
        car.statusHint
    );
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
    const sourceLines = sourceWithoutShortcutWrapper
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (
      sourceLines.some((line) => savedCars.normalizeSavedCarUrl(line) === savedCars.normalizeSavedCarUrl(car.url))
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

    if (car.readStatus && hasReaderDetailFields(car)) {
      return `Source: Reader details from ${compactUrl(car.url) || "listing URL"}`;
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

  function getReaderNote(car) {
    if (!car.readStatus || car.readStatus === "ok" || car.readStatus === "login_dialog_closed") {
      return "";
    }
    if (listingReader && typeof listingReader.getReaderFailureMessage === "function") {
      return listingReader.getReaderFailureMessage(car.readStatus);
    }
    return `Reader: ${car.readStatus.replace(/_/g, " ")}`;
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
        const readerNote = getReaderNote(car);
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
            ${readerNote ? `<div class="saved-car-card__source">${escapeHtml(readerNote)}</div>` : ""}
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

      const capture = {
        title: "",
        url: response.url,
        price: "",
        location: "",
        sellerName: "",
        mileage: "",
        transmission: "",
        fuelType: "",
        description: "",
        imageUrl: "",
        readStatus: "",
        statusHint: "",
        sourceText: `Saved from active tab: ${response.url}`,
      };
      const enrichment = await enrichCaptureWithReader(capture, {
        fallbackTitle: response.title || response.url,
        statusTarget: "saved",
      });
      await saveCaptureAsCar(enrichment.capture, {
        isUrlOnly: true,
        enriched: enrichment.enriched,
        readerAttempted: enrichment.attempted,
        readerMessage: enrichment.message,
        statusTarget: "saved",
      });
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

  useCaptureButton.addEventListener("click", handleCaptureUse);

  clearCaptureButton.addEventListener("click", () => {
    listingCaptureTextarea.value = "";
    setCaptureStatus("");
  });

  [listingCaptureBox, listingCaptureTextarea].forEach((dropTarget) => {
    dropTarget.addEventListener("dragenter", (event) => {
      event.preventDefault();
      setCaptureDragState(true);
    });
    dropTarget.addEventListener("dragover", (event) => {
      event.preventDefault();
      setCaptureDragState(true);
    });
    dropTarget.addEventListener("dragleave", (event) => {
      if (!listingCaptureBox.contains(event.relatedTarget)) {
        setCaptureDragState(false);
      }
    });
    dropTarget.addEventListener("drop", handleCaptureDrop);
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
