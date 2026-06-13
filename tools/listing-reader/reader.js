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

function hasUsefulFields(result) {
  return Boolean(
    result &&
      (result.title ||
        result.price ||
        result.location ||
        result.sellerName ||
        result.mileage ||
        result.transmission ||
        result.fuelType ||
        result.description ||
        result.imageUrl ||
        result.statusHint)
  );
}

function filterNoiseLines(rawLines) {
  const noiseRegexes = [
    /^facebook$/i,
    /^marketplace$/i,
    /^seller information$/i,
    /^member since\b/i,
    /^see more on facebook/i,
    /\b(log in|login|sign in|sign up|create new account|forgot account)\b/i,
    /^https?:\/\//i,
    /^[\d⭐*]+$/,
    /^\[InternetShortcut\]$/i,
    /^URL=/i,
    /^ref=|tracking=/i,
  ];

  const seen = new Set();
  const cleaned = [];

  for (const line of rawLines) {
    const lower = line.toLowerCase();
    if (seen.has(lower)) continue;
    if (noiseRegexes.some((re) => re.test(line))) continue;
    seen.add(lower);
    cleaned.push(line);
  }
  return cleaned;
}

function extractFieldsFromText(rawText, hints = {}) {
  const rawLines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  // Seller detection must see the "Seller information" header and following name (port order from capture-parser)
  let sellerName = "";
  let sellerSectionNameLine = "";

  for (const line of rawLines) {
    const sellerMatch = line.match(/^(?:seller|listed by|posted by)\s*:\s*(.+)$/i);
    if (sellerMatch && sellerMatch[1].trim()) {
      sellerName = sellerMatch[1].trim();
      break;
    }
  }

  if (!sellerName) {
    const sellerInfoIdx = rawLines.findIndex((line) => /^seller information$/i.test(line));
    if (sellerInfoIdx !== -1) {
      for (let i = sellerInfoIdx + 1; i < rawLines.length; i++) {
        const candidate = rawLines[i];
        if (
          candidate &&
          !candidate.match(/^https?:\/\//i) &&
          !/^[\d⭐*]/.test(candidate) &&
          !/^member since/i.test(candidate) &&
          !/^(facebook|marketplace)$/i.test(candidate)
        ) {
          sellerName = candidate;
          sellerSectionNameLine = candidate;
          break;
        }
      }
    }
  }

  const cleanedLines = filterNoiseLines(rawLines);
  const text = normalizeWhitespace(rawText);
  const cleanedText = cleanedLines.join("\n");

  const price = firstMatch(text, /\$\s?\d[\d,]*(?:\.\d{2})?/);

  const location =
    firstMatch(text, /Listed\s+\d+\s+\w+\s+ago\s+in\s+([A-Za-z .'-]+,\s*[A-Z]{2})/i) ||
    firstMatch(text, /Listed in ([A-Za-z .'-]+,\s*[A-Z]{2})/i) ||
    firstMatch(text, /Located in ([A-Za-z .'-]+,\s*[A-Z]{2})/i) ||
    firstMatch(text, /Location\s+([A-Za-z .'-]+,\s*[A-Z]{2})/i) ||
    firstMatch(text, /([A-Za-z .'-]+,\s*[A-Z]{2})/);

  const mileage =
    firstMatch(text, /Driven\s+(\d[\d,]*\s*miles?)/i) ||
    firstMatch(text, /(\d[\d,]*\s*Miles)/) ||
    firstMatch(text, /(\d[\d,]*\s*mi\.?)/i) ||
    firstMatch(text, /(\d[\d,]*)\s*(?:miles?|mi)\b/i) ||
    firstMatch(text, /mileage[:\s-]*(\d[\d,]*\s*(?:miles?|mi)?)/i);

  const transmission = firstMatch(text, /\b(automatic|manual|cvt|continuously variable)\b/i);
  const fuelType = firstMatch(text, /\b(gasoline|hybrid|electric|diesel|flex fuel|plug-in hybrid|phev)\b/i);
  const loginRequired = /\b(log in|login|sign in|sign up|create new account)\b/i.test(text);
  const unavailable = /\b(sold|no longer available|listing is no longer available|content isn't available|removed|this listing is no longer available)\b/i.test(text);

  // Title selection using cleaned lines + exclusions (sellerName already extracted above from raw order)
  let title =
    cleanTitle(hints.ogTitle || hints.pageTitle || "") ||
    cleanedLines.find((line) =>
      line !== price &&
      line !== location &&
      line !== sellerName &&
      line !== (mileage || "") &&
      !/^facebook marketplace$/i.test(line)
    ) ||
    "";

  const description = normalizeWhitespace(hints.ogDescription || "");

  const parsed = {
    ...emptyResult,
    title: normalizeWhitespace(title),
    price,
    location,
    sellerName,
    mileage,
    transmission,
    fuelType,
    description,
    imageUrl: normalizeWhitespace(hints.ogImage || ""),
    statusHint: unavailable ? "Gone / Removed" : "",
    unavailable,
    rawText: excerpt(rawText),
  };

  // Improved status: support "partial" when reader got useful data but not full core
  const hasCore = Boolean(parsed.title && parsed.price && parsed.location);
  const hasUseful = hasUsefulFields(parsed);

  if (loginRequired && !parsed.title && !parsed.price) {
    parsed.readStatus = "login_required";
  } else if (unavailable) {
    parsed.readStatus = "unavailable";
  } else if (hasCore) {
    parsed.readStatus = "ok";
  } else if (hasUseful) {
    parsed.readStatus = "partial";
  } else {
    parsed.readStatus = "could_not_parse";
  }

  return parsed;
}

async function getFacebookDialogState(page) {
  const state = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const bodyText = normalize(document.body?.innerText || "");
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const dialogTexts = dialogs.map((dialog) => normalize(dialog.innerText || dialog.textContent || ""));
    const seeMoreOnFacebook = /see more on facebook/i.test(bodyText) || dialogTexts.some((text) => /see more on facebook/i.test(text));
    const loginPrompt = /\b(log in|login|sign in|create new account|forgot account)\b/i.test(bodyText);
    const closeButtons = Array.from(document.querySelectorAll('[aria-label="Close"], [aria-label="close"], [role="button"]')).filter((element) => {
      const label = normalize(element.getAttribute("aria-label") || "");
      const text = normalize(element.innerText || element.textContent || "");
      return /^close$/i.test(label) || /^close$/i.test(text);
    });

    return {
      dialogCount: dialogs.length,
      closeButtonCount: closeButtons.length,
      seeMoreOnFacebook,
      loginPrompt,
      bodyExcerpt: bodyText.slice(0, 600),
    };
  }).catch(() => ({
    dialogCount: 0,
    closeButtonCount: 0,
    seeMoreOnFacebook: false,
    loginPrompt: false,
    bodyExcerpt: "",
  }));

  return {
    ...state,
    modalDetected: Boolean(state.dialogCount || state.seeMoreOnFacebook),
  };
}

async function dismissFacebookLoginDialog(page) {
  const before = await getFacebookDialogState(page);
  const result = {
    modalDetected: before.modalDetected,
    closeButtonFound: before.closeButtonCount > 0,
    clickAttempted: false,
    clickSucceeded: false,
    escapeAttempted: false,
    escapeSucceeded: false,
    closed: false,
    blocked: false,
    before,
    after: before,
  };

  if (!before.modalDetected) {
    return result;
  }

  const closeLocators = [
    page.getByLabel("Close", { exact: true }).first(),
    page.locator('[aria-label="Close"]').first(),
    page.locator('[role="dialog"] [aria-label="Close"]').first(),
  ];

  for (const locator of closeLocators) {
    const count = await locator.count().catch(() => 0);
    if (!count) {
      continue;
    }

    result.closeButtonFound = true;
    result.clickAttempted = true;
    await locator.click({ timeout: 3000 }).then(() => {
      result.clickSucceeded = true;
    }).catch(() => {});

    const afterClick = await getFacebookDialogState(page);
    result.after = afterClick;
    if (!afterClick.modalDetected) {
      result.closed = true;
      return result;
    }
  }

  result.escapeAttempted = true;
  await page.keyboard.press("Escape").then(() => {
    result.escapeSucceeded = true;
  }).catch(() => {});

  const afterEscape = await getFacebookDialogState(page);
  result.after = afterEscape;
  result.closed = !afterEscape.modalDetected;
  result.blocked = !result.closed;
  return result;
}

async function extractMetaFields(page) {
  return page.evaluate(() => {
    const getMeta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
    return {
      pageTitle: document.title || "",
      ogTitle: getMeta('meta[property="og:title"], meta[name="og:title"]'),
      ogDescription: getMeta('meta[property="og:description"], meta[name="og:description"], meta[name="description"]'),
      ogImage: getMeta('meta[property="og:image"], meta[name="og:image"]'),
    };
  }).catch(() => ({}));
}

async function getRenderedListingText(page) {
  const visibleText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const snapshot = page.accessibility && typeof page.accessibility.snapshot === "function"
    ? await page.accessibility.snapshot({ interestingOnly: false }).catch(() => null)
    : null;
  const meta = await extractMetaFields(page);
  const rawText = [visibleText, meta.pageTitle, meta.ogTitle, meta.ogDescription, JSON.stringify(snapshot || {})]
    .filter(Boolean)
    .join("\n");

  return { rawText, meta };
}

function chooseReadStatus(parsed, modalState, rawText) {
  if (modalState.blocked) {
    return "login_dialog_blocked";
  }

  if (parsed.unavailable) {
    return "unavailable";
  }

  const hasFields = hasUsefulFields(parsed);
  const hasCoreListingFields = Boolean(parsed.title && parsed.price && parsed.location);

  if (hasCoreListingFields) {
    return "ok";
  }

  if (modalState.modalDetected && modalState.closed && hasFields) {
    // Prefer partial when we have some but not full core after dialog close
    return hasCoreListingFields ? "ok" : "partial";
  }

  if (hasFields) {
    return hasCoreListingFields ? "ok" : "partial";
  }

  if (/\b(log in|login|sign in|sign up|create new account|forgot account)\b/i.test(rawText)) {
    return "login_required";
  }

  return "could_not_parse";
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
    const modalState = await dismissFacebookLoginDialog(page);
    if (modalState.closed) {
      await page.waitForLoadState("networkidle", { timeout: Math.min(DEFAULT_TIMEOUT_MS, 5000) }).catch(() => {});
    }

    const { rawText, meta } = await getRenderedListingText(page);
    const parsed = extractFieldsFromText(rawText, meta);
    const readStatus = chooseReadStatus(parsed, modalState, rawText);

    return {
      ...parsed,
      readStatus,
      modalDetected: modalState.modalDetected,
      closeButtonFound: modalState.closeButtonFound,
      closeSucceeded: modalState.closed,
      loginDialogBlocked: modalState.blocked,
    };
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
  dismissFacebookLoginDialog,
  readListing,
};
