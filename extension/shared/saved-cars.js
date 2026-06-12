(function registerSavedCarsContract(global) {
  const savedCarStatuses = ["Interested", "Messaged", "Maybe", "Rejected", "Gone / Removed", "Bought / Dead end"];

  const savedCarFields = [
    "id",
    "title",
    "url",
    "price",
    "location",
    "sellerName",
    "mileage",
    "transmission",
    "fuelType",
    "description",
    "imageUrl",
    "readStatus",
    "statusHint",
    "status",
    "notes",
    "sourceText",
    "createdAt",
    "updatedAt",
  ];

  function generateSavedCarId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }

    return `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function normalizeSavedCarUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }

      url.hash = "";

      if (
        (url.hostname === "facebook.com" || url.hostname === "www.facebook.com" || url.hostname === "m.facebook.com") &&
        /^\/marketplace\/item\/[^/]+\/?$/i.test(url.pathname)
      ) {
        url.hostname = "www.facebook.com";
        url.search = "";
        if (!url.pathname.endsWith("/")) {
          url.pathname += "/";
        }
      }

      return url.href;
    } catch (error) {
      return "";
    }
  }

  function normalizeSavedCarDraft(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: typeof source.id === "string" ? source.id : "",
      title: typeof source.title === "string" ? source.title : "",
      url: typeof source.url === "string" ? source.url : "",
      price: typeof source.price === "string" ? source.price : "",
      location: typeof source.location === "string" ? source.location : "",
      sellerName: typeof source.sellerName === "string" ? source.sellerName : "",
      mileage: typeof source.mileage === "string" ? source.mileage : "",
      transmission: typeof source.transmission === "string" ? source.transmission : "",
      fuelType: typeof source.fuelType === "string" ? source.fuelType : "",
      description: typeof source.description === "string" ? source.description : "",
      imageUrl: typeof source.imageUrl === "string" ? source.imageUrl : "",
      readStatus: typeof source.readStatus === "string" ? source.readStatus : "",
      statusHint: typeof source.statusHint === "string" ? source.statusHint : "",
      status: savedCarStatuses.includes(source.status) ? source.status : "Interested",
      notes: typeof source.notes === "string" ? source.notes : "",
      sourceText: typeof source.sourceText === "string" ? source.sourceText : "",
      createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    };
  }

  function normalizeStoredSavedCar(candidate) {
    const draft = normalizeSavedCarDraft(candidate);
    const normalizedUrl = normalizeSavedCarUrl(draft.url);
    if (!draft.title.trim() || !normalizedUrl) {
      return null;
    }

    const now = new Date().toISOString();
    return {
      ...draft,
      id: draft.id || generateSavedCarId(),
      title: draft.title.trim(),
      url: normalizedUrl,
      price: draft.price.trim(),
      location: draft.location.trim(),
      sellerName: draft.sellerName.trim(),
      mileage: draft.mileage.trim(),
      transmission: draft.transmission.trim(),
      fuelType: draft.fuelType.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl.trim(),
      readStatus: draft.readStatus.trim(),
      statusHint: draft.statusHint.trim(),
      notes: draft.notes.trim(),
      sourceText: draft.sourceText,
      createdAt: draft.createdAt || now,
      updatedAt: draft.updatedAt || now,
    };
  }

  function createSavedCar(candidate) {
    const normalized = normalizeStoredSavedCar({
      ...candidate,
      id: candidate && candidate.id ? candidate.id : generateSavedCarId(),
      createdAt: candidate && candidate.createdAt ? candidate.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (!normalized) {
      return { error: "Saved car needs a title and a valid http or https URL." };
    }

    return { value: normalized };
  }

  function updateSavedCar(existingCar, updates) {
    return createSavedCar({
      ...existingCar,
      ...updates,
      id: existingCar.id,
      createdAt: existingCar.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  global.CarSearchHarnessSavedCars = {
    savedCarStatuses,
    savedCarFields,
    generateSavedCarId,
    isHttpUrl,
    normalizeSavedCarUrl,
    normalizeSavedCarDraft,
    normalizeStoredSavedCar,
    createSavedCar,
    updateSavedCar,
  };
})(globalThis);
