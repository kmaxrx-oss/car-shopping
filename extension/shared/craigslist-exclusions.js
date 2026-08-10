(function registerCraigslistExclusions(global) {
  // Craigslist rejects query strings beyond ~15 negative terms (HTTP 400/404).
  // Highest-priority terms first; only the first MAX are sent in the URL.
  const MAX_CRAIGSLIST_QUERY_EXCLUSIONS = 15;

  const DEFAULT_CRAIGSLIST_EXCLUSIONS = [
    "silverado",
    "nissan",
    "f150",
    "expedition",
    "ram",
    "explorer",
    "vw",
    "forte",
    "dakota",
    "fusion",
    "f250",
    "patriot",
    "focus",
    "soul",
    "subaru",
    "suburban",
    "truck",
    "ranger",
    "tahoe",
    "trailblazer",
    "pontiac",
    "cadillac",
    "mercedes",
    "f-150",
    "f-250",
    "cruze",
    "scion",
    "cooper",
    "saab",
    "volkswagen",
    "volkswagon",
    "saturn",
    "bmw",
    "audi",
  ];

  global.CarSearchHarnessCraigslistExclusions = {
    DEFAULT_CRAIGSLIST_EXCLUSIONS,
    MAX_CRAIGSLIST_QUERY_EXCLUSIONS,
  };
})(globalThis);