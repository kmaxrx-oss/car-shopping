(function () {
  const vehicles = window.CAR_SEARCH_HOMEBASE_VEHICLES || [];
  const tierById = new Map(vehicles.map((tier) => [tier.id, tier]));

  const state = {
    tierId: vehicles[1] ? vehicles[1].id : vehicles[0]?.id || "tier-b",
    minPrice: 1500,
    maxPrice: 4000,
    radius: 100,
    daysListed: 7,
    exact: true,
    manualQuery: "",
  };

  const baseUrl = "https://www.facebook.com/marketplace/103108469729444/search/";

  const els = {
    tierSections: document.getElementById("tier-sections"),
    activeTierLabel: document.getElementById("active-tier-label"),
    minPrice: document.getElementById("min-price"),
    maxPrice: document.getElementById("max-price"),
    radius: document.getElementById("radius"),
    daysListed: document.getElementById("days-listed"),
    exact: document.getElementById("exact-toggle"),
    manualQuery: document.getElementById("manual-query"),
    manualLink: document.getElementById("manual-link"),
    manualUrl: document.getElementById("manual-url"),
    buildManualLink: document.getElementById("build-manual-link"),
    tierButtons: Array.from(document.querySelectorAll(".tier-chip")),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function buildMarketplaceUrl({ query, minYear, minPrice, maxPrice, radius, daysListed, exact }) {
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("minPrice", String(minPrice));
    params.set("maxPrice", String(maxPrice));
    params.set("minYear", String(minYear));
    params.set("category_id", "546583916084032");
    params.set("radius", String(radius));
    params.set("daysSinceListed", String(daysListed));
    params.set("sortBy", "creation_time_descend");
    params.set("exact", exact ? "true" : "false");
    return `${baseUrl}?${params.toString()}`;
  }

  function getActiveTier() {
    return tierById.get(state.tierId) || vehicles[0];
  }

  function syncStateFromControls() {
    state.minPrice = toPositiveNumber(els.minPrice.value, 1500);
    state.maxPrice = toPositiveNumber(els.maxPrice.value, 4000);
    state.radius = toPositiveNumber(els.radius.value, 100);
    state.daysListed = toPositiveNumber(els.daysListed.value, 7);
    state.exact = els.exact.checked;
    state.manualQuery = els.manualQuery.value.trim();
  }

  function getCardUrl(modelName, tierMinYear, extraTerm) {
    const query = extraTerm ? `${modelName} ${extraTerm}`.trim() : modelName;
    return buildMarketplaceUrl({
      query,
      minYear: tierMinYear,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      radius: state.radius,
      daysListed: state.daysListed,
      exact: state.exact,
    });
  }

  function renderManualLink() {
    syncStateFromControls();
    const activeTier = getActiveTier();
    const query = state.manualQuery || " ";
    const url = buildMarketplaceUrl({
      query,
      minYear: activeTier.minYear,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      radius: state.radius,
      daysListed: state.daysListed,
      exact: state.exact,
    });
    els.manualLink.href = url;
    els.manualLink.textContent = state.manualQuery
      ? `Open Marketplace search for "${state.manualQuery}"`
      : "Build a link to see it here";
    els.manualUrl.textContent = url;
    els.activeTierLabel.textContent = `${activeTier.label} - ${activeTier.minYear}+ minYear`;
  }

  function renderTierSections() {
    els.tierSections.innerHTML = vehicles
      .map((tier) => {
        const groupsHtml = tier.groups
          .map((group) => {
            const cardsHtml = group.models
              .map((model) => {
                const baseUrl = getCardUrl(model.name, tier.minYear);
                const extraLinks = (model.searchTerms || [])
                  .map((term) => {
                    const termQuery = term.query || term.label;
                    const termUrl = getCardUrl(model.name, tier.minYear, termQuery);
                    return `<a class="model-link is-secondary" href="${escapeHtml(termUrl)}" target="_blank" rel="noreferrer">${escapeHtml(
                      term.label
                    )}</a>`;
                  })
                  .join("");

                const tagsHtml = (model.tags || [])
                  .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
                  .join("");

                return `
                  <article class="model-card">
                    <div>
                      <div class="model-card__title">${escapeHtml(model.name)}</div>
                      ${tagsHtml ? `<div class="tag-list">${tagsHtml}</div>` : ""}
                    </div>
                    ${model.notes ? `<div class="model-note">${escapeHtml(model.notes)}</div>` : ""}
                    <div class="link-row">
                      <a class="model-link" href="${escapeHtml(baseUrl)}" target="_blank" rel="noreferrer">Search model</a>
                      ${extraLinks}
                    </div>
                  </article>
                `;
              })
              .join("");

            return `
              <section class="group">
                <h3>${escapeHtml(group.label)}</h3>
                ${group.note ? `<p class="group-meta">${escapeHtml(group.note)}</p>` : ""}
                <div class="models">${cardsHtml}</div>
              </section>
            `;
          })
          .join("");

        return `
          <section class="tier-section" data-tier-id="${escapeHtml(tier.id)}">
            <header class="tier-header">
              <div>
                <h2>${escapeHtml(tier.label)}</h2>
                <p>${escapeHtml(tier.description)}</p>
              </div>
              <div class="tier-badge">${escapeHtml(String(tier.minYear))}+ minYear</div>
            </header>
            <div class="groups">${groupsHtml}</div>
          </section>
        `;
      })
      .join("");
  }

  function syncTierButtonState() {
    els.tierButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tierId === state.tierId);
    });
  }

  function attachEvents() {
    [els.minPrice, els.maxPrice, els.radius, els.daysListed, els.exact, els.manualQuery].forEach((input) => {
      input.addEventListener("input", renderManualLink);
      input.addEventListener("change", renderManualLink);
    });

    els.buildManualLink.addEventListener("click", () => {
      renderManualLink();
      if (els.manualLink.href && els.manualLink.href !== "#") {
        window.open(els.manualLink.href, "_blank", "noreferrer");
      }
    });

    els.tierButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.tierId = button.dataset.tierId;
        syncTierButtonState();
        renderManualLink();
      });
    });
  }

  function initialize() {
    if (!vehicles.length) {
      els.tierSections.innerHTML = "<p>No vehicle data loaded.</p>";
      return;
    }

    renderTierSections();
    attachEvents();
    syncTierButtonState();
    renderManualLink();
  }

  initialize();
})();
