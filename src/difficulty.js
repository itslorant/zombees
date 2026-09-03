// ---------------------------------------------------------------------------
// The whole difficulty ramp, driven by a single intensity value.
//
//   intensity(n): ~0.20 at wave 1  ->  1.0 by wave 8  ->  keeps creeping after.
//
// The swarm is CONTINUOUS — there is no "wave cleared, take a breather". The
// wave number ticks up on a timer and simply cranks intensity:
//
//   Waves 1-3  — WARMUP. Thin trickle, slow, soft hits, spawns far away. You
//                can stand still and lose maybe a quarter of your health.
//   Waves 4-8  — RAMP. Spawn rate and toughness climb until the swarm is always
//                on you and positioning is the only thing keeping you alive.
//   Wave 9+    — OVERWHELM. It out-scales any weapon eventually. Score run.
//   Every 5th  — BOSS (Queen Zombee) drops in over the top of the trickle.
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const WAVE_SECONDS = 20;

export function intensity(n) {
  const base = clamp((n - 1) / 7, 0, 1); // 0 at wave 1, 1 at wave 8
  const overflow = Math.max(0, n - 8) * 0.06;
  return 0.14 + base * 0.86 + overflow;
}

// Rolling enemy stats for the given wave.
export function enemyStats(n) {
  const I = intensity(n);
  const tail = Math.max(0, n - 8);
  return {
    hp: Math.round(16 + I * 40 + tail * tail * 2.2),
    contactDmg: Math.round(lerp(3, 10, clamp(I, 0, 1))),
    speed: 2.6 + I * 1.9,
    // enemies per second poured onto the field.
    spawnRate: 0.5 + I * 2.3 + tail * 0.3,
    spawnZ: () => -(30 - clamp(I, 0, 1) * 13) - Math.random() * 5,
    rusherChance: clamp((I - 0.4) * 0.5, 0, 0.42),
    // how many spawn together when the budget ticks over
    clump: I < 0.45 ? 1 : I < 0.9 ? 2 : 3,
  };
}

export function bossStats(n) {
  return {
    hp: Math.round(280 + n * 55 + n * n * 7),
    speed: 2.4 + n * 0.05,
    contactDmg: 16,
    chargeDmg: 32,
    z: -18,
  };
}
