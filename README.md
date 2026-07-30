# Dex — PokeMMO Location Guide

Static site for **where Pokémon appear** in PokeMMO: locations, seasons, single vs horde, fishing, and Sweet Scent rates. Sprites from [PokéAPI](https://pokeapi.co/).

## Features

- **Locations** — browse areas; see every Pokémon that can appear there
- **Pokémon** — browse species; see every location they can be found
- Click either way (Pokémon ↔ Location)
- Filters: **Single / Any Horde / 3× / 5×**, Grass, Cave, Water, Fishing rods, Lure, Special, season, region
- **Sweet Scent / Honey** rate helper: horde entries show interpreted horde odds, while single encounters show listed single odds.

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

## Host for free

Upload: `index.html`, `styles.css`, `app.js`, `shinywars.js`, `locations-data.json`, `shinywars-meta.json`  
(Netlify Drop, Cloudflare Pages, GitHub Pages, surge.sh — no backend.)

You do **not** need to upload `monsters.json` unless regenerating data later.
