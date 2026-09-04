/**
 * Altering Cave Rotation Tracker — #/altering
 * Classic 7-cycle schedule (Synergy formula) + Team Méw type pools.
 */
(function () {
  const SPRITE =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const SHINY = `${SPRITE}/shiny`;

  const $ = (id) => document.getElementById(id);

  let data = null;
  let tickTimer = null;
  let lastRotation = null;
  let selectedHistoryId = null;
  let bound = false;
  const listeners = new Set();

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Normalize mixed-case sheet names (e.g. "poliwag" → "Poliwag"). */
  function displayMonName(name) {
    return String(name || "")
      .trim()
      .split(/([\s.\-]+)/)
      .map((part) => {
        if (!part || /^[\s.\-]+$/.test(part)) return part;
        const lower = part.toLowerCase();
        if (lower === "mr") return "Mr";
        if (lower === "f" || lower === "m") return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("");
  }

  function mod(a, e) {
    return ((a % e) + e) % e;
  }

  /**
   * Synergy-compatible classic schedule (UTC wall clock independent of TZ/DST):
   * slot = floor(nowMs / intervalMs)
   * rotation = ((slot - offsetSlots) % rotationCount) + 1
   */
  function getClassicState(nowMs = Date.now()) {
    if (!data?.schedule) {
      return { ok: false, error: "Schedule data missing" };
    }
    const { intervalMs, offsetSlots, rotationCount } = data.schedule;
    if (!intervalMs || !rotationCount) {
      return { ok: false, error: "Invalid schedule config" };
    }
    const slot = Math.floor(nowMs / intervalMs);
    const rotation = mod(slot - offsetSlots, rotationCount) + 1;
    const msUntilSwap = intervalMs - mod(nowMs, intervalMs);
    const endsAt = nowMs + msUntilSwap;
    const startedAt = endsAt - intervalMs;
    return {
      ok: true,
      rotation,
      msUntilSwap,
      endsAt,
      startedAt,
      rotationCount,
      intervalMs,
    };
  }

  function getRotation(id) {
    return data?.classicRotations?.find((r) => r.id === id) || null;
  }

  function formatCountdown(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return {
      text: `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`,
      hours: h,
      mins: m,
      secs: sec,
    };
  }

  function formatUtc(ms) {
    try {
      return new Date(ms).toLocaleString(undefined, {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return new Date(ms).toISOString();
    }
  }

  function spriteHtml(p, { shiny = false, tierMode = false } = {}) {
    const id = p.id;
    const src = id
      ? shiny
        ? `${SHINY}/${id}.png`
        : `${SPRITE}/${id}.png`
      : `${SPRITE}/0.png`;
    const rateLabel =
      p.rate != null
        ? tierMode
          ? `Tier ${escapeHtml(String(p.rate))}`
          : `${escapeHtml(String(p.rate))}%`
        : "";
    return `
      <figure class="ac-mon">
        <img src="${src}" alt="" width="64" height="64" loading="lazy"
          onerror="this.src='${SPRITE}/0.png';this.onerror=null;" />
        <figcaption>
          <span class="ac-mon-name">${escapeHtml(displayMonName(p.name))}</span>
          ${rateLabel ? `<span class="ac-mon-rate">${rateLabel}</span>` : ""}
          ${
            p.levelRange
              ? `<span class="ac-mon-lv">Lv ${escapeHtml(p.levelRange.join("–"))}</span>`
              : ""
          }
        </figcaption>
      </figure>`;
  }

  function emitRotationChange(prev, next, state) {
    const rot = getRotation(next);
    const detail = {
      event: "altering-cave-rotation-changed",
      previousRotation: prev,
      currentRotation: next,
      nextSwapAt: new Date(state.endsAt).toISOString(),
      pokemon: (rot?.pokemon || []).map((p) => ({ id: p.id, name: p.name })),
    };
    for (const fn of listeners) {
      try {
        fn(detail);
      } catch (err) {
        console.warn("AC notification listener error", err);
      }
    }
    window.dispatchEvent(
      new CustomEvent("dex:altering-cave-rotation", { detail })
    );

    // Optional browser notification if already permitted
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("Altering Cave Rotation Updated", {
          body: `The cave has rotated!\nCurrent Rotation: #${next}\n${(rot?.pokemon || [])
            .map((p) => p.name)
            .join(", ")}`,
        });
      } catch {}
    }
  }

  function renderCurrent() {
    const root = $("ac-current");
    if (!root || !data) return;

    const state = getClassicState();
    if (!state.ok) {
      root.innerHTML = `<div class="ac-error"><p>Could not calculate rotation.</p><p class="muted">${escapeHtml(state.error)}</p></div>`;
      return;
    }

    if (lastRotation != null && lastRotation !== state.rotation) {
      emitRotationChange(lastRotation, state.rotation, state);
      selectedHistoryId = state.rotation;
    }
    lastRotation = state.rotation;

    const rot = getRotation(state.rotation);
    const cd = formatCountdown(state.msUntilSwap);
    const pokemon = rot?.pokemon || [];

    root.innerHTML = `
      <div class="ac-hero">
        <div class="ac-hero-copy">
          <p class="empty-kicker">Altering Cave</p>
          <h1>Rotation #${state.rotation}</h1>
          ${
            rot?.repelTrick
              ? `<p class="ac-repel">Repel trick · Lv ${escapeHtml(String(rot.repelLevel))}</p>`
              : `<p class="ac-repel is-off">No repel trick</p>`
          }
        </div>
        <div class="ac-countdown" aria-live="polite">
          <p class="ac-countdown-label">Next rotation</p>
          <p class="ac-countdown-value" id="ac-countdown-value">${cd.text}</p>
          <p class="muted" id="ac-next-at">${escapeHtml(formatUtc(state.endsAt))}</p>
        </div>
      </div>
      <div class="ac-mon-grid" id="ac-current-mons">
        ${
          pokemon.length
            ? pokemon.map((p) => spriteHtml(p)).join("")
            : `<p class="muted">No Pokémon listed for this rotation.</p>`
        }
      </div>
      <div class="ac-notify-row">
        <button type="button" class="chip" id="ac-notify-btn">Enable notifications</button>
      </div>`;
  }

  function updateCountdownOnly() {
    const state = getClassicState();
    if (!state.ok) return;
    if (lastRotation != null && lastRotation !== state.rotation) {
      renderCurrent();
      renderHistory();
      return;
    }
    const el = $("ac-countdown-value");
    const at = $("ac-next-at");
    if (el) el.textContent = formatCountdown(state.msUntilSwap).text;
    if (at) at.textContent = formatUtc(state.endsAt);
  }

  function renderHistory() {
    const list = $("ac-history");
    if (!list || !data) return;
    const state = getClassicState();
    const current = state.ok ? state.rotation : null;
    const count = data.schedule.rotationCount;
    if (selectedHistoryId == null) selectedHistoryId = current;

    const order = [];
    if (current != null) {
      // upcoming first after current, then previous
      for (let i = 0; i < count; i++) {
        const id = ((current - 1 + i) % count) + 1;
        order.push(id);
      }
    } else {
      for (let i = 1; i <= count; i++) order.push(i);
    }

    list.innerHTML = order
      .map((id) => {
        const rot = getRotation(id);
        const isCurrent = id === current;
        let badge = "Rotation";
        if (isCurrent) badge = "Now";
        else if (current != null) {
          const ahead = mod(id - current, count);
          if (ahead === 1) badge = "Next";
          else if (ahead > 1) badge = `In ${ahead} swaps`;
          else badge = "Earlier";
        }
        const active = selectedHistoryId === id ? " is-active" : "";
        const cur = isCurrent ? " is-current" : "";
        return `
          <button type="button" class="ac-hist-item${active}${cur}" data-ac-hist="${id}">
            <span class="ac-hist-badge">${badge}</span>
            <span class="ac-hist-title">Rotation ${id}</span>
            <span class="ac-hist-count">${rot?.pokemon?.length || 0} Pokémon</span>
          </button>`;
      })
      .join("");

    renderHistoryDetail(selectedHistoryId);
  }

  function renderHistoryDetail(id) {
    const panel = $("ac-history-detail");
    if (!panel) return;
    const rot = getRotation(id);
    if (!rot) {
      panel.innerHTML = `<p class="muted">Unknown rotation.</p>`;
      return;
    }
    const state = getClassicState();
    const isCurrent = state.ok && state.rotation === id;
    panel.innerHTML = `
      <header class="ac-detail-head">
        <p class="empty-kicker">${isCurrent ? "Live now" : "Rotation preview"}</p>
        <h2>Rotation ${rot.id}</h2>
        <p class="muted">${
          rot.repelTrick
            ? `Repel trick · Lv ${escapeHtml(String(rot.repelLevel))}`
            : "No repel trick"
        }</p>
      </header>
      <div class="ac-mon-grid">
        ${(rot.pokemon || []).map((p) => spriteHtml(p)).join("")}
      </div>`;
  }

  function renderTypeGroups() {
    const root = $("ac-type-groups");
    if (!root) return;
    const groups = data?.typeRotationGroups;
    if (!groups) {
      root.innerHTML = `<p class="muted">Team Méw type-pool data not loaded.</p>`;
      return;
    }

    const rotations = groups.rotations || [];
    root.innerHTML = `
      <div class="ac-type-note">
        <h2 class="ac-section-title">Type pools</h2>
        <label class="filter-select ac-type-select">
          <span class="sr-only">Type pool</span>
          <select id="ac-type-rot-select" class="dex-select" aria-label="Type pool">
            ${rotations
              .map((r) => `<option value="${r.id}">Pool ${r.id}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      <div id="ac-type-rot-body"></div>`;

    renderTypeRotationBody(1);
  }

  function renderTypeRotationBody(rotId) {
    const body = $("ac-type-rot-body");
    if (!body || !data?.typeRotationGroups) return;
    const rot = data.typeRotationGroups.rotations.find((r) => r.id === rotId);
    const sel = $("ac-type-rot-select");
    if (sel) sel.value = String(rotId);
    if (!rot) {
      body.innerHTML = `<p class="muted">Empty rotation.</p>`;
      return;
    }
    const types = Object.keys(rot.byType).sort();
    if (!types.length) {
      body.innerHTML = `<p class="muted">No type pools filled for Rotation ${rotId} in the sheet.</p>`;
      return;
    }
    body.innerHTML = types
      .map((type) => {
        const pool = rot.byType[type];
        return `
          <section class="ac-type-block">
            <h3>${escapeHtml(type)}</h3>
            <div class="ac-type-cols">
              <div>
                <p class="field-label">Singles</p>
                <div class="ac-mon-grid ac-mon-grid-compact">
                  ${(pool.singles || [])
                    .map((p) =>
                      spriteHtml(
                        { id: p.id, name: p.name, rate: p.tier },
                        { tierMode: true }
                      )
                    )
                    .join("") || "<p class='muted'>—</p>"}
                </div>
              </div>
              <div>
                <p class="field-label">Hordes</p>
                <div class="ac-mon-grid ac-mon-grid-compact">
                  ${(pool.hordes || [])
                    .map((p) =>
                      spriteHtml(
                        { id: p.id, name: p.name, rate: p.tier },
                        { tierMode: true }
                      )
                    )
                    .join("") || "<p class='muted'>—</p>"}
                </div>
              </div>
            </div>
          </section>`;
      })
      .join("");
  }

  function startTicker() {
    stopTicker();
    tickTimer = setInterval(updateCountdownOnly, 1000);
  }

  function stopTicker() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    const root = $("page-altering");
    if (!root) return;

    root.addEventListener("change", (e) => {
      if (e.target.id === "ac-type-rot-select") {
        renderTypeRotationBody(+e.target.value);
      }
    });

    root.addEventListener("click", (e) => {
      const hist = e.target.closest("[data-ac-hist]");
      if (hist) {
        selectedHistoryId = +hist.dataset.acHist;
        renderHistory();
        return;
      }
      if (e.target.closest("#ac-notify-btn")) {
        if (typeof Notification === "undefined") {
          alert("Notifications are not supported in this browser.");
          return;
        }
        Notification.requestPermission().then((perm) => {
          const btn = $("ac-notify-btn");
          if (btn) {
            btn.textContent =
              perm === "granted"
                ? "Browser notifications on"
                : "Notifications blocked";
          }
        });
      }
    });

    // Recalculate on tab focus (catches sleep / wrong local clocks relative to refresh)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !$("page-altering")?.classList.contains("is-hidden")) {
        renderCurrent();
        renderHistory();
      }
    });
  }

  function renderAll() {
    renderCurrent();
    renderHistory();
    renderTypeGroups();
  }

  async function load() {
    const res = await fetch("altering-cave-data.json");
    if (!res.ok) throw new Error(`altering-cave-data.json HTTP ${res.status}`);
    data = await res.json();
    return data;
  }

  function show() {
    $("page-altering")?.classList.remove("is-hidden");
    bind();
    if (!data) {
      $("ac-current").innerHTML = `<p class="muted">Loading rotation data…</p>`;
      load()
        .then(() => {
          renderAll();
          startTicker();
        })
        .catch((err) => {
          $("ac-current").innerHTML = `
            <div class="ac-error">
              <p>Could not load Altering Cave data.</p>
              <p class="muted">${escapeHtml(err.message)}</p>
            </div>`;
        });
    } else {
      renderAll();
      startTicker();
    }
  }

  function hide() {
    $("page-altering")?.classList.add("is-hidden");
    stopTicker();
  }

  window.AlteringCave = {
    show,
    hide,
    ready: load().catch((e) => {
      console.warn(e);
      return null;
    }),
    getClassicState,
    onRotationChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get data() {
      return data;
    },
  };
})();
