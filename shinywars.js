/**
 * Shiny Wars Hunt Router — hidden at #/shinywars
 * Password: SW2026
 * Rules: https://forums.pokemmo.com/index.php?/topic/198507-pokemmo-shiny-wars-2026/
 */
(function () {
  const PASSWORD = "SW2026";
  const AUTH_KEY = "dex-sw-auth";
  const STORE_KEY = "dex-shinywars-v1";
  const SPRITE =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const SEASON_EMOJI = {
    Summer: "☀️",
    Autumn: "🍂",
    Winter: "❄️",
    Spring: "🌸",
  };
  const SEASON_ORDER = ["Summer", "Autumn", "Winter", "Spring"];
  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  const $ = (id) => document.getElementById(id);

  let meta = null;
  let byId = new Map();
  let byName = new Map();
  let store = null;

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/♀/g, "f")
      .replace(/♂/g, "m")
      .replace(/[^a-z0-9]/g, "");
  }

  function defaultStore() {
    const id = uid();
    return {
      currentSeason: "Summer",
      activePlayerId: id,
      players: [
        {
          id,
          name: "Luni",
          targets: [],
          completed: [],
        },
      ],
    };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultStore();
      const parsed = JSON.parse(raw);
      if (!parsed.players?.length) return defaultStore();
      return parsed;
    } catch {
      return defaultStore();
    }
  }

  function saveStore() {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function isAuthed() {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  }

  function setAuthed(ok) {
    if (ok) sessionStorage.setItem(AUTH_KEY, "1");
    else sessionStorage.removeItem(AUTH_KEY);
  }

  function activePlayer() {
    return (
      store.players.find((p) => p.id === store.activePlayerId) ||
      store.players[0]
    );
  }

  function resolvePokemon(query) {
    const q = String(query || "").trim();
    if (!q) return null;
    if (/^\d+$/.test(q)) return byId.get(parseInt(q, 10)) || null;
    const exact = byName.get(normalizeName(q));
    if (exact) return exact;
    const partial = meta.pokemon.find((p) =>
      normalizeName(p.name).includes(normalizeName(q))
    );
    return partial || null;
  }

  function upcomingSeasons(current) {
    const i = SEASON_ORDER.indexOf(current);
    if (i < 0) return SEASON_ORDER.slice();
    return [0, 1, 2, 3].map((n) => SEASON_ORDER[(i + n) % 4]);
  }

  /** Best hunt spot for a species in a season (uses main Dex encounter data if loaded). */
  function bestSpot(pokemonId, season) {
    if (!window.DexHunt || typeof window.DexHunt.rankHuntSpots !== "function") {
      return null;
    }
    const ranked = window.DexHunt.rankHuntSpots(pokemonId, season, "best");
    return ranked[0] || null;
  }

  function seasonQuality(pokemonId, season) {
    const spot = bestSpot(pokemonId, season);
    if (!spot) return { label: "Unknown", score: 0, spot: null };
    const avg = spot.avgChance ?? spot.speciesChance ?? 0;
    let label = "Poor";
    if (avg >= 80) label = "Excellent";
    else if (avg >= 50) label = "Good";
    else if (avg >= 25) label = "Okay";
    else if (avg > 0) label = "Weak";
    return { label, score: avg, spot };
  }

  function weeksUntilSeason(targetSeason, currentSeason) {
    const cur = SEASON_ORDER.indexOf(currentSeason);
    const tgt = SEASON_ORDER.indexOf(targetSeason);
    if (cur < 0 || tgt < 0) return 0;
    return (tgt - cur + 4) % 4;
  }

  /** Best season + spot for this Pokémon (season-first, not location-first). */
  function bestSeasonPlan(pokemonId) {
    let best = null;
    for (const season of SEASON_ORDER) {
      const q = seasonQuality(pokemonId, season);
      if (!best || q.score > best.score) {
        best = { season, ...q };
      }
    }

    if (!best || best.score === 0) {
      return {
        season: store.currentSeason,
        label: "Unknown",
        score: 0,
        location: "No encounter data",
        region: "",
        locationKey: null,
        encounter: "",
        horde: "",
        huntNow: false,
        weeksUntil: 0,
        spot: null,
      };
    }

    const e = best.spot?.e;
    const weeksUntil = weeksUntilSeason(best.season, store.currentSeason);

    return {
      season: best.season,
      label: best.label,
      score: best.score,
      location: e?.locationName || "See Hunt tab",
      region: e?.region || "",
      locationKey: e?.locationKey || null,
      encounter: e?.encounter || "",
      horde: e ? (e.horde5 ? "5× Horde" : e.horde3 ? "3× Horde" : "Single") : "",
      huntNow: best.season === store.currentSeason,
      weeksUntil,
      spot: best.spot,
    };
  }

  function formatHuntPlan(name, plan) {
    const emoji = SEASON_EMOJI[plan.season] || "";
    const loc = plan.region
      ? `${plan.location} (${plan.region})`
      : plan.location;

    if (plan.huntNow) {
      return `Hunt <strong>${escapeHtml(name)}</strong> in <strong>${emoji} ${escapeHtml(plan.season)}</strong> at <strong>${escapeHtml(loc)}</strong>`;
    }
    if (plan.weeksUntil === 1) {
      return `Next week — hunt <strong>${escapeHtml(name)}</strong> in <strong>${emoji} ${escapeHtml(plan.season)}</strong> at <strong>${escapeHtml(loc)}</strong>`;
    }
    const w = plan.weeksUntil === 1 ? "1 week" : `${plan.weeksUntil} weeks`;
    return `Wait — hunt <strong>${escapeHtml(name)}</strong> in <strong>${emoji} ${escapeHtml(plan.season)}</strong> at <strong>${escapeHtml(loc)}</strong> (${w})`;
  }

  function formatHuntSubtext(plan, seasonNow) {
    if (plan.huntNow) {
      return `${plan.label} odds this week · ${plan.horde}${plan.encounter ? " · " + plan.encounter : ""}`;
    }
    return `Skip ${store.currentSeason} (${seasonNow.label}) — save time for ${plan.season} (${plan.label})`;
  }

  function starsFromScore(score) {
    const n = Math.max(1, Math.min(5, Math.round(score)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function lineRootOf(poke) {
    return poke ? poke.rootId : null;
  }

  function teamCompletedLines() {
    const lines = new Map(); // rootId -> { playerName, pokemonName }
    for (const pl of store.players) {
      for (const c of pl.completed || []) {
        if (!lines.has(c.rootId)) {
          lines.set(c.rootId, { playerName: pl.name, name: c.name });
        }
      }
    }
    return lines;
  }

  function playerHasLine(player, rootId) {
    return (player.completed || []).some((c) => c.rootId === rootId);
  }

  function otherPlayersHuntingLine(rootId, exceptPlayerId) {
    const hits = [];
    for (const pl of store.players) {
      if (pl.id === exceptPlayerId) continue;
      for (const t of pl.targets || []) {
        if (t.rootId === rootId && t.status !== "done") {
          hits.push({ player: pl.name, target: t.name });
        }
      }
    }
    return hits;
  }

  function estimatePoints(poke, player) {
    if (!poke || poke.points == null) {
      return { base: 0, unique: 0, note: "Untiered / unknown — check Alpha/Legendary rules" };
    }
    const teamLines = teamCompletedLines();
    const alreadyTeam = teamLines.has(poke.rootId);
    const alreadyPlayer = playerHasLine(player, poke.rootId);
    if (alreadyPlayer) {
      return {
        base: meta.scoring.bonuses.duplicatePlayer,
        unique: 0,
        note: "Player duplicate of this line → only +1",
      };
    }
    return {
      base: poke.points,
      unique: alreadyTeam ? 0 : meta.scoring.bonuses.uniqueSpecies,
      note: alreadyTeam
        ? "Line already unique-claimed by team (still full tier pts)"
        : "First of line for team → +8 unique bonus",
    };
  }

  function scoreTarget(player, target) {
    const poke = byId.get(target.pokemonId);
    if (!poke) return { score: 0, reasons: ["Unknown Pokémon"], rating: 1, plan: null };

    const pts = estimatePoints(poke, player);
    const expectedPts = pts.base + pts.unique;
    const plan = bestSeasonPlan(target.pokemonId);
    const seasonNow = seasonQuality(target.pokemonId, store.currentSeason);

    const others = otherPlayersHuntingLine(poke.rootId, player.id);
    const pri = PRIORITY_WEIGHT[target.priority] || 2;
    const phases = Number(target.phases) || 0;

    let score = expectedPts * 2 + plan.score * 0.1 + pri * 4;

    const reasons = [];
    reasons.push(
      poke.tier != null
        ? `Tier ${poke.tier} · ~${expectedPts} pts (${pts.base}${pts.unique ? ` +${pts.unique} unique` : ""})`
        : pts.note
    );

    if (plan.huntNow) {
      reasons.push(`Best season is now (${store.currentSeason}) — go to ${plan.location}`);
      if (plan.label === "Excellent" || plan.label === "Good") score += 12;
      else score += 4;
    } else {
      reasons.push(
        `Don't hunt in ${store.currentSeason} (${seasonNow.label}). Best: ${plan.season} at ${plan.location}`
      );
      score -= plan.weeksUntil * 5;
      if (seasonNow.score > 40) score -= 3;
    }

    if (others.length) {
      reasons.push(
        `Duplicate hunt risk: ${others.map((o) => o.player + " also hunts " + o.target).join("; ")}`
      );
      score -= 15;
    }

    if (playerHasLine(player, poke.rootId)) {
      reasons.push("You already completed this evolution line (+1 only if you catch another)");
      score -= 20;
    } else if (teamCompletedLines().has(poke.rootId)) {
      reasons.push("Team already has this line's unique +8");
    } else {
      reasons.push("Low duplicate risk · unique +8 still available");
      score += 5;
    }

    if (phases >= 15 && !plan.huntNow) {
      reasons.push(`Already ${phases} phases in — but ${plan.season} is still better. Consider pausing.`);
      score -= 4;
    }

    if (target.priority === "high") reasons.push("Marked high priority");
    if (target.priority === "low") {
      reasons.push("Lower priority vs other options");
      score -= 3;
    }

    const delay = !plan.huntNow && plan.score > seasonNow.score;

    const siblings = (player.targets || []).filter(
      (t) => t.id !== target.id && t.status !== "done"
    );
    let alt = null;
    let continuePct = 70;
    for (const t of siblings) {
      const altScore = scoreTargetQuick(player, t);
      if (!alt || altScore.score > alt.score) alt = { ...altScore, name: t.name };
    }
    if (alt && alt.score > score + 5) {
      continuePct = Math.max(15, Math.min(55, Math.round(100 - (alt.score - score) * 3)));
    } else if (delay) {
      continuePct = 25;
    } else if (plan.huntNow && plan.label === "Excellent") {
      continuePct = 90;
    } else if (plan.huntNow) {
      continuePct = 75;
    }

    const rating = Math.max(1, Math.min(5, Math.round(score / 18)));

    return {
      score,
      rating,
      reasons,
      pts,
      seasonNow,
      plan,
      delay,
      continuePct,
      alt: alt && alt.score > score ? alt : null,
      poke,
    };
  }

  /** Lighter score for comparing alternatives without recursion depth issues */
  function scoreTargetQuick(player, target) {
    const poke = byId.get(target.pokemonId);
    if (!poke) return { score: 0 };
    const pts = estimatePoints(poke, player);
    const plan = bestSeasonPlan(target.pokemonId);
    const others = otherPlayersHuntingLine(poke.rootId, player.id);
    let score =
      (pts.base + pts.unique) * 2 +
      plan.score * 0.1 +
      (PRIORITY_WEIGHT[target.priority] || 2) * 4;
    if (plan.huntNow) score += 10;
    else score -= plan.weeksUntil * 5;
    if (others.length) score -= 15;
    if (playerHasLine(player, poke.rootId)) score -= 20;
    return { score, name: target.name };
  }

  function fillDatalist() {
    const dl = $("sw-poke-datalist");
    if (!dl || !meta) return;
    dl.innerHTML = meta.pokemon
      .filter((p) => p.tier != null || (window.state?.data?.pokemon || []).some((x) => x.id === p.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (p) =>
          `<option value="${escapeHtml(p.name)}">${
            p.tier != null ? `T${p.tier} · ${p.points}pts` : "—"
          }</option>`
      )
      .join("");
  }

  function renderSeasons() {
    const box = $("sw-season-filters");
    box.innerHTML = SEASON_ORDER.map((s) => {
      const on = store.currentSeason === s ? " is-active" : "";
      return `<button type="button" class="chip${on}" data-sw-season="${s}">${SEASON_EMOJI[s] || ""} ${s}</button>`;
    }).join("");

    const up = upcomingSeasons(store.currentSeason);
    $("sw-season-upcoming").textContent = `Upcoming: ${up
      .slice(1)
      .map((s) => `${SEASON_EMOJI[s] || ""} ${s}`)
      .join(" → ")} (weekly during SW)`;
  }

  function renderPlayers() {
    const list = $("sw-player-list");
    list.innerHTML = store.players
      .map((p) => {
        const on = p.id === store.activePlayerId ? " is-active" : "";
        const n = (p.targets || []).filter((t) => t.status !== "done").length;
        return `
          <button type="button" class="sw-player-chip${on}" data-sw-player="${p.id}">
            <span>${escapeHtml(p.name)}</span>
            <span class="muted">${n} hunt${n === 1 ? "" : "s"}</span>
          </button>`;
      })
      .join("");
  }

  function renderCompleted() {
    const player = activePlayer();
    const box = $("sw-completed-list");
    if (!player.completed?.length) {
      box.innerHTML = '<p class="muted">None logged yet.</p>';
      return;
    }
    box.innerHTML = player.completed
      .map(
        (c) => `
        <div class="sw-mini-row">
          <img src="${SPRITE}/${c.pokemonId}.png" alt="" width="28" height="28" />
          <span>${escapeHtml(c.name)} <span class="muted">(line: ${escapeHtml(c.rootName)})</span></span>
          <button type="button" class="chip" data-sw-del-complete="${c.id}">Remove</button>
        </div>`
      )
      .join("");
  }

  function renderWarnings() {
    const player = activePlayer();
    const box = $("sw-warnings");
    const notes = [];

    for (const t of player.targets || []) {
      if (t.status === "done") continue;
      const poke = byId.get(t.pokemonId);
      if (!poke) continue;
      if (playerHasLine(player, poke.rootId)) {
        notes.push({
          type: "danger",
          text: `Duplicate risk: ${t.name} is the same evolution line as a shiny you already logged. Extra catches are only +1 point.`,
        });
      }
      const others = otherPlayersHuntingLine(poke.rootId, player.id);
      if (others.length) {
        notes.push({
          type: "warn",
          text: `Team overlap: ${t.name} line also hunted by ${others
            .map((o) => o.player)
            .join(", ")}. Only one unique +8 for the team — consider spreading targets.`,
        });
      }
    }

    if (!notes.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = notes
      .map(
        (n) =>
          `<div class="sw-alert sw-alert-${n.type}">${escapeHtml(n.text)}</div>`
      )
      .join("");
  }

  function renderTargets() {
    const player = activePlayer();
    $("sw-active-name").textContent = player.name;
    const box = $("sw-target-list");
    const targets = (player.targets || []).filter((t) => t.status !== "done");

    if (!targets.length) {
      box.innerHTML =
        '<p class="muted">No planned hunts yet. Click <strong>+ Add Pokémon</strong>.</p>';
      return;
    }

    box.innerHTML = targets
      .map((t) => {
        const poke = byId.get(t.pokemonId);
        const analysis = scoreTarget(player, t);
        const tier =
          poke?.tier != null ? `Tier ${poke.tier} · ${poke.points} pts` : "Untiered";
        return `
          <article class="sw-target-card">
            <div class="sw-target-top">
              <img src="${SPRITE}/${t.pokemonId}.png" alt="" width="56" height="56"
                onerror="this.src='${SPRITE}/0.png';this.onerror=null;" />
              <div>
                <h3>${escapeHtml(t.name)}</h3>
                <p class="muted">${escapeHtml(tier)} · Priority: ${escapeHtml(t.priority)}${
                  t.phases ? ` · ${t.phases} phases` : ""
                }</p>
                ${t.notes ? `<p class="muted">${escapeHtml(t.notes)}</p>` : ""}
              </div>
              <button type="button" class="chip" data-sw-del-target="${t.id}">Remove</button>
            </div>
            <div class="sw-season-grid">
              <div><span class="muted">This week</span><strong>${escapeHtml(
                store.currentSeason
              )} · ${escapeHtml(analysis.seasonNow.label)}</strong></div>
              <div><span class="muted">Best season</span><strong>${SEASON_EMOJI[analysis.plan.season] || ""} ${escapeHtml(
                analysis.plan.season
              )} · ${escapeHtml(analysis.plan.label)}</strong></div>
              <div><span class="muted">Hunt now?</span><strong>${
                analysis.plan.huntNow ? "Yes" : `Wait ${analysis.plan.weeksUntil}w`
              }</strong></div>
            </div>
            <p class="sw-hunt-plan${analysis.plan.huntNow ? " is-now" : " is-wait"}">${formatHuntPlan(
              t.name,
              analysis.plan
            )}</p>
            <p class="muted sw-hunt-sub">${escapeHtml(
              formatHuntSubtext(analysis.plan, analysis.seasonNow)
            )}</p>
          </article>`;
      })
      .join("");
  }

  function renderRoute() {
    const player = activePlayer();
    const box = $("sw-route");
    const targets = (player.targets || []).filter((t) => t.status !== "done");
    if (!targets.length) {
      box.innerHTML = '<p class="muted">Add targets to generate a hunt order.</p>';
      return;
    }

    const ranked = targets
      .map((t) => ({ t, a: scoreTarget(player, t) }))
      .sort((x, y) => {
        if (y.a.score !== x.a.score) return y.a.score - x.a.score;
        if (x.a.plan?.huntNow !== y.a.plan?.huntNow) {
          return y.a.plan?.huntNow ? 1 : -1;
        }
        return 0;
      });

    box.innerHTML = ranked
      .map(({ t, a }, i) => {
        const plan = a.plan;
        const locAttr = plan.locationKey
          ? ` data-goto-loc="${encodeURIComponent(plan.locationKey)}" role="button" tabindex="0"`
          : "";

        const delayBlock = a.delay
          ? `<p class="sw-rec"><strong>Don't hunt in ${escapeHtml(
              store.currentSeason
            )}.</strong> Save it for ${SEASON_EMOJI[plan.season] || ""} ${escapeHtml(
              plan.season
            )} at ${escapeHtml(plan.location)}.</p>`
          : "";

        const switchBlock =
          a.alt && a.continuePct <= 40
            ? `<p class="sw-rec"><strong>Switch?</strong> Continue ${a.continuePct}%. Hunt <strong>${escapeHtml(
                a.alt.name
              )}</strong> instead this week.</p>`
            : "";

        return `
          <article class="sw-route-card${i === 0 ? " is-best" : ""}${plan.huntNow ? " can-hunt-now" : " is-waiting"}"${locAttr}>
            <p class="rank-tag">${
              i === 0
                ? plan.huntNow
                  ? "Hunt this now"
                  : "Plan ahead"
                : `#${i + 1}`
            }</p>
            <div class="sw-route-head">
              <img src="${SPRITE}/${t.pokemonId}.png" alt="" width="48" height="48" />
              <div>
                <h3>${i + 1}. ${escapeHtml(t.name)}</h3>
                <p class="sw-stars">${starsFromScore(a.rating)}</p>
              </div>
            </div>
            <p class="sw-hunt-plan${plan.huntNow ? " is-now" : " is-wait"}">${formatHuntPlan(
              t.name,
              plan
            )}</p>
            <p class="muted sw-hunt-sub">${escapeHtml(formatHuntSubtext(plan, a.seasonNow))}</p>
            <ul class="sw-reason-list">
              ${a.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            </ul>
            ${delayBlock}
            ${switchBlock}
            ${
              plan.locationKey
                ? '<p class="muted sw-open-hint">Click card to open location →</p>'
                : ""
            }
          </article>`;
      })
      .join("");
  }

  function renderTeamRoute() {
    const box = $("sw-team-route");
    const block = $("sw-team-block");
    if (store.players.length < 2) {
      block.classList.add("is-hidden");
      return;
    }
    block.classList.remove("is-hidden");

    // Detect overlaps
    const lineHunters = new Map(); // rootId -> [{player, target}]
    for (const pl of store.players) {
      for (const t of pl.targets || []) {
        if (t.status === "done") continue;
        if (!lineHunters.has(t.rootId)) lineHunters.set(t.rootId, []);
        lineHunters.get(t.rootId).push({ player: pl, target: t });
      }
    }

    const overlaps = [...lineHunters.entries()].filter(([, arr]) => arr.length > 1);
    if (!overlaps.length) {
      box.innerHTML =
        '<p class="muted">No overlapping evolution lines across members. Distribution looks clean.</p>';
      return;
    }

    const suggestions = overlaps
      .map(([rootId, arr]) => {
        const keep = arr[0];
        const movers = arr.slice(1);
        const keepPoke = byId.get(keep.target.pokemonId);
        return `
          <div class="sw-alert sw-alert-warn">
            <strong>${escapeHtml(keepPoke?.rootName || keep.target.name)}</strong> line is hunted by
            ${arr.map((a) => escapeHtml(a.player.name)).join(", ")}.
            <br />Suggested: keep <strong>${escapeHtml(keep.player.name)}</strong> on
            ${escapeHtml(keep.target.name)}; others should switch to a different line for another unique +8.
            ${movers
              .map((m) => `<br />· ${escapeHtml(m.player.name)}: switch off ${escapeHtml(m.target.name)}`)
              .join("")}
          </div>`;
      })
      .join("");

    box.innerHTML = `
      <p class="muted">Goal: one hunter per evolution line when possible, so the team banks more unique +8 bonuses.</p>
      ${suggestions}`;
  }

  function renderAll() {
    if (!store) return;
    renderSeasons();
    renderPlayers();
    renderCompleted();
    renderWarnings();
    renderTargets();
    renderRoute();
    renderTeamRoute();
  }

  function showGateOrApp() {
    const gate = $("sw-gate");
    const app = $("sw-app");
    if (!gate || !app) return;
    const ok = isAuthed();
    gate.classList.toggle("is-hidden", ok);
    app.classList.toggle("is-hidden", !ok);
    if (ok) renderAll();
  }

  function applyMeta(data) {
    meta = data;
    byId = new Map(meta.pokemon.map((p) => [p.id, p]));
    byName = new Map(meta.pokemon.map((p) => [normalizeName(p.name), p]));
    fillDatalist();
  }

  function loadErrorHelp(err) {
    if (location.protocol === "file:") {
      return `Cannot load data from a file on disk. Start a local server:<br><code>python -m http.server 8080</code><br>Then open <code>http://localhost:8080/#/shinywars</code>`;
    }
    if (String(err.message).includes("404") || String(err.message).includes("HTTP 404")) {
      return `Missing <code>shinywars-meta.json</code> on the server. Run <code>node build-shinywars.js</code> and upload it with your site files.`;
    }
    return `Could not reach <code>shinywars-meta.json</code> (${escapeHtml(err.message)}). Use a local server or upload all files when hosting.`;
  }

  async function ensureMeta() {
    if (meta) return;

    if (window.dexReady) {
      try {
        await window.dexReady;
      } catch {
        /* locations failed; still try shiny meta below */
      }
    }

    if (window.ShinyWarsMeta) {
      applyMeta(window.ShinyWarsMeta);
      return;
    }

    const url = new URL("shinywars-meta.json", window.location.href).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    window.ShinyWarsMeta = data;
    applyMeta(data);
  }

  function bind() {
    $("sw-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = $("sw-password").value;
      if (val === PASSWORD) {
        setAuthed(true);
        $("sw-login-error").classList.add("is-hidden");
        $("sw-password").value = "";
        showGateOrApp();
      } else {
        $("sw-login-error").classList.remove("is-hidden");
      }
    });

    $("sw-season-filters")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sw-season]");
      if (!btn) return;
      store.currentSeason = btn.dataset.swSeason;
      saveStore();
      renderAll();
    });

    $("sw-add-player")?.addEventListener("click", () => {
      if (store.players.length >= 30) {
        alert("Max 30 players.");
        return;
      }
      const name = prompt("Member name?");
      if (!name?.trim()) return;
      const id = uid();
      store.players.push({ id, name: name.trim(), targets: [], completed: [] });
      store.activePlayerId = id;
      saveStore();
      renderAll();
    });

    $("sw-player-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sw-player]");
      if (!btn) return;
      store.activePlayerId = btn.dataset.swPlayer;
      saveStore();
      renderAll();
    });

    $("sw-add-target")?.addEventListener("click", () => {
      $("sw-target-form").classList.toggle("is-hidden");
      $("sw-target-input")?.focus();
    });

    $("sw-target-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const poke = resolvePokemon($("sw-target-input").value);
      if (!poke) {
        alert("Pokémon not found.");
        return;
      }
      const player = activePlayer();
      const rootId = lineRootOf(poke);
      if (playerHasLine(player, rootId)) {
        const ok = confirm(
          `Duplicate risk: ${poke.name} shares an evolution line with a shiny you already logged. Extra catches are only +1 point. Add anyway?`
        );
        if (!ok) return;
      }
      const others = otherPlayersHuntingLine(rootId, player.id);
      if (others.length) {
        const ok = confirm(
          `Team overlap: ${others
            .map((o) => o.player)
            .join(", ")} already plan this line. Only one unique +8 for the team. Add anyway?`
        );
        if (!ok) return;
      }

      player.targets.push({
        id: uid(),
        pokemonId: poke.id,
        name: poke.name,
        rootId: poke.rootId,
        rootName: poke.rootName,
        priority: $("sw-target-priority").value,
        notes: $("sw-target-notes").value.trim(),
        phases: Number($("sw-target-phases").value) || 0,
        status: "planned",
      });
      $("sw-target-input").value = "";
      $("sw-target-notes").value = "";
      $("sw-target-phases").value = "";
      $("sw-target-form").classList.add("is-hidden");
      saveStore();
      renderAll();
    });

    $("sw-target-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sw-del-target]");
      if (!btn) return;
      const player = activePlayer();
      player.targets = player.targets.filter((t) => t.id !== btn.dataset.swDelTarget);
      saveStore();
      renderAll();
    });

    $("sw-complete-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const poke = resolvePokemon($("sw-complete-input").value);
      if (!poke) {
        alert("Pokémon not found.");
        return;
      }
      const player = activePlayer();
      player.completed.push({
        id: uid(),
        pokemonId: poke.id,
        name: poke.name,
        rootId: poke.rootId,
        rootName: poke.rootName,
      });
      $("sw-complete-input").value = "";
      saveStore();
      renderAll();
    });

    $("sw-completed-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sw-del-complete]");
      if (!btn) return;
      const player = activePlayer();
      player.completed = player.completed.filter((c) => c.id !== btn.dataset.swDelComplete);
      saveStore();
      renderAll();
    });

    $("sw-refresh-route")?.addEventListener("click", () => renderRoute());

    $("sw-route")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-goto-loc]");
      if (!card) return;
      const key = decodeURIComponent(card.dataset.gotoLoc);
      if (window.goPage) window.goPage("locations", { locKey: key });
      else location.hash = `#/locations/${encodeURIComponent(key)}`;
    });

    $("sw-route")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".sw-route-card[data-goto-loc]");
      if (!card) return;
      e.preventDefault();
      const key = decodeURIComponent(card.dataset.gotoLoc);
      if (window.goPage) window.goPage("locations", { locKey: key });
      else location.hash = `#/locations/${encodeURIComponent(key)}`;
    });
  }

  async function show() {
    const page = $("page-shinywars");
    if (!page) return;
    page.classList.remove("is-hidden");

    const loadErr = $("sw-load-error");
    loadErr?.classList.add("is-hidden");

    try {
      await ensureMeta();
      store = loadStore();
      showGateOrApp();
    } catch (err) {
      $("sw-gate")?.classList.remove("is-hidden");
      $("sw-app")?.classList.add("is-hidden");
      if (loadErr) {
        loadErr.innerHTML = loadErrorHelp(err);
        loadErr.classList.remove("is-hidden");
      }
    }
  }

  function hide() {
    $("page-shinywars")?.classList.add("is-hidden");
  }

  function init() {
    bind();
    if (location.hash.replace(/^#\/?/, "").startsWith("shinywars")) {
      show();
    }
  }

  window.ShinyWars = { show, hide, init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
