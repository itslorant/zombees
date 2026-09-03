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
    // how many spawn together when the budget ticks over
    clump: I < 0.45 ? 1 : I < 0.9 ? 2 : 3,
  };
}

// Per-archetype multipliers on the base grunt stats.
export const KIND_MODS = {
  grunt: { hp: 1, speed: 1, dmg: 1 },
  rusher: { hp: 0.5, speed: 1.9, dmg: 1 },
  spitter: { hp: 0.85, speed: 0.8, dmg: 0 },
  tank: { hp: 4.6, speed: 0.55, dmg: 2.3 },
  splitter: { hp: 1.35, speed: 0.9, dmg: 1.1 },
};

// Weighted archetype roll for the given wave. Warmup is pure grunt; specials
// fade in as intensity climbs.
export function rollKind(n) {
  const I = intensity(n);
  const bag = [["grunt", 10]];
  if (I > 0.3) bag.push(["rusher", (I - 0.3) * 14]);
  if (I > 0.5) bag.push(["splitter", (I - 0.5) * 8]);
  if (I > 0.55) bag.push(["spitter", (I - 0.55) * 7]);
  if (I > 0.7) bag.push(["tank", (I - 0.7) * 4]);

  let total = 0;
  for (const [, w] of bag) total += w;
  let r = Math.random() * total;
  for (const [k, w] of bag) {
    r -= w;
    if (r <= 0) return k;
  }
  return "grunt";
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
