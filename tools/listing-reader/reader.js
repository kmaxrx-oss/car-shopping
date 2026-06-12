const DEFAULT_TIMEOUT_MS = Number(process.env.LISTING_READER_TIMEOUT_MS || 20000);

const emptyResult = {
  readStatus: "could_not_parse",
  title: "",
  price: "",
  location: "",
  sellerName: "",
  mileage: "",
  transmission: "",
  fuelType: "",
  description: "",
  imageUrl: "",
  statusHint: "",
  unavailable: false,
  rawText: "",
};

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? normalizeWhitespace(match[1] || match[0]) : "";
}

function extractFieldsFromText(rawText) {
  const text = normalizeWhitespace(rawText);
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const price = firstMatch(text, /\$\s?\d[\d,]*(?:\.\d{2})?/);
  const location = firstMatch(text, /([A-Za-z .'-]+,\s*[A-Z]{2})/);
  const mileage = firstMatch(text, /(\d[\d,]*\s*(?:miles|mi\.?))/i);
  const transmission = firstMatch(text, /\b(automatic|manual|cvt|continuously variable)\b/i);
  const fuelType = firstMatch(text, /\b(gasoline|hybrid|electric|diesel|flex fuel|plug-in hybrid|phev)\b/i);
  const unavailable = /\b(sold|no longer available|listing is no longer available|content isn't available|removed)\b/i.test(text);
  const title = lines.find((line) => line !== price && line !== location && !/^facebook marketplace$/i.test(line)) || "";

  return {
    ...emptyResult,
    readStatus: title || price || location || mileage ? "ok" : unavailable ? "unavailable" : "could_not_parse",
    title,
    price,
    location,
    mileage,
    transmission,
    fuelType,
    statusHint: unavailable ? "Gone / Removed" : "",
    unavailable,
    rawText,
  };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    return null;
  }
}

async function readWithPlaywright(url) {
  const playwright = await loadPlaywright();
  if (!playwright) {
    return {
      ...emptyResult,
      readStatus: "reader_unavailable",
      rawText: "",
      error: "Playwright is not installed. Run npm install in tools/listing-reader or use LISTING_READER_MOCK=1 for contract testing.",
    };
  }

  const browser = await playwright.chromium.launch({
    headless: process.env.LISTING_READER_HEADLESS !== "0",
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: Math.min(DEFAULT_TIMEOUT_MS, 10000) }).catch(() => {});

    const visibleText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const snapshot = await page.accessibility.snapshot({ interestingOnly: false }).catch(() => null);
    const rawText = [visibleText, JSON.stringify(snapshot || {})].filter(Boolean).join("\n");
    const parsed = extractFieldsFromText(rawText);

    if (/log in|login|sign in/i.test(rawText) && !parsed.title && !parsed.price) {
      return { ...parsed, readStatus: "login_required" };
    }

    return parsed;
  } catch (error) {
    const isTimeout = /timeout/i.test(error.message || "");
    return {
      ...emptyResult,
      readStatus: isTimeout ? "timeout" : "error",
      error: error.message || "Reader failed.",
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function readMockListing(url) {
  return {
    ...emptyResult,
    readStatus: "ok",
    title: "2023 Honda grom",
    price: "$4,000",
    location: "Little Falls, MN",
    sellerName: "Mock Seller",
    mileage: "1,234 miles",
    transmission: "Manual",
    fuelType: "Gasoline",
    description: "Mock reader response for local contract testing.",
    imageUrl: "",
    rawText: `Mock listing read for ${url}`,
  };
}

async function readListing(url) {
  if (process.env.LISTING_READER_MOCK === "1") {
    return readMockListing(url);
  }

  return readWithPlaywright(url);
}

module.exports = {
  emptyResult,
  extractFieldsFromText,
  readListing,
};
