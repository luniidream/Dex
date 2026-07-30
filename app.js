const SPRITE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const SEASON_EMOJI = {
  Any: "✨",
  Spring: "🌸",
  Summer: "☀️",
  Autumn: "🍂",
  Winter: "❄️",
};

const MODE_FILTERS = [
  { id: "all", label: "All" },
  { id: "single", label: "Single" },
  { id: "horde", label: "Any Horde" },
  { id: "horde3", label: "3× Horde" },
  { id: "horde5", label: "5× Horde" },
];

const METHOD_FILTERS = [
  { id: "all", label: "All methods" },
  { id: "grass", label: "Grass" },
  { id: "dark-grass", label: "Dark Grass" },
  { id: "cave", label: "Cave" },
  { id: "water", label: "Water" },
  { id: "fishing", label: "Fishing" },
  { id: "old-rod", label: "Old Rod" },
  { id: "good-rod", label: "Good Rod" },
  { id: "super-rod", label: "Super Rod" },
  { id: "rocks", label: "Rocks" },
  { id: "headbutt", label: "Headbutt" },
  { id: "inside", label: "Inside" },
  { id: "dust", label: "Dust Cloud" },
  { id: "shadow", label: "Shadow" },
  { id: "honey", label: "Honey Tree" },
  { id: "sweet-scent", label: "Sweet Scent" },
  { id: "lure", label: "Lure only" },
  { id: "special", label: "Special" },
];

const state = {
  data: null,
  byPokemon: new Map(),
  page: "locations",
  loc: {
    query: "",
    region: "All",
    season: "All",
    mode: "all",
    method: "all",
    selectedKey: null,
  },
  poke: {
    query: "",
    region: "All",
    season: "All",
    mode: "all",
    method: "all",
    selectedId: null,
  },
  hunt: {
    season: "Any",
    prefer: "best",
    query: "",
    selectedId: null,
  },
};

const $ = (id) => document.getElementById(id);

function locKey(loc) {
  return `${loc.id}::${loc.name}::${loc.region}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueIds(entries) {
  return new Set(entries.map((e) => e.id)).size;
}

function parsePercent(rarity) {
  if (!rarity || rarity === "--" || rarity === "Lure" || rarity === "Special") {
    return null;
  }
  const n = parseFloat(String(rarity).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function isSweetScentHabitat(e) {
  return (e?.encounter || "").toLowerCase() === "sweet scent";
}

function hordeRateScaleFor(e) {
  return isHorde(e) && !isSweetScentHabitat(e) ? state.data.hordeRateScale || 20 : 1;
}

function sweetScentRate(rarity, entryOrScale = 20) {
  const n = parsePercent(rarity);
  if (n == null) return null;
  const scale = typeof entryOrScale === "number" ? entryOrScale : hordeRateScaleFor(entryOrScale);
  const pct = Math.min(100, Math.round(n * scale * 100) / 100);
  return `${pct}%`;
}

function isHorde(e) {
  return !!(e.horde3 || e.horde5);
}

function hordeLabel(e) {
  if (e.horde5) return "5× Horde";
  if (e.horde3) return "3× Horde";
  return "Single";
}

function hordeSize(e) {
  if (e.horde5) return 5;
  if (e.horde3) return 3;
  return 1;
}

function levelLabel(e) {
  if (e.minLevel == null && e.maxLevel == null) return "";
  if (e.minLevel === e.maxLevel) return `Lv ${e.minLevel}`;
  return `Lv ${e.minLevel}–${e.maxLevel}`;
}

function matchesMode(e, mode) {
  if (mode === "all") return true;
  if (mode === "single") return !isHorde(e);
  if (mode === "horde") return isHorde(e);
  if (mode === "horde3") return !!e.horde3 && !e.horde5;
  if (mode === "horde5") return !!e.horde5;
  return true;
}

function matchesMethod(e, method) {
  if (method === "all") return true;
  const t = (e.encounter || "").toLowerCase();
  const rarities = [e.morning, e.day, e.night];

  switch (method) {
    case "grass":
      return t === "grass";
    case "dark-grass":
      return t === "dark grass";
    case "cave":
      return t === "cave";
    case "water":
      return t === "water";
    case "fishing":
      return ["fishing", "old rod", "good rod", "super rod"].includes(t);
    case "old-rod":
      return t === "old rod";
    case "good-rod":
      return t === "good rod";
    case "super-rod":
      return t === "super rod";
    case "rocks":
      return t === "rocks";
    case "headbutt":
      return t === "headbutt";
    case "inside":
      return t === "inside";
    case "dust":
      return t === "dust cloud";
    case "shadow":
      return t === "shadow";
    case "honey":
      return t === "honey tree";
    case "sweet-scent":
      return t === "sweet scent";
    case "lure":
      return rarities.some((r) => r === "Lure");
    case "special":
      return rarities.some((r) => r === "Special");
    default:
      return true;
  }
}

function matchesSeason(e, season) {
  if (!season || season === "All" || season === "Any") return true;
  return e.season === season || e.season === "Any";
}

function filterEncounters(entries, { season, mode, method, region }) {
  return entries.filter((e) => {
    if (season && season !== "All" && e.season !== season) return false;
    if (!matchesMode(e, mode || "all")) return false;
    if (!matchesMethod(e, method || "all")) return false;
    if (region && region !== "All" && e.region !== region) return false;
    return true;
  });
}

function groupBySeason(entries) {
  const order = ["Any", "Spring", "Summer", "Autumn", "Winter"];
  const map = {};
  for (const e of entries) {
    if (!map[e.season]) map[e.season] = [];
    map[e.season].push(e);
  }
  const sorted = {};
  for (const s of order) if (map[s]) sorted[s] = map[s];
  for (const s of Object.keys(map)) if (!sorted[s]) sorted[s] = map[s];
  return sorted;
}

function rarityChips(e, showSweetScent) {
  const times = [
    { icon: "🌅", key: "morning", label: "Morning" },
    { icon: "☀️", key: "day", label: "Day" },
    { icon: "🌙", key: "night", label: "Night" },
  ];
  return times
    .map(({ icon, key, label }) => {
      const raw = e[key];
      if (!raw || raw === "--") {
        return `<span class="rarity is-none" title="${label}">${icon} —</span>`;
      }
      if (showSweetScent && isHorde(e)) {
        const ss = sweetScentRate(raw, e);
        if (ss) return `<span class="rarity" title="${label}">${icon} ${ss} horde</span>`;
      }
      return `<span class="rarity" title="${label}">${icon} ${escapeHtml(raw)} single</span>`;
    })
    .join("");
}

function modeBadge(e) {
  const cls = e.horde5 ? "badge-horde5" : e.horde3 ? "badge-horde3" : "badge-single";
  return `<span class="badge ${cls}">${hordeLabel(e)}</span>`;
}

function renderChips(container, items, active, dataAttr) {
  if (!container) return;
  container.innerHTML = items
    .map((item) => {
      const id = typeof item === "string" ? item : item.id;
      const label = typeof item === "string" ? item : item.label;
      const on = active === id ? " is-active" : "";
      return `<button type="button" class="chip${on}" data-${dataAttr}="${id}">${label}</button>`;
    })
    .join("");
}

function activeFilterCount(scope) {
  let n = 0;
  if (scope === "loc-side") {
    if (state.loc.region !== "All") n++;
  } else if (scope === "loc-detail") {
    if (state.loc.season !== "All") n++;
    if (state.loc.mode !== "all") n++;
    if (state.loc.method !== "all") n++;
  } else if (scope === "poke-side") {
    if (state.poke.region !== "All") n++;
    if (state.poke.season !== "All") n++;
    if (state.poke.mode !== "all") n++;
    if (state.poke.method !== "all") n++;
  }
  return n;
}

function updateFilterBadges() {
  const pairs = [
    ["loc-side-badge", "loc-side"],
    ["loc-detail-badge", "loc-detail"],
    ["poke-side-badge", "poke-side"],
  ];
  for (const [id, scope] of pairs) {
    const el = $(id);
    if (!el) continue;
    const n = activeFilterCount(scope);
    el.textContent = String(n);
    el.classList.toggle("is-hidden", n === 0);
  }
}

/* ---------- Routing ---------- */

function setHash() {
  if (state.page === "pokemon") {
    const id = state.poke.selectedId;
    location.hash = id ? `#/pokemon/${id}` : "#/pokemon";
  } else if (state.page === "hunt") {
    const id = state.hunt.selectedId;
    const season = state.hunt.season;
    location.hash = id
      ? `#/hunt/${id}/${encodeURIComponent(season)}`
      : "#/hunt";
  } else if (state.page === "shinywars") {
    location.hash = "#/shinywars";
  } else {
    const key = state.loc.selectedKey;
    location.hash = key
      ? `#/locations/${encodeURIComponent(key)}`
      : "#/locations";
  }
}

function readHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [page, ...rest] = h.split("/");
  if (page === "pokemon") {
    state.page = "pokemon";
    const id = parseInt(rest[0], 10);
    state.poke.selectedId = Number.isFinite(id) ? id : null;
  } else if (page === "hunt") {
    state.page = "hunt";
    const id = parseInt(rest[0], 10);
    state.hunt.selectedId = Number.isFinite(id) ? id : null;
    if (rest[1]) {
      try {
        state.hunt.season = decodeURIComponent(rest[1]);
      } catch {
        state.hunt.season = rest[1];
      }
    }
  } else if (page === "shinywars") {
    state.page = "shinywars";
  } else if (page === "locations" || !page) {
    state.page = "locations";
    if (rest[0]) {
      try {
        state.loc.selectedKey = decodeURIComponent(rest.join("/"));
      } catch {
        state.loc.selectedKey = rest.join("/");
      }
    }
  }
}

function showPage() {
  const page = state.page;
  $("page-locations").classList.toggle("is-hidden", page !== "locations");
  $("page-pokemon").classList.toggle("is-hidden", page !== "pokemon");
  $("page-hunt").classList.toggle("is-hidden", page !== "hunt");
  $("nav-locations")?.classList.toggle("is-active", page === "locations");
  $("nav-pokemon")?.classList.toggle("is-active", page === "pokemon");
  $("nav-hunt")?.classList.toggle("is-active", page === "hunt");

  if (page === "shinywars") {
    window.ShinyWars?.show();
  } else {
    window.ShinyWars?.hide();
  }
}

function goPage(page, opts = {}) {
  state.page = page;
  if (opts.pokeId != null) state.poke.selectedId = opts.pokeId;
  if (opts.locKey != null) state.loc.selectedKey = opts.locKey;
  if (opts.huntId != null) state.hunt.selectedId = opts.huntId;
  showPage();
  setHash();
  refresh();
}
window.goPage = goPage;

/* ---------- Locations ---------- */

