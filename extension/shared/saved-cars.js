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

  global.CarSearchHarnessSavedCars = {
    savedCarStatuses,
    savedCarFields,
    normalizeSavedCarDraft,
  };
})(globalThis);
