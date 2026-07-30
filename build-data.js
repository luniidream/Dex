/**
 * Regenerates locations-data.json from monsters.json
 * Run: node build-data.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "monsters.json");
const OUT = path.join(ROOT, "locations-data.json");

function clean(s) {
  return String(s || "")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF]/g, "")
    .trim();
}

function normalizeEncounter(type) {
  const t = clean(type) || "Unknown";
  if (/super\s*rod/i.test(t)) return "Super Rod";
  if (/good\s*rod/i.test(t)) return "Good Rod";
  if (/old\s*rod/i.test(t)) return "Old Rod";
  return t;
}

function normalizeRarity(r) {
  let s = clean(r) || "--";
  s = s.replace(",", ".");
  return s;
}

let raw = fs.readFileSync(SRC, "utf8");
raw = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const monsters = JSON.parse(raw);

const locMap = new Map();
const pokeMap = new Map();
const encounterSet = new Set();

for (const m of monsters) {
  if (!Array.isArray(m.locations) || !m.locations.length) continue;
  const pokeName = clean(m.name);

  if (!pokeMap.has(m.id)) {
    pokeMap.set(m.id, { id: m.id, name: pokeName, locationCount: 0 });
  }

  for (const l of m.locations) {
    const name = clean(l.location_name_full || l.location_name);
    const region = clean(l.region_name) || "Unknown";
    const key = `${l.location_id}::${name}::${region}`;
    const encounter = normalizeEncounter(l.type);
    encounterSet.add(encounter);

    if (!locMap.has(key)) {
      locMap.set(key, {
        id: l.location_id,
        name,
        shortName: clean(l.location_name),
        region,
        regionId: l.region_id ?? 0,
        pokemon: [],
      });
    }

    locMap.get(key).pokemon.push({
      id: m.id,
      name: pokeName,
      season: clean(l.season) || "Any",
      encounter,
      minLevel: l.min_level ?? null,
      maxLevel: l.max_level ?? null,
      morning: normalizeRarity(l.rarity_morning),
      day: normalizeRarity(l.rarity_day),
      night: normalizeRarity(l.rarity_night),
      horde3: !!l.is_horde_3x,
      horde5: !!l.is_horde_5x,
    });
  }
}

const seasonOrder = { Any: 0, Spring: 1, Summer: 2, Autumn: 3, Winter: 4 };

const locations = [...locMap.values()]
  .map((loc) => {
    const seen = new Set();
    loc.pokemon = loc.pokemon
      .filter((p) => {
        const k = [
          p.id,
          p.season,
          p.encounter,
          p.minLevel,
          p.maxLevel,
          p.morning,
          p.day,
          p.night,
          p.horde3,
          p.horde5,
        ].join("|");
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => {
        const sa = seasonOrder[a.season] ?? 9;
        const sb = seasonOrder[b.season] ?? 9;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name) || a.id - b.id;
      });
    return loc;
  })
  .sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.name.localeCompare(b.name);
  });

// Count unique locations per Pokémon
const locKeysByPoke = new Map();
for (const loc of locations) {
  const key = `${loc.id}::${loc.name}::${loc.region}`;
  for (const p of loc.pokemon) {
    if (!locKeysByPoke.has(p.id)) locKeysByPoke.set(p.id, new Set());
    locKeysByPoke.get(p.id).add(key);
  }
}

const pokemon = [...pokeMap.values()]
  .map((p) => ({
    ...p,
    locationCount: locKeysByPoke.get(p.id)?.size || 0,
  }))
  .sort((a, b) => a.id - b.id);

const out = {
  generatedAt: new Date().toISOString(),
  regions: [...new Set(locations.map((l) => l.region))].sort(),
  seasons: ["Any", "Spring", "Summer", "Autumn", "Winter"],
  encounters: [...encounterSet].sort((a, b) => a.localeCompare(b)),
  /** PokeMMO Sweet Scent / Honey: listed grass/cave % × 20 ≈ horde species chance */
  hordeRateScale: 20,
  pokemon,
  locations,
};

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
  `Wrote ${locations.length} locations, ${pokemon.length} Pokémon → ${path.basename(OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`
);
