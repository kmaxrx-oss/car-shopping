(function registerCraigslist(global) {
  const exclusionsModule = global.CarSearchHarnessCraigslistExclusions;
  const DEFAULT_CRAIGSLIST_BASE_URL = "https://wausau.craigslist.org";
  const CRAIGSLIST_SEARCH_PATH = "/search/cta";
  const CRAIGSLIST_SEARCH_HASH = "#search=2~gallery~10";
  const craigslistHostRe = /^[a-z0-9-]+\.craigslist\.org$/i;

  function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function positiveIntegerAtLeast(value, fallback, min) {
    const parsed = Math.floor(Number(value));
    const threshold = Number.isFinite(min) ? min : 1;
    return Number.isFinite(parsed) && parsed >= threshold ? parsed : fallback;
  }

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

  function normalizeCraigslistBaseUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return DEFAULT_CRAIGSLIST_BASE_URL;
    }

    let candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate.replace(/^\/+/, "")}`;
    }

    try {
      const url = new URL(candidate);
      if (!craigslistHostRe.test(url.hostname)) {
        return "";
      }

      return `${url.protocol}//${url.hostname}`;
    } catch (error) {
      return "";
    }
  }

  function getMaxQueryExclusions() {
    if (exclusionsModule && Number.isFinite(exclusionsModule.MAX_CRAIGSLIST_QUERY_EXCLUSIONS)) {
      return exclusionsModule.MAX_CRAIGSLIST_QUERY_EXCLUSIONS;
    }
    return 15;
  }

  function getDefaultExclusions() {
    if (exclusionsModule && Array.isArray(exclusionsModule.DEFAULT_CRAIGSLIST_EXCLUSIONS)) {
      return exclusionsModule.DEFAULT_CRAIGSLIST_EXCLUSIONS.slice();
    }
    return [];
  }

  function applyExclusionLimit(exclusionTerms) {
    const exclusions = Array.isArray(exclusionTerms) ? exclusionTerms.slice() : getDefaultExclusions();
    const maxTerms = getMaxQueryExclusions();
    const applied = exclusions.slice(0, maxTerms);
    return {
      applied,
      totalAvailable: exclusions.length,
      truncatedCount: Math.max(0, exclusions.length - applied.length),
      maxTerms,
    };
  }

  function buildCraigslistQuery(positiveKeyword, exclusionTerms) {
    const positive = String(positiveKeyword || "").trim();
    const exclusions = applyExclusionLimit(exclusionTerms).applied;
    const negatives = exclusions
      .map((term) => String(term || "").trim())
      .filter(Boolean)
      .map((term) => `-${term}`)
      .join(" ");

    if (positive && negatives) {
      return `${positive} ${negatives}`.trim();
    }

    return positive || negatives;
  }

  function buildCraigslistSearchQueryString(filters) {
    const minPrice = Math.floor(positiveNumber(filters && filters.minPrice, 1500));
    const maxPrice = Math.floor(positiveNumber(filters && filters.maxPrice, 4000));
    const minAutoYear = Math.floor(positiveNumber(filters && filters.minYear, 2005));
    const postal = normalizeZip(filters && filters.zip);
    const searchDistance = positiveIntegerAtLeast(filters && filters.radius, 125, 1);
    const exclusionLimit = applyExclusionLimit(getDefaultExclusions());
    const exclusionTerms = exclusionLimit.applied;
    const query = buildCraigslistQuery(filters && filters.query, exclusionTerms);
    const parts = [
      `max_price=${maxPrice}`,
      `min_auto_year=${minAutoYear}`,
      `min_price=${minPrice}`,
      `postal=${postal}`,
    ];

    if (query) {
      parts.push(`query=${encodeURIComponent(query)}`);
    }

    parts.push(`search_distance=${searchDistance}`);
    return {
      minPrice,
      maxPrice,
      minAutoYear,
      postal,
      searchDistance,
      query,
      exclusionTerms,
      exclusionTruncatedCount: exclusionLimit.truncatedCount,
      exclusionMaxTerms: exclusionLimit.maxTerms,
      queryString: parts.join("&"),
    };
  }

  function isCraigslistSearchUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return craigslistHostRe.test(url.hostname) && /^\/search\//i.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  function isCraigslistListingUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (!craigslistHostRe.test(url.hostname)) {
        return false;
      }

      return /^\/(?:[^/]+\/)?d\//i.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  function buildCraigslistSearchUrl(filters) {
    const baseUrl = normalizeCraigslistBaseUrl(filters && filters.craigslistBaseUrl);
    if (!baseUrl) {
      return {
        status: "error",
        message: "Enter a valid Craigslist site such as wausau.craigslist.org.",
      };
    }

    const built = buildCraigslistSearchQueryString({ ...filters, craigslistBaseUrl: baseUrl });
    if (!built.postal) {
      return {
        status: "error",
        message: "Enter a valid 5-digit ZIP for Craigslist search.",
      };
    }

    return {
      status: "ok",
      url: `${baseUrl}${CRAIGSLIST_SEARCH_PATH}?${built.queryString}${CRAIGSLIST_SEARCH_HASH}`,
      baseUrl,
      postal: built.postal,
      searchDistance: built.searchDistance,
      minPrice: built.minPrice,
      maxPrice: built.maxPrice,
      minAutoYear: built.minAutoYear,
      query: built.query,
      positiveKeyword: String((filters && filters.query) || "").trim(),
      exclusionCount: built.exclusionTerms.length,
      exclusionTruncatedCount: built.exclusionTruncatedCount,
      exclusionMaxTerms: built.exclusionMaxTerms,
    };
  }

  global.CarSearchHarnessCraigslist = {
    DEFAULT_CRAIGSLIST_BASE_URL,
    CRAIGSLIST_SEARCH_PATH,
    CRAIGSLIST_SEARCH_HASH,
    normalizeCraigslistBaseUrl,
    buildCraigslistQuery,
    buildCraigslistSearchQueryString,
    buildCraigslistSearchUrl,
    isCraigslistSearchUrl,
    isCraigslistListingUrl,
  };
})(globalThis);