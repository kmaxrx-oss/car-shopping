(function registerPlatforms(global) {
  const FACEBOOK_BASE_URL = "https://www.facebook.com/marketplace/103108469729444/search/";
  const FACEBOOK_VEHICLE_CATEGORY_ID = "546583916084032";

  function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function buildFacebookSearchUrl(filters) {
    const params = new URLSearchParams();
    params.set("query", String(filters.query || ""));
    params.set("minPrice", String(positiveNumber(filters.minPrice, 1500)));
    params.set("maxPrice", String(positiveNumber(filters.maxPrice, 4000)));
    params.set("minYear", String(positiveNumber(filters.minYear, 2013)));
    params.set("category_id", FACEBOOK_VEHICLE_CATEGORY_ID);
    params.set("radius", String(positiveNumber(filters.radius, 100)));
    params.set("daysSinceListed", String(positiveNumber(filters.daysListed, 7)));
    params.set("sortBy", "creation_time_descend");
    params.set("exact", filters.exact === false ? "false" : "true");

    return {
      status: "ok",
      url: `${FACEBOOK_BASE_URL}?${params.toString()}`,
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
      supportsZip: "unknown",
      supportsRadius: "unknown",
      buildSearchUrl: () => notImplemented("craigslist"),
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
    buildFacebookSearchUrl,
  };
})(globalThis);
