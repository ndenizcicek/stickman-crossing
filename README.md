# Stickman Crossing

Hop across busy city streets, pick up friends waving on the sidewalk and keep your chain alive.
Plain TypeScript + HTML canvas, no game engine and no image assets.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # production build into dist/ (zip this folder for game portals)
npm run preview   # serve the production build
```

## Controls

- Tap: step forward. Swipe: left, right, back.
- Keyboard: arrow keys or WASD, Space for forward.

## Code map

| File | What it does |
| --- | --- |
| `src/config.ts` | Every tunable value: vehicles, cities, speeds, ad pacing |
| `src/world.ts` | Endless street generation and traffic simulation |
| `src/game.ts` | Player, friend chain, scoring, camera, death and revive |
| `src/render.ts` | All drawing (pen-on-paper style) |
| `src/ui.ts` | Screens: main menu, city picker, settings, privacy viewer, pause, game over, ad countdown |
| `src/haptics.ts` | Vibration through Capacitor Haptics |
| `src/progress.ts` | Best scores and the city unlock chain |
| `src/storage.ts` | Durable saved data (Capacitor Preferences / localStorage) |
| `src/ads.ts` | Ad interface, placeholder ads, interstitial pacing rules |
| `src/audio.ts` | Synthesized sound effects |
| `src/main.ts` | Wires everything together, input, game loop |

## Cities

Istanbul, New York, Tokyo, Moscow, Berlin, Singapore, Cape Town, Buenos Aires, Rio.

## Saved progress and locked cities

Best scores, unlocked cities, ad progress and settings are saved with Capacitor Preferences in the app
(they survive restarts and updates and reset only when the app is deleted) and localStorage in browsers.
See `src/storage.ts` and `src/progress.ts`.

Istanbul, New York and Tokyo are open from the start. Every later city on the map opens when the player
scores `unlock.score` in the city before it, or watches `unlock.ads` rewarded ads for it. Set the defaults in
`STANDARD_UNLOCK` (config.ts) or give a city its own `unlock` rule.

## Adding a city

Add an entry to `CITIES` and `CITY_ORDER` in `src/config.ts` (the map, unlock chain and saved data follow
`CITY_ORDER` automatically): name, tagline, map badge vehicle, unlock rule, traffic side
(`'left'` or `'right'`), vehicle mix, bike-lane and tram chances, wide roads, snowfall, paint jobs,
sidewalk style and obstacles, road colour.
New vehicle or obstacle types also need a drawing in `src/render.ts`.

## Ads

The game only talks to the `AdProvider` interface in `src/ads.ts`. Right now `FakeAdProvider`
shows a 3-second countdown. For release, add a provider per platform:

- CrazyGames and Poki: wrap their SDK (check each portal's current docs and ad-frequency rules).
- iOS / Android: AdMob through a Capacitor plugin.

Interstitials appear on "Play again" / "Change city" only after `adBreakSeconds` of play and
`adBreakRounds` finished rounds (see `TUNING` in `config.ts`). Watching a rewarded ad resets the timer.

## Roadmap

1. Release on web portals (CrazyGames first, then Poki).
2. Wrap with Capacitor for iOS and Android (iOS builds need a Mac).
3. More cities, cosmetic costumes, unlockable cities.
