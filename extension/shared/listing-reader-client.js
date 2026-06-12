(function registerListingReaderClient(global) {
  const listingReaderEndpoint = "http://localhost:3137/read-listing";
  const listingReaderTimeoutMs = 10000;

  function isFacebookMarketplaceListingUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return (
        (url.hostname === "facebook.com" || url.hostname === "www.facebook.com" || url.hostname === "m.facebook.com") &&
        /^\/marketplace\/item\/[^/]+\/?$/i.test(url.pathname)
      );
    } catch (error) {
      return false;
    }
  }

  function normalizeReaderResponse(response, fallbackUrl, sourceText) {
    const source = response && typeof response === "object" ? response : {};
    return {
      title: typeof source.title === "string" ? source.title.trim() : "",
      url: fallbackUrl,
      price: typeof source.price === "string" ? source.price.trim() : "",
      location: typeof source.location === "string" ? source.location.trim() : "",
      sellerName: typeof source.sellerName === "string" ? source.sellerName.trim() : "",
      mileage: typeof source.mileage === "string" ? source.mileage.trim() : "",
      transmission: typeof source.transmission === "string" ? source.transmission.trim() : "",
      fuelType: typeof source.fuelType === "string" ? source.fuelType.trim() : "",
      description: typeof source.description === "string" ? source.description.trim() : "",
      imageUrl: typeof source.imageUrl === "string" ? source.imageUrl.trim() : "",
      readStatus: typeof source.readStatus === "string" ? source.readStatus : "",
      statusHint: typeof source.statusHint === "string" ? source.statusHint : "",
      sourceText,
    };
  }

  function hasReaderCaptureFields(capture) {
    return Boolean(
      capture &&
        (capture.title ||
          capture.price ||
          capture.location ||
          capture.sellerName ||
          capture.mileage ||
          capture.transmission ||
          capture.fuelType ||
          capture.description ||
          capture.imageUrl ||
          capture.statusHint)
    );
  }

  function getReaderFailureMessage(readStatus) {
    if (readStatus === "timeout") {
      return "Reader timed out.";
    }

    if (readStatus === "login_dialog_blocked" || readStatus === "login_required") {
      return "Reader could not capture listing details.";
    }

    if (readStatus === "could_not_parse" || readStatus === "unavailable") {
      return "Reader could not capture listing details.";
    }

    return "Local reader unavailable.";
  }

  async function readListingFromLocalReader(url) {
    if (typeof global.fetch !== "function") {
      return { readStatus: "reader_unavailable", error: "Local reader requires fetch support." };
    }

    const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
    const timeoutId = controller
      ? global.setTimeout(() => controller.abort(), listingReaderTimeoutMs)
      : null;

    try {
      const response = await global.fetch(listingReaderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller ? controller.signal : undefined,
      });

      if (!response.ok) {
        return { readStatus: "reader_unavailable", error: `Reader returned HTTP ${response.status}.` };
      }

      return await response.json();
    } catch (error) {
      if (error && error.name === "AbortError") {
        return { readStatus: "timeout", error: "Reader timed out." };
      }

      return { readStatus: "reader_unavailable", error: "Reader unavailable." };
    } finally {
      if (timeoutId) {
        global.clearTimeout(timeoutId);
      }
    }
  }

  global.CarSearchHarnessListingReaderClient = {
    listingReaderEndpoint,
    isFacebookMarketplaceListingUrl,
    normalizeReaderResponse,
    hasReaderCaptureFields,
    getReaderFailureMessage,
    readListingFromLocalReader,
  };
})(globalThis);
