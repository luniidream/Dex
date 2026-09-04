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
      <div class="ac-current-wrap">
        <div class="ac-current-header">
          <div>
            <p class="empty-kicker">Altering Cave</p>
            <h1>Rotation #${state.rotation}</h1>
            ${
              rot?.repelTrick
                ? `<p class="ac-repel">Repel trick · Lv ${escapeHtml(String(rot.repelLevel))}</p>`
                : `<p class="ac-repel is-off">No repel trick</p>`
            }
          </div>
          <div class="ac-compact-timer" aria-live="polite">
            <span class="ac-timer-icon">⏳</span>
            <div class="ac-timer-content">
              <p class="ac-timer-label">Next rotation in</p>
              <p class="ac-timer-value" id="ac-countdown-value">${cd.text}</p>
            </div>
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
        </div>
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

    // Update all visible timer displays
    const count = data?.schedule?.rotationCount || 7;
    for (let id = 1; id <= count; id++) {
      const timerEl = $(`ac-timer-${id}`);
      if (!timerEl) continue;

      const current = state.rotation;
      let timeUntilMs = 0;
      if (id === current) {
        timeUntilMs = state.msUntilSwap;
      } else if (current != null) {
        const ahead = mod(id - current, count);
        timeUntilMs = state.msUntilSwap + (ahead - 1) * state.intervalMs;
      }

      const cd = formatCountdown(timeUntilMs);
      const valueEl = timerEl.querySelector(".ac-timer-value");
      if (valueEl) valueEl.textContent = cd.text;
    }

    // Also update the main countdown if it exists
    const mainCd = $("ac-countdown-value");
    if (mainCd) mainCd.textContent = formatCountdown(state.msUntilSwap).text;
    const mainAt = $("ac-next-at");
    if (mainAt) mainAt.textContent = formatUtc(state.endsAt);
  }

  let allRotationsExpanded = false;

  function renderHistory() {
    const list = $("ac-history");
    if (!list || !data) return;
    const state = getClassicState();
    const current = state.ok ? state.rotation : null;
    const count = data.schedule.rotationCount;
    if (selectedHistoryId == null) selectedHistoryId = current;

    // Build rotation order
    const order = [];
    if (current != null) {
      for (let i = 0; i < count; i++) {
        const id = ((current - 1 + i) % count) + 1;
        order.push(id);
      }
    } else {
      for (let i = 1; i <= count; i++) order.push(i);
    }

    // Show only current rotation by default, or all if expanded
    const visibleRotations = allRotationsExpanded ? order : [current];

    list.innerHTML = `
      <div class="ac-rotations-header">
        <h2 class="ac-section-title">Rotations</h2>
        <button type="button" class="ac-toggle-rotations" id="ac-toggle-rotations">
          ${allRotationsExpanded ? "Show Current Only" : "View All Rotations"}
        </button>
      </div>
      <div class="ac-rotations-container">
        ${visibleRotations
          .map((id) => {
            const rot = getRotation(id);
            const isCurrent = id === current;
            let badge = "Current";
            if (!isCurrent && current != null) {
              const ahead = mod(id - current, count);
              if (ahead === 1) badge = "Next";
              else if (ahead > 1) badge = `+${ahead}`;
              else badge = "Previous";
            }

            // Calculate time until this rotation starts
            let timeUntilMs = 0;
            if (isCurrent) {
              timeUntilMs = state.msUntilSwap;
            } else if (current != null) {
              const ahead = mod(id - current, count);
              timeUntilMs = state.msUntilSwap + (ahead - 1) * state.intervalMs;
            }

            const cd = formatCountdown(timeUntilMs);
            const cur = isCurrent ? " is-current" : "";
            return `
              <div class="ac-rotation-card${cur}" data-ac-hist="${id}">
                <div class="ac-rot-header">
                  <div class="ac-rot-info">
                    <span class="ac-rot-badge">${badge}</span>
                    <h3 class="ac-rot-title">Rotation #${id}</h3>
                  </div>
                  <div class="ac-rot-timer" id="ac-timer-${id}">
                    <span class="ac-timer-label">Time until</span>
                    <span class="ac-timer-value">${cd.text}</span>
                  </div>
                </div>
                <div class="ac-mon-grid" id="ac-mons-${id}">
                  ${
                    rot?.pokemon?.length
                      ? rot.pokemon.map((p) => spriteHtml(p)).join("")
                      : `<p class="muted">No Pokémon listed.</p>`
                  }
                </div>
                ${
                  rot?.repelTrick
                    ? `<p class="ac-repel">Repel trick · Lv ${escapeHtml(String(rot.repelLevel))}</p>`
                    : ""
                }
              </div>`;
          })
          .join("")}
      </div>`;
  }

  function renderHistoryDetail(id) {
    // Detail panel removed - rotations now display inline in cards
    return;
  }

  function renderTypeGroups() {
    // Type groups (pools) section is now hidden - removed entirely
    const root = $("ac-type-groups");
    if (root) {
      root.style.display = "none";
    }
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

    root.addEventListener("click", (e) => {
      // Toggle rotations button
      if (e.target.id === "ac-toggle-rotations") {
        allRotationsExpanded = !allRotationsExpanded;
        renderHistory();
        return;
      }

      // Rotation card click
      const card = e.target.closest("[data-ac-hist]");
      if (card) {
        selectedHistoryId = +card.dataset.acHist;
        renderHistoryDetail(selectedHistoryId);
        return;
      }

      // Notify button
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

    // Recalculate on tab focus
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
