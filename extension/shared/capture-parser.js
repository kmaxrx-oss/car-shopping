(function registerCaptureParser(global) {
  function parseSavedCarCapture(rawText) {
    const sourceText = typeof rawText === "string" ? rawText.trim() : "";
    if (!sourceText) {
      return { error: "Paste or drop a listing URL or text block to use Smart Capture." };
    }

    const urlMatch = sourceText.match(/https?:\/\/\S+/i);
    const url = urlMatch ? urlMatch[0].replace(/[)\].,!?]+$/, "") : "";

    const rawLines = sourceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const seenLines = new Set();
    const uniqueLines = rawLines.filter((line) => {
      const normalizedLine = line.toLowerCase();
      if (seenLines.has(normalizedLine)) {
        return false;
      }
      seenLines.add(normalizedLine);
      return true;
    });

    const priceLine = uniqueLines.find((line) => /^\$\s?\d[\d,]*(?:\.\d{2})?$/.test(line));
    const barePriceLine = uniqueLines.find((line) => /^\d[\d,]*(?:\.\d{2})?$/.test(line));
    const price = priceLine || barePriceLine || "";

    const location =
      uniqueLines.find((line) => /^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(line)) ||
      uniqueLines.find((line) => /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(line)) ||
      "";

    const mileageLine =
      uniqueLines.find((line) => /^(?:driven\s+)?[\d,]+\s*(?:miles?|mi)\b/i.test(line)) || "";

    let sellerName = "";
    for (const line of uniqueLines) {
      const sellerMatch = line.match(/^(?:seller|listed by|posted by)\s*:\s*(.+)$/i);
      if (sellerMatch && sellerMatch[1].trim()) {
        sellerName = sellerMatch[1].trim();
        break;
      }
    }

    const filteredLines = uniqueLines.filter((line) => {
      if (url && line.includes(url)) {
        return false;
      }
      if (price && line === price) {
        return false;
      }
      if (location && line === location) {
        return false;
      }
      if (mileageLine && line === mileageLine) {
        return false;
      }
      if (/^(seller|listed by|posted by)\s*:/i.test(line)) {
        return false;
      }
      if (/^(ref|referral_code|referral_story_type|tracking)=/i.test(line)) {
        return false;
      }
      if (/^\[InternetShortcut\]$/i.test(line) || /^URL=/i.test(line)) {
        return false;
      }
      if (/^(facebook|marketplace)$/i.test(line)) {
        return false;
      }
      return true;
    });

    const title = filteredLines[0] || "";

    if (!sellerName) {
      const nameLikePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]*)+$/;
      for (const line of filteredLines.slice(1)) {
        if (nameLikePattern.test(line)) {
          sellerName = line;
          break;
        }
      }
    }

    if (!url && !price && !location && !title && !sellerName && !mileageLine) {
      return { error: "Smart Capture could not find a usable listing URL or details in that text." };
    }

    return {
      value: {
        url,
        price,
        location,
        title,
        sellerName,
        mileage: mileageLine,
        transmission: "",
        fuelType: "",
        description: "",
        imageUrl: "",
        readStatus: "",
        statusHint: "",
        sourceText,
      },
    };
  }

  function isUrlOnlyCapture(rawText, capture) {
    if (!capture.url) {
      return false;
    }

    const textWithoutUrl = String(rawText || "")
      .replace(capture.url, "")
      .replace(/^\s*\[InternetShortcut\]\s*$/gim, "")
      .replace(/^\s*URL=\s*$/gim, "")
      .replace(/^\s*URL=/gim, "")
      .trim();

    return !capture.title && !capture.price && !capture.location && !capture.sellerName && !textWithoutUrl;
  }

  global.CarSearchHarnessCaptureParser = {
    parseSavedCarCapture,
    isUrlOnlyCapture,
  };
})(globalThis);
