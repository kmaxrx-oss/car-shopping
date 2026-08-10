(function registerStorageContract(global) {
  const storageKeys = {
    savedCars: "carShopping.savedCars.v1",
    activeSearch: "carShopping.extension.activeSearch.v1",
    recentZips: "carShopping.extension.recentZips.v1",
    savedCarListPrefs: "carShopping.extension.savedCarListPrefs.v1",
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

  async function getActiveSearch() {
    const value = await getValue(storageKeys.activeSearch, null);
    return value && typeof value === "object" ? value : null;
  }

  async function setActiveSearch(activeSearch) {
    if (!activeSearch || typeof activeSearch !== "object") {
      throw new Error("Active search must be stored as an object.");
    }

    await setValue(storageKeys.activeSearch, activeSearch);
  }

  async function getRecentZips() {
    const value = await getValue(storageKeys.recentZips, []);
    return Array.isArray(value) ? value : [];
  }

  async function setRecentZips(recentZips) {
    if (!Array.isArray(recentZips)) {
      throw new Error("Recent ZIPs must be stored as an array.");
    }

    await setValue(storageKeys.recentZips, recentZips);
  }

  async function getSavedCarListPrefs() {
    const value = await getValue(storageKeys.savedCarListPrefs, null);
    return value && typeof value === "object" ? value : null;
  }

  async function setSavedCarListPrefs(savedCarListPrefs) {
    if (!savedCarListPrefs || typeof savedCarListPrefs !== "object") {
      throw new Error("Saved car list prefs must be stored as an object.");
    }

    await setValue(storageKeys.savedCarListPrefs, savedCarListPrefs);
  }

  global.CarSearchHarnessStorage = {
    storageKeys,
    storagePlan,
    getSavedCars,
    setSavedCars,
    getActiveSearch,
    setActiveSearch,
    getRecentZips,
    setRecentZips,
    getSavedCarListPrefs,
    setSavedCarListPrefs,
  };
})(globalThis);
