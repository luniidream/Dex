// Team Fate - Shiny Wars 2026 Route Tracker

const teamFateState = {
  routes: [],
  filteredRoutes: [],
  selectedRoute: null,
  filters: {
    query: "",
    region: "All",
    time: "All"
  }
};

const SAMPLE_ROUTES = [
  {
    id: 1,
    name: "Route 12",
    pokemon: "Magikarp",
    region: "Kanto",
    horde: "5x Horde",
    encountersPerHour: 1100,
    time: "Night",
    method: "Water"
  },
  {
    id: 2,
    name: "Altering Cave",
    pokemon: "Zubat",
    region: "Kanto",
    horde: "3x Horde",
    encountersPerHour: 660,
    time: "Any Time",
    method: "Cave"
  },
  {
    id: 3,
    name: "Route 14",
    pokemon: "Ralts",
    region: "Hoenn",
    horde: "5x Horde",
    encountersPerHour: 1100,
    time: "Day",
    method: "Grass"
  },
  {
    id: 4,
    name: "Route 18",
    pokemon: "Tentacruel",
    region: "Kanto",
    horde: "3x Horde",
    encountersPerHour: 660,
    time: "Night",
    method: "Water"
  },
  {
    id: 5,
    name: "Safari Zone",
    pokemon: "Psyduck",
    region: "Kanto",
    horde: "5x Horde",
    encountersPerHour: 1100,
    time: "Day",
    method: "Water"
  },
  {
    id: 6,
    name: "Victory Road",
    pokemon: "Golbat",
    region: "Kanto",
    horde: "3x Horde",
    encountersPerHour: 660,
    time: "Night",
    method: "Cave"
  }
];

function initTeamFate() {
  if (!state.data) {
    setTimeout(initTeamFate, 100);
    return;
  }

  teamFateState.routes = SAMPLE_ROUTES;
  teamFateState.filteredRoutes = [...SAMPLE_ROUTES];

  buildTeamFateFilters();
  renderTeamFateRoutes();
  attachTeamFateListeners();
}

function buildTeamFateFilters() {
  const regions = new Set(teamFateState.routes.map(r => r.region));
  const times = new Set(teamFateState.routes.map(r => r.time));

  const regionFilters = $("tf-region-filters");
  regionFilters.innerHTML = `
    <button type="button" class="chip is-active" data-tf-region="All">All Regions</button>
    ${[...regions].map(r => `<button type="button" class="chip" data-tf-region="${r}">${r}</button>`).join("")}
  `;

  const timeFilters = $("tf-time-filters");
  timeFilters.innerHTML = `
    <button type="button" class="chip is-active" data-tf-time="All">All Times</button>
    ${[...times].map(t => `<button type="button" class="chip" data-tf-time="${t}">${t}</button>`).join("")}
  `;
}

function attachTeamFateListeners() {
  const search = $("tf-search");
  if (search) {
    search.addEventListener("input", (e) => {
      teamFateState.filters.query = e.target.value.toLowerCase();
      applyTeamFateFilters();
    });
  }

  // Region filters
  $("tf-region-filters")?.addEventListener("click", (e) => {
    if (e.target.dataset.tfRegion) {
      $("tf-region-filters").querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
      e.target.classList.add("is-active");
      teamFateState.filters.region = e.target.dataset.tfRegion;
      applyTeamFateFilters();
      updateTeamFateBadge();
    }
  });

  // Time filters
  $("tf-time-filters")?.addEventListener("click", (e) => {
    if (e.target.dataset.tfTime) {
      $("tf-time-filters").querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
      e.target.classList.add("is-active");
      teamFateState.filters.time = e.target.dataset.tfTime;
      applyTeamFateFilters();
      updateTeamFateBadge();
    }
  });

  // Filter toggle
  const toggleBtn = document.querySelector('[data-filter-panel="tf-side-panel"]');
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const panel = $("tf-side-panel");
      const isCollapsed = panel.classList.contains("is-collapsed");
      panel.classList.toggle("is-collapsed");
      toggleBtn.setAttribute("aria-expanded", isCollapsed ? "true" : "false");
    });
  }
}

