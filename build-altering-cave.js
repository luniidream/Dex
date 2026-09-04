/**
 * Rebuild altering-cave-data.json from:
 *  - Synergy classic 7-cycle schedule + pools (live tracker)
 *  - Team Méw ZIP type-rotation groups (supplementary)
 *
 * Run: node build-altering-cave.js
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = __dirname;
const ZIP_HTML =
  "c:/Users/leuls/Downloads/AlteringCaveData_extracted/Rotation Groups.html";
const OUT = path.join(ROOT, "altering-cave-data.json");
const NAME_TO_ID = path.join(ROOT, "locations-data.json");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "DexACBuilder/1.0" } }, (r) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () =>
          resolve({
            status: r.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      })
      .on("error", reject);
  });
}

function parseRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
  let rm;
  while ((rm = rowRe.exec(html))) {
    const cells = [];
    let cm;
    cellRe.lastIndex = 0;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1];
      let t = cm[2]
        .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "$1")
        .replace(/<img[^>]*>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
      const colspan = +(attrs.match(/colspan="?(\d+)/i) || [])[1] || 1;
      cells.push({ t, colspan });
    }
    if (cells.some((c) => c.t)) rows.push(cells);
  }
  return rows.map((row) => {
    const out = [];
    for (const c of row) {
      out.push(c.t);
      for (let i = 1; i < c.colspan; i++) out.push("");
    }
    return out;
  });
}

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

function normalizeName(name) {
  return displayMonName(
    String(name || "")
      .replace(/\s*1%\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parsePokemonCell(name, tierRaw) {
  if (!name || /^(Singles|Hordes|Tier|Rotation|Current|ACTIVE)$/i.test(name)) {
    return null;
  }
  const rare = /1%/i.test(name);
  const n = normalizeName(name);
  if (!n || /^\d+$/.test(n)) return null;
  const tier = tierRaw !== undefined && tierRaw !== "" ? Number(tierRaw) : null;
  return {
    name: n,
    tier: Number.isFinite(tier) ? tier : null,
    rare: rare || undefined,
  };
}

function buildTypeRotations(rows) {
  const typeRow = rows[2] || [];
  const types = [];
  for (let ci = 4; ci < typeRow.length; ci += 2) {
    const type = typeRow[ci];
    if (type && !/^\d+$/.test(type)) types.push({ type, col: ci });
  }

  const rotations = {};
  for (let n = 1; n <= 6; n++) rotations[n] = { id: n, byType: {} };

  const rotStarts = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const cell = rows[ri][4];
    const m = cell && String(cell).match(/^Rotation\s*(\d+)$/i);
    if (m) rotStarts.push({ ri, id: +m[1] });
  }

  for (let i = 0; i < rotStarts.length; i++) {
    const { ri: start, id } = rotStarts[i];
    const end = i + 1 < rotStarts.length ? rotStarts[i + 1].ri : rows.length;
    let singlesStart = null;
    let hordesStart = null;
    let currentMarked = false;

    for (let ri = start; ri < end; ri++) {
      const c4 = rows[ri][4];
      if (/^Singles$/i.test(c4)) singlesStart = ri + 1;
      else if (/^Hordes$/i.test(c4)) hordesStart = ri + 1;
      for (const cell of rows[ri]) {
        if (/^Current$/i.test(cell)) currentMarked = true;
      }
    }

    const singlesEnd = hordesStart != null ? hordesStart - 1 : end;
    for (const { type, col } of types) {
      const singles = [];
      const hordes = [];
      if (singlesStart != null) {
        for (let ri = singlesStart; ri < singlesEnd; ri++) {
          const p = parsePokemonCell(rows[ri][col], rows[ri][col + 1]);
          if (p) singles.push(p);
        }
      }
      if (hordesStart != null) {
        for (let ri = hordesStart; ri < end; ri++) {
          const p = parsePokemonCell(rows[ri][col], rows[ri][col + 1]);
          if (p) hordes.push(p);
        }
      }
      if (singles.length || hordes.length) {
        rotations[id].byType[type] = { singles, hordes };
      }
    }
    rotations[id].snapshotMarkedCurrent = currentMarked;
  }

  const live = { singles: [], hordes: [], sourceTypeHint: typeRow[1] || null };
  let liveMode = null;
  for (let ri = 5; ri < 40; ri++) {
    const name = rows[ri]?.[1];
    const tier = rows[ri]?.[2];
    if (/^Singles$/i.test(name)) {
      liveMode = "singles";
      continue;
    }
    if (/^Hordes$/i.test(name)) {
      liveMode = "hordes";
      continue;
    }
    if (/^Rotation/i.test(rows[ri]?.[4] || "")) break;
    const p = parsePokemonCell(name, tier);
    if (!p || !liveMode) continue;
    live[liveMode].push(p);
  }

  return {
    types: types.map((t) => t.type),
    rotations: Object.values(rotations),
    liveSnapshot: live,
  };
}

function extractSynergyCycles(body) {
  const start = body.indexOf("const i=[");
  if (start < 0) throw new Error("Synergy cycles array not found");
  let i = start + "const i=".length;
  let depth = 0;
  let end = -1;
  for (; i < body.length; i++) {
    if (body[i] === "[") depth++;
    else if (body[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const arrSrc = body.slice(start + "const i=".length, end);
  const jsonish = arrSrc
    .replace(/([{\s,])(\w+):/g, '$1"$2":')
    .replace(/!0/g, "true")
    .replace(/!1/g, "false");
  return Function(`"use strict"; return (${jsonish});`)();
}

function nameKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[^a-z0-9]/g, "");
}

function attachIds(list, byName) {
  return list.map((p) => {
    const id = byName.get(nameKey(p.name)) || null;
    return id ? { ...p, id } : { ...p };
  });
}

(async () => {
  const locData = JSON.parse(fs.readFileSync(NAME_TO_ID, "utf8"));
  const byName = new Map();
  for (const p of locData.pokemon) byName.set(nameKey(p.name), p.id);

  // Synergy classic cycles
  let synergyBody;
  const cached = path.join(ROOT, "_altering_cave_rotations.CVK8gal.js");
  if (fs.existsSync(cached)) synergyBody = fs.readFileSync(cached, "utf8");
  else {
    const r = await get(
      "https://synergymmo.com/js/altering_cave_rotations.CVK8gal.js"
    );
    synergyBody = r.body;
    fs.writeFileSync(cached, synergyBody);
  }
  const synergyCycles = extractSynergyCycles(synergyBody).map((c) => ({
    id: c.cycle,
    repelTrick: !!c.repelTrick,
    repelLevel: c.repelLevel ?? null,
    pokemon: attachIds(
      (c.pokemon || []).map((p) => ({
        name: p.name,
        rate: p.rate,
        levelRange: p.levelRange || null,
        rarity: p.rarity || null,
        repelTrickRarity: p.repelTrickRarity || null,
      })),
      byName
    ),
  }));

  // Team Méw type groups from ZIP
  let typeGroups = null;
  if (fs.existsSync(ZIP_HTML)) {
    const rows = parseRows(fs.readFileSync(ZIP_HTML, "utf8"));
    const parsed = buildTypeRotations(rows);
    typeGroups = {
      types: parsed.types,
      liveSnapshot: {
        ...parsed.liveSnapshot,
        singles: attachIds(parsed.liveSnapshot.singles, byName),
        hordes: attachIds(parsed.liveSnapshot.hordes, byName),
      },
      rotations: parsed.rotations.map((r) => ({
        id: r.id,
        snapshotMarkedCurrent: !!r.snapshotMarkedCurrent,
        byType: Object.fromEntries(
          Object.entries(r.byType).map(([type, pool]) => [
            type,
            {
              singles: attachIds(pool.singles, byName),
              hordes: attachIds(pool.hordes, byName),
            },
          ])
        ),
      })),
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: {
      synergy: {
        url: "https://synergymmo.com/altering-cave-rotations/",
        module: "js/altering_cave_rotations.*.js",
        role: "Authoritative for classic 7-cycle schedule + encounter pools",
      },
      teamMewZip: {
        file: "Altering Cave Data.zip / Rotation Groups.html",
        role: "Type-based rotation groups (Singles/Hordes + tiers) — no schedule timestamps",
      },
      wiki: {
        url: "https://pokemmo.fandom.com/wiki/Altering_Cave",
        role: "Confirms 7 groups × 6 real-life hours for classic cave",
      },
    },
    discrepancies: [
      {
        id: "classic-vs-type-pools",
        summary:
          "Synergy/wiki describe 7 classic cycles (Zubat/Houndour/…). Team Méw ZIP describes 6 type-based Singles/Horde pools with tiers.",
        resolution:
          "Live rotation tracker uses Synergy classic cycles + UTC schedule. Type pools from the ZIP are shown separately and are editable.",
      },
      {
        id: "zip-current-markers",
        summary:
          "ZIP Active/Current panel matched Rotation 2 Dark 100%, while a Current marker sat on Rotation 3 Grass — snapshot inconsistency inside the sheet.",
        resolution:
          "ZIP Current markers treated as export-time notes only, never as the live clock.",
      },
      {
        id: "rotation-count",
        summary: "Wiki/Synergy: 7 rotations. Team Méw sheet: 6 type rotations (Rotation 6 empty).",
        resolution: "Classic tracker uses 7. Type-group browser uses sheet count.",
      },
    ],
    /**
     * Classic schedule — mirrors Synergy:
     *   slot = floor(nowMs / 21600000)
     *   rotation = ((slot - 82342) % 7 + 7) % 7 + 1
     *   msUntilSwap = 21600000 - (nowMs % 21600000)
     */
    schedule: {
      mode: "classic-synergy",
      timezone: "UTC",
      intervalMs: 21600000,
      offsetSlots: 82342,
      rotationCount: 7,
      boundariesNote: "Swaps at 00:00 / 06:00 / 12:00 / 18:00 UTC",
    },
    classicRotations: synergyCycles,
    typeRotationGroups: typeGroups,
    /**
     * Notification hook surface — consumers can subscribe without knowing schedule internals.
     */
    notificationContract: {
      event: "altering-cave-rotation-changed",
      payload: {
        previousRotation: "number",
        currentRotation: "number",
        nextSwapAt: "ISO-8601 UTC",
        pokemon: "array of {id,name}",
      },
      channels: ["in-app", "browser-notification", "discord-webhook"],
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log(
    `Wrote ${path.basename(OUT)} · classic=${synergyCycles.length} · typeGroups=${
      typeGroups ? typeGroups.rotations.length : 0
    }`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
