/**
 * Builds shinywars-meta.json: SW2026 tier chart + evolution line roots.
 * Run: node build-shinywars.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function clean(s) {
  return String(s || "")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF]/g, "")
    .trim();
}

// Official SW2026 tier chart (base / representative species per line)
// Source: https://forums.pokemmo.com/index.php?/topic/198507-pokemmo-shiny-wars-2026/
const TIER_LISTS = {
  0: [
    "Bulbasaur", "Charmander", "Squirtle", "Eevee", "Porygon", "Snorlax",
    "Chikorita", "Cyndaquil", "Totodile", "Togepi", "Tyrogue",
    "Treecko", "Torchic", "Mudkip", "Shedinja", "Beldum",
    "Turtwig", "Chimchar", "Piplup", "Riolu", "Rotom",
    "Snivy", "Tepig", "Oshawott", "Audino", "Ducklett", "Emolga",
    "Alomomola", "Larvesta", "Kecleon", "Tropius", "Chimecho", "Luvdisc",
    "Drifloon", "Stunky", "Chatot", "Gible", "Croagunk", "Finneon",
    "Darumaka", "Maractus", "Sigilyph", "Cryogonal", "Gothita", "Solosis",
    "Vanillite", "Klink", "Elgyem", "Stunfisk", "Druddigon", "Vullaby", "Durant",
  ],
  1: [
    "Chansey", "Kangaskhan", "Scyther", "Pinsir", "Sudowoodo", "Skarmory",
    "Shroomish", "Slakoth", "Skitty", "Plusle", "Minun", "Gulpin", "Castform",
    "Absol", "Burmy", "Combee", "Cherubi", "Spiritomb", "Skorupi", "Carnivine",
    "Pansage", "Pansear", "Panpour", "Drilbur", "Archen", "Zorua", "Pawniard",
    "Seviper", "Barboach", "Joltik", "Ferroseed", "Tynamo", "Cubchoo", "Shelmet",
    "Snover", "Patrat", "Munna", "Blitzle", "Roggenrola", "Woobat", "Tympole",
    "Sewaddle", "Minccino", "Mienfoo", "Golett",
  ],
  2: [
    "Clefairy", "Shellder", "Mr. Mime", "Lapras", "Omanyte", "Kabuto",
    "Aerodactyl", "Aipom", "Pineco", "Qwilfish", "Shuckle", "Corsola",
    "Houndour", "Miltank", "Ralts", "Nincada", "Lileep", "Anorith", "Feebas",
    "Relicanth", "Bagon", "Cranidos", "Shieldon", "Tirtouga", "Wailmer",
    "Cacnea", "Zangoose", "Deino", "Foongus", "Spoink", "Solrock", "Clamperl",
    "Bidoof", "Shinx", "Shellos", "Glameow", "Bronzor", "Basculin", "Sandile",
    "Yamask", "Deerling", "Frillish", "Litwick",
  ],
  3: [
    "Vulpix", "Growlithe", "Farfetch'd", "Exeggcute", "Staryu", "Jynx", "Magmar",
    "Tauros", "Dratini", "Sentret", "Ledyba", "Sunkern", "Yanma", "Murkrow",
    "Misdreavus", "Gligar", "Heracross", "Remoraid", "Delibird", "Mantine",
    "Nosepass", "Volbeat", "Illumise", "Carvanha", "Bouffalant", "Rufflet",
    "Heatmor", "Karrablast", "Roselia", "Baltoy", "Shuppet", "Duskull", "Spheal",
    "Buizel",
  ],
  4: [
    "Oddish", "Venonat", "Meowth", "Drowzee", "Electabuzz", "Hoothoot", "Spinarak",
    "Wooper", "Snubbull", "Sneasel", "Larvitar", "Lotad", "Surskit", "Spinda",
    "Trapinch", "Lunatone", "Corphish", "Kricketot", "Pachirisu", "Buneary",
    "Purrloin", "Pidove", "Scraggy", "Axew", "Petilil", "Dwebble", "Trubbish",
    "Electrike", "Torkoal",
  ],
  5: [
    "Caterpie", "Weedle", "Pikachu", "Nidoran♂", "Nidoran [M]", "NidoranM",
    "Jigglypuff", "Paras", "Bellsprout", "Horsea", "Natu", "Hoppip", "Teddiursa",
    "Wurmple", "Taillow", "Numel", "Swablu", "Snorunt", "Starly", "Hippopotas",
    "Lillipup", "Timburr", "Throh", "Sawk", "Venipede", "Cottonee", "Sableye",
    "Mawile", "Aron", "Meditite",
  ],
  6: [
    "Pidgey", "Spearow", "Ekans", "Nidoran♀", "Nidoran [F]", "NidoranF",
    "Diglett", "Mankey", "Abra", "Ponyta", "Doduo", "Grimer", "Cubone",
    "Lickitung", "Tangela", "Ditto", "Chinchou", "Mareep", "Slugma", "Phanpy",
    "Stantler", "Poochyena", "Zigzagoon", "Wingull", "Whismur", "Makuhita",
    "Swinub", "Smeargle", "Seedot",
  ],
  7: [
    "Rattata", "Sandshrew", "Zubat", "Psyduck", "Poliwag", "Machop", "Tentacool",
    "Geodude", "Slowpoke", "Magnemite", "Seel", "Gastly", "Onix", "Krabby",
    "Voltorb", "Koffing", "Rhyhorn", "Goldeen", "Magikarp", "Marill", "Unown",
    "Wobbuffet", "Girafarig", "Dunsparce",
  ],
};

const TIER_POINTS = {
  0: 50,
  1: 45,
  2: 40,
  3: 30,
  4: 15,
  5: 10,
  6: 5,
  7: 3,
};

const BONUSES = {
  uniqueSpecies: 8,
  secretShiny: 20,
  safari: 10,
  duplicatePlayer: 1,
  shinyAlpha: 75,
  shinyAlphaDuplicate: 35,
  legendary: 200,
  eggFlat: 35,
};

function normalizeName(name) {
  return clean(name)
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/\[f\]/gi, "f")
    .replace(/\[m\]/gi, "m")
    .replace(/nidoran\s*f/i, "nidoranf")
    .replace(/nidoran\s*m/i, "nidoranm")
    .replace(/farfetch'?d/i, "farfetchd")
    .replace(/mr\.?\s*mime/i, "mrmime")
    .replace(/[^a-z0-9]/g, "");
}

let raw = fs.readFileSync(path.join(ROOT, "monsters.json"), "utf8");
raw = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const monsters = JSON.parse(raw);

const byId = new Map();
const byNorm = new Map();
for (const m of monsters) {
  const name = clean(m.name);
  byId.set(m.id, { id: m.id, name, evolutions: m.evolutions || [] });
  byNorm.set(normalizeName(name), m.id);
}

// Parent map: childId -> parentId
const parentOf = new Map();
for (const m of monsters) {
  for (const evo of m.evolutions || []) {
    if (evo && evo.id) parentOf.set(evo.id, m.id);
  }
}

function rootId(id) {
  let cur = id;
  const seen = new Set();
  while (parentOf.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = parentOf.get(cur);
  }
  return cur;
}

// Line members from each root
const lineMembers = new Map(); // rootId -> Set of ids
for (const m of monsters) {
  const r = rootId(m.id);
  if (!lineMembers.has(r)) lineMembers.set(r, new Set());
  lineMembers.get(r).add(m.id);
}

// Tier lookup by normalized chart name → assign to whole evo line via root
const tierByRoot = new Map();
const unmatched = [];

for (const [tierStr, names] of Object.entries(TIER_LISTS)) {
  const tier = Number(tierStr);
  for (const name of names) {
    const nid = byNorm.get(normalizeName(name));
    if (!nid) {
      unmatched.push(name);
      continue;
    }
    const r = rootId(nid);
    // Prefer higher tier (lower number) if conflict
    if (!tierByRoot.has(r) || tier < tierByRoot.get(r)) {
      tierByRoot.set(r, tier);
    }
  }
}

const pokemon = monsters.map((m) => {
  const r = rootId(m.id);
  const root = byId.get(r);
  const tier = tierByRoot.has(r) ? tierByRoot.get(r) : null;
  return {
    id: m.id,
    name: clean(m.name),
    rootId: r,
    rootName: root ? root.name : clean(m.name),
    tier,
    points: tier == null ? null : TIER_POINTS[tier],
    lineIds: [...(lineMembers.get(r) || [m.id])],
    lineNames: [...(lineMembers.get(r) || [m.id])].map((id) => byId.get(id)?.name || String(id)),
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  source: "https://forums.pokemmo.com/index.php?/topic/198507-pokemmo-shiny-wars-2026/",
  event: {
    name: "PokeMMO Shiny Wars 2026",
    start: "2026-08-01T00:00:00Z",
    end: "2026-08-28T23:59:59Z",
    seasonOrder: ["Summer", "Autumn", "Winter", "Spring"],
    seasonDays: 7,
    note: "Seasons rotate every 7 days during the event: Summer → Autumn → Winter → Spring",
  },
  scoring: {
    tierPoints: TIER_POINTS,
    bonuses: BONUSES,
    rules: [
      "Same evolution line shares the same tier points.",
      "Unique species bonus: +8 the first time the TEAM catches a line.",
      "Player duplicate penalty: extra shinies of the same line by one player = +1 (Alphas +35).",
      "Secret Shiny +20, Safari +10.",
      "Egg hatch = max(35, tier value).",
    ],
  },
  unmatchedTierNames: unmatched,
  pokemon,
};

fs.writeFileSync(path.join(ROOT, "shinywars-meta.json"), JSON.stringify(out));
console.log(
  `Wrote shinywars-meta.json · ${pokemon.length} species · ${tierByRoot.size} tiered lines · unmatched ${unmatched.length}`
);
if (unmatched.length) console.log("Unmatched:", unmatched.join(", "));
