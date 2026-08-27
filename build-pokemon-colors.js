/**
 * Build pokemon-colors.json via PokeAPI color endpoints (10 requests).
 * Run: node build-pokemon-colors.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT = path.join(__dirname, "pokemon-colors.json");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "DexColorBuilder/1.0" } }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          return get(r.headers.location).then(resolve, reject);
        }
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          if (r.statusCode !== 200) reject(new Error(`${url} → ${r.statusCode}`));
          else resolve(JSON.parse(d));
        });
      })
      .on("error", reject);
  });
}

function speciesIdFromUrl(url) {
  const m = String(url).match(/\/pokemon-species\/(\d+)\/?$/);
  return m ? +m[1] : null;
}

(async () => {
  const index = await get("https://pokeapi.co/api/v2/pokemon-color/");
  const byId = {};
  const colors = [];

  for (const entry of index.results) {
    const detail = await get(entry.url);
    const color = detail.name;
    colors.push(color);
    for (const s of detail.pokemon_species || []) {
      const id = speciesIdFromUrl(s.url);
      if (id != null) byId[id] = color;
    }
    console.log(color, detail.pokemon_species?.length || 0);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "https://pokeapi.co/api/v2/pokemon-color/",
    colors: colors.sort(),
    byId,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log("Wrote", OUT, Object.keys(byId).length, "species");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
