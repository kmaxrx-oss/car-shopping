(function () {
  const vehicles = window.CAR_SEARCH_HOMEBASE_VEHICLES || [];
  const tierById = new Map(vehicles.map((tier) => [tier.id, tier]));
  const savedCarsStorageKey = "carShopping.savedCars.v1";
  const savedCarStatuses = ["Interested", "Messaged", "Maybe", "Rejected", "Gone / Removed", "Bought / Dead end"];

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
    savedCarsToggle: document.getElementById("saved-cars-toggle"),
    savedCarsPanel: document.getElementById("saved-cars-panel"),
    savedCarsCount: document.getElementById("saved-cars-count"),
    savedCarsList: document.getElementById("saved-cars-list"),
    savedCarCaptureBox: document.getElementById("saved-car-capture-box"),
    savedCarCapture: document.getElementById("saved-car-capture"),
    savedCarCaptureUse: document.getElementById("saved-car-capture-use"),
    savedCarCaptureMessage: document.getElementById("saved-car-capture-message"),
    savedCarForm: document.getElementById("saved-car-form"),
    savedCarId: document.getElementById("saved-car-id"),
    savedCarSourceText: document.getElementById("saved-car-source-text"),
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
        sourceText,
      },
    };
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
          <section class="tier-section" data-tier-id="${escapeHtml(tier.id)}">
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

    return { value: { title, url, price, location, sellerName, status, notes, sourceText } };
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
        const facts = [car.price, car.location, car.sellerName]
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

  function prefillSavedCarFormFromCapture(capture) {
    els.savedCarSourceText.value = capture.sourceText || "";
    els.savedCarTitle.value = capture.title || "";
    els.savedCarUrl.value = capture.url || "";
    els.savedCarPrice.value = capture.price || "";
    els.savedCarLocation.value = capture.location || "";
    els.savedCarSellerName.value = capture.sellerName || "";
  }

  function handleSavedCarCaptureUse() {
    const result = parseSavedCarCapture(els.savedCarCapture.value);
    if (result.error) {
      setCaptureMessage(result.error, "error");
      return;
    }

    prefillSavedCarFormFromCapture(result.value);
    clearSavedCarError();

    const summaryParts = [result.value.title, result.value.price, result.value.location, result.value.url ? "URL found" : ""].filter(Boolean);
    setCaptureMessage(
      summaryParts.length ? `Capture ready: ${summaryParts.join(" | ")}` : "Capture added a listing URL to the form.",
      "success"
    );
  }

  function setCaptureDragState(isActive) {
    els.savedCarCaptureBox.classList.toggle("is-drag-over", isActive);
  }

  function handleSavedCarCaptureDrop(event) {
    event.preventDefault();
    setCaptureDragState(false);

    const droppedText = event.dataTransfer && typeof event.dataTransfer.getData === "function"
      ? event.dataTransfer.getData("text/plain") || event.dataTransfer.getData("text/uri-list")
      : "";

    if (!droppedText) {
      setCaptureMessage("Drop text or a listing URL into Smart Capture to use it.", "error");
      return;
    }

    els.savedCarCapture.value = droppedText.trim();
    handleSavedCarCaptureUse();
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

  function syncTierButtonState() {
    els.tierButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tierId === state.tierId);
    });
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
    els.savedCarCaptureUse.addEventListener("click", handleSavedCarCaptureUse);
    els.savedCarCapture.addEventListener("dragenter", (event) => {
      event.preventDefault();
      setCaptureDragState(true);
    });
    els.savedCarCapture.addEventListener("dragover", (event) => {
      event.preventDefault();
      setCaptureDragState(true);
    });
    els.savedCarCapture.addEventListener("dragleave", () => {
      setCaptureDragState(false);
    });
    els.savedCarCapture.addEventListener("drop", handleSavedCarCaptureDrop);
    els.savedCarForm.addEventListener("submit", handleSavedCarSubmit);
    els.savedCarCancel.addEventListener("click", resetSavedCarForm);
    els.savedCarsList.addEventListener("click", handleSavedCarsListClick);
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
