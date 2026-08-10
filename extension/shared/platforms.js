(function registerPlatforms(global) {
  const marketplaceLocation = global.CarSearchHarnessMarketplaceLocation;
  const craigslist = global.CarSearchHarnessCraigslist;
  const FACEBOOK_VEHICLE_CATEGORY_ID = "546583916084032";
  const SEARCHABLE_PLATFORM_IDS = ["facebook", "craigslist"];

  function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function positiveIntegerAtLeast(value, fallback, min) {
    const parsed = Math.floor(Number(value));
    const threshold = Number.isFinite(min) ? min : 1;
    return Number.isFinite(parsed) && parsed >= threshold ? parsed : fallback;
  }

  function resolveFacebookLocationId(filters) {
    const source = filters && typeof filters === "object" ? filters : {};
    const zip = marketplaceLocation ? marketplaceLocation.normalizeZip(source.zip) : "";

    if (marketplaceLocation && marketplaceLocation.isValidLocationId(source.locationId)) {
      return String(source.locationId).trim();
    }

    // Facebook still needs a path location id; when a ZIP is set, the zip query param drives the area.
    if (zip && marketplaceLocation) {
      return marketplaceLocation.DEFAULT_LOCATION_ID;
    }

    if (marketplaceLocation) {
      return marketplaceLocation.DEFAULT_LOCATION_ID;
    }

    return "103108469729444";
  }

  function buildFacebookSearchBaseUrl(locationId) {
    if (marketplaceLocation) {
      return marketplaceLocation.buildMarketplaceSearchBase(locationId);
    }

    const id = String(locationId || "103108469729444").trim() || "103108469729444";
    return `https://www.facebook.com/marketplace/${id}/search/`;
  }

  function buildFacebookSearchUrl(filters) {
    const locationId = resolveFacebookLocationId(filters || {});
    const params = new URLSearchParams();
    params.set("query", String(filters.query || ""));
    params.set("minPrice", String(positiveNumber(filters.minPrice, 1500)));
    params.set("maxPrice", String(positiveNumber(filters.maxPrice, 4000)));
    params.set("minYear", String(positiveNumber(filters.minYear, 2013)));
    params.set("category_id", FACEBOOK_VEHICLE_CATEGORY_ID);
    const radiusMiles = positiveNumber(filters.radius, 100);
    const radiusParam = marketplaceLocation
      ? marketplaceLocation.milesToFacebookRadiusParam(radiusMiles)
      : radiusMiles;
    params.set("radius", String(radiusParam));
    params.set("daysSinceListed", String(positiveIntegerAtLeast(filters.daysListed, 7, 1)));
    params.set("sortBy", "creation_time_descend");
    params.set("exact", filters.exact === false ? "false" : "true");

    const zip = marketplaceLocation ? marketplaceLocation.normalizeZip(filters.zip) : "";
    if (zip) {
      params.set("zip", zip);
    }

    const radiusInfo = marketplaceLocation
      ? marketplaceLocation.describeFacebookRadius(radiusMiles)
      : { requestedMiles: radiusMiles, radiusParam, displayMiles: radiusMiles };

    return {
      status: "ok",
      url: `${buildFacebookSearchBaseUrl(locationId)}?${params.toString()}`,
      locationId,
      radiusParam,
      effectiveRadiusMiles: radiusInfo.displayMiles,
      requestedRadiusMiles: radiusInfo.requestedMiles,
    };
  }

  function notImplemented(platformId) {
    return {
      status: "not_implemented",
      platformId,
      url: "",
      message: "Platform URL builder is intentionally deferred in this scaffold.",
    };
  }

  const defaultPlatformId = "facebook";
  const platformRegistry = {
    facebook: {
      label: "Facebook",
      supportsZip: "partial",
      supportsRadius: "yes",
      buildSearchUrl: buildFacebookSearchUrl,
    },
    cars: {
      label: "Cars.com",
      supportsZip: "unknown",
      supportsRadius: "unknown",
      buildSearchUrl: () => notImplemented("cars"),
    },
    ebay: {
      label: "eBay",
      supportsZip: "unknown",
      supportsRadius: "unknown",
      buildSearchUrl: () => notImplemented("ebay"),
    },
    craigslist: {
      label: "Craigslist",
      supportsZip: "yes",
      supportsRadius: "yes",
      buildSearchUrl: (filters) => {
        if (!craigslist || typeof craigslist.buildCraigslistSearchUrl !== "function") {
          return notImplemented("craigslist");
        }
        return craigslist.buildCraigslistSearchUrl(filters);
      },
    },
    autotrader: {
      label: "Autotrader",
      supportsZip: "unknown",
      supportsRadius: "unknown",
      buildSearchUrl: () => notImplemented("autotrader"),
    },
  };

  global.CarSearchHarnessPlatforms = {
    defaultPlatformId,
    platformRegistry,
    searchablePlatformIds: SEARCHABLE_PLATFORM_IDS,
    isSearchablePlatform(platformId) {
      return SEARCHABLE_PLATFORM_IDS.includes(platformId);
    },
    buildFacebookSearchUrl,
  };
})(globalThis);
