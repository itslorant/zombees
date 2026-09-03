import { sfx } from "./audio.js";
import { rand } from "./utils.js";
import { WAVE_SECONDS, enemyStats, bossStats, rollKind, KIND_MODS } from "./difficulty.js";

// Continuous swarm director. The wave number ticks up on a timer and cranks
// the difficulty; enemies pour in the whole time. Bosses drop in on wave 5,
// 10, 15, ... over the top of the trickle.
export function createWaves(enemies, hud) {
  let wave = 0;
  let waveClock = 0;
  let running = false;
  let spawnBudget = 0;
  let stats = null;
  let pendingBoss = false;

  function enterWave(n) {
    wave = n;
    stats = enemyStats(n);
    if (n % 5 === 0) {
      pendingBoss = true;
      sfx.boss();
      hud.announce(`WAVE ${n} — BOSS`, "#ff5252");
    } else {
      sfx.wave();
      hud.announce(`WAVE ${n}`, n <= 3 ? "#8fe36b" : "#ffd23f");
    }
  }

  function spawnGrunt() {
    const kind = rollKind(wave);
    const m = KIND_MODS[kind];
    enemies.spawn({
      x: rand(-9, 9),
      z: stats.spawnZ(),
      speed: stats.speed * m.speed + rand(0, 1.2),
      hp: Math.max(6, Math.round(stats.hp * m.hp)),
      dmg: Math.round(stats.contactDmg * m.dmg),
      kind,
    });
  }

  return {
    get wave() {
      return wave;
    },

    reset() {
      wave = 0;
      waveClock = 0;
      running = false;
      spawnBudget = 0;
      stats = null;
      pendingBoss = false;
    },

    start() {
      running = true;
      waveClock = 0;
      enterWave(1);
    },

    update(dt) {
      if (!running) return;

      waveClock += dt;
      if (waveClock >= WAVE_SECONDS) {
        waveClock -= WAVE_SECONDS;
        enterWave(wave + 1);
      }

      if (pendingBoss) {
        pendingBoss = false;
        const b = bossStats(wave);
        enemies.spawn({
          x: rand(-3, 3),
          z: b.z,
          speed: b.speed,
          hp: b.hp,
          dmg: b.contactDmg,
          chargeDmg: b.chargeDmg,
          kind: "boss",
        });
      }

      // pour grunts onto the field at the current rate (with a hard cap so a
      // struggling player's screen — and the frame rate — doesn't melt).
      // Ease off while a boss is alive so the fight is about the boss.
      const rate = stats.spawnRate * (enemies.boss ? 0.45 : 1);
      spawnBudget += rate * dt;
      while (spawnBudget >= 1) {
        spawnBudget -= 1;
        if (enemies.list.length >= 52) break;
        for (let i = 0; i < stats.clump; i++) spawnGrunt();
      }
    },
  };
}
