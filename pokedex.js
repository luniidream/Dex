/**
 * PokeDex - Gen 1 through Gen 5 grid backed by monsters.json.
 */
(function () {
  const SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const ART = `${SPRITE}/other/official-artwork`;
  const SHINY_ART = `${SPRITE}/shiny`;
  const MAX_DEX = 649;

  const $ = (id) => document.getElementById(id);

  let allMonsters = [];
  let visibleMonsters = [];
  let selectedId = null;
  let bound = false;

  const filters = { search: "", type: "All", generation: "All" };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripInvalidJsonControls(text) {
    return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  }

  async function fetchJsonText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    return JSON.parse(stripInvalidJsonControls(await res.text()));
  }

  function generationFor(id) {
    if (id <= 151) return 1;
    if (id <= 251) return 2;
    if (id <= 386) return 3;
    if (id <= 493) return 4;
    return 5;
  }

  function titleCase(value) {
    return String(value ?? "")
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];
    return [value];
  }

  function normalizeTypes(monster) {
    return normalizeArray(monster.types ?? monster.type)
      .map((type) => (typeof type === "string" ? type : type?.name))
      .filter(Boolean)
      .map(titleCase);
  }

  function normalizeAbilities(monster) {
    const seen = new Set();
    return normalizeArray(monster.abilities)
      .map((ability) => (typeof ability === "string" ? ability : ability?.name))
      .filter(Boolean)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function normalizeStats(monster) {
    const source = monster.base_stats || monster.stats || {};
    const read = (...keys) => {
      for (const key of keys) {
        const value = source[key];
        if (Number.isFinite(Number(value))) return Number(value);
      }
      return null;
    };
    return [
      ["HP", read("HP", "hp")],
      ["Atk", read("Atk", "attack", "atk")],
      ["Def", read("Def", "defense", "def")],
      ["SpA", read("SpA", "sp_attack", "special_attack")],
      ["SpD", read("SpD", "sp_defense", "special_defense")],
      ["Spe", read("Spe", "speed", "spe")],
    ];
  }

  function normalizeLocations(monster) {
    return normalizeArray(monster.encounter_locations || monster.locations)
      .map((loc) => {
        if (typeof loc === "string") return { location: loc };
        return {
          region: loc.region_name || loc.region,
          location: loc.location_name_full || loc.location_name || loc.name,
          method: loc.type || loc.encounter,
          season: loc.season,
          minLevel: loc.min_level ?? loc.minLevel,
          maxLevel: loc.max_level ?? loc.maxLevel,
        };
      })
      .filter((loc) => loc.location);
  }

  function normalizeMonster(raw) {
    const id = Number(raw.id ?? raw.dex_number ?? raw.dexNumber);
    if (!Number.isInteger(id) || id < 1 || id > MAX_DEX) return null;
    const name = String(raw.name || `#${id}`).trim();
    return {
      raw,
      id,
      dex_number: id,
      name,
      types: normalizeTypes(raw),
      stats: normalizeStats(raw),
      abilities: normalizeAbilities(raw),
      moves: normalizeArray(raw.moves),
      egg_groups: normalizeArray(raw.egg_groups || raw.eggGroups).map(titleCase),
      catch_rate: raw.catch_rate ?? raw.catchRate ?? null,
      shiny_color: raw.shiny_color ?? null,
      sprite_url: raw.sprite_url || `${ART}/${id}.png`,
      shiny_sprite_url: raw.shiny_sprite_url || `${SHINY_ART}/${id}.png`,
      encounter_locations: normalizeLocations(raw),
      generation: generationFor(id),
    };
  }

  function matches(monster) {
    const query = filters.search.trim().toLowerCase();
    if (query) {
      const dex = String(monster.id);
      const padded = dex.padStart(3, "0");
      if (!monster.name.toLowerCase().includes(query) && !dex.includes(query) && !padded.includes(query)) return false;
    }
    if (filters.type !== "All" && !monster.types.some((type) => type.toLowerCase() === filters.type.toLowerCase())) return false;
    if (filters.generation !== "All" && monster.generation !== Number(filters.generation)) return false;
    return true;
  }

  function typePills(types) {
    return (types.length ? types : ["Unknown"])
      .map((type) => `<span class="type-pill type-${escapeHtml(type.toLowerCase())}">${escapeHtml(type)}</span>`)
      .join("");
  }

  function renderGrid() {
    const grid = $("pokedex-grid");
    const count = $("pdex-count");
    if (!grid) return;
    visibleMonsters = allMonsters.filter(matches);
    if (count) count.textContent = `${visibleMonsters.length} Pokemon`;
    if (!visibleMonsters.length) {
      grid.innerHTML = `<p class="muted pdex-grid-empty">No Pokemon match those filters.</p>`;
      return;
    }
    grid.innerHTML = visibleMonsters
      .map(
        (m) => `
          <button type="button" class="pdex-card" data-pdex-id="${m.id}" aria-label="Open ${escapeHtml(m.name)}">
            <div class="pdex-card-artwork">
              <img src="${escapeHtml(m.sprite_url)}" alt="" width="96" height="96" loading="lazy"
                onerror="this.src='${SPRITE}/${m.id}.png';this.onerror=function(){this.src='${SPRITE}/0.png';};" />
            </div>
            <div class="pdex-card-info">
              <p class="pdex-card-id">#${String(m.id).padStart(3, "0")}</p>
              <p class="pdex-card-name">${escapeHtml(m.name)}</p>
              <div class="type-row">${typePills(m.types)}</div>
            </div>
          </button>`
      )
      .join("");
  }

  function renderFilters() {
    const typeSelect = $("pdex-type-select");
    const genSelect = $("pdex-gen-select");
    if (typeSelect) {
      const types = [...new Set(allMonsters.flatMap((m) => m.types))].sort();
      typeSelect.innerHTML =
        `<option value="All">All types</option>` +
        types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
      typeSelect.value = filters.type;
    }
    if (genSelect) {
      genSelect.innerHTML =
        `<option value="All">Gen 1-5</option>` +
        [1, 2, 3, 4, 5].map((gen) => `<option value="${gen}">Generation ${gen}</option>`).join("");
      genSelect.value = filters.generation;
    }
  }

  function movesHtml(monster) {
    const groups = new Map();
    for (const move of monster.moves) {
      const method = titleCase(move.type || move.method || "Other");
      if (!groups.has(method)) groups.set(method, []);
      groups.get(method).push(move);
    }
    if (!groups.size) return `<p class="muted">No moves listed.</p>`;
    return [...groups.entries()]
      .map(([method, moves]) => {
        const chips = moves
          .slice(0, 18)
          .map((move) => {
            const level = move.level != null ? ` Lv ${move.level}` : "";
            return `<span class="pdex-move">${escapeHtml(move.name || "Unknown")}${escapeHtml(level)}</span>`;
          })
          .join("");
        return `<section><h4>${escapeHtml(method)}</h4><div class="pdex-moves-list">${chips}</div></section>`;
      })
      .join("");
  }

  function locationsHtml(monster) {
    const locations = monster.encounter_locations.slice(0, 18);
    if (!locations.length) return `<p class="muted">No wild locations listed.</p>`;
    return locations
      .map((loc) => {
        const levels =
          loc.minLevel == null && loc.maxLevel == null
            ? ""
            : loc.minLevel === loc.maxLevel
              ? ` Lv ${loc.minLevel}`
              : ` Lv ${loc.minLevel}-${loc.maxLevel}`;
        const meta = [loc.region, loc.method, loc.season, levels.trim()].filter(Boolean).join(" - ");
        return `<li><strong>${escapeHtml(loc.location)}</strong><span>${escapeHtml(meta)}</span></li>`;
      })
      .join("");
  }

  function renderDetail(id) {
    const monster = allMonsters.find((m) => m.id === id);
    if (!monster) return;
    selectedId = id;
    $("pdex-empty")?.classList.add("is-hidden");
    const detail = $("pdex-detail");
    detail?.classList.remove("is-hidden");
    detail?.setAttribute("role", "dialog");
    detail?.setAttribute("aria-modal", "true");
    detail?.setAttribute("aria-labelledby", "pdex-detail-name");
    if (detail && !$("pdex-modal-close")) {
      detail.insertAdjacentHTML(
        "afterbegin",
        `<button type="button" class="pdex-modal-close" id="pdex-modal-close" aria-label="Close PokeDex details">Close</button>`
      );
    }
    const detailId = $("pdex-detail-id");
    const detailName = $("pdex-detail-name");
    const detailMeta = $("pdex-detail-meta");
    if (detailId) detailId.textContent = `#${String(id).padStart(3, "0")}`;
    if (detailName) detailName.textContent = monster.name;
    if (detailMeta) detailMeta.textContent = `${monster.types.join(" / ") || "Unknown"} - Gen ${monster.generation}`;

    const sprite = $("pdex-detail-sprite");
    const shiny = $("pdex-detail-shiny");
    if (sprite) {
      sprite.src = monster.sprite_url;
      sprite.alt = monster.name;
      sprite.onerror = function () {
        this.src = `${SPRITE}/${id}.png`;
        this.onerror = null;
      };
    }
    if (shiny) {
      shiny.src = monster.shiny_sprite_url;
      shiny.alt = `Shiny ${monster.name}`;
      shiny.onerror = function () {
        this.src = `${SPRITE}/shiny/${id}.png`;
        this.onerror = null;
      };
    }

    const stats = $("pdex-stats");
    if (stats) stats.innerHTML = `
      <h3 class="pdex-section-title">Base Stats</h3>
      <div class="pdex-stats-grid">
        ${monster.stats
          .map(([label, value]) => `<div class="pdex-stat"><span class="pdex-stat-label">${label}</span><span class="pdex-stat-value">${value ?? "?"}</span></div>`)
          .join("")}
      </div>`;

    const abilities = $("pdex-abilities");
    if (abilities) abilities.innerHTML = `
      <h3 class="pdex-section-title">Details</h3>
      <div class="pdex-detail-grid">
        <div><span>Types</span><strong>${typePills(monster.types)}</strong></div>
        <div><span>Abilities</span><strong>${escapeHtml(monster.abilities.join(", ") || "Unknown")}</strong></div>
        <div><span>Egg Groups</span><strong>${escapeHtml(monster.egg_groups.join(", ") || "Unknown")}</strong></div>
        <div><span>Catch Rate</span><strong>${escapeHtml(monster.catch_rate ?? "Unknown")}</strong></div>
      </div>
      <h3 class="pdex-section-title">Wild Locations</h3>
      <ul class="pdex-location-list">${locationsHtml(monster)}</ul>`;

    const moves = $("pdex-moves");
    if (moves) moves.innerHTML = `
      <h3 class="pdex-section-title">Movesets</h3>
      <div class="pdex-move-groups">${movesHtml(monster)}</div>`;
  }

  function bind() {
    if (bound) return;
    bound = true;
    $("pdex-search")?.addEventListener("input", (event) => {
      filters.search = event.target.value;
      renderGrid();
    });
    $("pdex-type-select")?.addEventListener("change", (event) => {
      filters.type = event.target.value;
      renderGrid();
    });
    $("pdex-gen-select")?.addEventListener("change", (event) => {
      filters.generation = event.target.value;
      renderGrid();
    });
    $("pokedex-grid")?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-pdex-id]");
      if (!card) return;
      renderDetail(Number(card.dataset.pdexId));
    });
    $("pdex-detail")?.addEventListener("click", (event) => {
      if (event.target.id === "pdex-detail" || event.target.closest("#pdex-modal-close")) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  function closeModal() {
    $("pdex-detail")?.classList.add("is-hidden");
    $("pdex-empty")?.classList.remove("is-hidden");
  }

  async function load() {
    const raw = await fetchJsonText("monsters.json");
    const records = Array.isArray(raw) ? raw : raw.monsters || raw.pokemon || [];
    allMonsters = records.map(normalizeMonster).filter(Boolean).sort((a, b) => a.id - b.id);
    return allMonsters;
  }

  async function show() {
    $("page-pokedex")?.classList.remove("is-hidden");
    bind();
    const grid = $("pokedex-grid");
    try {
      if (!allMonsters.length) {
        if (grid) grid.innerHTML = `<p class="muted pdex-grid-empty">Loading Pokemon data...</p>`;
        await load();
        renderFilters();
      }
      renderGrid();
      const requestedId = Number(window.DexHunt?.state?.poke?.selectedId);
      if (Number.isInteger(requestedId) && requestedId >= 1 && requestedId <= MAX_DEX) selectedId = requestedId;
      if (selectedId) renderDetail(selectedId);
    } catch (err) {
      console.error("Failed to load monsters.json", err);
      if (grid) grid.innerHTML = `<p class="muted pdex-grid-empty">Could not load monsters.json. ${escapeHtml(err.message)}</p>`;
      const count = $("pdex-count");
      if (count) count.textContent = "Failed to load";
    }
  }

  function hide() {
    $("page-pokedex")?.classList.add("is-hidden");
  }

  window.PokeDex = {
    show,
    hide,
    open(id) {
      selectedId = Number(id);
      return show();
    },
    ready: load().catch((err) => {
      console.warn("PokeDex preload failed", err);
      return [];
    }),
    get monsters() {
      return [...allMonsters];
    },
  };
})();
