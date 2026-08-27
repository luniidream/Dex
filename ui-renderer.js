/**
 * DEX UI INTEGRATION LAYER
 * Bridges your existing app.js logic with the new modern UI
 * Drop this in and modify app.js to call initNewUI() after data loads
 */

// State for new UI
const uiState = {
  view: 'locations',
  selectedId: null,
  searchQuery: '',
  filters: {},
};

// Initialize the new app shell
function initNewUI() {
  renderAppShell();
  bindUIEvents();
}

// Render the main app shell
function renderAppShell() {
  const app = document.getElementById('app');
  const loader = document.getElementById('initial-loader');
  
  app.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="brand">DEX</div>
      </div>
      <nav class="nav-tabs">
        <button class="nav-tab ${uiState.view === 'locations' ? 'active' : ''}" onclick="window.switchView('locations')">Locations</button>
        <button class="nav-tab ${uiState.view === 'pokemon' ? 'active' : ''}" onclick="window.switchView('pokemon')">Pokémon</button>
        <button class="nav-tab ${uiState.view === 'hunt' ? 'active' : ''}" onclick="window.switchView('hunt')">Hunt</button>
      </nav>
      <div class="sidebar-content">
        <div class="search-container">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" class="search-input" placeholder="Search name or #..." value="${uiState.searchQuery || ''}" oninput="window.handleSearch(this.value)">
        </div>
        <div id="filters-container">
          ${renderFiltersUI()}
        </div>
      </div>
    </aside>
    <main class="main-content" id="main-content">
      <!-- Content injected here -->
    </main>
  `;

  // Hide loader, show app
  loader.style.opacity = '0';
  setTimeout(() => {
    loader.style.display = 'none';
    app.classList.remove('hidden');
    renderMainContent();
  }, 400);
}

// Render filters based on current view
function renderFiltersUI() {
  if (uiState.view === 'locations') {
    return `
      <div class="filter-group">
        <div class="filter-title">Region</div>
        <div class="filter-chips">
          ${(state.data?.regions || []).map(region => 
            `<button class="chip ${uiState.filters.region === region ? 'active' : ''}" onclick="window.toggleFilter('region', '${region}')">${region}</button>`
          ).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">Season</div>
        <div class="filter-chips">
          ${(state.data?.seasons || []).map(season => 
            `<button class="chip ${uiState.filters.season === season ? 'active' : ''}" onclick="window.toggleFilter('season', '${season}')">${season}</button>`
          ).join('')}
        </div>
      </div>
    `;
  } else if (uiState.view === 'pokemon') {
    return `
      <div class="filter-group">
        <div class="filter-title">Region</div>
        <div class="filter-chips">
          ${(state.data?.regions || []).map(region => 
            `<button class="chip ${uiState.filters.region === region ? 'active' : ''}" onclick="window.toggleFilter('region', '${region}')">${region}</button>`
          ).join('')}
        </div>
      </div>
    `;
  }
  return '';
}

// Router: Render main content based on view
function renderMainContent() {
  const main = document.getElementById('main-content');
  
  if (uiState.selectedId && uiState.view === 'locations') {
    main.innerHTML = renderLocationDetail(uiState.selectedId);
  } else if (uiState.selectedId && uiState.view === 'pokemon') {
    main.innerHTML = renderPokemonDetail(uiState.selectedId);
  } else if (uiState.view === 'hunt') {
    main.innerHTML = renderHuntAdvisor();
  } else if (uiState.view === 'locations') {
    const list = filteredLocations();
    main.innerHTML = `
      <div class="pokemon-grid fade-in">
        ${list.map(loc => renderLocationCard(loc)).join('')}
      </div>
    `;
  } else if (uiState.view === 'pokemon') {
    const list = filteredPokemon();
    main.innerHTML = `
      <div class="pokemon-grid fade-in">
        ${list.map(poke => renderPokemonCard(poke)).join('')}
      </div>
    `;
  }
}

// Card: Location
function renderLocationCard(loc) {
  const key = locKey(loc);
  const entries = locEntries(loc);
  const count = uniqueIds(entries);
  
  return `
    <div class="pokemon-card" onclick="window.selectLocation('${encodeURIComponent(key)}')">
      <div class="card-glow"></div>
      <div class="card-header">
        <span class="pokemon-id">${loc.region}</span>
        <div class="pokemon-types">
          <span class="type-badge">${count} Pokémon</span>
        </div>
      </div>
      <div class="card-artwork" style="font-size: 3rem; text-align: center;">📍</div>
      <div class="card-footer">
        <h3 class="pokemon-name">${escapeHtml(loc.name)}</h3>
      </div>
    </div>
  `;
}

// Card: Pokemon
function renderPokemonCard(poke) {
  const primaryType = 'normal'; // Default; enhance with actual type data
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${poke.id}.png`;
  
  return `
    <div class="pokemon-card type-${primaryType}" onclick="window.selectPokemon(${poke.id})">
      <div class="card-glow"></div>
      <div class="card-header">
        <span class="pokemon-id">#${String(poke.id).padStart(3, '0')}</span>
        <div class="pokemon-types"></div>
      </div>
      <div class="card-artwork">
        <img src="${spriteUrl}" alt="${poke.name}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'">
      </div>
      <div class="card-footer">
        <h3 class="pokemon-name">${escapeHtml(poke.name)}</h3>
      </div>
    </div>
  `;
}

// Detail: Location
function renderLocationDetail(locKey) {
  const loc = state.data.locations.find(l => locKey(l) === locKey);
  if (!loc) return '<div style="padding: 20px; color: var(--text-secondary);">Location not found</div>';
  
  const entries = locEntries(loc);
  const count = uniqueIds(entries);
  
  return `
    <div class="detail-view">
      <div class="detail-header">
        <button class="back-btn" onclick="window.deselectLocation()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <span class="detail-id">${loc.region}</span>
      </div>
      
      <div class="detail-hero">
        <div class="hero-artwork-container">
          <div style="font-size: 120px;">📍</div>
        </div>
        <div class="hero-info">
          <h1 class="hero-name">${escapeHtml(loc.name)}</h1>
          <div class="hero-quick-stats">
            <div class="quick-stat">
              <span class="stat-label">Pokémon</span>
              <span class="stat-value">${count}</span>
            </div>
            <div class="quick-stat">
              <span class="stat-label">Encounters</span>
              <span class="stat-value">${entries.length}</span>
            </div>
            <div class="quick-stat">
              <span class="stat-label">Region</span>
              <span class="stat-value">${loc.region}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h2 class="section-title">Pokémon Found Here</h2>
        <div class="pokemon-grid">
          ${entries.slice(0, 12).map(e => `
            <div class="pokemon-card" onclick="window.selectPokemon(${e.id})">
              <div class="card-artwork">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${e.id}.png" alt="${e.name}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'">
              </div>
              <div class="card-footer">
                <h3 class="pokemon-name">${escapeHtml(e.name)}</h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(e.encounter)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Detail: Pokemon
function renderPokemonDetail(pokeId) {
  const poke = state.data.pokemon.find(p => p.id === pokeId);
  if (!poke) return '<div style="padding: 20px; color: var(--text-secondary);">Pokémon not found</div>';
  
  const encounters = allEncountersForPokemon(pokeId);
  const uniqueLocs = new Set(encounters.map(e => e.locationKey)).size;
  
  return `
    <div class="detail-view">
      <div class="detail-header">
        <button class="back-btn" onclick="window.deselectPokemon()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <span class="detail-id">#${String(pokeId).padStart(3, '0')}</span>
      </div>
      
      <div class="detail-hero">
        <div class="hero-artwork-container">
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png" alt="${poke.name}" class="hero-artwork" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png'">
        </div>
        <div class="hero-info">
          <h1 class="hero-name">${escapeHtml(poke.name)}</h1>
          <div class="hero-quick-stats">
            <div class="quick-stat">
              <span class="stat-label">Locations</span>
              <span class="stat-value">${uniqueLocs}</span>
            </div>
            <div class="quick-stat">
              <span class="stat-label">Encounters</span>
              <span class="stat-value">${encounters.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h2 class="section-title">Found At</h2>
        <div class="pokemon-grid">
          ${encounters.slice(0, 12).map(e => `
            <div class="pokemon-card" onclick="window.selectLocation('${encodeURIComponent(e.locationKey)}')">
              <div class="card-artwork" style="font-size: 2rem;">📍</div>
              <div class="card-footer">
                <h3 class="pokemon-name">${escapeHtml(e.locationName)}</h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(e.region)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Hunt Advisor
function renderHuntAdvisor() {
  return `
    <div class="hunt-container fade-in">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-family: var(--font-heading); font-size: 2.5rem; font-weight: 800; margin-bottom: 12px;">Hunt Advisor</h1>
        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
          Enter a Pokémon and current season. We'll score and rank the best spawn locations based on encounter rate, horde size, and time-of-day consistency.
        </p>
      </div>
      
      <div class="search-container" style="max-width: 500px; margin: 0 auto 40px;">
        <input type="text" class="search-input" id="hunt-poke-input" placeholder="Enter Pokémon name..." style="padding: 16px 20px; font-size: 1rem;">
      </div>

      <div class="hunt-results" id="hunt-results-container">
        <p style="text-align: center; color: var(--text-secondary);">Enter a Pokémon to see hunt recommendations</p>
      </div>
    </div>
  `;
}

// State Managers
window.switchView = function(view) {
  uiState.view = view;
  uiState.selectedId = null;
  renderAppShell();
};

window.selectLocation = function(key) {
  uiState.selectedId = decodeURIComponent(key);
  renderMainContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.selectPokemon = function(id) {
  uiState.selectedId = id;
  renderMainContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deselectLocation = function() {
  uiState.selectedId = null;
  renderMainContent();
};

window.deselectPokemon = function() {
  uiState.selectedId = null;
  renderMainContent();
};

window.handleSearch = function(query) {
  uiState.searchQuery = query.toLowerCase();
  renderMainContent();
};

window.toggleFilter = function(category, value) {
  if (uiState.filters[category] === value) {
    uiState.filters[category] = null;
  } else {
    uiState.filters[category] = value;
  }
  renderAppShell();
};

// Bind UI Events
function bindUIEvents() {
  // Event bindings can go here
}

// Export for use in app.js
window.initNewUI = initNewUI;
