(function registerSavedCarUtils(global) {
  const SORT_MODES = {
    updatedDesc: "updated-desc",
    priceAsc: "price-asc",
    priceDesc: "price-desc",
    mileageAsc: "mileage-asc",
    mileageDesc: "mileage-desc",
    yearAsc: "year-asc",
    yearDesc: "year-desc",
  };

  function parsePriceNumber(price) {
    const text = String(price || "").trim();
    if (!text) {
      return null;
    }

    const match = text.match(/[\d,]+(?:\.\d{2})?/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseMileageNumber(mileage) {
    const text = String(mileage || "").trim();
    if (!text) {
      return null;
    }

    const match = text.match(/([\d,]+)/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseYearFromTitle(title) {
    const match = String(title || "").match(/\b(19[89]\d|20[0-3]\d)\b/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function inferYearFromTitle(title) {
    const year = parseYearFromTitle(title);
    return year ? String(year) : "";
  }

  function resolveCarYear(car) {
    const source = car && typeof car === "object" ? car : {};
    const explicit = String(source.year || "").trim();
    if (explicit) {
      const parsed = Number(explicit);
      if (Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2100) {
        return parsed;
      }
    }

    return parseYearFromTitle(source.title);
  }

  function extractStateFromLocation(location) {
    const text = String(location || "").trim();
    if (!text) {
      return "Unknown";
    }

    const commaMatch = text.match(/,\s*([A-Z]{2})\b/);
    if (commaMatch) {
      return commaMatch[1];
    }

    const tailMatch = text.match(/\b([A-Z]{2})\s*$/);
    if (tailMatch) {
      return tailMatch[1];
    }

    return "Unknown";
  }

  function compareFavoritesFirst(a, b, compareFn) {
    const aFavorite = Boolean(a && a.favorite);
    const bFavorite = Boolean(b && b.favorite);
    if (aFavorite && !bFavorite) {
      return -1;
    }
    if (!aFavorite && bFavorite) {
      return 1;
    }
    return compareFn(a, b);
  }

  function compareNullableNumbers(left, right, ascending) {
    if (left == null && right == null) {
      return 0;
    }
    if (left == null) {
      return 1;
    }
    if (right == null) {
      return -1;
    }
    return ascending ? left - right : right - left;
  }

  function compareUpdatedDesc(a, b) {
    const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return bTime - aTime;
  }

  function sortSavedCars(cars, sortMode) {
    const list = Array.isArray(cars) ? [...cars] : [];

    switch (sortMode) {
      case SORT_MODES.priceAsc:
        list.sort((a, b) =>
          compareFavoritesFirst(a, b, (left, right) =>
            compareNullableNumbers(parsePriceNumber(left.price), parsePriceNumber(right.price), true)
          )
        );
        break;
      case SORT_MODES.priceDesc:
        list.sort((a, b) =>
          compareFavoritesFirst(a, b, (left, right) =>
            compareNullableNumbers(parsePriceNumber(left.price), parsePriceNumber(right.price), false)
          )
        );
        break;
      case SORT_MODES.mileageAsc:
        list.sort((a, b) =>
          compareFavoritesFirst(a, b, (left, right) =>
            compareNullableNumbers(parseMileageNumber(left.mileage), parseMileageNumber(right.mileage), true)
          )
        );
        break;
      case SORT_MODES.mileageDesc:
        list.sort((a, b) =>
          compareFavoritesFirst(a, b, (left, right) =>
            compareNullableNumbers(parseMileageNumber(left.mileage), parseMileageNumber(right.mileage), false)
          )
        );
        break;
      case SORT_MODES.yearAsc:
        list.sort((a, b) =>
          compareFavoritesFirst(a, b, (left, right) =>
            compareNullableNumbers(resolveCarYear(left), resolveCarYear(right), true)
          )
        );
        break;
      case SORT_MODES.yearDesc:
        list.sort((a, b) =>
          compareFavoritesFirst(a, b, (left, right) =>
            compareNullableNumbers(resolveCarYear(left), resolveCarYear(right), false)
          )
        );
        break;
      case SORT_MODES.updatedDesc:
      default:
        list.sort((a, b) => compareFavoritesFirst(a, b, compareUpdatedDesc));
        break;
    }

    return list;
  }

  function groupCarsByState(cars) {
    const groups = new Map();

    for (const car of Array.isArray(cars) ? cars : []) {
      const state = extractStateFromLocation(car.location);
      if (!groups.has(state)) {
        groups.set(state, []);
      }
      groups.get(state).push(car);
    }

    const keys = [...groups.keys()].sort((left, right) => {
      if (left === "Unknown") {
        return 1;
      }
      if (right === "Unknown") {
        return -1;
      }
      return left.localeCompare(right);
    });

    return keys.map((state) => ({ state, cars: groups.get(state) }));
  }

  function normalizeListPrefs(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const sortMode = Object.values(SORT_MODES).includes(source.sortMode)
      ? source.sortMode
      : SORT_MODES.updatedDesc;

    return {
      sortMode,
      groupByState: Boolean(source.groupByState),
      favoritesOnly: Boolean(source.favoritesOnly),
    };
  }

  global.CarSearchHarnessSavedCarUtils = {
    SORT_MODES,
    parsePriceNumber,
    parseMileageNumber,
    parseYearFromTitle,
    inferYearFromTitle,
    resolveCarYear,
    extractStateFromLocation,
    sortSavedCars,
    groupCarsByState,
    normalizeListPrefs,
  };
})(globalThis);