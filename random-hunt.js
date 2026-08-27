/**
 * Random Shiny Hunt Generator — #/random
 * Picks a random shiny-hunt target from locations-data filters.
 */
(function () {
  const SPRITE =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const SHINY_STATIC = `${SPRITE}/shiny`;
  const SHINY_ANIM =
    `${SPRITE}/versions/generation-v/black-white/animated/shiny`;

  const SEASON_EMOJI = {
    Any: "✨",
    Spring: "🌸",
    Summer: "☀️",
    Autumn: "🍂",
    Winter: "❄️",
  };

  const COLORS = [
    "black",
    "blue",
    "brown",
    "gray",
    "green",
    "pink",
    "purple",
    "red",
    "white",
    "yellow",
  ];

  const ENCOUNTER_OPTIONS = [
    { id: "any", label: "Any" },
    { id: "single", label: "Single" },
    { id: "horde", label: "Horde" },
    { id: "lure", label: "Lure" },
    { id: "no-lure", label: "No lure" },
  ];

  const HORDE_OPTIONS = [
    { id: "any", label: "Any" },
    { id: "normal", label: "Normal / standard" },
    { id: "horde3", label: "3× Horde" },
    { id: "horde5", label: "5× Horde" },
  ];

  const $ = (id) => document.getElementById(id);

  const filters = {
    region: "All",
    color: "All",
    season: "All",
    seasonExclusive: false,
    encounter: "any",
    hordeSize: "any",
  };

  let colorsById = {};
  let lastResult = null;
  let lastPoolSize = 0;
  let bound = false;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function isHorde(e) {
    return !!(e.horde3 || e.horde5);
  }

  function isLure(e) {
    return [e.morning, e.day, e.night].some((r) => r === "Lure");
  }

  function hordeLabel(e) {
    if (e.horde5) return "5× Horde";
    if (e.horde3) return "3× Horde";
    return "Single";
  }

  function matchesEncounter(e, encounter) {
    if (encounter === "any") return true;
    if (encounter === "single") return !isHorde(e);
    if (encounter === "horde") return isHorde(e);
    if (encounter === "lure") return isLure(e);
    if (encounter === "no-lure") return !isLure(e);
    return true;
  }

  function matchesHordeSize(e, hordeSize) {
    if (hordeSize === "any") return true;
    if (hordeSize === "normal") return !isHorde(e);
    if (hordeSize === "horde3") return !!e.horde3 && !e.horde5;
    if (hordeSize === "horde5") return !!e.horde5;
    return true;
  }

  function matchesSeasonFilter(e, season, exclusive) {
    if (!season || season === "All") return true;
    if (exclusive) return e.season === season;
    return e.season === season || e.season === "Any";
  }

  /** Build unique hunt candidates that satisfy ALL filters. */
  function buildPool() {
    const data = window.DexHunt?.state?.data;
    if (!data?.locations) return [];

    const byId = new Map();

    for (const loc of data.locations) {
      if (filters.region !== "All" && loc.region !== filters.region) continue;

      for (const e of loc.pokemon) {
        if (!matchesSeasonFilter(e, filters.season, filters.seasonExclusive)) {
          continue;
        }
        if (!matchesEncounter(e, filters.encounter)) continue;
        if (!matchesHordeSize(e, filters.hordeSize)) continue;

        // Encounter + horde constraints that conflict
        if (filters.encounter === "single" && filters.hordeSize !== "any" && filters.hordeSize !== "normal") {
          continue;
        }
        if (filters.encounter === "horde" && filters.hordeSize === "normal") {
          continue;
        }

        if (filters.color !== "All") {
          const c = colorsById[e.id];
          if (!c || c !== filters.color) continue;
        }

        if (!byId.has(e.id)) {
          byId.set(e.id, {
            id: e.id,
            name: e.name,
            color: colorsById[e.id] || null,
            encounters: [],
          });
        }
        byId.get(e.id).encounters.push({
          region: loc.region,
          location: loc.name,
          locationKey: `${loc.id}::${loc.name}::${loc.region}`,
          season: e.season,
          encounter: e.encounter,
          horde3: !!e.horde3,
          horde5: !!e.horde5,
          lure: isLure(e),
          morning: e.morning,
          day: e.day,
          night: e.night,
        });
      }
    }

    return [...byId.values()];
  }

  function pickRepresentative(candidate) {
    const list = candidate.encounters;
    // Prefer an encounter that best reflects active filters
    let best = list[0];
    let score = -1;
    for (const enc of list) {
      let s = 0;
      if (filters.season !== "All" && enc.season === filters.season) s += 3;
      if (filters.encounter === "horde" && (enc.horde3 || enc.horde5)) s += 2;
      if (filters.encounter === "single" && !enc.horde3 && !enc.horde5) s += 2;
      if (filters.encounter === "lure" && enc.lure) s += 2;
      if (filters.hordeSize === "horde5" && enc.horde5) s += 2;
      if (filters.hordeSize === "horde3" && enc.horde3) s += 2;
      if (s > score) {
        score = s;
        best = enc;
      }
    }
    return best;
  }

  function shinyImg(id, name) {
    return `
      <img
        class="rh-shiny-sprite"
        src="${SHINY_ANIM}/${id}.gif"
        alt="Shiny ${escapeHtml(name)}"
        width="120"
        height="120"
        onerror="this.onerror=null;this.src='${SHINY_STATIC}/${id}.png';this.classList.add('is-static');"
      />`;
  }

  function renderFilters() {
    const data = window.DexHunt?.state?.data;
    const regions = ["All", ...(data?.regions || [])];
    const seasons = ["All", "Spring", "Summer", "Autumn", "Winter"];

    const regionEl = $("rh-region");
    const colorEl = $("rh-color");
    const seasonEl = $("rh-season");
    if (!regionEl) return;

    regionEl.innerHTML = regions
      .map(
        (r) =>
          `<option value="${escapeHtml(r)}"${filters.region === r ? " selected" : ""}>${escapeHtml(r)}</option>`
      )
      .join("");

    colorEl.innerHTML =
      `<option value="All"${filters.color === "All" ? " selected" : ""}>Any color</option>` +
      COLORS.map(
        (c) =>
          `<option value="${c}"${filters.color === c ? " selected" : ""}>${capitalize(c)}</option>`
      ).join("");

    seasonEl.innerHTML = seasons
      .map(
        (s) =>
          `<option value="${escapeHtml(s)}"${filters.season === s ? " selected" : ""}>${
            s === "All" ? "Any season" : `${SEASON_EMOJI[s] || ""} ${s}`
          }</option>`
      )
      .join("");

    $("rh-exclusive").checked = filters.seasonExclusive;

    $("rh-encounter").innerHTML = ENCOUNTER_OPTIONS.map(
      (o) =>
        `<button type="button" class="chip${filters.encounter === o.id ? " is-active" : ""}" data-rh-encounter="${o.id}">${o.label}</button>`
    ).join("");

    $("rh-horde").innerHTML = HORDE_OPTIONS.map(
      (o) =>
        `<button type="button" class="chip${filters.hordeSize === o.id ? " is-active" : ""}" data-rh-horde="${o.id}">${o.label}</button>`
    ).join("");

    updatePoolHint();
  }

  function updatePoolHint() {
    const el = $("rh-pool-hint");
    if (!el) return;
    const n = buildPool().length;
    el.textContent =
      n === 0
        ? "No Pokémon match these filters"
        : `${n} Pokémon in the hunt pool`;
    el.classList.toggle("is-empty", n === 0);
  }

  function renderEmpty(message) {
    $("rh-result").innerHTML = `
      <div class="rh-empty">
        <p class="empty-kicker">No match</p>
        <h2>${escapeHtml(message)}</h2>
        <p class="muted">Try loosening a filter — season exclusive + rare color combos can wipe the pool.</p>
      </div>`;
  }

  function renderResult(candidate, { animate } = { animate: true }) {
    const enc = pickRepresentative(candidate);
    const regions = [...new Set(candidate.encounters.map((e) => e.region))];
    const seasons = [...new Set(candidate.encounters.map((e) => e.season))];

    lastResult = candidate;
    lastPoolSize = buildPool().length;

    const metaBits = [
      `#${String(candidate.id).padStart(3, "0")}`,
      regions.join(" · ") || "—",
    ];
    if (candidate.color) metaBits.push(capitalize(candidate.color));

    const tags = [];
    tags.push(`<span class="rh-tag">${escapeHtml(hordeLabel(enc))}</span>`);
    tags.push(`<span class="rh-tag">${escapeHtml(enc.encounter)}</span>`);
    if (enc.lure) tags.push(`<span class="rh-tag rh-tag-lure">Lure</span>`);
    else tags.push(`<span class="rh-tag">No lure</span>`);
    tags.push(
      `<span class="rh-tag">${SEASON_EMOJI[enc.season] || ""} ${escapeHtml(enc.season)}</span>`
    );
    if (filters.seasonExclusive && enc.season !== "Any") {
      tags.push(`<span class="rh-tag rh-tag-exclusive">${escapeHtml(enc.season)} exclusive</span>`);
    }

    $("rh-result").innerHTML = `
      <article class="rh-card${animate ? " rh-reveal" : ""}" aria-live="polite">
        <div class="rh-sparkle" aria-hidden="true"></div>
        <p class="rh-card-kicker">Your next shiny hunt</p>
        <div class="rh-sprite-wrap">
          ${shinyImg(candidate.id, candidate.name)}
        </div>
        <h2 class="rh-name">${escapeHtml(candidate.name)}</h2>
        <p class="rh-meta">${metaBits.map(escapeHtml).join(" · ")}</p>
        <div class="rh-tags">${tags.join("")}</div>
        <p class="rh-spot muted">
          Example spot: <button type="button" class="rh-link" data-rh-goto-loc="${encodeURIComponent(enc.locationKey)}">${escapeHtml(enc.location)}</button>
          · ${escapeHtml(enc.region)}
        </p>
        <p class="rh-pool muted">${lastPoolSize} in pool · ${candidate.encounters.length} matching encounter${candidate.encounters.length === 1 ? "" : "s"} · seasons: ${seasons.map(escapeHtml).join(", ")}</p>
        <div class="rh-card-actions">
          <button type="button" class="hunt-submit rh-reroll" id="rh-reroll">Reroll</button>
          <button type="button" class="chip" data-rh-goto-poke="${candidate.id}">Open in Dex</button>
        </div>
      </article>`;
  }

  function generate() {
    const pool = buildPool();
    lastPoolSize = pool.length;
    if (!pool.length) {
      lastResult = null;
      renderEmpty("Nothing fits that combination.");
      return;
    }
    // Avoid immediate duplicate when possible
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && lastResult && pick.id === lastResult.id) {
      pick = pool.filter((p) => p.id !== lastResult.id)[
        Math.floor(Math.random() * (pool.length - 1))
      ];
    }
    renderResult(pick, { animate: true });
  }

  function resetFilters() {
    filters.region = "All";
    filters.color = "All";
    filters.season = "All";
    filters.seasonExclusive = false;
    filters.encounter = "any";
    filters.hordeSize = "any";
    lastResult = null;
    renderFilters();
    $("rh-result").innerHTML = `
      <div class="rh-empty rh-ready">
        <p class="empty-kicker">Ready</p>
        <h2>Roll a shiny target</h2>
        <p class="muted">Set filters if you want — or leave them open and see what the cave (and grass) give you.</p>
      </div>`;
  }

  function bind() {
    if (bound) return;
    bound = true;
    const root = $("page-random");
    if (!root) return;

    root.addEventListener("change", (e) => {
      const t = e.target;
      if (t.id === "rh-region") filters.region = t.value;
      else if (t.id === "rh-color") filters.color = t.value;
      else if (t.id === "rh-season") filters.season = t.value;
      else if (t.id === "rh-exclusive") filters.seasonExclusive = t.checked;
      else return;
      updatePoolHint();
    });

    root.addEventListener("click", (e) => {
      const encBtn = e.target.closest("[data-rh-encounter]");
      if (encBtn) {
        filters.encounter = encBtn.dataset.rhEncounter;
        renderFilters();
        return;
      }
      const hordeBtn = e.target.closest("[data-rh-horde]");
      if (hordeBtn) {
        filters.hordeSize = hordeBtn.dataset.rhHorde;
        renderFilters();
        return;
      }
      if (e.target.closest("#rh-generate") || e.target.closest("#rh-reroll")) {
        generate();
        return;
      }
      if (e.target.closest("#rh-reset")) {
        resetFilters();
        return;
      }
      const gotoPoke = e.target.closest("[data-rh-goto-poke]");
      if (gotoPoke && window.goPage) {
        window.goPage("pokemon", {
          pokeId: parseInt(gotoPoke.dataset.rhGotoPoke, 10),
        });
        return;
      }
      const gotoLoc = e.target.closest("[data-rh-goto-loc]");
      if (gotoLoc && window.goPage) {
        window.goPage("locations", {
          locKey: decodeURIComponent(gotoLoc.dataset.rhGotoLoc),
        });
      }
    });
  }

  async function loadColors() {
    try {
      const res = await fetch("pokemon-colors.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      colorsById = data.byId || {};
    } catch (err) {
      console.warn("pokemon-colors.json unavailable", err);
      colorsById = {};
    }
  }

  function show() {
    $("page-random")?.classList.remove("is-hidden");
    bind();
    renderFilters();
    if (!lastResult) {
      $("rh-result").innerHTML = `
        <div class="rh-empty rh-ready">
          <p class="empty-kicker">Ready</p>
          <h2>Roll a shiny target</h2>
          <p class="muted">Set filters if you want — or leave them open and see what you get.</p>
        </div>`;
    }
  }

  function hide() {
    $("page-random")?.classList.add("is-hidden");
  }

  window.RandomHunt = {
    show,
    hide,
    ready: loadColors(),
    get filters() {
      return { ...filters };
    },
  };
})();
