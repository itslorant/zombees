# Zombees

A low-poly **Three.js wave shooter**. The hive turned zombie — hold the road and
gun down the swarm. Inspired by lane-survival shooters like Zombie Route.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

Build a static bundle with `npm run build` (output in `dist/`), preview it with
`npm run preview`.

## How to play

- **Move:** `A` / `D`, arrow keys, or click-drag left/right.
- Your soldier **auto-fires into a forward cone** at the nearest Zombee — so
  standing still gets you flanked. Positioning is the whole game: keep the swarm
  in front of you, peel away from the ones curling around your side.
- The swarm is **continuous and always ramps**. Waves 1-3 are a gentle warmup;
  from wave 4 the spawn rate outruns a single gun. New Zombee types fade in as
  it heats up: **rushers** (fast, fragile, orange), **spitters** (hang back and
  lob venom), **splitters** (pop into two on death), **tanks** (huge, armoured,
  slow). Every **5th wave** drops the **Queen Zombee** boss — she charges,
  summons broodlings, and enrages below 30% health (bar up top).
- **Weapon crates** drop from kills and every boss. Grab them to climb the gun
  ladder — Pistol → SMG → Shotgun → Minigun → Plasma — or stack capped
  fire-rate / damage / pierce modifiers.
- **Chain kills** for a score multiplier (up to 6×); taking a hit resets it.
- Contact with a Zombee hurts. At 0 health you're stung to death — press `R` or
  the button to try again. It's a score run: your best score and wave are saved.

## Project layout

| File | Responsibility |
| --- | --- |
| `src/main.js` | Bootstraps renderer/scene/camera, wires systems, runs the loop |
| `src/assets.js` | All procedural meshes & textures (player, guns, Zombees, crates, props) |
| `src/player.js` | Player entity: movement, aim lean, walk cycle, health |
| `src/weapons.js` | Weapon tiers, auto-targeting, firing, upgrades/mods |
| `src/bullets.js` | Projectile pool, movement, enemy collision |
| `src/enemies.js` | Zombee archetypes, crescent swarm, venom spit, boss state machine (charge / summon / enrage) |
| `src/difficulty.js` | The single intensity curve + per-archetype mods and the spawn-mix roll |
| `src/waves.js` | Continuous swarm director; wave timer; boss cadence |
| `src/pickups.js` | Weapon-crate drops and collection |
| `src/progress.js` | Best score / wave, persisted to localStorage |
| `src/effects.js` | Muzzle flashes, sparks, shockwave rings |
| `src/environment.js` | Scrolling road + recycled roadside props |
| `src/hud.js` | DOM HUD, start / game-over overlays |
| `src/audio.js` | Procedural WebAudio SFX (no audio files) |

All art is generated from primitives at runtime — there are no binary assets and
nothing is copied from any other game.
