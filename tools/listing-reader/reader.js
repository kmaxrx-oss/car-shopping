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

function excerpt(value, maxLength = 4000) {
  const text = normalizeWhitespace(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? normalizeWhitespace(match[1] || match[0]) : "";
}

function cleanTitle(value) {
  return normalizeWhitespace(value)
    .replace(/\s*\|\s*Facebook Marketplace\s*$/i, "")
    .replace(/\s*-\s*Facebook Marketplace\s*$/i, "")
    .replace(/^Marketplace\s*-\s*/i, "");
}

function extractFieldsFromText(rawText, hints = {}) {
  const text = normalizeWhitespace(rawText);
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const price = firstMatch(text, /\$\s?\d[\d,]*(?:\.\d{2})?/);
  const location =
    firstMatch(text, /Listed\s+\d+\s+\w+\s+ago\s+in\s+([A-Za-z .'-]+,\s*[A-Z]{2})/i) ||
    firstMatch(text, /Location\s+([A-Za-z .'-]+,\s*[A-Z]{2})/i) ||
    firstMatch(text, /([A-Za-z .'-]+,\s*[A-Z]{2})/);
  const mileage =
    firstMatch(text, /Driven\s+(\d[\d,]*\s*miles?)/i) ||
    firstMatch(text, /(\d[\d,]*\s*Miles)/) ||
    firstMatch(text, /(\d[\d,]*\s*mi\.?)/i);
  const transmission = firstMatch(text, /\b(automatic|manual|cvt|continuously variable)\b/i);
  const fuelType = firstMatch(text, /\b(gasoline|hybrid|electric|diesel|flex fuel|plug-in hybrid|phev)\b/i);
  const loginRequired = /\b(log in|login|sign in|sign up|create new account)\b/i.test(text);
  const unavailable = /\b(sold|no longer available|listing is no longer available|content isn't available|removed|this listing is no longer available)\b/i.test(text);
  const title =
    cleanTitle(hints.ogTitle || hints.pageTitle || "") ||
    lines.find((line) => line !== price && line !== location && !/^facebook marketplace$/i.test(line)) ||
    "";
  const description = normalizeWhitespace(hints.ogDescription || "");

  return {
    ...emptyResult,
    readStatus: loginRequired && !title && !price
      ? "login_required"
      : unavailable
        ? "unavailable"
        : title || price || location || mileage || description
          ? "ok"
          : "could_not_parse",
    title,
    price,
    location,
    mileage,
    transmission,
    fuelType,
    description,
    imageUrl: normalizeWhitespace(hints.ogImage || ""),
    statusHint: unavailable ? "Gone / Removed" : "",
    unavailable,
    rawText: excerpt(rawText),
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
    const snapshot = page.accessibility && typeof page.accessibility.snapshot === "function"
      ? await page.accessibility.snapshot({ interestingOnly: false }).catch(() => null)
      : null;
    const meta = await page.evaluate(() => {
      const getMeta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
      return {
        pageTitle: document.title || "",
        ogTitle: getMeta('meta[property="og:title"], meta[name="og:title"]'),
        ogDescription: getMeta('meta[property="og:description"], meta[name="og:description"], meta[name="description"]'),
        ogImage: getMeta('meta[property="og:image"], meta[name="og:image"]'),
      };
    }).catch(() => ({}));
    const rawText = [visibleText, meta.pageTitle, meta.ogTitle, meta.ogDescription, JSON.stringify(snapshot || {})].filter(Boolean).join("\n");
    const parsed = extractFieldsFromText(rawText, meta);

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
