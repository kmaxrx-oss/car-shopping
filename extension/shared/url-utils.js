(function registerUrlUtils(global) {
  function isHttpUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function extractUrlsFromText(rawText) {
    const text = String(rawText || "");
    const re = /https?:\/\/\S+/gi;
    const results = [];
    let match;
    while ((match = re.exec(text)) !== null) {
      let candidate = match[0].replace(/[)\].,!?;:'"`>]+$/g, "");
      if (isHttpUrl(candidate)) {
        results.push(candidate);
      }
    }
    return results;
  }

  function extractLphpDecoded(rawText) {
    const text = String(rawText || "");
    const re = /https?:\/\/l\.facebook\.com\/l\.php\?[^"'\s>)]*u=([^&"'\s>)]+)/i;
    const match = text.match(re);
    if (!match || !match[1]) return "";
    try {
      let decoded = decodeURIComponent(match[1]);
      decoded = decoded.replace(/[)\].,!?;:'"`>]+$/g, "");
      if (isHttpUrl(decoded)) return decoded;
    } catch (error) {}
    return "";
  }

  function normalizeMarketplaceItemUrl(value) {
    let candidate = String(value || "").trim();
    if (!candidate) return "";

    // Unwrap l.facebook.com/l.php?u=...
    if (/l\.facebook\.com\/l\.php/i.test(candidate)) {
      const uMatch = candidate.match(/[?&]u=([^&"'\s>)]+)/i);
      if (uMatch && uMatch[1]) {
        try {
          candidate = decodeURIComponent(uMatch[1]);
        } catch (error) {}
      }
    }

    // For /share/ etc, only promote if after unwrap it matches item path; do not invent
    try {
      let url = new URL(candidate);
      // Re-check l.php after URL parse (in case direct)
      if (
        url.hostname.endsWith("facebook.com") &&
        url.pathname === "/l.php"
      ) {
        const u = url.searchParams.get("u");
        if (u) {
          try {
            url = new URL(decodeURIComponent(u));
          } catch (error) {}
        }
      }

      const host = url.hostname;
      const isFbHost =
        host === "facebook.com" ||
        host === "www.facebook.com" ||
        host === "m.facebook.com" ||
        host === "l.facebook.com";
      if (!isFbHost) return "";

      if (/^\/marketplace\/item\/[^/]+\/?$/i.test(url.pathname)) {
        url.hostname = "www.facebook.com";
        url.search = "";
        url.hash = "";
        let path = url.pathname;
        if (!path.endsWith("/")) path += "/";
        url.pathname = path;
        return url.href;
      }

      return "";
    } catch (error) {
      return "";
    }
  }

  function isMarketplaceItemUrl(value) {
    return Boolean(normalizeMarketplaceItemUrl(value));
  }

  function normalizeSavedCarIdentityUrl(value) {
    const canon = normalizeMarketplaceItemUrl(value);
    if (canon) return canon;

    // Fallback basic normalization for non-Marketplace (or non-FB) URLs
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      url.hash = "";
      // Do NOT strip query for general case
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function extractBestListingUrl(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return "";

    const urls = extractUrlsFromText(text);

    // 1. Prefer any canonical Marketplace item URL found in text (handles order, queries, mobile, l.php decoded)
    for (const u of urls) {
      const canon = normalizeMarketplaceItemUrl(u);
      if (canon) return canon;
    }

    // 2. Explicit l.php decode from raw text (catches encoded u= even if regex didn't surface as top level url)
    const lphp = extractLphpDecoded(text);
    if (lphp) {
      const canon = normalizeMarketplaceItemUrl(lphp);
      if (canon) return canon;
    }

    // 3. First valid http(s) URL as fallback (do not return FB search or other non-item as "best" if no item present)
    for (const u of urls) {
      if (isHttpUrl(u)) {
        return u;
      }
    }

    return "";
  }

  function stripCapturedUrlNoise(rawText, capturedUrl) {
    let text = String(rawText || "");
    const canon = String(capturedUrl || "").trim();
    // Strip raw extracted urls first (full noisy forms with query/tracking so entire token vanishes)
    const rawUrls = extractUrlsFromText(rawText);
    for (const ru of rawUrls) {
      if (ru) {
        text = text.split(ru).join("");
      }
    }
    // Then strip the (possibly canonical) form if still present as substring
    if (canon) {
      text = text.split(canon).join("");
    }
    text = text
      .replace(/^\s*\[InternetShortcut\]\s*$/gim, "")
      .replace(/^\s*URL=\s*$/gim, "")
      .replace(/^\s*URL=/gim, "")
      .trim();
    return text;
  }

  global.CarSearchHarnessUrlUtils = {
    extractUrlsFromText,
    extractBestListingUrl,
    normalizeMarketplaceItemUrl,
    isMarketplaceItemUrl,
    normalizeSavedCarIdentityUrl,
    stripCapturedUrlNoise,
    isHttpUrl,
  };
})(globalThis);
