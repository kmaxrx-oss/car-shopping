(function registerStorageContract(global) {
  const storageKeys = {
    savedCars: "carShopping.savedCars.v1",
    activeSearch: "carShopping.extension.activeSearch.v1",
    recentZips: "carShopping.extension.recentZips.v1",
  };

  const storagePlan = {
    currentStaticAppStorage: "localStorage",
    futureExtensionStorage: "chrome.storage.local",
    migrationRequired: true,
    migrationNote:
      "Do not silently replace saved cars. A future extension migration should read carShopping.savedCars.v1 and preserve the existing payload shape.",
  };

  function getChromeStorageLocal() {
    return global.chrome && global.chrome.storage && global.chrome.storage.local
      ? global.chrome.storage.local
      : null;
  }

  async function getValue(key, fallbackValue) {
    const storageArea = getChromeStorageLocal();
    if (!storageArea) {
      return fallbackValue;
    }

    const result = await storageArea.get(key);
    return Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallbackValue;
  }

  async function setValue(key, value) {
    const storageArea = getChromeStorageLocal();
    if (!storageArea) {
      throw new Error("chrome.storage.local is not available in this context.");
    }

    await storageArea.set({ [key]: value });
  }

  async function getSavedCars() {
    const value = await getValue(storageKeys.savedCars, []);
    return Array.isArray(value) ? value : [];
  }

  async function setSavedCars(savedCars) {
    if (!Array.isArray(savedCars)) {
      throw new Error("Saved cars must be stored as an array.");
    }

    await setValue(storageKeys.savedCars, savedCars);
  }

  global.CarSearchHarnessStorage = {
    storageKeys,
    storagePlan,
    getSavedCars,
    setSavedCars,
  };
})(globalThis);
