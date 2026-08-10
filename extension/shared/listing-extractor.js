(function registerListingExtractor(global) {
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

  function excerpt(value, maxLength) {
    const text = normalizeWhitespace(value);
    const max = maxLength || 4000;
    return text.length > max ? text.slice(0, max) + "..." : text;
  }

  function firstMatch(text, regex) {
    const match = text.match(regex);
    return match ? normalizeWhitespace(match[1] || match[0]) : "";
  }

  function cleanTitle(value) {
    return normalizeWhitespace(value)
      .replace(/\s*\|\s*Facebook Marketplace\s*$/i, "")
      .replace(/\s*-\s*Facebook Marketplace\s*$/i, "")
      .replace(/\s*-\s*craigslist\s*$/i, "")
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

  function extractFieldsFromText(rawText, hints) {
    const safeHints = hints || {};
    const rawLines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

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
      const sellerInfoIdx = rawLines.findIndex((line) => /seller information/i.test(line));
      if (sellerInfoIdx !== -1) {
        for (let i = sellerInfoIdx + 1; i < rawLines.length; i++) {
          const candidate = rawLines[i];
          if (
            candidate &&
            !candidate.match(/^https?:\/\//i) &&
            !/^[\d⭐*]/.test(candidate) &&
            !/^member since|^joined /i.test(candidate) &&
            !/^(facebook|marketplace)$/i.test(candidate) &&
            !/^seller (information|details)$/i.test(candidate) &&
            !/send.*seller|message.*seller|seller.*(message|details)/i.test(candidate)
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

    let title =
      cleanTitle(safeHints.ogTitle || safeHints.pageTitle || "") ||
      cleanedLines.find((line) =>
        line !== price &&
        line !== location &&
        line !== sellerName &&
        line !== (mileage || "") &&
        !/^facebook marketplace$/i.test(line)
      ) ||
      "";

    const description = normalizeWhitespace(safeHints.ogDescription || "");

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
      imageUrl: normalizeWhitespace(safeHints.ogImage || ""),
      statusHint: unavailable ? "Gone / Removed" : "",
      unavailable,
      rawText: excerpt(rawText),
    };

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

  global.CarSearchHarnessListingExtractor = {
    extractFieldsFromText,
    hasUsefulFields,
  };
})(globalThis);