function filteredLocations() {
  const q = state.loc.query.trim().toLowerCase();
  return state.data.locations.filter((loc) => {
    if (state.loc.region !== "All" && loc.region !== state.loc.region) return false;

    const entries = filterEncounters(loc.pokemon, {
      season: state.loc.season,
      mode: state.loc.mode,
      method: state.loc.method,
    });
    if (
      !entries.length &&
      (state.loc.mode !== "all" ||
        state.loc.method !== "all" ||
        state.loc.season !== "All")
    ) {
      return false;
    }

    if (!q) return true;
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.region.toLowerCase().includes(q) ||
      (loc.shortName && loc.shortName.toLowerCase().includes(q))
    );
  });
}

function locEntries(loc) {
  return filterEncounters(loc.pokemon, {
    season: state.loc.season,
    mode: state.loc.mode,
    method: state.loc.method,
  });
}

function renderLocationList() {
  const list = filteredLocations();
  $("loc-count").textContent = `${list.length} area${list.length === 1 ? "" : "s"}`;

  if (!list.length) {
    $("location-list").innerHTML =
      '<p class="muted" style="padding:0.75rem 0.7rem">No locations match.</p>';
    return;
  }

  $("location-list").innerHTML = list
    .map((loc) => {
      const key = locKey(loc);
      const count = uniqueIds(locEntries(loc));
      const active = state.loc.selectedKey === key ? " is-active" : "";
      return `
        <button type="button" class="loc-item${active}" data-loc-key="${encodeURIComponent(key)}">
          <span class="loc-name">${escapeHtml(loc.name)}</span>
          <span class="loc-count">${count}</span>
          <span class="loc-region">${escapeHtml(loc.region)}</span>
        </button>`;
    })
    .join("");
}

function renderLocationDetail() {
  const loc = state.data.locations.find((l) => locKey(l) === state.loc.selectedKey);

  if (!loc) {
    $("loc-empty").classList.remove("is-hidden");
    $("loc-detail").classList.add("is-hidden");
    return;
  }

  const entries = locEntries(loc);
  $("loc-empty").classList.add("is-hidden");
  $("loc-detail").classList.remove("is-hidden");
  $("loc-detail-region").textContent = loc.region;
  $("loc-detail-name").textContent = loc.name;
  $("loc-detail-meta").textContent = `${uniqueIds(entries)} Pokémon · ${entries.length} encounter${entries.length === 1 ? "" : "s"}`;

  if (!entries.length) {
    $("loc-groups").innerHTML = '<p class="muted">Nothing matches these filters.</p>';
    return;
  }

  const bySeason = groupBySeason(entries);
  $("loc-groups").innerHTML = Object.entries(bySeason)
    .map(([season, list]) => {
      const cards = list
        .map(
          (e) => `
            <button type="button" class="poke-card is-button" data-goto-poke="${e.id}">
              <img src="${SPRITE}/${e.id}.png" alt="" loading="lazy" width="72" height="72"
                onerror="this.src='${SPRITE}/0.png';this.onerror=null;" />
              <p class="poke-name">${escapeHtml(e.name)}</p>
              <div class="badge-row">${modeBadge(e)}</div>
              <p class="poke-meta">${escapeHtml(e.encounter)}${levelLabel(e) ? " · " + levelLabel(e) : ""}</p>
              <div class="poke-rarities">${rarityChips(e, true)}</div>
            </button>`
        )
        .join("");

      return `
        <section class="season-block">
          <h3 class="season-title" data-season="${escapeHtml(season)}">
            <span class="dot" aria-hidden="true"></span>
            ${SEASON_EMOJI[season] || "📍"} ${escapeHtml(season)}
            <span class="muted season-count">(${uniqueIds(list)})</span>
          </h3>
          <div class="poke-grid">${cards}</div>
        </section>`;
    })
    .join("");
}

/* ---------- Pokémon ---------- */

function allEncountersForPokemon(id) {
  return state.byPokemon.get(id) || [];
}

function buildPokemonIndex() {
  const map = new Map();
  for (const loc of state.data.locations) {
    const key = locKey(loc);
    for (const e of loc.pokemon) {
      if (!map.has(e.id)) map.set(e.id, []);
      map.get(e.id).push({
        ...e,
        locationKey: key,
        locationName: loc.name,
        region: loc.region,
      });
    }
  }
  state.byPokemon = map;
}

function filteredPokemon() {
  const q = state.poke.query.trim().toLowerCase();
  return state.data.pokemon.filter((p) => {
    const encounters = filterEncounters(allEncountersForPokemon(p.id), {
      season: state.poke.season,
      mode: state.poke.mode,
      method: state.poke.method,
      region: state.poke.region,
    });

    if (
      state.poke.mode !== "all" ||
      state.poke.method !== "all" ||
      state.poke.season !== "All" ||
      state.poke.region !== "All"
    ) {
      if (!encounters.length) return false;
    } else if (!p.locationCount) {
      return false;
    }

    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      String(p.id).includes(q) ||
      String(p.id).padStart(3, "0").includes(q)
    );
  });
}

