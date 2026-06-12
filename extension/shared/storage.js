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

  global.CarSearchHarnessStorage = {
    storageKeys,
    storagePlan,
  };
})(globalThis);
