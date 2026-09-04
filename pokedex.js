/**
 * PokéDex — Dynamic Pokémon Grid Display from monsters.json
 * Grid layout with search, type/generation filters, and detail modal
 */
(function () {
  const SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const SHINY = `${SPRITE}/shiny`;

  const $ = (id) => document.getElementById(id);

  let allMonsters = [];
  let filteredMonsters = [];
  let selectedMonsterId = null;
  let bound = false;

  const filters = {
    search: "",
    type: "All",
    generation: "All",
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getGeneration(id) {
    if (id <= 151) return 1;
    if (id <= 251) return 2;
    if (id <= 386) return 3;
    if (id <= 493) return 4;
    if (id <= 649) return 5;
    if (id <= 721) return 6;
    if (id <= 809) return 7;
    if (id <= 905) return 8;
    if (id <= 1025) return 9;
    return 10;
  }

  function getTypes(monster) {
    // Extract types from the monster data
    if (monster.types && Array.isArray(monster.types)) {
      return monster.types.map(t => typeof t === 'string' ? t : t.name || t);
    }
    if (monster.type) {
      return [monster.type];
    }
    return [];
  }

  function matchesFilters(monster) {
    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      const matchesName = monster.name.toLowerCase().includes(query);
      const matchesId = String(monster.id).includes(query);
      if (!matchesName && !matchesId) return false;
    }

    // Type filter
    if (filters.type !== "All") {
      const types = getTypes(monster);
      if (!types.some(t => t.toLowerCase() === filters.type.toLowerCase())) {
        return false;
      }
    }

    // Generation filter
    if (filters.generation !== "All") {
      const gen = getGeneration(monster.id);
      if (gen !== parseInt(filters.generation, 10)) {
        return false;
      }
    }

    return true;
  }

  function buildFilteredList() {
    filteredMonsters = allMonsters.filter(matchesFilters);
    return filteredMonsters;
  }

  function renderGrid() {
    const grid = $("pokedex-grid");
    const count = $("pdex-count");
    if (!grid) return;

    buildFilteredList();

    if (filteredMonsters.length === 0) {
      grid.innerHTML = `<p class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No Pokémon match those filters.</p>`;
      if (count) count.textContent = "0 Pokémon";
      return;
    }

    grid.innerHTML = filteredMonsters
      .map((m) => {
        const spriteUrl = `${SPRITE}/other/official-artwork/${m.id}.png`;
        return `
          <button type="button" class="pdex-card" data-pdex-id="${m.id}" title="${escapeHtml(m.name)}">
            <div class="pdex-card-artwork">
              <img src="${spriteUrl}" alt="${escapeHtml(m.name)}" width="96" height="96" loading="lazy" onerror="this.src='${SPRITE}/0.png';" />
            </div>
            <div class="pdex-card-info">
              <p class="pdex-card-id">#${String(m.id).padStart(3, "0")}</p>
              <p class="pdex-card-name">${escapeHtml(m.name)}</p>
            </div>
          </button>`;
      })
      .join("");

    if (count) count.textContent = `${filteredMonsters.length} Pokémon`;
  }

  function renderFilters() {
    const typeSelect = $("pdex-type-select");
    const genSelect = $("pdex-gen-select");

    if (typeSelect) {
      const types = new Set();
      allMonsters.forEach((m) => {
        getTypes(m).forEach((t) => types.add(t));
      });

      typeSelect.innerHTML =
        `<option value="All">All types</option>` +
        [...types].sort().map((t) => `<option value="${t}">${escapeHtml(t)}</option>`).join("");
      typeSelect.value = filters.type;
    }

    if (genSelect) {
      genSelect.innerHTML =
        `<option value="All">All generations</option>` +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          .map((g) => `<option value="${g}">Generation ${g}</option>`)
          .join("");
      genSelect.value = filters.generation;
    }
  }

  function renderDetail(id) {
    const monster = allMonsters.find((m) => m.id === id);
    if (!monster) {
      $("pdex-empty")?.classList.remove("is-hidden");
      $("pdex-detail")?.classList.add("is-hidden");
      return;
    }

    selectedMonsterId = id;
    const empty = $("pdex-empty");
    const detail = $("pdex-detail");
    if (empty) empty.classList.add("is-hidden");
    if (detail) detail.classList.remove("is-hidden");

    const types = getTypes(monster);
    const gen = getGeneration(id);
    const spriteUrl = `${SPRITE}/other/official-artwork/${id}.png`;
    const shinyUrl = `${SHINY}/other/official-artwork/${id}.png`;

    const meta = [
      `#${String(id).padStart(3, "0")}`,
      types.map(escapeHtml).join(" / ") || "Unknown",
      `Gen ${gen}`,
    ].join(" · ");

    // Update header
    const idEl = $("pdex-detail-id");
    const nameEl = $("pdex-detail-name");
    const metaEl = $("pdex-detail-meta");
    const spriteEl = $("pdex-detail-sprite");
    const shinyEl = $("pdex-detail-shiny");

    if (idEl) idEl.textContent = `#${String(id).padStart(3, "0")}`;
    if (nameEl) nameEl.textContent = escapeHtml(monster.name);
    if (metaEl) metaEl.textContent = meta;
    if (spriteEl) {
      spriteEl.src = spriteUrl;
      spriteEl.alt = `${monster.name}`;
      spriteEl.onerror = function () {
        this.src = `${SPRITE}/0.png`;
      };
    }
    if (shinyEl) {
      shinyEl.src = shinyUrl;
      shinyEl.alt = `Shiny ${monster.name}`;
      shinyEl.onerror = function () {
        this.src = `${SPRITE}/0.png`;
      };
    }

    // Render stats
    renderStats(monster);

    // Render abilities
    renderAbilities(monster);

    // Render moves
    renderMoves(monster);
  }

  function renderStats(monster) {
    const statsEl = $("pdex-stats");
    if (!statsEl) return;

    const stats = monster.stats || [];
    if (stats.length === 0) {
      statsEl.innerHTML = `<p class="muted">No stats available.</p>`;
      return;
    }

    statsEl.innerHTML = `
      <h3 class="pdex-section-title">Base Stats</h3>
      <div class="pdex-stats-grid">
        ${stats
          .map(
            (stat) => `
          <div class="pdex-stat">
            <span class="pdex-stat-label">${escapeHtml(stat.name || stat.stat?.name || "Unknown")}</span>
            <span class="pdex-stat-value">${stat.base_stat || stat.value || 0}</span>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function renderAbilities(monster) {
    const abilitiesEl = $("pdex-abilities");
    if (!abilitiesEl) return;

    const abilities = monster.abilities || [];
    if (abilities.length === 0) {
      abilitiesEl.innerHTML = `<p class="muted">No abilities listed.</p>`;
      return;
    }

    abilitiesEl.innerHTML = `
      <h3 class="pdex-section-title">Abilities</h3>
      <div class="pdex-abilities-list">
        ${abilities
          .map(
            (ability) => `
          <div class="pdex-ability">
            <span class="pdex-ability-name">${escapeHtml(ability.name || "Unknown")}</span>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function renderMoves(monster) {
    const movesEl = $("pdex-moves");
    if (!movesEl) return;

    const moves = (monster.moves || []).slice(0, 12); // Show first 12 moves
    if (moves.length === 0) {
      movesEl.innerHTML = `<p class="muted">No moves listed.</p>`;
      return;
    }

    movesEl.innerHTML = `
      <h3 class="pdex-section-title">Moves (first 12)</h3>
      <div class="pdex-moves-list">
        ${moves
          .map(
            (move) => `
          <div class="pdex-move">
            <span class="pdex-move-name">${escapeHtml(move.name || "Unknown")}</span>
            <span class="pdex-move-type">${move.type ? escapeHtml(move.type) : ""}</span>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function bind() {
    if (bound) return;
    bound = true;

    const root = $("page-pokedex");
    if (!root) return;

    // Search input
    const searchEl = $("pdex-search");
    if (searchEl) {
      searchEl.addEventListener("input", (e) => {
        filters.search = e.target.value;
        renderGrid();
      });
    }

    // Type filter
    const typeEl = $("pdex-type-select");
    if (typeEl) {
      typeEl.addEventListener("change", (e) => {
        filters.type = e.target.value;
        renderGrid();
      });
    }

    // Generation filter
    const genEl = $("pdex-gen-select");
    if (genEl) {
      genEl.addEventListener("change", (e) => {
        filters.generation = e.target.value;
        renderGrid();
      });
    }

    // Grid card clicks
    root.addEventListener("click", (e) => {
      const card = e.target.closest("[data-pdex-id]");
      if (card) {
        const id = parseInt(card.dataset.pdexId, 10);
        renderDetail(id);
      }
    });
  }

  function resetFilters() {
    filters.search = "";
    filters.type = "All";
    filters.generation = "All";
    const searchEl = $("pdex-search");
    if (searchEl) searchEl.value = "";
    renderFilters();
    renderGrid();
  }

  async function load() {
    try {
      const res = await fetch("monsters.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allMonsters = await res.json();
      return allMonsters;
    } catch (err) {
      console.error("Failed to load monsters.json", err);
      return [];
    }
  }

  function show() {
    $("page-pokedex")?.classList.remove("is-hidden");
    bind();

    if (allMonsters.length === 0) {
      const grid = $("pokedex-grid");
      if (grid) grid.innerHTML = `<p class="muted">Loading Pokémon data…</p>`;

      load()
        .then(() => {
          renderFilters();
          renderGrid();
        })
        .catch((err) => {
          const grid = $("pokedex-grid");
          if (grid)
            grid.innerHTML = `<p class="muted">Error loading Pokémon data: ${escapeHtml(err.message)}</p>`;
        });
    } else {
      renderGrid();
    }
  }

  function hide() {
    $("page-pokedex")?.classList.add("is-hidden");
  }

  window.PokeDex = {
    show,
    hide,
    ready: load(),
    get filters() {
      return { ...filters };
    },
  };
})();