function renderPokemonList() {
  const list = filteredPokemon();
  $("poke-count").textContent = `${list.length} species`;

  if (!list.length) {
    $("pokemon-list").innerHTML =
      '<p class="muted" style="padding:0.75rem 0.7rem">No Pokémon match.</p>';
    return;
  }

  $("pokemon-list").innerHTML = list
    .map((p) => {
      const active = state.poke.selectedId === p.id ? " is-active" : "";
      const encounters = filterEncounters(allEncountersForPokemon(p.id), {
        season: state.poke.season,
        mode: state.poke.mode,
        method: state.poke.method,
        region: state.poke.region,
      });
      const locCount = new Set(encounters.map((e) => e.locationKey)).size;
      return `
        <button type="button" class="loc-item poke-list-item${active}" data-poke-id="${p.id}">
          <img class="list-sprite" src="${SPRITE}/${p.id}.png" alt="" loading="lazy" width="40" height="40"
            onerror="this.src='${SPRITE}/0.png';this.onerror=null;" />
          <span class="loc-name">#${String(p.id).padStart(3, "0")} ${escapeHtml(p.name)}</span>
          <span class="loc-count">${locCount}</span>
          <span class="loc-region">${locCount} location${locCount === 1 ? "" : "s"}</span>
        </button>`;
    })
    .join("");
}

function regionBadgeClass(region) {
  const map = {
    Kanto: "region-kanto",
    Johto: "region-johto",
    Hoenn: "region-hoenn",
    Sinnoh: "region-sinnoh",
    Unova: "region-unova",
  };
  return map[region] || "region-default";
}

function bestRateLine(e) {
  const slots = [
    { key: "morning", label: "Morning", raw: e.morning },
    { key: "day", label: "Day", raw: e.day },
    { key: "night", label: "Night", raw: e.night },
  ];
  let best = null;
  for (const s of slots) {
    const pct = parsePercent(s.raw);
    if (pct == null) continue;
    if (!best || pct > best.pct) best = { ...s, pct };
  }
  if (best) {
    const ss = isHorde(e) ? sweetScentRate(best.raw, e) : null;
    return {
      label: best.label,
      value: ss ? `${ss} horde` : `${best.raw} single`,
    };
  }
  for (const s of slots) {
    if (s.raw && s.raw !== "--") return { label: s.label, value: s.raw };
  }
  return { label: "Rate", value: "—" };
}

function renderPokemonDetail() {
  const poke = state.data.pokemon.find((p) => p.id === state.poke.selectedId);

  if (!poke) {
    $("poke-empty").classList.remove("is-hidden");
    $("poke-detail").classList.add("is-hidden");
    return;
  }

  const entries = filterEncounters(allEncountersForPokemon(poke.id), {
    season: state.poke.season,
    mode: state.poke.mode,
    method: state.poke.method,
    region: state.poke.region,
  });

  $("poke-empty").classList.add("is-hidden");
  $("poke-detail").classList.remove("is-hidden");
  $("poke-detail-sprite").src = `${SPRITE}/${poke.id}.png`;
  $("poke-detail-sprite").alt = poke.name;
  $("poke-detail-id").textContent = `#${String(poke.id).padStart(3, "0")}`;
  $("poke-detail-name").textContent = poke.name;

  const locCount = new Set(entries.map((e) => e.locationKey)).size;
  const hordeCount = entries.filter(isHorde).length;
  $("poke-detail-meta").textContent = `${locCount} location${locCount === 1 ? "" : "s"} · ${entries.length - hordeCount} single · ${hordeCount} horde`;

  if (!entries.length) {
    $("poke-groups").innerHTML = '<p class="muted">Nothing matches these filters.</p>';
    return;
  }

  const cards = [...entries]
    .sort((a, b) => {
      if (a.region !== b.region) return a.region.localeCompare(b.region);
      if (a.locationName !== b.locationName) return a.locationName.localeCompare(b.locationName);
      const seasonOrder = { Any: 0, Spring: 1, Summer: 2, Autumn: 3, Winter: 4 };
      return (seasonOrder[a.season] ?? 9) - (seasonOrder[b.season] ?? 9);
    })
    .map((e) => {
      const rate = bestRateLine(e);
      const level =
        e.minLevel != null && e.maxLevel != null
          ? e.minLevel === e.maxLevel
            ? String(e.minLevel)
            : `${e.minLevel}-${e.maxLevel}`
          : "—";
      return `
        <button type="button" class="spot-card" data-goto-loc="${encodeURIComponent(e.locationKey)}" title="Open ${escapeHtml(e.locationName)}">
          <div class="spot-card-head">
            <span class="spot-name">${escapeHtml(e.locationName)}</span>
            <span class="spot-region ${regionBadgeClass(e.region)}">${escapeHtml(e.region)}</span>
          </div>
          <dl class="spot-meta">
            <div><dt>Level</dt><dd>${escapeHtml(level)}</dd></div>
            <div><dt>Season</dt><dd>${SEASON_EMOJI[e.season] || ""} ${escapeHtml(e.season)}</dd></div>
            <div><dt>${escapeHtml(rate.label)}</dt><dd>${escapeHtml(rate.value)}</dd></div>
            <div><dt>Horde</dt><dd>${escapeHtml(hordeLabel(e))}</dd></div>
            <div><dt>Habitat</dt><dd>${escapeHtml(e.encounter)}</dd></div>
          </dl>
          <div class="spot-times">${rarityChips(e, true)}</div>
        </button>`;
    })
    .join("");

  $("poke-groups").innerHTML = `
    <div class="spot-section">
      <h3 class="spot-section-title">Locations</h3>
      <div class="spot-grid">${cards}</div>
    </div>`;
}

/* ---------- Hunt advisor ---------- */

function resolvePokemonQuery(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  const byId = parseInt(q, 10);
  if (/^\d+$/.test(q) && Number.isFinite(byId)) {
    return state.data.pokemon.find((p) => p.id === byId) || null;
  }
  const exact = state.data.pokemon.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;
  return (
    state.data.pokemon.find((p) => p.name.toLowerCase().startsWith(q)) ||
    state.data.pokemon.find((p) => p.name.toLowerCase().includes(q)) ||
    null
  );
}

