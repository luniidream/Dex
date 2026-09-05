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
    type: "All",
    eggGroup: "All",
    catchRate: "All",
    season: "All",
    seasonExclusive: false,
    encounter: "any",
    hordeSize: "any",
  };

  let colorsById = {};
  let monstersById = new Map();
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

  function titleCase(value) {
    return String(value ?? "")
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => capitalize(part))
      .join(" ");
  }

  function stripInvalidJsonControls(text) {
    return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];
    return [value];
  }

  function normalizeMonster(raw) {
    const id = Number(raw?.id ?? raw?.dex_number ?? raw?.dexNumber);
    if (!Number.isInteger(id) || id < 1 || id > 649) return null;
    const stats = raw?.base_stats || raw?.stats || {};
    return {
      id,
      name: raw?.name || `#${id}`,
      types: normalizeArray(raw?.types ?? raw?.type)
        .map((type) => (typeof type === "string" ? type : type?.name))
        .filter(Boolean)
        .map(titleCase),
      eggGroups: normalizeArray(raw?.egg_groups || raw?.eggGroups).map(titleCase),
      catchRate: raw?.catch_rate ?? raw?.catchRate ?? null,
      shinyColor: raw?.shiny_color || colorsById[id] || null,
      stats: {
        hp: stats.hp ?? stats.HP ?? null,
        attack: stats.attack ?? stats.atk ?? stats.Atk ?? null,
        defense: stats.defense ?? stats.def ?? stats.Def ?? null,
        spAttack: stats.sp_attack ?? stats.special_attack ?? stats.SpA ?? null,
        spDefense: stats.sp_defense ?? stats.special_defense ?? stats.SpD ?? null,
        speed: stats.speed ?? stats.spe ?? stats.Spe ?? null,
      },
    };
  }

  function catchRateBucket(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n)) return "unknown";
    if (n <= 45) return "low";
    if (n <= 120) return "medium";
    return "high";
  }

  function matchesMonsterFilters(monster) {
    const hasMetadataFilters =
      filters.color !== "All" ||
      filters.type !== "All" ||
      filters.eggGroup !== "All" ||
      filters.catchRate !== "All";
    if (!monster) return !hasMetadataFilters;
    if (filters.color !== "All" && String(monster.shinyColor || "").toLowerCase() !== filters.color.toLowerCase()) return false;
    if (filters.type !== "All" && !monster.types.some((type) => type.toLowerCase() === filters.type.toLowerCase())) return false;
    if (filters.eggGroup !== "All" && !monster.eggGroups.some((group) => group.toLowerCase() === filters.eggGroup.toLowerCase())) return false;
    if (filters.catchRate !== "All" && catchRateBucket(monster.catchRate) !== filters.catchRate) return false;
    return true;
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

        const monster = monstersById.get(Number(e.id));
        if (!matchesMonsterFilters(monster)) continue;

        if (!byId.has(e.id)) {
          byId.set(e.id, {
            id: e.id,
            name: e.name,
            color: monster?.shinyColor || null,
            types: monster?.types || [],
            eggGroups: monster?.eggGroups || [],
            catchRate: monster?.catchRate ?? null,
            stats: monster?.stats || {},
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

  const paletteCache = new Map();
  const DEFAULT_PALETTE = {
    accent: "#79b9ff",
    accentSoft: "#cce9ff",
    glow: "rgba(101, 174, 255, 0.28)",
  };

  function rgb(r, g, b) {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  function mixToward(r, g, b, tr, tg, tb, t) {
    return {
      r: r + (tr - r) * t,
      g: g + (tg - g) * t,
      b: b + (tb - b) * t,
    };
  }

  function saturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  }

  function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function loadSprite(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(url));
      img.src = url;
    });
  }

  function samplePalette(img) {
    const tw = 64;
    const th = 64;
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, tw, th);
    let data;
    try {
      data = ctx.getImageData(0, 0, tw, th).data;
    } catch {
      return null;
    }

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 140) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = luminance(r, g, b);
      if (lum < 18 || lum > 248) continue;
      const sat = saturation(r, g, b);
      const qr = r >> 4;
      const qg = g >> 4;
      const qb = b >> 4;
      const key = (qr << 8) | (qg << 4) | qb;
      const weight =
        (a / 255) *
        (0.4 + sat * 1.6) *
        (lum > 32 && lum < 230 ? 1.2 : 0.65);
      const prev = buckets.get(key) || { r: 0, g: 0, b: 0, w: 0, sat: 0 };
      prev.r += r * weight;
      prev.g += g * weight;
      prev.b += b * weight;
      prev.w += weight;
      prev.sat += sat * weight;
      buckets.set(key, prev);
    }

    const ranked = [...buckets.values()]
      .filter((x) => x.w > 0)
      .map((x) => ({
        r: x.r / x.w,
        g: x.g / x.w,
        b: x.b / x.w,
        w: x.w,
        sat: x.sat / x.w,
      }))
      .sort((a, b) => b.w - a.w);

    if (!ranked.length) return null;

    const top = ranked.slice(0, 8);
    top.sort((a, b) => b.w * (0.55 + a.sat) - a.w * (0.55 + b.sat));
    let accent = top[0];
    // Prefer a more saturated bucket if the winner is nearly gray
    if (accent.sat < 0.18) {
      const colorful = ranked.find((c) => c.sat > 0.28 && c.w > ranked[0].w * 0.12);
      if (colorful) accent = colorful;
    }

    const lifted = mixToward(accent.r, accent.g, accent.b, 255, 255, 255, 0.28);
    const glow = mixToward(accent.r, accent.g, accent.b, 120, 180, 255, 0.12);
    return {
      accent: rgb(accent.r, accent.g, accent.b),
      accentSoft: rgb(lifted.r, lifted.g, lifted.b),
      glow: `rgba(${Math.round(glow.r)}, ${Math.round(glow.g)}, ${Math.round(glow.b)}, 0.38)`,
    };
  }

  async function getShinyPalette(id) {
    if (paletteCache.has(id)) return paletteCache.get(id);
    const urls = [
      `${SHINY_ANIM}/${id}.gif`,
      `${SPRITE}/versions/generation-v/black-white/shiny/${id}.png`,
      `${SHINY_STATIC}/${id}.png`,
      `${SPRITE}/other/home/shiny/${id}.png`,
    ];
    for (const url of urls) {
      try {
        const img = await loadSprite(url);
        const palette = samplePalette(img);
        if (palette) {
          paletteCache.set(id, palette);
          return palette;
        }
      } catch {
        /* try next source */
      }
    }
    paletteCache.set(id, DEFAULT_PALETTE);
    return DEFAULT_PALETTE;
  }

  function applyShinyTheme(palette) {
    const page = $("page-random");
    if (!page) return;
    if (!palette) {
      page.classList.remove("is-shiny-themed");
      page.style.removeProperty("--rh-accent");
      page.style.removeProperty("--rh-accent-2");
      page.style.removeProperty("--rh-glow");
      return;
    }
    page.style.setProperty("--rh-accent", palette.accent);
    page.style.setProperty("--rh-accent-2", palette.accentSoft);
    page.style.setProperty("--rh-glow", palette.glow);
    page.classList.add("is-shiny-themed");
  }

  function shinyImg(id, name) {
    return `
      <img
        class="rh-shiny-sprite"
        src="${SHINY_ANIM}/${id}.gif"
        alt="Shiny ${escapeHtml(name)}"
        width="120"
        height="120"
        crossorigin="anonymous"
        onerror="this.onerror=null;this.removeAttribute('crossorigin');this.src='${SHINY_STATIC}/${id}.png';this.classList.add('is-static');"
      />`;
  }

  function renderFilters() {
    const data = window.DexHunt?.state?.data;
    const regions = ["All", ...(data?.regions || [])];
    const seasons = ["All", "Spring", "Summer", "Autumn", "Winter"];
    const types = ["All", ...new Set([...monstersById.values()].flatMap((m) => m.types || []))].sort((a, b) =>
      a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)
    );
    const eggGroups = ["All", ...new Set([...monstersById.values()].flatMap((m) => m.eggGroups || []))].sort((a, b) =>
      a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)
    );

    const regionEl = $("rh-region");
    const colorEl = $("rh-color");
    const seasonEl = $("rh-season");
    if (!regionEl) return;

    regionEl.innerHTML = regions
      .map(
        (r) =>
          `<option value="${escapeHtml(r)}"${filters.region === r ? " selected" : ""}>${escapeHtml(r === "All" ? "All regions" : r)}</option>`
      )
      .join("");

    colorEl.innerHTML =
      `<option value="All"${filters.color === "All" ? " selected" : ""}>Any color</option>` +
      COLORS.map(
        (c) =>
          `<option value="${c}"${filters.color === c ? " selected" : ""}>${capitalize(c)}</option>`
      ).join("");

    fillSelect(
      "rh-type",
      types.map((type) => ({ id: type, label: type === "All" ? "Any type" : type })),
      filters.type
    );
    fillSelect(
      "rh-egg-group",
      eggGroups.map((group) => ({ id: group, label: group === "All" ? "Any egg group" : group })),
      filters.eggGroup
    );
    fillSelect(
      "rh-catch-rate",
      [
        { id: "All", label: "Any catch rate" },
        { id: "low", label: "Low (1-45)" },
        { id: "medium", label: "Medium (46-120)" },
        { id: "high", label: "High (121+)" },
        { id: "unknown", label: "Unknown" },
      ],
      filters.catchRate
    );

    seasonEl.innerHTML = seasons
      .map(
        (s) =>
          `<option value="${escapeHtml(s)}"${filters.season === s ? " selected" : ""}>${
            s === "All" ? "Any season" : `${SEASON_EMOJI[s] || ""} ${s}`
          }</option>`
      )
      .join("");

    $("rh-exclusive").checked = filters.seasonExclusive;

    fillSelect("rh-encounter", ENCOUNTER_OPTIONS, filters.encounter);
    fillSelect("rh-horde", HORDE_OPTIONS, filters.hordeSize);

    updatePoolHint();
  }

  function fillSelect(id, items, active) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = items
      .map((item) => {
        const value = typeof item === "string" ? item : item.id;
        const label = typeof item === "string" ? item : item.label;
        const sel = String(active) === String(value) ? " selected" : "";
        return `<option value="${escapeHtml(String(value))}"${sel}>${escapeHtml(label)}</option>`;
      })
      .join("");
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
    applyShinyTheme(null);
    $("rh-result").innerHTML = `
      <div class="rh-empty">
        <p class="empty-kicker">No match</p>
        <h2>${escapeHtml(message)}</h2>
      </div>`;
  }

  function renderResult(candidate, { animate, palette } = { animate: true }) {
    const enc = pickRepresentative(candidate);
    const regions = [...new Set(candidate.encounters.map((e) => e.region))];

    lastResult = candidate;
    lastPoolSize = buildPool().length;
    applyShinyTheme(palette || DEFAULT_PALETTE);

    const metaBits = [
      `#${String(candidate.id).padStart(3, "0")}`,
      regions.join(" · ") || "—",
    ];
    if (candidate.color) metaBits.push(capitalize(candidate.color));
    if (candidate.types?.length) metaBits.push(candidate.types.join(" / "));

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
        <p class="rh-card-kicker">Shiny hunt</p>
        <div class="rh-sprite-wrap">
          ${shinyImg(candidate.id, candidate.name)}
        </div>
        <h2 class="rh-name">${escapeHtml(candidate.name)}</h2>
        <p class="rh-meta">${metaBits.map(escapeHtml).join(" · ")}</p>
        <div class="rh-tags">${tags.join("")}</div>
        <div class="rh-stat-strip">
          ${statChip("HP", candidate.stats?.hp)}
          ${statChip("Atk", candidate.stats?.attack)}
          ${statChip("Def", candidate.stats?.defense)}
          ${statChip("SpA", candidate.stats?.spAttack)}
          ${statChip("SpD", candidate.stats?.spDefense)}
          ${statChip("Spe", candidate.stats?.speed)}
        </div>
        <p class="rh-spot muted">
          <button type="button" class="rh-link" data-rh-goto-loc="${encodeURIComponent(enc.locationKey)}">${escapeHtml(enc.location)}</button>
          · ${escapeHtml(enc.region)}
        </p>
        <p class="rh-pool muted">${lastPoolSize} in pool · ${candidate.encounters.length} matching encounter${candidate.encounters.length === 1 ? "" : "s"}</p>
        <div class="rh-card-actions">
          <button type="button" class="hunt-submit rh-reroll" id="rh-reroll">Reroll</button>
          <button type="button" class="nav-link" data-rh-goto-poke="${candidate.id}">Open in Dex</button>
        </div>
      </article>`;
  }

  function statChip(label, value) {
    return `<span><b>${escapeHtml(label)}</b>${escapeHtml(value ?? "?")}</span>`;
  }

  let genToken = 0;

  async function generate() {
    const token = ++genToken;
    const pool = buildPool();
    lastPoolSize = pool.length;
    if (!pool.length) {
      lastResult = null;
      renderEmpty("Nothing fits that combination.");
      return;
    }
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && lastResult && pick.id === lastResult.id) {
      pick = pool.filter((p) => p.id !== lastResult.id)[
        Math.floor(Math.random() * (pool.length - 1))
      ];
    }
    const palette = await getShinyPalette(pick.id);
    if (token !== genToken) return;
    renderResult(pick, { animate: true, palette });
  }

  function readyEmpty() {
    applyShinyTheme(null);
    $("rh-result").innerHTML = `
      <div class="rh-empty rh-ready">
        <p class="empty-kicker">Random</p>
        <h2>Generate a hunt</h2>
      </div>`;
  }

  function resetFilters() {
    filters.region = "All";
    filters.color = "All";
    filters.type = "All";
    filters.eggGroup = "All";
    filters.catchRate = "All";
    filters.season = "All";
    filters.seasonExclusive = false;
    filters.encounter = "any";
    filters.hordeSize = "any";
    lastResult = null;
    renderFilters();
    readyEmpty();
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
      else if (t.id === "rh-type") filters.type = t.value;
      else if (t.id === "rh-egg-group") filters.eggGroup = t.value;
      else if (t.id === "rh-catch-rate") filters.catchRate = t.value;
      else if (t.id === "rh-season") filters.season = t.value;
      else if (t.id === "rh-encounter") filters.encounter = t.value;
      else if (t.id === "rh-horde") filters.hordeSize = t.value;
      else if (t.id === "rh-exclusive") filters.seasonExclusive = t.checked;
      else return;
      updatePoolHint();
    });

    root.addEventListener("click", (e) => {
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
        window.goPage("pokedex", {
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

  async function loadMetadata() {
    try {
      const res = await fetch("pokemon-colors.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      colorsById = data.byId || {};
    } catch (err) {
      console.warn("pokemon-colors.json unavailable", err);
      colorsById = {};
    }

    try {
      const res = await fetch("monsters.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = JSON.parse(stripInvalidJsonControls(await res.text()));
      const records = Array.isArray(raw) ? raw : raw.monsters || raw.pokemon || [];
      monstersById = new Map(
        records
          .map(normalizeMonster)
          .filter(Boolean)
          .map((monster) => [monster.id, monster])
      );
    } catch (err) {
      console.warn("monsters.json unavailable for random filters", err);
      monstersById = new Map();
    }
  }

  async function show() {
    $("page-random")?.classList.remove("is-hidden");
    bind();
    await window.RandomHunt.ready;
    renderFilters();
    if (!lastResult) readyEmpty();
  }

  function hide() {
    $("page-random")?.classList.add("is-hidden");
  }

  window.RandomHunt = {
    show,
    hide,
    ready: loadMetadata(),
    get filters() {
      return { ...filters };
    },
  };
})();
