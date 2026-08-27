# Dex — PokeMMO Location Guide

Static site for **where Pokémon appear** in PokeMMO: locations, seasons, single vs horde, fishing, and Sweet Scent rates. Sprites from [PokéAPI](https://pokeapi.co/).

## Features

- **Locations** — browse areas; see every Pokémon that can appear there
- **Pokémon** — browse species; see every location they can be found
- Click either way (Pokémon ↔ Location)
- Filters: **Single / Any Horde / 3× / 5×**, Grass, Cave, Water, Fishing rods, Lure, Special, season, region
- **Sweet Scent / Honey** rate helper: horde entries show interpreted horde odds, while single encounters show listed single odds.
- **Random** — roll a random shiny-hunt target with region / color / season / encounter filters (shiny sprites)
- **Altering Cave** — live classic 7-cycle rotation tracker (UTC, Synergy-compatible) + Team Méw type pools

## Run locally

```bash
cd "d:\Leul Folder\Dex"
python -m http.server 8080
```

Open http://localhost:8080

Or: `npx --yes serve .`

## Rebuild data

After updating `monsters.json`:

```bash
node build-data.js
```

Pokédex colors (for Random filters):

```bash
node build-pokemon-colors.js
```

Altering Cave data (Synergy classic cycles + Team Méw ZIP type groups):

```bash
node build-altering-cave.js
```

Requires the extracted ZIP at `c:\Users\leuls\Downloads\AlteringCaveData_extracted\Rotation Groups.html` (or update the path in `build-altering-cave.js`).

## Host for free

Upload: `index.html`, `styles.css`, `app.js`, `random-hunt.js`, `altering-cave.js`, `shinywars.js`, `locations-data.json`, `shinywars-meta.json`, `altering-cave-data.json`, `pokemon-colors.json`  
(Netlify Drop, Cloudflare Pages, GitHub Pages, surge.sh — no backend.)

You do **not** need to upload `monsters.json` unless regenerating data later.