function bestTimeSlot(e) {
  const slots = [
    { key: "morning", icon: "🌅", label: "Morning", raw: e.morning },
    { key: "day", icon: "☀️", label: "Day", raw: e.day },
    { key: "night", icon: "🌙", label: "Night", raw: e.night },
  ];
  let best = null;
  for (const s of slots) {
    const pct = parsePercent(s.raw);
    if (pct == null) continue;
    if (!best || pct > best.pct) best = { ...s, pct };
  }
  if (best) return best;
  for (const s of slots) {
    if (s.raw && s.raw !== "--") return { ...s, pct: s.raw === "Lure" ? 5 : 1 };
  }
  return { key: "day", icon: "☀️", label: "Day", raw: "--", pct: 0 };
}

/** Effective species % for hunting; Sweet Scent habitats are already final horde odds. */
function effectiveChance(listedPct, entry) {
  if (listedPct == null) return null;
  if (isHorde(entry)) return Math.min(100, listedPct * hordeRateScaleFor(entry));
  return listedPct;
}

function timeSlotChances(e) {
  return [
    { key: "morning", icon: "🌅", label: "Morning", raw: e.morning },
    { key: "day", icon: "☀️", label: "Day", raw: e.day },
    { key: "night", icon: "🌙", label: "Night", raw: e.night },
  ]
    .map((s) => {
      const listed = parsePercent(s.raw);
      const chance = effectiveChance(listed, e);
      return { ...s, listed, chance };
    })
    .filter((s) => s.chance != null);
}

function scoreEncounter(e, prefer) {
  const size = hordeSize(e);
  const isH = isHorde(e);
  const slot = bestTimeSlot(e);
  const slots = timeSlotChances(e);

  // Average across morning/day/night so a night drop actually hurts rank
  let avgChance = 0;
  if (slots.length) {
    avgChance = slots.reduce((sum, s) => sum + s.chance, 0) / slots.length;
  } else {
    avgChance = effectiveChance(slot.pct, e) || 0;
  }

  // Consistency: penalize spots that swing a lot (e.g. 100/100/50)
  let consistency = 1;
  if (slots.length >= 2) {
    const vals = slots.map((s) => s.chance);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    consistency = max > 0 ? 0.65 + 0.35 * (min / max) : 0.65;
  }

  // Peak chance (for display / tip)
  const peakChance = slots.length
    ? Math.max(...slots.map((s) => s.chance))
    : avgChance;

  let expected = (avgChance / 100) * size * consistency;

  const method = (e.encounter || "").toLowerCase();
  // Mild method preferences only — never override exclusivity / consistency
  if (method.includes("rod") || method === "fishing") expected *= 0.8;
  if (method === "honey tree" || method === "headbutt") expected *= 0.55;
  if (method === "dust cloud" || method === "shadow") expected *= 0.7;
  if ([e.morning, e.day, e.night].includes("Lure")) expected *= 0.45;
  if ([e.morning, e.day, e.night].includes("Special")) expected *= 0.5;

  // Tiny tie-breaker: Sweet Scent–friendly tiles over dark grass / rocks
  if (isH && ["grass", "cave", "water", "inside"].includes(method)) expected *= 1.03;

  if (prefer === "horde" && !isH) expected *= 0.05;
  if (prefer === "single" && isH) expected *= 0.05;
  if (prefer === "best" && isH) expected *= 1.04;
  if (prefer === "horde" && isH && method === "dark grass") expected *= 0.97;

  if (e.season !== "Any") expected *= 1.01;

  return {
    score: expected,
    speciesChance: peakChance,
    avgChance,
    listed: slot.pct,
    size,
    slot,
    consistency,
    slots,
  };
}

/** Same location + method + season + horde size = one encounter pool / split. */
function getEncounterPool(entry) {
  const loc = state.data.locations.find((l) => locKey(l) === entry.locationKey);
  if (!loc) return [];
  const size = hordeSize(entry);
  return loc.pokemon.filter(
    (p) =>
      p.encounter === entry.encounter &&
      p.season === entry.season &&
      hordeSize(p) === size
  );
}

function poolRateForSlot(p, slotKey) {
  const raw = p[slotKey];
  const pct = parsePercent(raw);
  if (pct != null) return { raw, pct, label: `${pct}%` };
  if (raw && raw !== "--") return { raw, pct: null, label: raw };
  return { raw: "--", pct: null, label: "—" };
}

