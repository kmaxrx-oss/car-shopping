(function registerZipGeocode(global) {
  const ZIP_GEOCODE_API = "https://api.zippopotam.us/us";

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

  function formatPlaceLabel(place) {
    if (!place || typeof place !== "object") {
      return "";
    }

    const city = String(place["place name"] || "").trim();
    const state = String(place["state abbreviation"] || "").trim();
    if (city && state) {
      return `${city}, ${state}`;
    }
    return city || state || "";
  }

  function normalizeGeocodeResult(zip, payload) {
    const normalizedZip = normalizeZip(zip);
    if (!normalizedZip || !payload || typeof payload !== "object") {
      return null;
    }

    const places = Array.isArray(payload.places) ? payload.places : [];
    const primary = places[0] || null;
    const locationLabel = formatPlaceLabel(primary);

    return {
      zip: normalizedZip,
      locationLabel: locationLabel || normalizedZip,
      city: primary ? String(primary["place name"] || "").trim() : "",
      state: primary ? String(primary["state abbreviation"] || "").trim() : "",
    };
  }

  async function fetchZipGeocode(zip) {
    const normalizedZip = normalizeZip(zip);
    if (!normalizedZip) {
      return null;
    }

    const response = await fetch(`${ZIP_GEOCODE_API}/${normalizedZip}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return normalizeGeocodeResult(normalizedZip, payload);
  }

  global.CarSearchHarnessZipGeocode = {
    normalizeZip,
    formatPlaceLabel,
    normalizeGeocodeResult,
    fetchZipGeocode,
  };
})(globalThis);