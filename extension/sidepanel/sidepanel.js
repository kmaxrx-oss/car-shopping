(function initializeSidepanel() {
  const platforms = globalThis.CarSearchHarnessPlatforms;
  const craigslist = globalThis.CarSearchHarnessCraigslist;
  const savedCars = globalThis.CarSearchHarnessSavedCars;
  const savedCarUtils = globalThis.CarSearchHarnessSavedCarUtils;
  const captureParser = globalThis.CarSearchHarnessCaptureParser;
  const listingReader = globalThis.CarSearchHarnessListingReaderClient;
  const listingExtractor = globalThis.CarSearchHarnessListingExtractor;
  const storage = globalThis.CarSearchHarnessStorage;
  const marketplaceLocation = globalThis.CarSearchHarnessMarketplaceLocation;
  const zipGeocode = globalThis.CarSearchHarnessZipGeocode;
  const tabs = document.getElementById("platform-tabs");
  const resultBox = document.getElementById("platform-result");
  const searchButton = document.getElementById("search-button");
  const searchStatus = document.getElementById("search-status");
  const savedCarForm = document.getElementById("saved-car-form");
  const savedCarList = document.getElementById("saved-cars-list");
  const savedCarsSortSelect = document.getElementById("saved-cars-sort");
  const savedCarsGroupByStateToggle = document.getElementById("saved-cars-group-by-state");
  const savedCarsFavoritesOnlyToggle = document.getElementById("saved-cars-favorites-only");
  const savedCarStatusLine = document.getElementById("saved-car-status-line");
  const cancelEditButton = document.getElementById("cancel-edit-button");
  const saveCurrentTabButton = document.getElementById("save-current-tab-button");
  const exportBackupButton = document.getElementById("export-backup-button");
  const importBackupButton = document.getElementById("import-backup-button");
  const importFileInput = document.getElementById("import-file-input");
  const chooseRepoButton = document.getElementById("choose-repo-button");
  const saveToRepoButton = document.getElementById("save-to-repo-button");
  const loadFromRepoButton = document.getElementById("load-from-repo-button");
  const repoStatusEl = document.getElementById("repo-status");
  const repoFolderInput = document.getElementById("repo-folder-input");
  const repoFileInput = document.getElementById("repo-file-input");
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
  const searchQueryLabelEl = document.getElementById("search-query-label");
  const filterFields = {
    query: document.getElementById("search-query"),
    minPrice: document.getElementById("min-price"),
    maxPrice: document.getElementById("max-price"),
    minYear: document.getElementById("min-year"),
    radius: document.getElementById("radius"),
    daysListed: document.getElementById("days-listed"),
    exact: document.getElementById("exact-match"),
    zip: document.getElementById("active-zip"),
    craigslistBaseUrl: document.getElementById("craigslist-base-url"),
  };
  const activeLocationLabelEl = document.getElementById("active-location-label");
  const recentZipsEl = document.getElementById("recent-zips");
  const zipStatusLine = document.getElementById("zip-status-line");
  const useMarketplaceLocationButton = document.getElementById("use-marketplace-location-button");

  const tierPickerEl = document.getElementById("tier-picker");
  const tierModelPopover = document.getElementById("tier-model-popover");
  const vehicles = globalThis.CarSearchHarnessVehicles || [];

  const activeFilters = {
    query: "hybrid",
    minPrice: 1500,
    maxPrice: 4000,
    minYear: 2013,
    radius: 100,
    daysListed: 7,
    exact: true,
    zip: marketplaceLocation ? marketplaceLocation.DEFAULT_ZIP : "",
    locationId: marketplaceLocation ? marketplaceLocation.DEFAULT_LOCATION_ID : "",
    locationLabel: marketplaceLocation ? marketplaceLocation.DEFAULT_LOCATION_LABEL : "",
    craigslistBaseUrl: craigslist ? craigslist.DEFAULT_CRAIGSLIST_BASE_URL : "https://wausau.craigslist.org",
  };

  const platformControlCache = {
    facebook: {
      query: "hybrid",
      radius: 100,
      minYear: 2013,
      minPrice: 1500,
      maxPrice: 4000,
    },
    craigslist: {
      query: "",
      radius: 125,
      minYear: 2005,
      minPrice: 1500,
      maxPrice: 4000,
    },
  };

  let recentZipRecords = [];
  const zipGeocodeCache = new Map();
  let zipGeocodeRequestId = 0;

  let activePlatformId = platforms.defaultPlatformId;
  let currentPlatformResult = null;
  let savedCarRecords = [];
  let savedCarListPrefs = savedCarUtils
    ? savedCarUtils.normalizeListPrefs(null)
    : { sortMode: "updated-desc", groupByState: true, favoritesOnly: false };
  let openTierId = null;
  let popoverPinned = false;
  let popoverCloseTimer = null;
  let popoverOpenTimer = null;
  const TIER_POPOVER_OPEN_DELAY_MS = 400;
  const TIER_POPOVER_SWITCH_DELAY_MS = 120;

  function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function setZipStatus(message) {
    if (zipStatusLine) {
      zipStatusLine.textContent = message;
    }
  }

  function getRadiusStatusText() {
    if (!marketplaceLocation || !Number.isFinite(activeFilters.radius)) {
      return "";
    }

    const radiusInfo = marketplaceLocation.describeFacebookRadius(activeFilters.radius);
    if (radiusInfo.displayMiles === radiusInfo.requestedMiles) {
      return ` · ${radiusInfo.displayMiles} mi radius`;
    }

    return ` · ${radiusInfo.requestedMiles} mi requested, Facebook shows ~${radiusInfo.displayMiles} mi`;
  }

  function getSavedZipEntry(zip) {
    if (!marketplaceLocation) {
      return null;
    }

    return marketplaceLocation.findRecentZip(recentZipRecords, zip);
  }

  function renderActiveLocationLabel() {
    if (!activeLocationLabelEl) {
      return;
    }

    const zip = marketplaceLocation ? marketplaceLocation.normalizeZip(activeFilters.zip) : activeFilters.zip;
    const label = activeFilters.locationLabel || "";
    const locationId = activeFilters.locationId || "";
    const radiusNote = getRadiusStatusText();

    if (zip && locationId && label) {
      activeLocationLabelEl.textContent = `Searching near ${label} (${zip})${radiusNote}`;
      return;
    }

    if (zip && locationId) {
      activeLocationLabelEl.textContent = `Searching near ZIP ${zip}${radiusNote}`;
      return;
    }

    if (zip) {
      const saved = getSavedZipEntry(zip);
      if (saved && saved.locationLabel) {
        activeLocationLabelEl.textContent = saved.locationId
          ? `Searching near ${saved.locationLabel} (${zip})${radiusNote}`
          : `Searching near ${saved.locationLabel} (${zip}) via ZIP${radiusNote}`;
        return;
      }

      if (label) {
        activeLocationLabelEl.textContent = `Searching near ${label} (${zip}) via ZIP${radiusNote}`;
        return;
      }

      activeLocationLabelEl.textContent = `Searching near ZIP ${zip}${radiusNote}`;
      return;
    }

    if (locationId && label) {
      activeLocationLabelEl.textContent = `Searching near ${label}${radiusNote}`;
      return;
    }

    activeLocationLabelEl.textContent = "Marketplace location not set yet.";
  }

  async function lookupZipGeocode(zip, options = {}) {
    if (!zipGeocode || !marketplaceLocation) {
      return null;
    }

    const normalizedZip = marketplaceLocation.normalizeZip(zip);
    if (!normalizedZip) {
      return null;
    }

    if (zipGeocodeCache.has(normalizedZip)) {
      return zipGeocodeCache.get(normalizedZip);
    }

    const saved = marketplaceLocation.findRecentZip(recentZipRecords, normalizedZip);
    if (saved && saved.locationLabel && saved.locationLabel !== normalizedZip) {
      const cached = {
        zip: normalizedZip,
        locationLabel: saved.locationLabel,
        city: "",
        state: "",
      };
      zipGeocodeCache.set(normalizedZip, cached);
      return cached;
    }

    if (options.skipNetwork) {
      return null;
    }

    try {
      const result = await zipGeocode.fetchZipGeocode(normalizedZip);
      if (result) {
        zipGeocodeCache.set(normalizedZip, result);
      }
      return result;
    } catch (error) {
      return null;
    }
  }

  async function applyZipGeocodeLabel(zip, options = {}) {
    const geocoded = await lookupZipGeocode(zip, options);
    if (!geocoded || !geocoded.locationLabel) {
      return false;
    }

    activeFilters.locationLabel = geocoded.locationLabel;
    return true;
  }

  async function applyZipLocationFromInput(options = {}) {
    if (!marketplaceLocation) {
      return { resolved: false };
    }

    const storedActiveSearch = await storage.getActiveSearch();
    const lookup = marketplaceLocation.applyZipLocationLookup(
      filterFields.zip.value,
      recentZipRecords,
      storedActiveSearch
    );

    activeFilters.zip = lookup.zip;
    activeFilters.locationId = lookup.locationId;
    activeFilters.locationLabel = lookup.locationLabel;
    if (lookup.zip) {
      filterFields.zip.value = lookup.zip;
    }

    if (lookup.zip && !lookup.locationLabel) {
      await applyZipGeocodeLabel(lookup.zip, options);
    }

    renderActiveLocationLabel();
    return {
      resolved: Boolean(lookup.zip),
      linked: Boolean(lookup.locationId),
      saved: Boolean(getSavedZipEntry(lookup.zip)),
      lookup,
    };
  }

  function renderRecentZips() {
    if (!recentZipsEl) {
      return;
    }

    const activeZip = marketplaceLocation ? marketplaceLocation.normalizeZip(activeFilters.zip) : activeFilters.zip;
    const normalized = recentZipRecords
      .map((entry) => (marketplaceLocation ? marketplaceLocation.normalizeRecentZipEntry(entry) : entry))
      .filter(Boolean);

    if (!normalized.length) {
      recentZipsEl.innerHTML = '<span class="chip is-muted">Recent ZIPs appear after you search or sync a location.</span>';
      return;
    }

    recentZipsEl.innerHTML = normalized
      .map((entry) => {
        const chipLabel = marketplaceLocation
          ? marketplaceLocation.formatRecentZipChipLabel(entry)
          : entry.zip;
        const isActive = entry.zip === activeZip ? " is-active" : "";
        return `<button class="chip chip-button${isActive}" type="button" data-zip="${escapeHtml(entry.zip)}" title="${escapeHtml(entry.locationLabel || entry.zip)}">${escapeHtml(chipLabel)}</button>`;
      })
      .join("");
  }

  async function persistZipState(message) {
    if (!marketplaceLocation) {
      return;
    }

    const activeSearch = marketplaceLocation.normalizeActiveSearch(
      {
        zip: activeFilters.zip,
        locationId: activeFilters.locationId,
        locationLabel: activeFilters.locationLabel,
      },
      { allowDefaults: false }
    );

    if (craigslist) {
      activeSearch.craigslistBaseUrl = craigslist.normalizeCraigslistBaseUrl(activeFilters.craigslistBaseUrl);
    }

    activeFilters.zip = activeSearch.zip || activeFilters.zip;
    activeFilters.locationId = activeSearch.locationId;
    activeFilters.locationLabel = activeSearch.locationLabel;
    if (activeSearch.zip) {
      filterFields.zip.value = activeSearch.zip;
    }
    if (activeSearch.craigslistBaseUrl) {
      activeFilters.craigslistBaseUrl = activeSearch.craigslistBaseUrl;
      if (filterFields.craigslistBaseUrl) {
        filterFields.craigslistBaseUrl.value = activeSearch.craigslistBaseUrl;
      }
    }

    await storage.setActiveSearch(activeSearch);
    await storage.setRecentZips(recentZipRecords);
    renderActiveLocationLabel();
    renderRecentZips();
    renderPlatformResult();

    if (message) {
      setZipStatus(message);
    }
  }

  function applyZipSelection(zip, locationId, locationLabel) {
    const normalizedZip = marketplaceLocation ? marketplaceLocation.normalizeZip(zip) : zip;
    if (!normalizedZip) {
      setZipStatus("Enter a valid 5-digit ZIP.");
      return false;
    }

    activeFilters.zip = normalizedZip;
    filterFields.zip.value = normalizedZip;

    if (marketplaceLocation && marketplaceLocation.isValidLocationId(locationId)) {
      activeFilters.locationId = locationId;
      activeFilters.locationLabel = locationLabel || normalizedZip;
    }

    return true;
  }

  function rememberCurrentZipLocation() {
    if (!marketplaceLocation) {
      return recentZipRecords;
    }

    const zip = marketplaceLocation.normalizeZip(activeFilters.zip);
    if (!zip) {
      return recentZipRecords;
    }

    recentZipRecords = marketplaceLocation.upsertRecentZip(recentZipRecords, {
      zip,
      locationId: activeFilters.locationId || "",
      locationLabel: activeFilters.locationLabel || zip,
    });
    return recentZipRecords;
  }

  function applyMarketplaceContext(context) {
    if (!context) {
      return;
    }

    if (context.locationId) {
      activeFilters.locationId = context.locationId;
    }
    if (context.locationLabel) {
      activeFilters.locationLabel = context.locationLabel;
    }
    if (Number.isFinite(context.radiusMiles) && context.radiusMiles > 0) {
      activeFilters.radius = context.radiusMiles;
      filterFields.radius.value = String(context.radiusMiles);
    }
  }

  async function resolveLocationForActiveZip(options = {}) {
    if (!marketplaceLocation) {
      return { resolved: false };
    }

    const zip = marketplaceLocation.normalizeZip(filterFields.zip.value);
    if (!zip) {
      return { resolved: false };
    }

    activeFilters.zip = zip;
    filterFields.zip.value = zip;

    const lookup = marketplaceLocation.applyZipLocationLookup(zip, recentZipRecords, await storage.getActiveSearch());
    activeFilters.zip = lookup.zip;
    activeFilters.locationId = lookup.locationId || "";
    activeFilters.locationLabel = lookup.locationLabel || "";

    if (!activeFilters.locationLabel) {
      await applyZipGeocodeLabel(zip);
    }

    if (activeFilters.locationId) {
      return {
        resolved: true,
        source: marketplaceLocation.findRecentZip(recentZipRecords, zip) ? "recent" : "stored",
        linked: true,
      };
    }

    if (options.preferMarketplaceTab) {
      try {
        const context = await chrome.runtime.sendMessage({ type: "GET_MARKETPLACE_SEARCH_CONTEXT" });
        if (context && context.locationId) {
          applyZipSelection(context.zip || zip, context.locationId, context.locationLabel);
          applyMarketplaceContext(context);
          return { resolved: true, source: context.status || "marketplace_tab", linked: true };
        }
      } catch (error) {
        // unresolved
      }
    }

    if (activeFilters.locationLabel) {
      return { resolved: true, source: "zip", linked: false };
    }

    return { resolved: false };
  }

  async function syncLocationFromMarketplace() {
    if (!marketplaceLocation) {
      setZipStatus("Location helpers are unavailable. Reload the extension.");
      return;
    }

    useMarketplaceLocationButton.disabled = true;
    setZipStatus("Reading Marketplace location...");

    try {
      const zip = marketplaceLocation.normalizeZip(filterFields.zip.value) || activeFilters.zip;
      const response = await chrome.runtime.sendMessage({
        type: "SYNC_MARKETPLACE_LOCATION",
        zip,
      });

      if (!response || response.status !== "ok") {
        throw new Error(response?.message || "Could not read Marketplace location.");
      }

      applyZipSelection(response.zip, response.locationId, response.locationLabel);
      applyMarketplaceContext(response);
      rememberCurrentZipLocation();
      const radiusNote = Number.isFinite(activeFilters.radius) ? ` · ${activeFilters.radius} mi radius` : "";
      await persistZipState(`Linked ZIP ${response.zip} to ${response.locationLabel}${radiusNote}.`);
    } catch (error) {
      setZipStatus(error.message || "Could not sync Marketplace location.");
    } finally {
      useMarketplaceLocationButton.disabled = false;
    }
  }

  async function loadZipState() {
    if (!marketplaceLocation) {
      return;
    }

    const [storedActiveSearch, storedRecentZips] = await Promise.all([
      storage.getActiveSearch(),
      storage.getRecentZips(),
    ]);

    recentZipRecords = Array.isArray(storedRecentZips)
      ? storedRecentZips.map((entry) => marketplaceLocation.normalizeRecentZipEntry(entry)).filter(Boolean)
      : [];

    const lookup = marketplaceLocation.applyZipLocationLookup(
      storedActiveSearch && storedActiveSearch.zip ? storedActiveSearch.zip : marketplaceLocation.DEFAULT_ZIP,
      recentZipRecords,
      storedActiveSearch
    );

    if (!lookup.zip) {
      lookup.zip = marketplaceLocation.DEFAULT_ZIP;
    }

    activeFilters.zip = lookup.zip;
    activeFilters.locationId = lookup.locationId || "";
    activeFilters.locationLabel = lookup.locationLabel || "";
    filterFields.zip.value = lookup.zip;

    if (lookup.zip && !lookup.locationLabel) {
      await applyZipGeocodeLabel(lookup.zip, { skipNetwork: false });
    }

    if (storedActiveSearch && craigslist && storedActiveSearch.craigslistBaseUrl) {
      activeFilters.craigslistBaseUrl = craigslist.normalizeCraigslistBaseUrl(storedActiveSearch.craigslistBaseUrl);
      if (filterFields.craigslistBaseUrl) {
        filterFields.craigslistBaseUrl.value = activeFilters.craigslistBaseUrl;
      }
    }

    renderActiveLocationLabel();
    renderRecentZips();
  }

  function isSearchablePlatform(platformId) {
    if (platforms && typeof platforms.isSearchablePlatform === "function") {
      return platforms.isSearchablePlatform(platformId);
    }
    return platformId === platforms.defaultPlatformId;
  }

  function rememberPlatformControls(platformId) {
    syncFiltersFromControls();
    platformControlCache[platformId] = {
      query: activeFilters.query,
      radius: activeFilters.radius,
      minYear: activeFilters.minYear,
      minPrice: activeFilters.minPrice,
      maxPrice: activeFilters.maxPrice,
    };
  }

  function applyPlatformControls(platformId) {
    const defaults =
      platformId === "craigslist"
        ? platformControlCache.craigslist
        : platformControlCache.facebook;
    const cached = platformControlCache[platformId] || defaults;

    filterFields.query.value = cached.query;
    filterFields.radius.value = String(cached.radius);
    filterFields.minYear.value = String(cached.minYear);
    filterFields.minPrice.value = String(cached.minPrice);
    filterFields.maxPrice.value = String(cached.maxPrice);

    activeFilters.query = cached.query;
    activeFilters.radius = cached.radius;
    activeFilters.minYear = cached.minYear;
    activeFilters.minPrice = cached.minPrice;
    activeFilters.maxPrice = cached.maxPrice;
  }

  function updatePlatformControlsVisibility() {
    const isFacebook = activePlatformId === "facebook";
    const isCraigslist = activePlatformId === "craigslist";

    document.querySelectorAll("[data-platform-field]").forEach((element) => {
      const scope = element.dataset.platformField;
      const visible = scope === "facebook" ? isFacebook : scope === "craigslist" ? isCraigslist : true;
      element.hidden = !visible;
    });

    if (useMarketplaceLocationButton) {
      useMarketplaceLocationButton.hidden = !isFacebook;
    }

    if (searchQueryLabelEl) {
      searchQueryLabelEl.textContent = isCraigslist ? "Optional keyword" : "Query / model";
    }

    if (filterFields.query) {
      filterFields.query.placeholder = isCraigslist
        ? "Leave blank for exclusions only"
        : "e.g. hybrid";
    }
  }

  function syncFiltersFromControls() {
    activeFilters.query = filterFields.query.value.trim();
    activeFilters.minPrice = positiveNumber(filterFields.minPrice.value, 1500);
    activeFilters.maxPrice = positiveNumber(filterFields.maxPrice.value, 4000);
    activeFilters.minYear = positiveNumber(filterFields.minYear.value, 2013);
    activeFilters.radius = positiveNumber(filterFields.radius.value, 100);
    activeFilters.daysListed = positiveNumber(filterFields.daysListed.value, 7);
    activeFilters.exact = filterFields.exact.checked;
    if (marketplaceLocation) {
      activeFilters.zip = marketplaceLocation.normalizeZip(filterFields.zip.value) || activeFilters.zip;
    } else {
      activeFilters.zip = filterFields.zip.value.trim();
    }
    if (filterFields.craigslistBaseUrl && craigslist) {
      activeFilters.craigslistBaseUrl =
        craigslist.normalizeCraigslistBaseUrl(filterFields.craigslistBaseUrl.value) ||
        activeFilters.craigslistBaseUrl;
      filterFields.craigslistBaseUrl.value = activeFilters.craigslistBaseUrl;
    }
    if (platformControlCache[activePlatformId]) {
      platformControlCache[activePlatformId] = {
        query: activeFilters.query,
        radius: activeFilters.radius,
        minYear: activeFilters.minYear,
        minPrice: activeFilters.minPrice,
        maxPrice: activeFilters.maxPrice,
      };
    }
  }

  function renderPlatformResult() {
    syncFiltersFromControls();
    const platform = platforms.platformRegistry[activePlatformId];
    const result = platform.buildSearchUrl(activeFilters);
    currentPlatformResult = result;

    if (result.status !== "ok") {
      resultBox.textContent = `${platform.label}: ${result.status}${result.message ? ` — ${result.message}` : ""}`;
    } else if (activePlatformId === "craigslist") {
      const lines = [result.url, ""];
      lines.push(`Site: ${result.baseUrl}`);
      lines.push(`ZIP: ${result.postal} · Radius: ${result.searchDistance} mi`);
      lines.push(
        `Price/year in URL: $${result.minPrice}-$${result.maxPrice}, min_auto_year=${result.minAutoYear}`
      );
      lines.push(
        `Keyword: ${result.positiveKeyword || "(none)"} · Exclusions in URL: ${result.exclusionCount}/${result.exclusionMaxTerms || result.exclusionCount}`
      );
      if (result.exclusionTruncatedCount > 0) {
        lines.push(`Note: ${result.exclusionTruncatedCount} exclusions omitted — Craigslist query limit is ~${result.exclusionMaxTerms} terms.`);
      }
      resultBox.textContent = lines.join("\n");
    } else {
      const lines = [result.url, ""];
      if (activeFilters.zip) {
        const locationNote = activeFilters.locationLabel
          ? `${activeFilters.locationLabel} (${activeFilters.zip})`
          : `ZIP ${activeFilters.zip}`;
        if (activeFilters.locationId) {
          lines.push(`Location: ${locationNote} · Facebook id ${activeFilters.locationId}`);
        } else {
          lines.push(`Location: ${locationNote} via zip= query param`);
        }
      }
      if (Number.isFinite(result.requestedRadiusMiles) && Number.isFinite(result.effectiveRadiusMiles)) {
        lines.push(
          `Radius: ${result.requestedRadiusMiles} mi in controls → radius=${result.radiusParam} in URL → Facebook shows ~${result.effectiveRadiusMiles} mi`
        );
      }
      lines.push(
        `Filters in URL: query=${activeFilters.query || "(empty)"}, $${activeFilters.minPrice}-$${activeFilters.maxPrice}, minYear=${activeFilters.minYear}, days=${activeFilters.daysListed}, exact=${activeFilters.exact}`
      );
      resultBox.textContent = lines.join("\n");
    }

    const searchable = isSearchablePlatform(activePlatformId);
    searchButton.disabled = result.status !== "ok" || !searchable;
    searchButton.textContent = searchable ? `Search ${platform.label}` : `${platform.label} not implemented`;
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

  function clearPopoverCloseTimer() {
    if (popoverCloseTimer) {
      clearTimeout(popoverCloseTimer);
      popoverCloseTimer = null;
    }
  }

  function clearPopoverOpenTimer() {
    if (popoverOpenTimer) {
      clearTimeout(popoverOpenTimer);
      popoverOpenTimer = null;
    }
  }

  function clearPopoverTimer() {
    clearPopoverCloseTimer();
    clearPopoverOpenTimer();
  }

  function schedulePopoverOpen(tierId, buttonEl) {
    clearPopoverOpenTimer();
    const delay = tierModelPopover.hidden ? TIER_POPOVER_OPEN_DELAY_MS : TIER_POPOVER_SWITCH_DELAY_MS;
    popoverOpenTimer = setTimeout(() => {
      popoverOpenTimer = null;
      openTierPopover(tierId, buttonEl, popoverPinned);
    }, delay);
  }

  function schedulePopoverClose() {
    clearPopoverCloseTimer();
    clearPopoverOpenTimer();
    popoverCloseTimer = setTimeout(() => {
      if (!popoverPinned) {
        closeTierPopover();
      }
    }, 280);
  }

  function positionTierPopover(buttonEl) {
    const rect = buttonEl.getBoundingClientRect();
    const popWidth = Math.min(340, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popWidth - 8));
    tierModelPopover.style.top = (rect.bottom + 4) + "px";
    tierModelPopover.style.left = left + "px";
    tierModelPopover.style.width = popWidth + "px";
  }

  function openTierPopover(tierId, buttonEl, pin) {
    clearPopoverTimer();
    const tier = vehicles.find((t) => t.id === tierId);
    if (!tier) {
      return;
    }
    openTierId = tierId;
    popoverPinned = pin;

    const groupsHtml = tier.groups
      .map((group) => {
        const chipsHtml = group.models
          .map((model) => {
            const tagsHtml = (model.tags || [])
              .map((tag) => `<span class="tier-model-tag">${escapeHtml(tag)}</span>`)
              .join("");
            return `<button class="tier-model-chip" type="button" data-model-name="${escapeHtml(model.name)}" data-tier-id="${escapeHtml(tierId)}">${escapeHtml(model.name)}${tagsHtml ? `<span class="tier-model-tags">${tagsHtml}</span>` : ""}</button>`;
          })
          .join("");
        return `<div class="tier-model-popover__group"><div class="tier-model-popover__group-label">${escapeHtml(group.label)}</div><div class="tier-model-chips">${chipsHtml}</div></div>`;
      })
      .join("");

    tierModelPopover.innerHTML = `<div class="tier-model-popover__header"><div class="tier-model-popover__tier-label">${escapeHtml(tier.label)}</div><p class="tier-model-popover__tier-desc">${escapeHtml(tier.description)}</p></div>${groupsHtml}`;
    positionTierPopover(buttonEl);
    tierModelPopover.hidden = false;

    tierPickerEl.querySelectorAll(".tier-picker-button").forEach((btn) => {
      const isActive = btn.dataset.tierId === tierId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  }

  function closeTierPopover() {
    clearPopoverTimer();
    tierModelPopover.hidden = true;
    tierModelPopover.innerHTML = "";
    openTierId = null;
    popoverPinned = false;
    tierPickerEl.querySelectorAll(".tier-picker-button").forEach((btn) => {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-pressed", "false");
    });
  }

  function renderTierPicker() {
    if (!vehicles.length) {
      tierPickerEl.innerHTML = '<p class="status-line">No vehicle data.</p>';
      return;
    }
    tierPickerEl.innerHTML = vehicles
      .map((tier) => {
        const shortLabel = tier.label.split(" - ")[0].trim();
        return `<button class="tier-picker-button" type="button" data-tier-id="${escapeHtml(tier.id)}" aria-pressed="false" title="${escapeHtml(tier.description)}">${escapeHtml(shortLabel)}<span class="tier-picker-button__year">${escapeHtml(String(tier.minYear))}+</span></button>`;
      })
      .join("");

    tierPickerEl.querySelectorAll(".tier-picker-button").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        clearPopoverCloseTimer();
        schedulePopoverOpen(btn.dataset.tierId, btn);
      });
      btn.addEventListener("mouseleave", schedulePopoverClose);
      btn.addEventListener("click", () => {
        clearPopoverTimer();
        if (popoverPinned && openTierId === btn.dataset.tierId) {
          closeTierPopover();
        } else {
          openTierPopover(btn.dataset.tierId, btn, true);
        }
      });
    });
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
    } else if (options.readerAttempted) {
      // Distinguish partial reader success (per tranche guidance)
      const car = carResult.value;
      const hasSomeReaderFields = Boolean(car.price || car.location || car.sellerName || car.mileage);
      if (hasSomeReaderFields) {
        const missing = ["price", "location", "sellerName", "mileage"].filter((f) => !car[f]).join(", ");
        message = missing
          ? `Reader found partial listing details — missing ${missing}.`
          : `Saved with reader details: ${car.title}.`;
      } else if (options.readerMessage) {
        message = `Saved URL only. ${options.readerMessage}`;
      } else {
        message = `Saved URL only: ${car.title}.`;
      }
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
        setCaptureStatus("Capture needs a listing URL. Paste a Marketplace or Craigslist listing URL.");
        return;
      }

      if (findSavedCarByUrl(capture.url)) {
        setCaptureStatus("Already saved.");
        return;
      }

      const isUrlOnly = captureParser.isUrlOnlyCapture(rawText, capture);
      const missingFields = getMissingCaptureFields(capture);
      const isCraigslistListing =
        craigslist && typeof craigslist.isCraigslistListingUrl === "function" && craigslist.isCraigslistListingUrl(capture.url);
      const isFacebookListing =
        listingReader && typeof listingReader.isFacebookMarketplaceListingUrl === "function" &&
        listingReader.isFacebookMarketplaceListingUrl(capture.url);
      const canExtract =
        capture.url &&
        missingFields.length &&
        listingExtractor &&
        (isFacebookListing || isCraigslistListing);

      let finalCapture = { ...capture, title: capture.title || capture.url };

      if (canExtract) {
        setCaptureStatus("Opening listing to read details...");
        try {
          const response = await chrome.runtime.sendMessage({
            type: "OPEN_AND_EXTRACT_LISTING",
            url: capture.url,
            active: false,
            keepTab: false,
          });
          if (response && response.status === "ok" && response.bodyText) {
            const extracted = listingExtractor.extractFieldsFromText(response.bodyText, {
              pageTitle: response.pageTitle,
              ogTitle: response.ogTitle,
              ogDescription: response.ogDescription,
              ogImage: response.ogImage,
            });
            finalCapture = mergeCaptureWithReader(capture, extracted, response.title || capture.url);
          }
        } catch (error) {
          // fall through to URL-only save
        }
      }

      const gotFields = listingExtractor && listingExtractor.hasUsefulFields(finalCapture);
      const saveResult = await saveCaptureAsCar(finalCapture, {
        isUrlOnly: isUrlOnly && !gotFields,
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
      // Use accurate partial language when the reader contributed data
      const prefix = (car.readStatus === "partial" || car.readStatus === "ok")
        ? "Reader found partial listing details"
        : "Saved URL only";
      return `${prefix} - missing ${missingFields.join(", ")}`;
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

  function getVisibleSavedCars() {
    let cars = [...savedCarRecords];
    if (savedCarListPrefs.favoritesOnly) {
      cars = cars.filter((car) => car.favorite);
    }
    if (savedCarUtils) {
      return savedCarUtils.sortSavedCars(cars, savedCarListPrefs.sortMode);
    }
    return cars;
  }

  function renderSavedCarCard(car) {
    const meta = formatTimestamp(car.updatedAt);
    const incompleteNote = getIncompleteSavedCarNote(car);
    const sourceNote = getSavedCarSourceNote(car);
    const readerNote = getReaderNote(car);
    const displayYear = car.year || (savedCarUtils ? String(savedCarUtils.resolveCarYear(car) || "") : "");
    const extraFacts = [displayYear, car.transmission, car.fuelType, car.statusHint]
      .filter(Boolean)
      .map((fact) => `<div class="saved-car-card__detail saved-car-card__detail--muted">${escapeHtml(fact)}</div>`)
      .join("");
    const favoriteClass = car.favorite ? " is-active" : "";
    const favoriteLabel = car.favorite ? "Remove from favorites" : "Add to favorites";

    return `
      <article class="saved-car-card" data-saved-car-id="${escapeHtml(car.id)}">
        <div class="saved-car-card__header">
          <div class="saved-car-card__title">${escapeHtml(car.title)}</div>
          <button
            class="saved-car-card__favorite${favoriteClass}"
            type="button"
            data-action="favorite"
            data-id="${escapeHtml(car.id)}"
            aria-pressed="${car.favorite ? "true" : "false"}"
            title="${escapeHtml(favoriteLabel)}"
            aria-label="${escapeHtml(favoriteLabel)}"
          >${car.favorite ? "★" : "☆"}</button>
        </div>
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
  }

  function renderSavedCars() {
    if (!savedCarRecords.length) {
      savedCarList.innerHTML = '<p class="saved-cars-empty">No saved cars yet. Add a listing URL to start the extension shortlist.</p>';
      return;
    }

    const visibleCars = getVisibleSavedCars();
    if (!visibleCars.length) {
      savedCarList.innerHTML = '<p class="saved-cars-empty">No favorite cars yet. Star a listing to see it here.</p>';
      return;
    }

    if (savedCarListPrefs.groupByState && savedCarUtils) {
      const groups = savedCarUtils.groupCarsByState(visibleCars);
      savedCarList.innerHTML = groups
        .map((group) => {
          const cards = group.cars.map((car) => renderSavedCarCard(car)).join("");
          return `
            <section class="saved-cars-state-group">
              <h3 class="saved-cars-state-group__header">${escapeHtml(group.state)} (${group.cars.length})</h3>
              ${cards}
            </section>
          `;
        })
        .join("");
      return;
    }

    savedCarList.innerHTML = visibleCars.map((car) => renderSavedCarCard(car)).join("");
  }

  function syncSavedCarListControls() {
    if (savedCarsSortSelect) {
      savedCarsSortSelect.value = savedCarListPrefs.sortMode;
    }
    if (savedCarsGroupByStateToggle) {
      savedCarsGroupByStateToggle.checked = savedCarListPrefs.groupByState;
    }
    if (savedCarsFavoritesOnlyToggle) {
      savedCarsFavoritesOnlyToggle.checked = savedCarListPrefs.favoritesOnly;
    }
  }

  async function persistSavedCarListPrefs() {
    if (!storage.setSavedCarListPrefs) {
      return;
    }

    const normalized = savedCarUtils
      ? savedCarUtils.normalizeListPrefs(savedCarListPrefs)
      : savedCarListPrefs;
    savedCarListPrefs = normalized;
    await storage.setSavedCarListPrefs(normalized);
    syncSavedCarListControls();
    renderSavedCars();
  }

  async function loadSavedCarListPrefs() {
    if (!storage.getSavedCarListPrefs || !savedCarUtils) {
      syncSavedCarListControls();
      return;
    }

    const stored = await storage.getSavedCarListPrefs();
    savedCarListPrefs = savedCarUtils.normalizeListPrefs(stored);
    syncSavedCarListControls();
  }

  async function toggleSavedCarFavorite(id) {
    const car = savedCarRecords.find((savedCar) => savedCar.id === id);
    if (!car) {
      return;
    }

    const updateResult = savedCars.updateSavedCar(car, { favorite: !car.favorite });
    if (updateResult.error) {
      setSavedCarStatus(updateResult.error);
      return;
    }

    savedCarRecords = savedCarRecords.map((savedCar) => (savedCar.id === id ? updateResult.value : savedCar));
    await persistSavedCars(updateResult.value.favorite ? `Starred ${updateResult.value.title}.` : `Unstarred ${updateResult.value.title}.`);
  }

  async function persistSavedCars(message) {
    await storage.setSavedCars(savedCarRecords);
    renderSavedCars();
    setSavedCarStatus(message);
  }

  function exportBackup() {
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        source: "car-search-harness",
        cars: savedCarRecords,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `car-shopping-saved-cars-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSavedCarStatus("Backup exported. Keep the file in a safe place (e.g. OneDrive) to survive reinstalls.");
    } catch (err) {
      setSavedCarStatus("Export failed: " + (err.message || err));
    }
  }

  function carsFromBackupPayload(parsed) {
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.cars)) {
      return parsed.cars;
    }
    throw new Error("Unrecognized backup format (expected array or {cars: [...]})");
  }

  async function mergeCarsFromBackupPayload(parsed, options) {
    const imported = carsFromBackupPayload(parsed);
    const existingNormUrls = new Set(
      savedCarRecords
        .map((c) => savedCars.normalizeSavedCarUrl(c.url))
        .filter(Boolean)
    );

    let added = 0;
    for (const raw of imported) {
      const norm = savedCars.normalizeStoredSavedCar(raw);
      if (!norm) continue;
      const normUrl = savedCars.normalizeSavedCarUrl(norm.url);
      if (!normUrl || existingNormUrls.has(normUrl)) continue;

      savedCarRecords.push(norm);
      existingNormUrls.add(normUrl);
      added++;
    }

    const successMessage =
      options && options.successMessage
        ? options.successMessage(added)
        : `Imported ${added} new car(s) from backup (duplicates skipped).`;
    const emptyMessage =
      options && options.emptyMessage
        ? options.emptyMessage
        : "Import complete — no new cars added (all were duplicates or invalid).";

    if (added > 0) {
      await persistSavedCars(successMessage);
    } else {
      setSavedCarStatus(emptyMessage);
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      await mergeCarsFromBackupPayload(parsed);
    } catch (err) {
      setSavedCarStatus("Import failed: " + (err.message || "could not read file"));
    } finally {
      event.target.value = "";
    }
  }

  // --- Repository Folder ---
  // Chrome/Edge: File System Access API with a persisted directory handle (IndexedDB).
  // Firefox: folder/file pickers only (no showDirectoryPicker in extension sidebars).

  const REPO_DB_NAME = "carSearchHarnessRepo";
  const REPO_STORE_NAME = "handles";
  const REPO_HANDLE_KEY = "repoDir";
  const REPO_BACKUP_FILENAME = "car-shopping-saved-cars.json";
  const REPO_FOLDER_LABEL_KEY = "carShopping.extension.repoFolderLabel.v1";
  const supportsDirectoryPicker = typeof window.showDirectoryPicker === "function";
  let currentRepoHandle = null;

  function openRepoDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(REPO_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(REPO_STORE_NAME)) {
          db.createObjectStore(REPO_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveRepoHandle(handle) {
    const db = await openRepoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REPO_STORE_NAME, 'readwrite');
      const store = tx.objectStore(REPO_STORE_NAME);
      const req = store.put(handle, REPO_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadRepoHandle() {
    const db = await openRepoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REPO_STORE_NAME, 'readonly');
      const store = tx.objectStore(REPO_STORE_NAME);
      const req = store.get(REPO_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function verifyRepoPermission(handle) {
    if (!handle) return false;
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  async function readRepoFolderLabel() {
    const result = await chrome.storage.local.get(REPO_FOLDER_LABEL_KEY);
    return result[REPO_FOLDER_LABEL_KEY] || "";
  }

  async function persistRepoFolderLabel(label) {
    await chrome.storage.local.set({ [REPO_FOLDER_LABEL_KEY]: label });
  }

  function findRepoBackupFile(files) {
    if (!files || !files.length) {
      return null;
    }

    const target = REPO_BACKUP_FILENAME.toLowerCase();
    for (const file of files) {
      const relativePath = (file.webkitRelativePath || file.name || "").toLowerCase();
      if (
        relativePath === target ||
        relativePath.endsWith("/" + target) ||
        file.name.toLowerCase() === target
      ) {
        return file;
      }
    }

    return null;
  }

  function folderLabelFromFileList(files) {
    const first = files && files[0];
    if (!first || !first.webkitRelativePath) {
      return "linked folder";
    }

    return first.webkitRelativePath.split("/")[0] || "linked folder";
  }

  async function loadCarsFromRepoFile(file) {
    const parsed = JSON.parse(await file.text());
    await mergeCarsFromBackupPayload(parsed, {
      successMessage: (added) => `Loaded ${added} new car(s) from repository (duplicates skipped).`,
      emptyMessage: "Loaded from repo — no new cars added.",
    });
  }

  async function handleRepoFolderInput(event) {
    const files = event.target.files;
    if (!files || !files.length) {
      return;
    }

    const label = folderLabelFromFileList(files);
    await persistRepoFolderLabel(label);
    await updateRepoStatus();

    const backupFile = findRepoBackupFile(files);
    if (backupFile) {
      try {
        await loadCarsFromRepoFile(backupFile);
      } catch (err) {
        setSavedCarStatus("Load from repo failed: " + (err.message || "invalid JSON"));
      }
    } else {
      setSavedCarStatus(
        `Repository folder linked (${label}). Save to Repo downloads ${REPO_BACKUP_FILENAME} — copy it into this folder.`
      );
    }

    event.target.value = "";
  }

  async function updateRepoStatus() {
    if (!repoStatusEl) return;
    try {
      const handle = currentRepoHandle || (await loadRepoHandle());
      if (handle) {
        const perm = await handle.queryPermission({ mode: "readwrite" });
        if (perm === "granted") {
          currentRepoHandle = handle;
          repoStatusEl.textContent = `Repo: ${handle.name || "linked folder"}`;
          return;
        }
      }

      const folderLabel = await readRepoFolderLabel();
      if (folderLabel) {
        repoStatusEl.textContent = supportsDirectoryPicker
          ? `Repo: ${folderLabel}`
          : `Repo: ${folderLabel} (re-pick folder to load)`;
        return;
      }

      repoStatusEl.textContent = supportsDirectoryPicker
        ? "No repo folder linked"
        : "No repo folder linked (Firefox: use folder picker)";
    } catch (e) {
      repoStatusEl.textContent = "Repo link needs attention";
    }
  }

  async function chooseRepoFolder() {
    if (!supportsDirectoryPicker) {
      if (repoFolderInput) {
        repoFolderInput.click();
      } else {
        setSavedCarStatus("Folder linking is unavailable in this browser. Use Import Backup instead.");
      }
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      if (await verifyRepoPermission(dirHandle)) {
        await saveRepoHandle(dirHandle);
        currentRepoHandle = dirHandle;
        await persistRepoFolderLabel(dirHandle.name || "linked folder");
        await updateRepoStatus();
        setSavedCarStatus("Repository folder linked. Use Save/Load to keep cars durable on disk/OneDrive.");
      } else {
        setSavedCarStatus("Write permission not granted to the folder.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setSavedCarStatus("Could not link folder: " + (err.message || err));
      }
    }
  }

  function buildRepoBackupPayload() {
    return {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      source: "car-search-harness",
      cars: savedCarRecords,
    };
  }

  async function downloadRepoBackupFile() {
    const backup = buildRepoBackupPayload();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = REPO_BACKUP_FILENAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function saveToRepo() {
    let handle = currentRepoHandle || (await loadRepoHandle());
    if (!handle || !supportsDirectoryPicker) {
      const folderLabel = await readRepoFolderLabel();
      try {
        await downloadRepoBackupFile();
        if (folderLabel) {
          setSavedCarStatus(
            `Downloaded ${REPO_BACKUP_FILENAME}. Copy it into your linked folder: ${folderLabel}`
          );
        } else {
          setSavedCarStatus(
            `Downloaded ${REPO_BACKUP_FILENAME}. Link a folder first, then copy the file there (or use Export Backup).`
          );
        }
      } catch (err) {
        setSavedCarStatus("Save to repo failed: " + (err.message || err));
      }
      return;
    }

    if (!await verifyRepoPermission(handle)) {
      setSavedCarStatus("Permission needed to write to the repository folder.");
      return;
    }

    try {
      const fileHandle = await handle.getFileHandle(REPO_BACKUP_FILENAME, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(buildRepoBackupPayload(), null, 2));
      await writable.close();
      setSavedCarStatus(`Saved current cars to ${REPO_BACKUP_FILENAME} in the linked folder.`);
    } catch (e) {
      setSavedCarStatus("Save to repo failed: " + (e.message || e));
    }
  }

  async function loadFromRepo() {
    let handle = currentRepoHandle || (await loadRepoHandle());
    if (!handle || !supportsDirectoryPicker) {
      if (repoFolderInput) {
        repoFolderInput.click();
        return;
      }
      if (repoFileInput) {
        repoFileInput.click();
        return;
      }
      setSavedCarStatus('No repository linked yet. Click "Link Repository Folder" or use Import Backup.');
      return;
    }

    if (!await verifyRepoPermission(handle)) {
      setSavedCarStatus("Permission needed to read the repository folder.");
      return;
    }

    try {
      const fileHandle = await handle.getFileHandle(REPO_BACKUP_FILENAME);
      const file = await fileHandle.getFile();
      await loadCarsFromRepoFile(file);
    } catch (e) {
      setSavedCarStatus("Load from repo failed: " + (e.message || "no file or invalid JSON"));
    }
  }

  async function handleRepoFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      await loadCarsFromRepoFile(file);
    } catch (err) {
      setSavedCarStatus("Load from repo failed: " + (err.message || "could not read file"));
    } finally {
      event.target.value = "";
    }
  }

  async function loadSavedCars() {
    const storedCars = await storage.getSavedCars();
    let backfilledYear = false;
    savedCarRecords = storedCars
      .map((raw) => {
        const beforeYear = typeof raw.year === "string" ? raw.year.trim() : "";
        const normalized = savedCars.normalizeStoredSavedCar(raw);
        if (normalized && !beforeYear && normalized.year) {
          backfilledYear = true;
        }
        return normalized;
      })
      .filter(Boolean);

    if (backfilledYear) {
      await storage.setSavedCars(savedCarRecords);
    }

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

    const missingFields = getMissingCriticalFields(car);

    if (missingFields.length && listingExtractor) {
      setSavedCarStatus("Opening listing to read missing details...");
      try {
        const response = await chrome.runtime.sendMessage({
          type: "OPEN_AND_EXTRACT_LISTING",
          url: car.url,
          active: true,
          keepTab: true,
        });

        if (response && response.status === "ok" && response.bodyText) {
          const extracted = listingExtractor.extractFieldsFromText(response.bodyText, {
            pageTitle: response.pageTitle,
            ogTitle: response.ogTitle,
            ogDescription: response.ogDescription,
            ogImage: response.ogImage,
          });

          const updates = {};
          if (!car.price && extracted.price) updates.price = extracted.price;
          if (!car.location && extracted.location) updates.location = extracted.location;
          if (!car.sellerName && extracted.sellerName) updates.sellerName = extracted.sellerName;
          if (!car.mileage && extracted.mileage) updates.mileage = extracted.mileage;
          if (!car.transmission && extracted.transmission) updates.transmission = extracted.transmission;
          if (!car.fuelType && extracted.fuelType) updates.fuelType = extracted.fuelType;
          if (!car.description && extracted.description) updates.description = extracted.description;
          if (!car.imageUrl && extracted.imageUrl) updates.imageUrl = extracted.imageUrl;
          if ((!car.title || car.title === car.url) && (extracted.title || response.title)) {
            updates.title = extracted.title || response.title;
          }
          if (extracted.readStatus) updates.readStatus = extracted.readStatus;

          if (Object.keys(updates).length) {
            const updateResult = savedCars.updateSavedCar(car, updates);
            if (!updateResult.error) {
              savedCarRecords = savedCarRecords.map((c) => c.id === car.id ? updateResult.value : c);
              const stillMissing = getMissingCriticalFields(updateResult.value);
              const message = stillMissing.length
                ? `Opened ${updateResult.value.title} — still missing ${stillMissing.join(", ")}.`
                : `Opened and updated ${updateResult.value.title}.`;
              await persistSavedCars(message);
              return;
            }
          }
        }
      } catch (error) {
        // fall through to status-only
      }

      setSavedCarStatus(`Opened ${car.title}.`);
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
      const response = await chrome.runtime.sendMessage({ type: "EXTRACT_LISTING_FROM_TAB" });
      if (!response || response.status !== "ok" || !savedCars.isHttpUrl(response.url)) {
        setSavedCarStatus(response?.message || "Current tab cannot be saved as a car.");
        return;
      }

      if (findSavedCarByUrl(response.url)) {
        setSavedCarStatus("Already saved.");
        return;
      }

      let capture;
      if (listingExtractor && response.bodyText) {
        const extracted = listingExtractor.extractFieldsFromText(response.bodyText, {
          pageTitle: response.pageTitle,
          ogTitle: response.ogTitle,
          ogDescription: response.ogDescription,
          ogImage: response.ogImage,
        });
        capture = {
          ...extracted,
          url: response.url,
          title: extracted.title || response.title || response.url,
          sourceText: `Saved from active tab: ${response.url}`,
        };
      } else {
        capture = {
          title: response.title || response.url,
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
      }

      await saveCaptureAsCar(capture, { statusTarget: "saved" });
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

    const nextPlatformId = button.dataset.platformId;
    if (nextPlatformId === activePlatformId) {
      return;
    }

    rememberPlatformControls(activePlatformId);
    activePlatformId = nextPlatformId;
    applyPlatformControls(activePlatformId);
    renderTabs();
    updatePlatformControlsVisibility();
    renderPlatformResult();
    searchStatus.textContent = "";
  });

  Object.entries(filterFields).forEach(([fieldName, field]) => {
    field.addEventListener("input", () => {
      if (fieldName === "zip") {
        const requestId = ++zipGeocodeRequestId;
        applyZipLocationFromInput()
          .then(async (result) => {
            if (requestId !== zipGeocodeRequestId) {
              return;
            }
            if (result.lookup && result.lookup.zip && !result.lookup.locationLabel) {
              await applyZipGeocodeLabel(result.lookup.zip);
              renderActiveLocationLabel();
              renderPlatformResult();
            }
            if (result.resolved) {
              setZipStatus("");
            }
          })
          .catch(() => {});
      }
      renderPlatformResult();
    });
    field.addEventListener("change", async () => {
      if (fieldName === "zip") {
        const result = await applyZipLocationFromInput();
        if (result.linked) {
          setZipStatus(`Using linked Marketplace location: ${activeFilters.locationLabel || activeFilters.zip}.`);
        } else if (result.resolved && activeFilters.locationLabel) {
          setZipStatus(`Searching near ${activeFilters.locationLabel} via ZIP ${activeFilters.zip}.`);
        } else if (result.resolved) {
          setZipStatus(`Searching near ZIP ${activeFilters.zip}.`);
        } else {
          setZipStatus("Enter a valid 5-digit ZIP.");
        }
        renderRecentZips();
      }
      renderPlatformResult();
    });
  });

  if (useMarketplaceLocationButton) {
    useMarketplaceLocationButton.addEventListener("click", syncLocationFromMarketplace);
  }

  if (recentZipsEl) {
    recentZipsEl.addEventListener("click", async (event) => {
      const chip = event.target.closest("[data-zip]");
      if (!chip) {
        return;
      }

      const zip = chip.dataset.zip;
      const cached = marketplaceLocation ? marketplaceLocation.findRecentZip(recentZipRecords, zip) : null;
      if (!cached) {
        setZipStatus("That ZIP is no longer saved.");
        return;
      }

      applyZipSelection(cached.zip, cached.locationId, cached.locationLabel);
      await persistZipState(`Active ZIP set to ${cached.zip}.`);
    });
  }

  searchButton.addEventListener("click", async () => {
    if (!isSearchablePlatform(activePlatformId)) {
      searchStatus.textContent = "This platform does not open search tabs yet.";
      return;
    }

    searchButton.disabled = true;

    try {
      if (activePlatformId === "facebook") {
        searchStatus.textContent = "Resolving Marketplace location...";

        const resolution = await resolveLocationForActiveZip({ preferMarketplaceTab: false });
        if (!resolution.resolved) {
          throw new Error("Enter a valid 5-digit ZIP to search Facebook Marketplace.");
        }

        rememberCurrentZipLocation();
        await persistZipState("");
        renderPlatformResult();

        if (!currentPlatformResult || currentPlatformResult.status !== "ok") {
          throw new Error("Search URL could not be built.");
        }

        searchStatus.textContent = "Opening Facebook Marketplace...";
        const response = await chrome.runtime.sendMessage({
          type: "OPEN_SEARCH_TAB",
          platformId: activePlatformId,
          url: currentPlatformResult.url,
        });

        if (!response || response.status !== "ok") {
          throw new Error(response?.message || "Search tab could not be opened.");
        }

        const locationNote = activeFilters.locationLabel ? ` near ${activeFilters.locationLabel}` : "";
        searchStatus.textContent = response.reused
          ? `Updated existing Facebook search tab${locationNote}.`
          : `Opened Facebook search tab${locationNote}.`;
        return;
      }

      if (activePlatformId === "craigslist") {
        searchStatus.textContent = "Building Craigslist search...";
        syncFiltersFromControls();

        if (!activeFilters.zip) {
          throw new Error("Enter a valid 5-digit ZIP for Craigslist search.");
        }

        await persistZipState("");
        renderPlatformResult();

        if (!currentPlatformResult || currentPlatformResult.status !== "ok") {
          throw new Error(currentPlatformResult?.message || "Search URL could not be built.");
        }

        searchStatus.textContent = "Opening Craigslist...";
        const response = await chrome.runtime.sendMessage({
          type: "OPEN_SEARCH_TAB",
          platformId: activePlatformId,
          url: currentPlatformResult.url,
        });

        if (!response || response.status !== "ok") {
          throw new Error(response?.message || "Search tab could not be opened.");
        }

        const siteNote = currentPlatformResult.baseUrl ? ` on ${currentPlatformResult.baseUrl}` : "";
        searchStatus.textContent = response.reused
          ? `Updated existing Craigslist search tab${siteNote}.`
          : `Opened Craigslist search tab${siteNote}.`;
      }
    } catch (error) {
      searchStatus.textContent = error.message || "Search tab could not be opened.";
    } finally {
      renderPlatformResult();
      searchButton.disabled =
        currentPlatformResult?.status !== "ok" || !isSearchablePlatform(activePlatformId);
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

  if (exportBackupButton) {
    exportBackupButton.addEventListener("click", exportBackup);
  }
  if (importBackupButton && importFileInput) {
    importBackupButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", handleImportFile);
  }

  if (chooseRepoButton) {
    chooseRepoButton.addEventListener("click", chooseRepoFolder);
  }
  if (saveToRepoButton) {
    saveToRepoButton.addEventListener("click", saveToRepo);
  }
  if (loadFromRepoButton) {
    loadFromRepoButton.addEventListener("click", loadFromRepo);
  }
  if (repoFolderInput) {
    repoFolderInput.addEventListener("change", handleRepoFolderInput);
  }
  if (repoFileInput) {
    repoFileInput.addEventListener("change", handleRepoFileInput);
  }

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

    if (actionButton.dataset.action === "favorite") {
      await toggleSavedCarFavorite(id);
    }
  });

  if (savedCarsSortSelect) {
    savedCarsSortSelect.addEventListener("change", async () => {
      savedCarListPrefs.sortMode = savedCarsSortSelect.value;
      await persistSavedCarListPrefs();
    });
  }

  if (savedCarsGroupByStateToggle) {
    savedCarsGroupByStateToggle.addEventListener("change", async () => {
      savedCarListPrefs.groupByState = savedCarsGroupByStateToggle.checked;
      await persistSavedCarListPrefs();
    });
  }

  if (savedCarsFavoritesOnlyToggle) {
    savedCarsFavoritesOnlyToggle.addEventListener("change", async () => {
      savedCarListPrefs.favoritesOnly = savedCarsFavoritesOnlyToggle.checked;
      await persistSavedCarListPrefs();
    });
  }

  tierModelPopover.addEventListener("mouseenter", clearPopoverCloseTimer);
  tierModelPopover.addEventListener("mouseleave", schedulePopoverClose);

  tierModelPopover.addEventListener("click", (event) => {
    const chip = event.target.closest(".tier-model-chip");
    if (!chip) {
      return;
    }
    const modelName = chip.dataset.modelName;
    const tierId = chip.dataset.tierId;
    const tier = vehicles.find((t) => t.id === tierId);
    if (!tier || !modelName) {
      return;
    }
    if (activePlatformId === "facebook") {
      filterFields.query.value = modelName;
      platformControlCache.facebook.query = modelName;
      filterFields.minYear.value = String(tier.minYear);
      platformControlCache.facebook.minYear = tier.minYear;
      searchStatus.textContent = `Selected ${modelName} — ${tier.label}.`;
    } else {
      searchStatus.textContent = `${modelName} is reference only on ${platforms.platformRegistry[activePlatformId].label}. Type a keyword to search it.`;
    }
    renderPlatformResult();
    closeTierPopover();
  });

  document.addEventListener("click", (event) => {
    if (!tierModelPopover.hidden && !tierModelPopover.contains(event.target) && !tierPickerEl.contains(event.target)) {
      closeTierPopover();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !tierModelPopover.hidden) {
      closeTierPopover();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      return;
    }

    chrome.runtime
      .sendMessage({ type: "GET_MARKETPLACE_SEARCH_CONTEXT" })
      .then((context) => {
        if (!context || !context.locationId) {
          return;
        }

        const zip = marketplaceLocation ? marketplaceLocation.normalizeZip(activeFilters.zip) : "";
        if (zip) {
          const lookup = marketplaceLocation.applyZipLocationLookup(
            zip,
            recentZipRecords,
            {
              zip: activeFilters.zip,
              locationId: activeFilters.locationId,
              locationLabel: activeFilters.locationLabel,
            }
          );
          if (!lookup.locationId || lookup.locationId !== context.locationId) {
            return;
          }
        }

        applyMarketplaceContext(context);
        renderActiveLocationLabel();
        renderPlatformResult();
      })
      .catch(() => {});
  });

  renderTierPicker();
  renderTabs();
  updatePlatformControlsVisibility();
  populateStatusOptions();
  resetSavedCarForm();
  loadZipState()
    .catch((error) => {
      setZipStatus(error.message || "ZIP settings could not be loaded.");
    })
    .finally(() => {
      renderPlatformResult();
    });
  loadSavedCarListPrefs().catch(() => {
    syncSavedCarListControls();
  });
  loadSavedCars().catch((error) => {
    setSavedCarStatus(error.message || "Saved cars could not be loaded.");
    renderSavedCars();
  });
  updateRepoStatus();
})();