function renderPoolSplit(entry, targetId) {
  const pool = getEncounterPool(entry);
  if (!pool.length) return "";

  const scale = state.data.hordeRateScale || 20;
  const isH = isHorde(entry);
  const modeName = hordeLabel(entry);
  const times = [
    { key: "morning", icon: "🌅" },
    { key: "day", icon: "☀️" },
    { key: "night", icon: "🌙" },
  ];

  // Dedupe species; keep one row each
  const byId = new Map();
  for (const p of pool) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  const members = [...byId.values()].sort((a, b) => {
    if (a.id === targetId) return -1;
    if (b.id === targetId) return 1;
    return a.name.localeCompare(b.name);
  });

  // Only species that appear in at least one time slot
  const visible = members.filter((p) =>
    times.some((t) => parsePercent(p[t.key]) != null || (p[t.key] && p[t.key] !== "--"))
  );

  const chips = visible
    .map((p) => {
      const isTarget = p.id === targetId;
      const parts = times
        .map((t) => {
          const rate = poolRateForSlot(p, t.key);
          if (rate.pct == null && rate.label === "—") return null;
          if (rate.pct != null && isH) {
            const ss = Math.min(100, Math.round(rate.pct * scale * 100) / 100);
            return `${t.icon}${rate.pct}%→${ss}%`;
          }
          return `${t.icon}${rate.label}`;
        })
        .filter(Boolean)
        .join(" ");

      // Relative pool share using average of available SS/walk chances
      let shareNote = "";
      if (isH) {
        const avgSlots = times
          .map((t) => parsePercent(p[t.key]))
          .filter((n) => n != null);
        if (avgSlots.length) {
          const avgListed = avgSlots.reduce((a, b) => a + b, 0) / avgSlots.length;
          // Compare to sum of averages in pool for rough share
          let poolAvgSum = 0;
          for (const other of visible) {
            const os = times
              .map((t) => parsePercent(other[t.key]))
              .filter((n) => n != null);
            if (os.length) {
              poolAvgSum +=
                (os.reduce((a, b) => a + b, 0) / os.length) * scale;
            }
          }
          const mine = Math.min(100, avgListed * scale);
          if (poolAvgSum > 0) {
            shareNote = ` · ~${Math.round((mine / Math.min(poolAvgSum, 999)) * 100)}% of pool`;
          }
        }
      }

      return `
        <div class="split-chip${isTarget ? " is-target" : ""}" title="${escapeHtml(p.name)}">
          <img src="${SPRITE}/${p.id}.png" alt="" width="32" height="32" loading="lazy"
            onerror="this.src='${SPRITE}/0.png';this.onerror=null;" />
          <div class="split-text">
            <span class="split-name">${isTarget ? "★ " : ""}${escapeHtml(p.name)}</span>
            <span class="split-rate">${escapeHtml(parts)}${escapeHtml(shareNote)}</span>
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="pool-split">
      <p class="pool-split-title">${escapeHtml(modeName)} split · ${escapeHtml(entry.encounter)}</p>
      <p class="muted pool-split-sub">Who shares this encounter table (${visible.length} species) · rates by time of day</p>
      <div class="split-grid">${chips}</div>
    </div>`;
}

function rankHuntSpots(pokeId, season, prefer) {
  const entries = allEncountersForPokemon(pokeId).filter((e) =>
    matchesSeason(e, season)
  );

  const scored = entries
    .map((e) => {
      const meta = scoreEncounter(e, prefer);
      return { e, ...meta };
    })
    .filter((row) => {
      if (prefer === "horde") return isHorde(row.e);
      if (prefer === "single") return !isHorde(row.e);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  return scored;
}

function fillHuntDatalist() {
  const dl = $("hunt-poke-datalist");
  if (!dl) return;
  dl.innerHTML = state.data.pokemon
    .map(
      (p) =>
        `<option value="${escapeHtml(p.name)}">#${String(p.id).padStart(3, "0")}</option>`
    )
    .join("");
}

function renderHuntSeasons() {
  const seasons = [
    { id: "Any", label: "✨ Any season" },
    ...["Spring", "Summer", "Autumn", "Winter"].map((s) => ({
      id: s,
      label: `${SEASON_EMOJI[s] || ""} ${s}`,
    })),
  ];
  renderChips($("hunt-season-filters"), seasons, state.hunt.season, "hunt-season");

  const preferEl = $("hunt-prefer-filters");
  if (preferEl) {
    [...preferEl.querySelectorAll("[data-prefer]")].forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.prefer === state.hunt.prefer);
    });
  }
}

function renderHuntResults() {
  const box = $("hunt-results");
  const poke = state.data.pokemon.find((p) => p.id === state.hunt.selectedId);

  if (!poke) {
    box.innerHTML = `
      <div class="empty-state hunt-empty">
        <p class="empty-kicker">Ready when you are</p>
        <h2>Pick a target</h2>
        <p class="muted">Skip season with <strong>Any</strong> to learn the best season and spot, plus who shares the horde/single pool.</p>
      </div>`;
    return;
  }

  const ranked = rankHuntSpots(poke.id, state.hunt.season, state.hunt.prefer);
  const anyMode = state.hunt.season === "Any";

  if (!ranked.length) {
    box.innerHTML = `
      <div class="hunt-summary">
        <img src="${SPRITE}/${poke.id}.png" alt="" width="72" height="72" />
        <div>
          <h2>${escapeHtml(poke.name)}</h2>
          <p class="muted">No encounters found for ${escapeHtml(state.hunt.season)} with this preference.</p>
        </div>
      </div>`;
    return;
  }

  const best = ranked[0];
  const bestSeasonLabel = `${SEASON_EMOJI[best.e.season] || ""} ${best.e.season}`;
  const avg = Math.round(best.avgChance ?? best.speciesChance);
  let tip;
  if (anyMode) {
    tip = isHorde(best.e)
      ? `Best season is ${bestSeasonLabel.trim()} at ${best.e.locationName} — about ${avg}% across the whole day for a ${best.size}× horde.`
      : `Best season is ${bestSeasonLabel.trim()} at ${best.e.locationName} — about ${avg}% across the day (${best.slot.label} peak ${best.listed}%).`;
  } else {
    tip = isHorde(best.e)
      ? `About ${avg}% across the day here · peak ~${Math.round(best.speciesChance)}% · ${best.size}× horde.`
      : `Best at ${best.slot.label.toLowerCase()} (${best.listed}%) · about ${avg}% averaged across the day.`;
  }

  const rows = ranked
    .slice(0, 12)
    .map((row, i) => {
      const e = row.e;
      const avgRow = Math.round(row.avgChance ?? row.speciesChance);
      const split = renderPoolSplit(e, poke.id);
      return `
        <article class="hunt-card${i === 0 ? " is-best" : ""}" role="link" tabindex="0" data-goto-loc="${encodeURIComponent(e.locationKey)}" title="Open ${escapeHtml(e.locationName)}">
          ${
            i === 0
              ? `<p class="best-tag">Best ${anyMode ? "season & spot" : "spot"} · click to open</p>`
              : `<p class="rank-tag">#${i + 1}</p>`
          }
          <div class="hunt-card-top">
            <div>
              <h3>${escapeHtml(e.locationName)}</h3>
              <p class="muted">${escapeHtml(e.region)} · ${SEASON_EMOJI[e.season] || ""} ${escapeHtml(e.season)}</p>
            </div>
            <div class="hunt-score" title="Relative hunt score">${row.score.toFixed(2)}</div>
          </div>
          <div class="enc-main">
            ${modeBadge(e)}
            <span class="enc-method">${escapeHtml(e.encounter)}</span>
            <span class="enc-level muted">${levelLabel(e)}</span>
            <span class="enc-season">${row.slot.icon} Peak: ${escapeHtml(row.slot.label)}</span>
          </div>
          <div class="poke-rarities">${rarityChips(e, true)}</div>
          <p class="hunt-why muted">
            ${
              isHorde(e)
                ? `Day average ≈ ${avgRow}% · peak ≈ ${Math.round(row.speciesChance)}% · ${row.size} per horde`
                : `Day average ≈ ${avgRow}% · peak ${row.listed}% at ${row.slot.label.toLowerCase()}`
            }
          </p>
          ${split}
          <div class="hunt-actions">
            <button type="button" class="chip" data-goto-poke="${poke.id}">Pokémon page</button>
          </div>
        </article>`;
    })
    .join("");

  const seasonChip = anyMode
    ? `Best: ${bestSeasonLabel.trim()}`
    : `${SEASON_EMOJI[state.hunt.season] || ""} ${state.hunt.season}`;

  box.innerHTML = `
    <div class="hunt-summary">
      <img src="${SPRITE}/${poke.id}.png" alt="" width="84" height="84"
        onerror="this.src='${SPRITE}/0.png';this.onerror=null;" />
      <div>
        <p class="region-chip">${escapeHtml(seasonChip)}</p>
        <h2>${escapeHtml(poke.name)}</h2>
        <p class="muted">${tip}</p>
      </div>
    </div>
    <div class="hunt-list">${rows}</div>`;
}

function runHuntFromForm() {
  const poke = resolvePokemonQuery($("hunt-poke-input").value);
  if (!poke) {
    $("hunt-results").innerHTML = `
      <div class="empty-state hunt-empty">
        <p class="empty-kicker">Not found</p>
        <h2>Unknown Pokémon</h2>
        <p class="muted">Try a name like <code>Gible</code> or a number like <code>443</code>.</p>
      </div>`;
    return;
  }
  state.hunt.selectedId = poke.id;
  state.hunt.query = poke.name;
  $("hunt-poke-input").value = poke.name;
  setHash();
  renderHuntResults();
}

/* ---------- Refresh & events ---------- */

function refreshFilters() {
  const regions = ["All", ...state.data.regions];
  const seasons = [
    { id: "All", label: "All seasons" },
    ...state.data.seasons.map((s) => ({
      id: s,
      label: `${SEASON_EMOJI[s] || ""} ${s}`,
    })),
  ];

  renderChips($("loc-region-filters"), regions, state.loc.region, "region");
  renderChips($("loc-season-filters"), seasons, state.loc.season, "season");
  renderChips($("loc-mode-filters"), MODE_FILTERS, state.loc.mode, "mode");
  renderChips($("loc-method-filters"), METHOD_FILTERS, state.loc.method, "method");

  renderChips($("poke-region-filters"), regions, state.poke.region, "region");
  renderChips($("poke-season-filters"), seasons, state.poke.season, "season");
  renderChips($("poke-mode-filters"), MODE_FILTERS, state.poke.mode, "mode");
  renderChips($("poke-method-filters"), METHOD_FILTERS, state.poke.method, "method");

  renderHuntSeasons();
  updateFilterBadges();
}

function refresh() {
  if (state.page === "shinywars") {
    window.ShinyWars?.show();
    return;
  }
  refreshFilters();
  if (state.page === "locations") {
    renderLocationList();
    renderLocationDetail();
  } else if (state.page === "pokemon") {
    renderPokemonList();
    renderPokemonDetail();
  } else if (state.page === "hunt") {
    if (state.hunt.selectedId) {
      const p = state.data.pokemon.find((x) => x.id === state.hunt.selectedId);
      if (p) $("hunt-poke-input").value = p.name;
      renderHuntResults();
    } else {
      renderHuntResults();
    }
  }
}

function bindChipGroup(el, onPick) {
  if (!el) return;
  el.addEventListener("click", (e) => {
    const btn = e.target.closest(
      "[data-region],[data-season],[data-mode],[data-method],[data-hunt-season],[data-prefer]"
    );
    if (!btn || !el.contains(btn)) return;
    if (btn.dataset.region != null) onPick("region", btn.dataset.region);
    else if (btn.dataset.season != null) onPick("season", btn.dataset.season);
    else if (btn.dataset.mode != null) onPick("mode", btn.dataset.mode);
    else if (btn.dataset.method != null) onPick("method", btn.dataset.method);
    else if (btn.dataset.huntSeason != null) onPick("hunt-season", btn.dataset.huntSeason);
    else if (btn.dataset.prefer != null) onPick("prefer", btn.dataset.prefer);
  });
}

function bindFilterToggles() {
  document.querySelectorAll("[data-filter-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = $(btn.dataset.filterPanel);
      if (!panel) return;
      panel.classList.toggle("is-collapsed");
      const collapsed = panel.classList.contains("is-collapsed");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.classList.toggle("is-open", !collapsed);
    });
  });
}

function bindEvents() {
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => goPage(btn.dataset.page));
  });

  bindFilterToggles();

  $("loc-search").addEventListener("input", (e) => {
    state.loc.query = e.target.value;
    renderLocationList();
  });

  $("poke-search").addEventListener("input", (e) => {
    state.poke.query = e.target.value;
    renderPokemonList();
  });

  bindChipGroup($("loc-region-filters"), (_k, v) => {
    state.loc.region = v;
    refresh();
  });
  bindChipGroup($("loc-season-filters"), (_k, v) => {
    state.loc.season = v;
    refresh();
  });
  bindChipGroup($("loc-mode-filters"), (_k, v) => {
    state.loc.mode = v;
    refresh();
  });
  bindChipGroup($("loc-method-filters"), (_k, v) => {
    state.loc.method = v;
    refresh();
  });

  bindChipGroup($("poke-region-filters"), (_k, v) => {
    state.poke.region = v;
    refresh();
  });
  bindChipGroup($("poke-season-filters"), (_k, v) => {
    state.poke.season = v;
    refresh();
  });
  bindChipGroup($("poke-mode-filters"), (_k, v) => {
    state.poke.mode = v;
    refresh();
  });
  bindChipGroup($("poke-method-filters"), (_k, v) => {
    state.poke.method = v;
    refresh();
  });

  bindChipGroup($("hunt-season-filters"), (_k, v) => {
    state.hunt.season = v;
    renderHuntSeasons();
    if (state.hunt.selectedId) {
      setHash();
      renderHuntResults();
    }
  });

  bindChipGroup($("hunt-prefer-filters"), (_k, v) => {
    state.hunt.prefer = v;
    renderHuntSeasons();
    if (state.hunt.selectedId) renderHuntResults();
  });

  $("location-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-loc-key]");
    if (!btn) return;
    state.loc.selectedKey = decodeURIComponent(btn.dataset.locKey);
    setHash();
    renderLocationList();
    renderLocationDetail();
  });

  $("pokemon-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-poke-id]");
    if (!btn) return;
    state.poke.selectedId = parseInt(btn.dataset.pokeId, 10);
    setHash();
    renderPokemonList();
    renderPokemonDetail();
  });

  $("loc-groups").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto-poke]");
    if (!btn) return;
    goPage("pokemon", { pokeId: parseInt(btn.dataset.gotoPoke, 10) });
  });

  $("poke-groups").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto-loc]");
    if (!btn) return;
    goPage("locations", { locKey: decodeURIComponent(btn.dataset.gotoLoc) });
  });

  $("hunt-results").addEventListener("click", (e) => {
    const pokeBtn = e.target.closest("[data-goto-poke]");
    if (pokeBtn) {
      e.stopPropagation();
      goPage("pokemon", { pokeId: parseInt(pokeBtn.dataset.gotoPoke, 10) });
      return;
    }
    const card = e.target.closest("[data-goto-loc]");
    if (card) {
      goPage("locations", { locKey: decodeURIComponent(card.dataset.gotoLoc) });
    }
  });

  $("hunt-results").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".hunt-card[data-goto-loc]");
    if (!card || e.target.closest("[data-goto-poke]")) return;
    e.preventDefault();
    goPage("locations", { locKey: decodeURIComponent(card.dataset.gotoLoc) });
  });

  $("hunt-form").addEventListener("submit", (e) => {
    e.preventDefault();
    runHuntFromForm();
  });

  window.addEventListener("hashchange", () => {
    readHash();
    showPage();
    refresh();
  });
}

async function init() {
  bindEvents();
  window.dexReady = (async () => {
    const [locRes, swRes] = await Promise.all([
      fetch("locations-data.json"),
      fetch("shinywars-meta.json"),
    ]);
    if (!locRes.ok) throw new Error(`locations-data.json HTTP ${locRes.status}`);
    state.data = await locRes.json();
    buildPokemonIndex();

    if (swRes.ok) {
      window.ShinyWarsMeta = await swRes.json();
    }

    if (!state.data.pokemon) {
      state.data.pokemon = [...state.byPokemon.entries()]
        .map(([id, entries]) => ({
          id,
          name: entries[0]?.name || `#${id}`,
          locationCount: new Set(entries.map((e) => e.locationKey)).size,
        }))
        .sort((a, b) => a.id - b.id);
    }
    if (!state.data.hordeRateScale) state.data.hordeRateScale = 20;

    fillHuntDatalist();
    readHash();
    showPage();
    refresh();
    setHash();
  })();

  try {
    await window.dexReady;
  } catch (err) {
    $("loc-count").textContent = "Failed to load";
    $("location-list").innerHTML = `
      <p class="muted" style="padding:0.75rem 0.7rem">
        Could not load <code>locations-data.json</code>. Run a local server (see README).
        ${escapeHtml(err.message)}
      </p>`;
  }
}

init();

/** Shared helpers for Shiny Wars Hunt Router */
window.DexHunt = {
  rankHuntSpots,
  get state() {
    return state;
  },
};