function applyTeamFateFilters() {
  const { query, region, time } = teamFateState.filters;

  teamFateState.filteredRoutes = teamFateState.routes.filter(route => {
    const matchesQuery = !query ||
      route.name.toLowerCase().includes(query) ||
      route.pokemon.toLowerCase().includes(query);

    const matchesRegion = region === "All" || route.region === region;
    const matchesTime = time === "All" || route.time === time;

    return matchesQuery && matchesRegion && matchesTime;
  });

  renderTeamFateRoutes();
}

function updateTeamFateBadge() {
  const { region, time } = teamFateState.filters;
  let activeCount = 0;
  if (region !== "All") activeCount++;
  if (time !== "All") activeCount++;

  const badge = $("tf-side-badge");
  if (badge) {
    badge.textContent = activeCount;
    badge.classList.toggle("is-hidden", activeCount === 0);
  }
}

function renderTeamFateRoutes() {
  const list = $("tf-route-list");
  if (!list) return;

  if (teamFateState.filteredRoutes.length === 0) {
    list.innerHTML = '<div class="empty-state"><p class="muted">No routes match your filters.</p></div>';
    return;
  }

  list.innerHTML = teamFateState.filteredRoutes.map(route => {
    const isSelected = teamFateState.selectedRoute?.id === route.id;
    return `
      <button
        type="button"
        class="list-item ${isSelected ? 'is-active' : ''}"
        data-tf-route="${route.id}"
        role="option"
        aria-selected="${isSelected}"
      >
        <div class="item-head">
          <span class="item-name">${escapeHtml(route.name)}</span>
          <span class="item-badge">${escapeHtml(route.horde)}</span>
        </div>
        <div class="item-meta">
          <span>${escapeHtml(route.pokemon)}</span>
          <span class="item-sep">·</span>
          <span>${escapeHtml(route.region)}</span>
        </div>
      </button>
    `;
  }).join("");

  // Attach click listeners
  list.querySelectorAll("[data-tf-route]").forEach(btn => {
    btn.addEventListener("click", () => {
      const routeId = parseInt(btn.dataset.tfRoute);
      selectTeamFateRoute(routeId);
    });
  });
}

function selectTeamFateRoute(routeId) {
  const route = teamFateState.routes.find(r => r.id === routeId);
  if (!route) return;

  teamFateState.selectedRoute = route;
  renderTeamFateRoutes();
  renderTeamFateDetail(route);

  $("tf-empty")?.classList.add("is-hidden");
  $("tf-detail")?.classList.remove("is-hidden");
}

function renderTeamFateDetail(route) {
  const regionChip = $("tf-detail-region");
  const nameEl = $("tf-detail-name");
  const metaEl = $("tf-detail-meta");
  const statsEl = $("tf-stats");

  if (regionChip) regionChip.textContent = route.region;
  if (nameEl) nameEl.textContent = route.name;
  if (metaEl) metaEl.textContent = `${route.pokemon} · ${route.method}`;

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="season-group">
        <h3 class="group-season">Hunt Details</h3>
        <div class="enc-table">
          <div class="enc-row enc-head">
            <div>Metric</div>
            <div>Value</div>
          </div>
          <div class="enc-row">
            <div>Pokémon</div>
            <div class="enc-rate"><strong>${escapeHtml(route.pokemon)}</strong></div>
          </div>
          <div class="enc-row">
            <div>Horde Type</div>
            <div class="enc-rate"><strong>${escapeHtml(route.horde)}</strong></div>
          </div>
          <div class="enc-row">
            <div>Encounters/Hour</div>
            <div class="enc-rate"><strong>${route.encountersPerHour.toLocaleString()}</strong></div>
          </div>
          <div class="enc-row">
            <div>Best Time</div>
            <div class="enc-rate"><strong>${escapeHtml(route.time)}</strong></div>
          </div>
          <div class="enc-row">
            <div>Method</div>
            <div class="enc-rate"><strong>${escapeHtml(route.method)}</strong></div>
          </div>
          <div class="enc-row">
            <div>Region</div>
            <div class="enc-rate"><strong>${escapeHtml(route.region)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTeamFate);
} else {
  initTeamFate();
}
