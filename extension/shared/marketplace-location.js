(function registerMarketplaceLocation(global) {
  const DEFAULT_LOCATION_ID = "103108469729444";
  const DEFAULT_LOCATION_LABEL = "Fairmont, MN";
  const DEFAULT_ZIP = "56031";
  const MAX_RECENT_ZIPS = 8;
  const KM_TO_MI = 0.621371;
  const FACEBOOK_RADIUS_PARAMS_KM = [1, 2, 5, 10, 20, 40, 60, 80, 100, 250, 500];

  const marketplaceSearchPathRe = /^\/marketplace\/([^/]+)\/search\/?/i;
  const invalidLocationSegments = new Set([
    "category",
    "item",
    "you",
    "selling",
    "notifications",
    "boosted",
  ]);

  function normalizeZip(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 5) {
      return digits;
    }
    if (digits.length === 9) {
      return digits.slice(0, 5);
    }
    return "";
  }

  function isValidLocationId(value) {
    const id = String(value || "").trim();
    if (!id || invalidLocationSegments.has(id.toLowerCase())) {
      return false;
    }
    return /^[a-z0-9._-]+$/i.test(id);
  }

  function parseLocationFromMarketplaceUrl(urlValue) {
    try {
      const url = new URL(String(urlValue || "").trim());
      if (!/\.facebook\.com$/i.test(url.hostname) && url.hostname !== "facebook.com") {
        return { locationId: "", locationLabel: "" };
      }

      const match = url.pathname.match(marketplaceSearchPathRe);
      if (!match || !match[1]) {
        return { locationId: "", locationLabel: "" };
      }

      const locationId = match[1];
      if (!isValidLocationId(locationId)) {
        return { locationId: "", locationLabel: "" };
      }

      return { locationId, locationLabel: "" };
    } catch (error) {
      return { locationId: "", locationLabel: "" };
    }
  }

  function parseLocationButtonText(value) {
    const text = String(value || "").trim();
    if (!text) {
      return { locationLabel: "", radiusMiles: null };
    }

    const filterMatch = text.match(/^Location:\s*(.+),\s*Within\s*(\d+)\s*mi/i);
    if (filterMatch) {
      return {
        locationLabel: filterMatch[1].trim(),
        radiusMiles: Number(filterMatch[2]),
      };
    }

    const parts = text.split("·").map((part) => part.trim()).filter(Boolean);
    let locationLabel = "";
    let radiusMiles = null;

    for (const part of parts) {
      const radiusMatch = part.match(/^(\d+)\s*mi$/i);
      if (radiusMatch) {
        radiusMiles = Number(radiusMatch[1]);
        continue;
      }

      const withinMatch = part.match(/Within\s*(\d+)\s*mi/i);
      if (withinMatch) {
        radiusMiles = Number(withinMatch[1]);
        continue;
      }

      if (!locationLabel && !/^\d+\s*mi$/i.test(part) && !/^Within\s*\d+\s*mi$/i.test(part)) {
        locationLabel = part.replace(/^Location:\s*/i, "").trim();
      }
    }

    return { locationLabel, radiusMiles };
  }

  function describeFacebookRadius(miles) {
    const requestedMiles = Number(miles);
    if (!Number.isFinite(requestedMiles) || requestedMiles <= 0) {
      return { requestedMiles: 100, radiusParam: 100, displayMiles: 62 };
    }

    const radiusParam = milesToFacebookRadiusParam(requestedMiles);
    const displayMiles = facebookRadiusParamToMiles(radiusParam);
    return {
      requestedMiles,
      radiusParam,
      displayMiles,
    };
  }

  function parseLocationLabelFromButtonText(value) {
    return parseLocationButtonText(value).locationLabel;
  }

  function snapRadiusParamKm(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return FACEBOOK_RADIUS_PARAMS_KM[FACEBOOK_RADIUS_PARAMS_KM.length - 3];
    }

    let closest = FACEBOOK_RADIUS_PARAMS_KM[0];
    let smallestDiff = Math.abs(parsed - closest);
    for (const option of FACEBOOK_RADIUS_PARAMS_KM) {
      const diff = Math.abs(parsed - option);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closest = option;
      }
    }
    return closest;
  }

  function milesToFacebookRadiusParam(miles) {
    const parsedMiles = Number(miles);
    if (!Number.isFinite(parsedMiles) || parsedMiles <= 0) {
      return 100;
    }

    let closest = FACEBOOK_RADIUS_PARAMS_KM[0];
    let smallestDiff = Math.abs(facebookRadiusParamToMiles(closest) - parsedMiles);
    for (const option of FACEBOOK_RADIUS_PARAMS_KM) {
      const displayedMiles = facebookRadiusParamToMiles(option);
      const diff = Math.abs(displayedMiles - parsedMiles);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closest = option;
      }
    }
    return closest;
  }

  function facebookRadiusParamToMiles(param) {
    const parsed = Number(param);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 100;
    }

    return Math.round(parsed * KM_TO_MI);
  }

  function parseFiltersFromMarketplaceUrl(urlValue) {
    const result = {
      locationId: "",
      radiusParam: null,
      radiusMiles: null,
    };

    try {
      const url = new URL(String(urlValue || "").trim());
      const location = parseLocationFromMarketplaceUrl(url.href);
      result.locationId = location.locationId;

      const radiusRaw = url.searchParams.get("radius");
      if (radiusRaw !== null && radiusRaw !== "") {
        const radiusParam = snapRadiusParamKm(Number(radiusRaw));
        result.radiusParam = radiusParam;
        result.radiusMiles = facebookRadiusParamToMiles(radiusParam);
      }
    } catch (error) {
      // keep defaults
    }

    return result;
  }

  function buildMarketplaceSearchBase(locationId) {
    const id = isValidLocationId(locationId) ? locationId : DEFAULT_LOCATION_ID;
    return `https://www.facebook.com/marketplace/${id}/search/`;
  }

  function normalizeRecentZipEntry(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const zip = normalizeZip(candidate.zip);
    const locationId = isValidLocationId(candidate.locationId) ? String(candidate.locationId).trim() : "";
    const locationLabel = typeof candidate.locationLabel === "string" ? candidate.locationLabel.trim() : "";

    if (!zip) {
      return null;
    }

    return {
      zip,
      locationId,
      locationLabel: locationLabel || zip,
      lastUsedAt: typeof candidate.lastUsedAt === "string" ? candidate.lastUsedAt : new Date().toISOString(),
    };
  }

  function normalizeActiveSearch(candidate, options = {}) {
    const allowDefaults = options.allowDefaults !== false;
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const zip = normalizeZip(source.zip) || (allowDefaults ? DEFAULT_ZIP : "");
    const locationId = isValidLocationId(source.locationId)
      ? String(source.locationId).trim()
      : allowDefaults
        ? DEFAULT_LOCATION_ID
        : "";
    const locationLabel =
      typeof source.locationLabel === "string" && source.locationLabel.trim()
        ? source.locationLabel.trim()
        : allowDefaults
          ? DEFAULT_LOCATION_LABEL
          : "";

    return {
      zip,
      locationId,
      locationLabel,
    };
  }

  function applyZipLocationLookup(zip, recentZips, activeSearch) {
    const normalizedZip = normalizeZip(zip);
    if (!normalizedZip) {
      return { zip: "", locationId: "", locationLabel: "" };
    }

    const cached = findRecentZip(recentZips, normalizedZip);
    if (cached) {
      return {
        zip: normalizedZip,
        locationId: isValidLocationId(cached.locationId) ? cached.locationId : "",
        locationLabel: cached.locationLabel || normalizedZip,
      };
    }

    const stored = normalizeActiveSearch(activeSearch, { allowDefaults: false });
    if (stored.zip === normalizedZip) {
      const cached = findRecentZip(recentZips, normalizedZip);
      if (cached) {
        return {
          zip: normalizedZip,
          locationId: isValidLocationId(cached.locationId) ? cached.locationId : "",
          locationLabel: cached.locationLabel || stored.locationLabel || normalizedZip,
        };
      }

      let locationId = isValidLocationId(stored.locationId) ? stored.locationId : "";
      let locationLabel = stored.locationLabel || "";
      const looksLikeStaleDefault =
        locationId === DEFAULT_LOCATION_ID &&
        normalizedZip !== DEFAULT_ZIP &&
        (!locationLabel || locationLabel === DEFAULT_LOCATION_LABEL);

      if (looksLikeStaleDefault) {
        locationId = "";
        locationLabel = "";
      }

      return {
        zip: normalizedZip,
        locationId,
        locationLabel,
      };
    }

    return {
      zip: normalizedZip,
      locationId: "",
      locationLabel: "",
    };
  }

  function findRecentZip(recentZips, zip) {
    const normalizedZip = normalizeZip(zip);
    if (!normalizedZip || !Array.isArray(recentZips)) {
      return null;
    }

    return recentZips.find((entry) => entry && entry.zip === normalizedZip) || null;
  }

  function upsertRecentZip(recentZips, entry) {
    const normalizedEntry = normalizeRecentZipEntry(entry);
    if (!normalizedEntry) {
      return Array.isArray(recentZips) ? recentZips.slice() : [];
    }

    const next = Array.isArray(recentZips) ? recentZips.filter((item) => item && item.zip !== normalizedEntry.zip) : [];
    next.unshift({
      ...normalizedEntry,
      lastUsedAt: new Date().toISOString(),
    });

    return next.slice(0, MAX_RECENT_ZIPS);
  }

  function formatRecentZipChipLabel(entry) {
    if (!entry) {
      return "";
    }
    if (entry.locationLabel && entry.locationLabel !== entry.zip) {
      return `${entry.zip} · ${entry.locationLabel}`;
    }
    return entry.zip;
  }

  global.CarSearchHarnessMarketplaceLocation = {
    DEFAULT_LOCATION_ID,
    DEFAULT_LOCATION_LABEL,
    DEFAULT_ZIP,
    MAX_RECENT_ZIPS,
    normalizeZip,
    isValidLocationId,
    parseLocationFromMarketplaceUrl,
    parseLocationLabelFromButtonText,
    parseLocationButtonText,
    describeFacebookRadius,
    snapRadiusParamKm,
    milesToFacebookRadiusParam,
    facebookRadiusParamToMiles,
    parseFiltersFromMarketplaceUrl,
    buildMarketplaceSearchBase,
    normalizeRecentZipEntry,
    normalizeActiveSearch,
    applyZipLocationLookup,
    findRecentZip,
    upsertRecentZip,
    formatRecentZipChipLabel,
  };
})(globalThis);