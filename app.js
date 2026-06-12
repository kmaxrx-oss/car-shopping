(function () {
  const vehicles = window.CAR_SEARCH_HOMEBASE_VEHICLES || [];
  const tierById = new Map(vehicles.map((tier) => [tier.id, tier]));
  const savedCarsStorageKey = "carShopping.savedCars.v1";
  const savedCarStatuses = ["Interested", "Messaged", "Maybe", "Rejected", "Gone / Removed", "Bought / Dead end"];
  const listingReaderEndpoint = "http://localhost:3137/read-listing";
  const listingReaderTimeoutMs = 10000;

  const state = {
    tierId: vehicles[1] ? vehicles[1].id : vehicles[0]?.id || "tier-b",
    minPrice: 1500,
    maxPrice: 4000,
    radius: 100,
    daysListed: 7,
    exact: true,
    manualQuery: "",
    savedCars: [],
  };

  const baseUrl = "https://www.facebook.com/marketplace/103108469729444/search/";

  const els = {
    tierSections: document.getElementById("tier-sections"),
    activeTierLabel: document.getElementById("active-tier-label"),
    minPrice: document.getElementById("min-price"),
    maxPrice: document.getElementById("max-price"),
    radius: document.getElementById("radius"),
    daysListed: document.getElementById("days-listed"),
    exact: document.getElementById("exact-toggle"),
    manualQuery: document.getElementById("manual-query"),
    manualLink: document.getElementById("manual-link"),
    manualUrl: document.getElementById("manual-url"),
    buildManualLink: document.getElementById("build-manual-link"),
    tierButtons: Array.from(document.querySelectorAll(".tier-chip")),
    toolbox: document.getElementById("toolbox"),
    quickNavSavedCars: document.getElementById("quick-nav-saved-cars"),
    savedCarsToggle: document.getElementById("saved-cars-toggle"),
    savedCarsPanel: document.getElementById("saved-cars-panel"),
    savedCarsCount: document.getElementById("saved-cars-count"),
    savedCarsList: document.getElementById("saved-cars-list"),
    savedCarCaptureBox: document.getElementById("saved-car-capture-box"),
    savedCarCapture: document.getElementById("saved-car-capture"),
    savedCarCaptureUse: document.getElementById("saved-car-capture-use"),
    savedCarCaptureMessage: document.getElementById("saved-car-capture-message"),
    savedCarCapturePreview: document.getElementById("saved-car-capture-preview"),
    savedCarForm: document.getElementById("saved-car-form"),
    savedCarId: document.getElementById("saved-car-id"),
    savedCarSourceText: document.getElementById("saved-car-source-text"),
    savedCarMileage: document.getElementById("saved-car-mileage"),
    savedCarTransmission: document.getElementById("saved-car-transmission"),
    savedCarFuelType: document.getElementById("saved-car-fuel-type"),
    savedCarDescription: document.getElementById("saved-car-description"),
    savedCarImageUrl: document.getElementById("saved-car-image-url"),
    savedCarReadStatus: document.getElementById("saved-car-read-status"),
    savedCarStatusHint: document.getElementById("saved-car-status-hint"),
    savedCarTitle: document.getElementById("saved-car-title"),
    savedCarUrl: document.getElementById("saved-car-url"),
    savedCarPrice: document.getElementById("saved-car-price"),
    savedCarLocation: document.getElementById("saved-car-location"),
    savedCarSellerName: document.getElementById("saved-car-seller-name"),
    savedCarStatus: document.getElementById("saved-car-status"),
    savedCarNotes: document.getElementById("saved-car-notes"),
    savedCarError: document.getElementById("saved-car-error"),
    savedCarSubmit: document.getElementById("saved-car-submit"),
    savedCarCancel: document.getElementById("saved-car-cancel"),
    savedCarsStorageWarning: document.getElementById("saved-cars-storage-warning"),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function generateSavedCarId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatTimestamp(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function showSavedCarError(message) {
    els.savedCarError.textContent = message;
  }

  function setCaptureMessage(message, tone) {
    els.savedCarCaptureMessage.textContent = message;
    els.savedCarCaptureMessage.classList.toggle("is-success", tone === "success");
  }

  function clearCapturePreview() {
    els.savedCarCapturePreview.hidden = true;
    els.savedCarCapturePreview.innerHTML = "";
  }

  function renderCapturePreview(capture) {
    const displayUrl = capture.url ? capture.url.replace(/^https?:\/\//i, "") : "";
    const rows = [
      ["Title", capture.title],
      ["Price", capture.price],
      ["Location", capture.location],
      ["Seller", capture.sellerName],
      ["Mileage", capture.mileage],
      ["Transmission", capture.transmission],
      ["Fuel", capture.fuelType],
      ["Reader", capture.readStatus],
      ["Status hint", capture.statusHint],
      ["URL", displayUrl],
    ].filter(([, value]) => value);

    if (!rows.length) {
      clearCapturePreview();
      return;
    }

    els.savedCarCapturePreview.hidden = false;
    els.savedCarCapturePreview.innerHTML = `
      <div class="capture-preview__title">Captured:</div>
      ${rows
        .map(([label, value]) => `<div class="capture-preview__row"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
        .join("")}
    `;
  }

  function clearSavedCarError() {
    showSavedCarError("");
  }

  function setStorageWarning(message) {
    els.savedCarsStorageWarning.textContent = message;
    els.savedCarsStorageWarning.hidden = !message;
  }

  function normalizeSavedCar(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    if (!title || !url) {
      return null;
    }

    return {
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : generateSavedCarId(),
      title,
      url,
      price: typeof candidate.price === "string" ? candidate.price : "",
      location: typeof candidate.location === "string" ? candidate.location : "",
      sellerName: typeof candidate.sellerName === "string" ? candidate.sellerName : "",
      mileage: typeof candidate.mileage === "string" ? candidate.mileage : "",
      transmission: typeof candidate.transmission === "string" ? candidate.transmission : "",
      fuelType: typeof candidate.fuelType === "string" ? candidate.fuelType : "",
      description: typeof candidate.description === "string" ? candidate.description : "",
      imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : "",
      readStatus: typeof candidate.readStatus === "string" ? candidate.readStatus : "",
      statusHint: typeof candidate.statusHint === "string" ? candidate.statusHint : "",
      status: savedCarStatuses.includes(candidate.status) ? candidate.status : "Interested",
      notes: typeof candidate.notes === "string" ? candidate.notes : "",
      sourceText: typeof candidate.sourceText === "string" ? candidate.sourceText : "",
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    };
  }

  function loadSavedCars() {
    setStorageWarning("");

    try {
      const raw = window.localStorage.getItem(savedCarsStorageKey);
      if (!raw) {
        state.savedCars = [];
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error("Saved cars storage was not an array.");
      }

      state.savedCars = parsed.map(normalizeSavedCar).filter(Boolean);
    } catch (error) {
      state.savedCars = [];
      setStorageWarning("Saved cars data could not be read, so the shortlist started empty.");
    }
  }

  function saveSavedCars() {
    try {
      window.localStorage.setItem(savedCarsStorageKey, JSON.stringify(state.savedCars));
      setStorageWarning("");
    } catch (error) {
      setStorageWarning("Saved cars could not be written to this browser.");
    }
  }

  function buildMarketplaceUrl({ query, minYear, minPrice, maxPrice, radius, daysListed, exact }) {
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("minPrice", String(minPrice));
    params.set("maxPrice", String(maxPrice));
    params.set("minYear", String(minYear));
    params.set("category_id", "546583916084032");
    params.set("radius", String(radius));
    params.set("daysSinceListed", String(daysListed));
    params.set("sortBy", "creation_time_descend");
    params.set("exact", exact ? "true" : "false");
    return `${baseUrl}?${params.toString()}`;
  }

  function parseSavedCarCapture(rawText) {
    const sourceText = typeof rawText === "string" ? rawText.trim() : "";
    if (!sourceText) {
      return { error: "Paste or drop a listing URL or text block to use Smart Capture." };
    }

    const urlMatch = sourceText.match(/https?:\/\/\S+/i);
    const url = urlMatch ? urlMatch[0].replace(/[)\].,!?]+$/, "") : "";
    const rawLines = sourceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const seenLines = new Set();
    const uniqueLines = rawLines.filter((line) => {
      const normalizedLine = line.toLowerCase();
      if (seenLines.has(normalizedLine)) {
        return false;
      }

      seenLines.add(normalizedLine);
      return true;
    });

    const priceLine = uniqueLines.find((line) => /^\$\s?\d[\d,]*(?:\.\d{2})?$/.test(line));
    const barePriceLine = uniqueLines.find((line) => /^\d[\d,]*(?:\.\d{2})?$/.test(line));
    const price = priceLine || barePriceLine || "";

    const location =
      uniqueLines.find((line) => /^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(line)) ||
      uniqueLines.find((line) => /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(line)) ||
      "";

    let sellerName = "";
    for (const line of uniqueLines) {
      const sellerMatch = line.match(/^(?:seller|listed by|posted by)\s*:\s*(.+)$/i);
      if (sellerMatch && sellerMatch[1].trim()) {
        sellerName = sellerMatch[1].trim();
        break;
      }
    }

    const filteredLines = uniqueLines.filter((line) => {
      if (url && line.includes(url)) {
        return false;
      }

      if (price && line === price) {
        return false;
      }

      if (location && line === location) {
        return false;
      }

      if (/^(seller|listed by|posted by)\s*:/i.test(line)) {
        return false;
      }

      if (/^(ref|referral_code|referral_story_type|tracking)=/i.test(line)) {
        return false;
      }

      if (/^\[InternetShortcut\]$/i.test(line) || /^URL=/i.test(line)) {
        return false;
      }

      if (/^(facebook|marketplace)$/i.test(line)) {
        return false;
      }

      return true;
    });

    const title = filteredLines[0] || "";

    if (!url && !price && !location && !title && !sellerName) {
      return { error: "Smart Capture could not find a usable listing URL or details in that text." };
    }

    return {
      value: {
        url,
        price,
        location,
        title,
        sellerName,
        mileage: "",
        transmission: "",
        fuelType: "",
        description: "",
        imageUrl: "",
        readStatus: "",
        statusHint: "",
        sourceText,
      },
    };
  }

  function isUrlOnlyCapture(rawText, capture) {
    if (!capture.url) {
      return false;
    }

    const textWithoutUrl = String(rawText || "")
      .replace(capture.url, "")
      .replace(/^\s*\[InternetShortcut\]\s*$/gim, "")
      .replace(/^\s*URL=\s*$/gim, "")
      .replace(/^\s*URL=/gim, "")
      .trim();

    return !capture.title && !capture.price && !capture.location && !capture.sellerName && !textWithoutUrl;
  }

  function normalizeReaderResponse(response, fallbackUrl, sourceText) {
    return {
      title: typeof response.title === "string" ? response.title.trim() : "",
      url: fallbackUrl,
      price: typeof response.price === "string" ? response.price.trim() : "",
      location: typeof response.location === "string" ? response.location.trim() : "",
      sellerName: typeof response.sellerName === "string" ? response.sellerName.trim() : "",
      mileage: typeof response.mileage === "string" ? response.mileage.trim() : "",
      transmission: typeof response.transmission === "string" ? response.transmission.trim() : "",
      fuelType: typeof response.fuelType === "string" ? response.fuelType.trim() : "",
      description: typeof response.description === "string" ? response.description.trim() : "",
      imageUrl: typeof response.imageUrl === "string" ? response.imageUrl.trim() : "",
      readStatus: typeof response.readStatus === "string" ? response.readStatus : "",
      statusHint: typeof response.statusHint === "string" ? response.statusHint : "",
      sourceText: typeof response.rawText === "string" && response.rawText ? response.rawText : sourceText,
    };
  }

  function hasReaderCaptureFields(capture) {
    return Boolean(
      capture.title ||
        capture.price ||
        capture.location ||
        capture.sellerName ||
        capture.mileage ||
        capture.transmission ||
        capture.fuelType ||
        capture.description ||
        capture.imageUrl ||
        capture.statusHint
    );
  }

  function getReaderFailureMessage(readStatus) {
    if (readStatus === "timeout") {
      return "Reader timeout. URL captured only. Paste listing text to fill details.";
    }

    if (readStatus === "login_dialog_blocked") {
      return "Facebook dialog could not be closed. Paste listing text instead.";
    }

    if (readStatus === "login_required") {
      return "Facebook only returned login content. Paste listing text instead.";
    }

    if (readStatus === "could_not_parse") {
      return "Reader opened the page but could not identify listing fields. Paste listing text instead.";
    }

    return "Reader unavailable. URL captured only. Paste listing text to fill details.";
  }

  async function readListingFromLocalReader(url) {
    if (typeof window.fetch !== "function") {
      return { readStatus: "reader_unavailable", error: "Local reader requires browser fetch support." };
    }

    const controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), listingReaderTimeoutMs)
      : null;

    try {
      const response = await window.fetch(listingReaderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller ? controller.signal : undefined,
      });

      if (!response.ok) {
        return { readStatus: "reader_unavailable", error: `Reader returned HTTP ${response.status}.` };
      }

      return await response.json();
    } catch (error) {
      if (error && error.name === "AbortError") {
        return { readStatus: "timeout", error: "Reader timed out." };
      }

      return { readStatus: "reader_unavailable", error: "Reader unavailable." };
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  function getActiveTier() {
    return tierById.get(state.tierId) || vehicles[0];
  }

  function syncStateFromControls() {
    state.minPrice = toPositiveNumber(els.minPrice.value, 1500);
    state.maxPrice = toPositiveNumber(els.maxPrice.value, 4000);
    state.radius = toPositiveNumber(els.radius.value, 100);
    state.daysListed = toPositiveNumber(els.daysListed.value, 7);
    state.exact = els.exact.checked;
    state.manualQuery = els.manualQuery.value.trim();
  }

  function getCardUrl(modelName, tierMinYear, extraTerm) {
    const query = extraTerm ? `${modelName} ${extraTerm}`.trim() : modelName;
    return buildMarketplaceUrl({
      query,
      minYear: tierMinYear,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      radius: state.radius,
      daysListed: state.daysListed,
      exact: state.exact,
    });
  }

  function renderManualLink() {
    syncStateFromControls();
    const activeTier = getActiveTier();

    if (!state.manualQuery) {
      els.manualLink.href = "#";
      els.manualLink.textContent = "Enter a query to build a link";
      els.manualUrl.textContent = "Awaiting input...";
      els.activeTierLabel.textContent = `${activeTier.label} - ${activeTier.minYear}+ minYear`;
      return;
    }

    const query = state.manualQuery;
    const url = buildMarketplaceUrl({
      query,
      minYear: activeTier.minYear,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      radius: state.radius,
      daysListed: state.daysListed,
      exact: state.exact,
    });
    els.manualLink.href = url;
    els.manualLink.textContent = state.manualQuery
      ? `Open Marketplace search for "${state.manualQuery}"`
      : "Build a link to see it here";
    els.manualUrl.textContent = url;
    els.activeTierLabel.textContent = `${activeTier.label} - ${activeTier.minYear}+ minYear`;
  }

  function refreshGeneratedLinks() {
    syncStateFromControls();
    renderTierSections();
    renderManualLink();
  }

  function renderTierSections() {
    els.tierSections.innerHTML = vehicles
      .map((tier) => {
        const groupsHtml = tier.groups
          .map((group) => {
            const cardsHtml = group.models
              .map((model) => {
                const baseUrl = getCardUrl(model.name, tier.minYear);
                const extraLinks = (model.searchTerms || [])
                  .map((term) => {
                    const termQuery = term.query || term.label;
                    const termUrl = getCardUrl(model.name, tier.minYear, termQuery);
                    return `<a class="model-link is-secondary" href="${escapeHtml(termUrl)}" target="_blank" rel="noreferrer">${escapeHtml(
                      term.label
                    )}</a>`;
                  })
                  .join("");

                const tagsHtml = (model.tags || [])
                  .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
                  .join("");

                return `
                  <article class="model-card">
                    <div>
                      <div class="model-card__title">${escapeHtml(model.name)}</div>
                      ${tagsHtml ? `<div class="tag-list">${tagsHtml}</div>` : ""}
                    </div>
                    ${model.notes ? `<div class="model-note">${escapeHtml(model.notes)}</div>` : ""}
                    <div class="link-row">
                      <a class="model-link" href="${escapeHtml(baseUrl)}" target="_blank" rel="noreferrer">Search model</a>
                      ${extraLinks}
                    </div>
                  </article>
                `;
              })
              .join("");

            return `
              <section class="group">
                <h3>${escapeHtml(group.label)}</h3>
                ${group.note ? `<p class="group-meta">${escapeHtml(group.note)}</p>` : ""}
                <div class="models">${cardsHtml}</div>
              </section>
            `;
          })
          .join("");

        return `
          <section id="${escapeHtml(tier.id)}" class="tier-section" data-tier-id="${escapeHtml(tier.id)}">
            <header class="tier-header">
              <div>
                <h2>${escapeHtml(tier.label)}</h2>
                <p>${escapeHtml(tier.description)}</p>
              </div>
              <div class="tier-badge">${escapeHtml(String(tier.minYear))}+ minYear</div>
            </header>
            <div class="groups">${groupsHtml}</div>
          </section>
        `;
      })
      .join("");
  }

  function resetSavedCarForm() {
    els.savedCarId.value = "";
    els.savedCarSourceText.value = "";
    els.savedCarMileage.value = "";
    els.savedCarTransmission.value = "";
    els.savedCarFuelType.value = "";
    els.savedCarDescription.value = "";
    els.savedCarImageUrl.value = "";
    els.savedCarReadStatus.value = "";
    els.savedCarStatusHint.value = "";
    els.savedCarTitle.value = "";
    els.savedCarUrl.value = "";
    els.savedCarPrice.value = "";
    els.savedCarLocation.value = "";
    els.savedCarSellerName.value = "";
    els.savedCarStatus.value = "Interested";
    els.savedCarNotes.value = "";
    els.savedCarSubmit.textContent = "Save car";
    els.savedCarCancel.hidden = true;
    clearSavedCarError();
  }

  function validateSavedCarForm() {
    const title = els.savedCarTitle.value.trim();
    const url = els.savedCarUrl.value.trim();
    const price = els.savedCarPrice.value.trim();
    const location = els.savedCarLocation.value.trim();
    const sellerName = els.savedCarSellerName.value.trim();
    const mileage = els.savedCarMileage.value.trim();
    const transmission = els.savedCarTransmission.value.trim();
    const fuelType = els.savedCarFuelType.value.trim();
    const description = els.savedCarDescription.value.trim();
    const imageUrl = els.savedCarImageUrl.value.trim();
    const readStatus = els.savedCarReadStatus.value.trim();
    const statusHint = els.savedCarStatusHint.value.trim();
    const status = savedCarStatuses.includes(els.savedCarStatus.value) ? els.savedCarStatus.value : "Interested";
    const notes = els.savedCarNotes.value.trim();
    const sourceText = els.savedCarSourceText.value;

    if (!title) {
      return { error: "Listing title is required." };
    }

    if (!url) {
      return { error: "Listing URL is required." };
    }

    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { error: "Listing URL must start with http or https." };
      }
    } catch (error) {
      return { error: "Listing URL must be a valid http or https URL." };
    }

    return { value: { title, url, price, location, sellerName, mileage, transmission, fuelType, description, imageUrl, readStatus, statusHint, status, notes, sourceText } };
  }

  function renderSavedCars() {
    els.savedCarsCount.textContent = String(state.savedCars.length);

    if (!state.savedCars.length) {
      els.savedCarsList.innerHTML = '<p class="saved-cars-empty">No saved cars yet. Paste a listing URL above to start a shortlist.</p>';
      return;
    }

    els.savedCarsList.innerHTML = state.savedCars
      .map((car) => {
        const savedAt = formatTimestamp(car.createdAt);
        const updatedAt = formatTimestamp(car.updatedAt);
        const timestamp = updatedAt && updatedAt !== savedAt ? `Updated ${updatedAt}` : savedAt ? `Saved ${savedAt}` : "";
        const facts = [car.price, car.location, car.sellerName, car.mileage, car.transmission, car.fuelType, car.statusHint]
          .filter(Boolean)
          .map((fact) => `<span class="saved-car-card__fact">${escapeHtml(fact)}</span>`)
          .join("");

        return `
          <article class="saved-car-card" data-saved-car-id="${escapeHtml(car.id)}">
            <div class="saved-car-card__title">${escapeHtml(car.title)}</div>
            ${facts ? `<div class="saved-car-card__facts">${facts}</div>` : ""}
            <div class="saved-car-card__status">${escapeHtml(car.status)}</div>
            ${car.notes ? `<p class="saved-car-card__notes">${escapeHtml(car.notes)}</p>` : ""}
            ${timestamp ? `<p class="saved-car-card__meta">${escapeHtml(timestamp)}</p>` : ""}
            <div class="saved-car-card__actions">
              <a href="${escapeHtml(car.url)}" target="_blank" rel="noreferrer">Open</a>
              <button type="button" data-action="edit" data-id="${escapeHtml(car.id)}">Edit</button>
              <button class="is-danger" type="button" data-action="delete" data-id="${escapeHtml(car.id)}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function handleSavedCarSubmit(event) {
    event.preventDefault();
    const result = validateSavedCarForm();
    if (result.error) {
      showSavedCarError(result.error);
      return;
    }

    const now = new Date().toISOString();
    const editingId = els.savedCarId.value;
    const existingCar = state.savedCars.find((car) => car.id === editingId);

    if (existingCar) {
      existingCar.title = result.value.title;
      existingCar.url = result.value.url;
      existingCar.price = result.value.price;
      existingCar.location = result.value.location;
      existingCar.sellerName = result.value.sellerName;
      existingCar.mileage = result.value.mileage;
      existingCar.transmission = result.value.transmission;
      existingCar.fuelType = result.value.fuelType;
      existingCar.description = result.value.description;
      existingCar.imageUrl = result.value.imageUrl;
      existingCar.readStatus = result.value.readStatus;
      existingCar.statusHint = result.value.statusHint;
      existingCar.status = result.value.status;
      existingCar.notes = result.value.notes;
      existingCar.sourceText = result.value.sourceText;
      existingCar.updatedAt = now;
    } else {
      state.savedCars.unshift({
        id: generateSavedCarId(),
        title: result.value.title,
        url: result.value.url,
        price: result.value.price,
        location: result.value.location,
        sellerName: result.value.sellerName,
        mileage: result.value.mileage,
        transmission: result.value.transmission,
        fuelType: result.value.fuelType,
        description: result.value.description,
        imageUrl: result.value.imageUrl,
        readStatus: result.value.readStatus,
        statusHint: result.value.statusHint,
        status: result.value.status,
        notes: result.value.notes,
        sourceText: result.value.sourceText,
        createdAt: now,
        updatedAt: now,
      });
    }

    saveSavedCars();
    resetSavedCarForm();
    renderSavedCars();
  }

  function editSavedCar(id) {
    const car = state.savedCars.find((savedCar) => savedCar.id === id);
    if (!car) {
      return;
    }

    els.savedCarId.value = car.id;
    els.savedCarSourceText.value = car.sourceText || "";
    els.savedCarMileage.value = car.mileage || "";
    els.savedCarTransmission.value = car.transmission || "";
    els.savedCarFuelType.value = car.fuelType || "";
    els.savedCarDescription.value = car.description || "";
    els.savedCarImageUrl.value = car.imageUrl || "";
    els.savedCarReadStatus.value = car.readStatus || "";
    els.savedCarStatusHint.value = car.statusHint || "";
    els.savedCarTitle.value = car.title;
    els.savedCarUrl.value = car.url;
    els.savedCarPrice.value = car.price || "";
    els.savedCarLocation.value = car.location || "";
    els.savedCarSellerName.value = car.sellerName || "";
    els.savedCarStatus.value = car.status;
    els.savedCarNotes.value = car.notes;
    els.savedCarSubmit.textContent = "Update car";
    els.savedCarCancel.hidden = false;
    clearSavedCarError();
    els.savedCarTitle.focus();
  }

  function deleteSavedCar(id) {
    const car = state.savedCars.find((savedCar) => savedCar.id === id);
    if (!car) {
      return;
    }

    if (typeof window.confirm === "function" && !window.confirm(`Delete "${car.title}" from Saved Cars?`)) {
      return;
    }

    state.savedCars = state.savedCars.filter((savedCar) => savedCar.id !== id);
    saveSavedCars();
    renderSavedCars();

    if (els.savedCarId.value === id) {
      resetSavedCarForm();
    }
  }

  function prefillSavedCarFormFromCapture(capture, options = {}) {
    const preserveMissing = Boolean(options.preserveMissing);
    els.savedCarSourceText.value = capture.sourceText || "";
    els.savedCarUrl.value = capture.url || els.savedCarUrl.value;

    const fieldPairs = [
      [els.savedCarTitle, capture.title],
      [els.savedCarPrice, capture.price],
      [els.savedCarLocation, capture.location],
      [els.savedCarSellerName, capture.sellerName],
      [els.savedCarMileage, capture.mileage],
      [els.savedCarTransmission, capture.transmission],
      [els.savedCarFuelType, capture.fuelType],
      [els.savedCarDescription, capture.description],
      [els.savedCarImageUrl, capture.imageUrl],
      [els.savedCarReadStatus, capture.readStatus],
      [els.savedCarStatusHint, capture.statusHint],
    ];

    fieldPairs.forEach(([field, value]) => {
      if (value || !preserveMissing) {
        field.value = value || "";
      }
    });

    if (capture.statusHint && savedCarStatuses.includes(capture.statusHint)) {
      els.savedCarStatus.value = capture.statusHint;
    }
  }

  async function handleSavedCarCaptureUse() {
    const result = parseSavedCarCapture(els.savedCarCapture.value);
    if (result.error) {
      setCaptureMessage(result.error, "error");
      clearCapturePreview();
      return;
    }

    if (isUrlOnlyCapture(els.savedCarCapture.value, result.value)) {
      prefillSavedCarFormFromCapture(result.value, { preserveMissing: true });
      clearSavedCarError();
      renderCapturePreview(result.value);
      setCaptureMessage("Reading listing from local reader...", "success");

      const readerResponse = await readListingFromLocalReader(result.value.url);
      const readerCapture = normalizeReaderResponse(readerResponse, result.value.url, result.value.sourceText);
      if (readerResponse.readStatus === "ok" || hasReaderCaptureFields(readerCapture)) {
        prefillSavedCarFormFromCapture(readerCapture);
        renderCapturePreview(readerCapture);
        setCaptureMessage(
          readerResponse.readStatus === "login_dialog_closed"
            ? "Listing read after closing Facebook dialog."
            : "Listing read successfully.",
          "success"
        );
        return;
      }

      setCaptureMessage(getReaderFailureMessage(readerResponse.readStatus), "error");
      renderCapturePreview(result.value);
      return;
    }

    prefillSavedCarFormFromCapture(result.value);
    clearSavedCarError();
    renderCapturePreview(result.value);

    const summaryParts = [result.value.title, result.value.price, result.value.location, result.value.url ? "URL found" : ""].filter(Boolean);
    setCaptureMessage(
      summaryParts.length ? `Capture ready: ${summaryParts.join(" | ")}` : "Capture added a listing URL to the form.",
      "success"
    );
  }

  function setCaptureDragState(isActive) {
    els.savedCarCaptureBox.classList.toggle("is-drag-over", isActive);
    els.toolbox.classList.toggle("is-drag-over", isActive);
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

  function readDroppedFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve("");
        return;
      }

      if (typeof file.text === "function") {
        file.text().then(resolve).catch(reject);
        return;
      }

      if (typeof window.FileReader !== "function") {
        reject(new Error("File reading is not available in this browser."));
        return;
      }

      const reader = new window.FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Dropped file could not be read."));
      reader.readAsText(file);
    });
  }

  async function getDroppedCaptureText(dataTransfer) {
    const droppedText = getDroppedText(dataTransfer);
    if (droppedText) {
      return droppedText;
    }

    const file = dataTransfer && dataTransfer.files && dataTransfer.files[0];
    if (!file) {
      return "";
    }

    return readDroppedFile(file);
  }

  async function handleSavedCarCaptureDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setCaptureDragState(false);

    let droppedText = "";
    try {
      droppedText = await getDroppedCaptureText(event.dataTransfer);
    } catch (error) {
      setCaptureMessage(error.message || "Dropped file could not be read.", "error");
      clearCapturePreview();
      return;
    }

    if (!droppedText) {
      setCaptureMessage("Drop text, a listing URL, or a readable .url shortcut into Smart Capture.", "error");
      clearCapturePreview();
      return;
    }

    els.savedCarCapture.value = droppedText.trim();
    await handleSavedCarCaptureUse();
  }

  function handleSavedCarsListClick(event) {
    const actionButton = event.target.closest("button[data-action]");
    if (!actionButton) {
      return;
    }

    const id = actionButton.dataset.id;
    if (actionButton.dataset.action === "edit") {
      editSavedCar(id);
    }

    if (actionButton.dataset.action === "delete") {
      deleteSavedCar(id);
    }
  }

  function toggleSavedCarsPanel() {
    const isExpanded = els.savedCarsToggle.getAttribute("aria-expanded") === "true";
    els.savedCarsToggle.setAttribute("aria-expanded", String(!isExpanded));
    els.savedCarsPanel.hidden = isExpanded;
  }

  function focusSavedCarsPanel() {
    if (els.savedCarsToggle.getAttribute("aria-expanded") !== "true") {
      els.savedCarsToggle.setAttribute("aria-expanded", "true");
      els.savedCarsPanel.hidden = false;
    }

    els.savedCarsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    els.savedCarsToggle.focus();
  }

  function syncTierButtonState() {
    els.tierButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tierId === state.tierId);
    });
  }

  function isToolboxDragExcludedTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        'input, textarea, select, button, a, [contenteditable="true"], [role="button"], .saved-car-notes'
      )
    );
  }

  function setupToolboxDragScroll() {
    if (!els.toolbox || typeof els.toolbox.addEventListener !== "function" || typeof window.PointerEvent !== "function") {
      return;
    }

    const dragState = {
      pointerId: null,
      startY: 0,
      startScrollTop: 0,
      dragging: false,
      suppressClick: false,
    };

    const finishDrag = () => {
      if (!dragState.pointerId) {
        return;
      }

      dragState.pointerId = null;
      dragState.startY = 0;
      dragState.startScrollTop = 0;
      dragState.dragging = false;
      els.toolbox.classList.remove("is-drag-scrolling");

      if (dragState.suppressClick) {
        window.setTimeout(() => {
          dragState.suppressClick = false;
        }, 0);
      } else {
        dragState.suppressClick = false;
      }
    };

    const onPointerDown = (event) => {
      if (event.button !== 0 || isToolboxDragExcludedTarget(event.target)) {
        return;
      }

      dragState.pointerId = event.pointerId;
      dragState.startY = event.clientY;
      dragState.startScrollTop = els.toolbox.scrollTop;
      dragState.dragging = false;
      dragState.suppressClick = false;

      if (typeof els.toolbox.setPointerCapture === "function") {
        try {
          els.toolbox.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture is optional; scroll still works without it.
        }
      }
    };

    const onPointerMove = (event) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      if (!dragState.dragging && Math.abs(deltaY) < 6) {
        return;
      }

      if (!dragState.dragging) {
        dragState.dragging = true;
        els.toolbox.classList.add("is-drag-scrolling");
      }

      event.preventDefault();
      els.toolbox.scrollTop = dragState.startScrollTop - deltaY;
    };

    const onPointerUpOrCancel = (event) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      if (dragState.dragging) {
        dragState.suppressClick = true;
      }

      if (typeof els.toolbox.releasePointerCapture === "function") {
        try {
          els.toolbox.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore capture release failures.
        }
      }

      finishDrag();
    };

    els.toolbox.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUpOrCancel);
    window.addEventListener("pointercancel", onPointerUpOrCancel);
    els.toolbox.addEventListener(
      "click",
      (event) => {
        if (!dragState.suppressClick) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  }

  function attachEvents() {
    [els.minPrice, els.maxPrice, els.radius, els.daysListed, els.exact].forEach((input) => {
      input.addEventListener("input", refreshGeneratedLinks);
      input.addEventListener("change", refreshGeneratedLinks);
    });

    els.manualQuery.addEventListener("input", renderManualLink);
    els.manualQuery.addEventListener("change", renderManualLink);

    els.buildManualLink.addEventListener("click", () => {
      renderManualLink();
      if (!state.manualQuery) {
        return;
      }

      if (els.manualLink.href && els.manualLink.href !== "#") {
        window.open(els.manualLink.href, "_blank", "noreferrer");
      }
    });

    els.tierButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.tierId = button.dataset.tierId;
        syncTierButtonState();
        renderManualLink();
      });
    });

    els.savedCarsToggle.addEventListener("click", toggleSavedCarsPanel);
    els.quickNavSavedCars.addEventListener("click", (event) => {
      event.preventDefault();
      focusSavedCarsPanel();
    });
    els.savedCarCaptureUse.addEventListener("click", handleSavedCarCaptureUse);
    [els.toolbox, els.savedCarCaptureBox, els.savedCarCapture].forEach((dropTarget) => {
      dropTarget.addEventListener("dragenter", (event) => {
        event.preventDefault();
        setCaptureDragState(true);
      });
      dropTarget.addEventListener("dragover", (event) => {
        event.preventDefault();
        setCaptureDragState(true);
      });
      dropTarget.addEventListener("dragleave", (event) => {
        if (!els.savedCarCaptureBox.contains(event.relatedTarget)) {
          setCaptureDragState(false);
        }
      });
      dropTarget.addEventListener("drop", handleSavedCarCaptureDrop);
    });
    els.savedCarForm.addEventListener("submit", handleSavedCarSubmit);
    els.savedCarCancel.addEventListener("click", resetSavedCarForm);
    els.savedCarsList.addEventListener("click", handleSavedCarsListClick);
    setupToolboxDragScroll();
  }

  function initialize() {
    if (!vehicles.length) {
      els.tierSections.innerHTML = "<p>No vehicle data loaded.</p>";
      return;
    }

    renderTierSections();
    loadSavedCars();
    renderSavedCars();
    attachEvents();
    syncTierButtonState();
    renderManualLink();
  }

  initialize();
})();
