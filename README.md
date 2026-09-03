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
  by wave 4-5 the spawn rate outruns a single gun; every **5th wave** drops a
  **boss** — the Queen Zombee, who rears up and charges (health bar up top).
- **Weapon crates** drop from kills (and every boss) and home toward you. Grab
  them to climb the gun ladder — Pistol → SMG → Shotgun → Minigun → Plasma — or
  stack capped fire-rate / damage / pierce modifiers.
- Contact with a Zombee hurts. At 0 health you're stung to death — press `R` or
  the button to try again. It's a score run: you *will* be overrun eventually.

## Project layout

| File | Responsibility |
| --- | --- |
| `src/main.js` | Bootstraps renderer/scene/camera, wires systems, runs the loop |
| `src/assets.js` | All procedural meshes & textures (player, guns, Zombees, crates, props) |
| `src/player.js` | Player entity: movement, aim lean, walk cycle, health |
| `src/weapons.js` | Weapon tiers, auto-targeting, firing, upgrades/mods |
| `src/bullets.js` | Projectile pool, movement, enemy collision |
| `src/enemies.js` | Zombee AI, crescent swarm, hover/flap animation, boss charge state machine |
| `src/difficulty.js` | The single intensity curve — every enemy/spawn number derives from it |
| `src/waves.js` | Continuous swarm director; wave timer; boss cadence |
| `src/pickups.js` | Weapon-crate drops and collection |
| `src/effects.js` | Muzzle flashes, sparks, shockwave rings |
| `src/environment.js` | Scrolling road + recycled roadside props |
| `src/hud.js` | DOM HUD, start / game-over overlays |
| `src/audio.js` | Procedural WebAudio SFX (no audio files) |

All art is generated from primitives at runtime — there are no binary assets and
nothing is copied from any other game.
