import * as THREE from "three";
import { makeZombee, addBlobShadow } from "./assets.js";
import { clamp, lerp, rand } from "./utils.js";
import { PLAYER_Z } from "./player.js";

// Grunts close to just in front of the player. The boss holds much further
// back — she's huge, and her threat is the telegraphed charge, not standing on
// top of the player blocking the view.
const STOP_Z = PLAYER_Z - 1.3;
const BOSS_STOP_Z = PLAYER_Z - 8;

// Per-archetype constants (stats like hp/speed/dmg are handed in per wave).
const KINDS = {
  grunt: { radius: 1.15, blob: 1.6, knockback: 1.3 },
  rusher: { radius: 1.0, blob: 1.4, knockback: 0.7, alwaysLunge: true, trail: true },
  spitter: { radius: 1.15, blob: 1.7, knockback: 1.1, standoff: 15, spit: true },
  tank: { radius: 2.0, blob: 2.6, knockback: 0.2, heavy: true },
  splitter: { radius: 1.3, blob: 1.8, knockback: 1.1, splits: 2 },
  mini: { radius: 0.75, blob: 1.0, knockback: 1.6 },
};

const SPIT_GEO = new THREE.SphereGeometry(0.22, 8, 6);
const SPIT_MAT = new THREE.MeshBasicMaterial({ color: 0xcaff3a });

export class Enemies {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.list = [];
    this.spits = [];
  }

  get boss() {
    return this.list.find((e) => e.isBoss && !e.dead) || null;
  }

  spawn({ x, z, speed, hp, dmg = 10, chargeDmg = 30, kind = "grunt" }) {
    const boss = kind === "boss";
    const cfg = KINDS[kind] || KINDS.grunt;
    const group = makeZombee(kind);
    group.position.set(x, group.userData.hoverBase, z);
    addBlobShadow(group, boss ? 3.4 : cfg.blob);
    this.scene.add(group);

    const e = {
      group,
      kind,
      isBoss: boss,
      cfg,
      hp,
      maxHp: hp,
      speed,
      radius: boss ? 2.9 : cfg.radius,
      contactDmg: dmg,
      chargeDmg,
      stagger: 0,
      dead: false,
      flash: 0,
      t: Math.random() * 10,
      laneX: x,
      xOffset: boss ? 0 : rand(-2.4, 2.4),
      stopJitter: boss ? 0 : rand(0, 1.1),
      attackCd: 0,
      spitCd: rand(1.2, 2.6),
      hitPop: 0,
      phase: "walk",
      phaseT: boss ? 3.5 : 0,
      summonsLeft: boss ? 3 : 0,
      chargeDir: new THREE.Vector3(),
    };

    e.damage = (d) => {
      if (e.dead) return false;
      e.hp -= d;
      e.hitPop = 0.12;
      e.flash = 0.06;
      if (e.hp <= 0) {
        e.dead = true;
        return true;
      }
      return false;
    };

    this.list.push(e);
    return e;
  }

  _spawnSplit(e) {
    for (let i = 0; i < (e.cfg.splits || 0); i++) {
      const child = this.spawn({
        x: e.group.position.x + rand(-1, 1),
        z: e.group.position.z + rand(-0.5, 0.5),
        speed: e.speed * 1.25,
        hp: Math.round(e.maxHp * 0.28),
        dmg: Math.max(4, Math.round(e.contactDmg * 0.6)),
        kind: "mini",
      });
      child.phaseT = 0;
    }
  }

  _remove(i) {
    this.scene.remove(this.list[i].group);
    this.list.splice(i, 1);
  }

  _spit(e, px, pz) {
    const from = e.group.position;
    const mesh = new THREE.Mesh(SPIT_GEO, SPIT_MAT);
    mesh.position.set(from.x, from.y + 0.1, from.z);
    const dir = new THREE.Vector3(px - from.x, 0.2, pz - from.z).normalize();
    this.scene.add(mesh);
    this.spits.push({ mesh, vel: dir.multiplyScalar(26), life: 2.4, dmg: 9 });
    this.effects.muzzleFlash(mesh.position, 0xcaff3a);
  }

  update(dt, player, onPlayerHit) {
    const px = player.group.position.x;
    const pz = player.group.position.z;

    // spit projectiles
    for (let i = this.spits.length - 1; i >= 0; i--) {
      const s = this.spits[i];
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 9 * dt;
      s.life -= dt;
      const dx = s.mesh.position.x - px;
      const dz = s.mesh.position.z - pz;
      if (dx * dx + dz * dz < 1.8 && Math.abs(s.mesh.position.y - 1) < 1.6) {
        onPlayerHit(s.dmg);
        this.effects.burst(s.mesh.position, 0xcaff3a, 6, 6);
        s.life = 0;
      }
      if (s.life <= 0 || s.mesh.position.y < 0) {
        if (s.mesh.position.y < 0) this.effects.burst(s.mesh.position, 0x9fbf3a, 4, 3);
        this.scene.remove(s.mesh);
        this.spits.splice(i, 1);
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const tx = clamp(px + e.xOffset, -7, 7);
      if (e.dead) {
        const c = e.isBoss ? 0x8fdc4a : e.kind === "rusher" ? 0xff9a4a : 0x8fdc4a;
        this.effects.burst(e.group.position, c, e.isBoss ? 26 : 10, e.isBoss ? 11 : 7);
        if (e.cfg.splits) this._spawnSplit(e);
        this._remove(i);
        continue;
      }

      e.t += dt;
      const g = e.group;

      // wing flap + hover bob + lurch
      const flapRate = e.kind === "rusher" ? 40 : e.kind === "tank" ? 14 : 26;
      const flap = Math.sin(e.t * flapRate) * 0.7;
      for (const w of g.userData.wings) w.rotation.z = w.userData.dir * (0.5 + flap);
      g.position.y = g.userData.hoverBase + Math.abs(Math.sin(e.t * 8)) * (e.cfg.heavy ? 0.05 : 0.14);
      g.rotation.z = Math.sin(e.t * 5) * 0.09;

      // hit flash
      if (e.flash > 0) e.flash -= dt;
      g.userData.flashShell.visible = e.flash > 0;

      // face the player
      const wantYaw = Math.atan2(px - g.position.x, pz - g.position.z + 0.001);
      g.rotation.y = lerp(g.rotation.y, wantYaw, 0.15);

      // --- movement ---
      if (e.isBoss) {
        this._boss(e, dt, px, pz, tx);
      } else if (e.stagger > 0) {
        e.stagger -= dt;
      } else if (e.cfg.spit) {
        // hold at range, lob venom
        const target = pz - e.cfg.standoff;
        g.position.z += clamp(target - g.position.z, -1, 1) * e.speed * dt;
        g.position.x += clamp(tx - g.position.x, -1, 1) * e.speed * 0.4 * dt;
        e.spitCd -= dt;
        if (e.spitCd <= 0 && g.position.z > pz - 40) {
          e.spitCd = rand(1.9, 3.2);
          this._spit(e, px, pz);
        }
      } else {
        const close = g.position.z > pz - 11 || e.cfg.alwaysLunge;
        const targetX = close ? tx : e.laneX;
        const lunge = close ? (e.cfg.alwaysLunge ? 1.35 : 1.8) : 1;
        this._advance(e, targetX, dt, e.speed * lunge);
        if (e.cfg.trail && e.t % 0.06 < dt) {
          this.effects.burst(g.position, 0xff7a3a, 1, 1.5);
        }
      }

      if (!e.cfg.spit || e.isBoss) {
        const myStop = e.isBoss
          ? PLAYER_Z + 1
          : STOP_Z - Math.abs(e.xOffset) * 0.22 - e.stopJitter;
        g.position.z = Math.min(g.position.z, myStop);
      }

      // hit pop
      const pop = e.hitPop > 0 ? 1 + (e.hitPop -= dt) * 1.4 : 1;
      g.scale.setScalar(Math.max(0.3, pop));

      // --- contact damage ---
      e.attackCd -= dt;
      const dx = g.position.x - px;
      const dz = g.position.z - pz;
      const reach = e.radius + player.radius;
      if (dx * dx + dz * dz <= reach * reach && e.attackCd <= 0) {
        const dmg = e.isBoss
          ? e.phase === "charge"
            ? e.chargeDmg
            : e.contactDmg
          : e.contactDmg;
        if (onPlayerHit(dmg)) {
          e.attackCd = e.isBoss ? 1.0 : e.cfg.heavy ? 1.3 : 0.85;
          if (!e.isBoss) {
            g.position.z = Math.max(g.position.z - e.cfg.knockback, -60);
            e.stagger = e.cfg.heavy ? 0.12 : 0.25;
          } else {
            g.position.z -= 1.2;
          }
        }
      }
    }
  }

  _boss(e, dt, px, pz, tx) {
    const g = e.group;
    e.phaseT -= dt;
    const atStandoff = g.position.z >= BOSS_STOP_Z - 0.3;
    const enraged = e.hp < e.maxHp * 0.3;
    const speedUp = enraged ? 1.4 : 1;

    if (e.phase === "walk") {
      g.position.z += clamp(BOSS_STOP_Z - g.position.z, -1, 1) * e.speed * dt;
      g.position.x += clamp(tx - g.position.x, -1, 1) * e.speed * 0.35 * dt;
      g.position.y = lerp(g.position.y, g.userData.hoverBase, 0.1);
      if (e.phaseT <= 0 && atStandoff) {
        // alternate: charge, then summon
        if (e.summonsLeft > 0 && Math.random() < 0.5) {
          e.phase = "summon";
          e.phaseT = 0.9;
        } else {
          e.phase = "telegraph";
          e.phaseT = enraged ? 0.45 : 0.7;
        }
      }
    } else if (e.phase === "telegraph") {
      g.position.y += dt * 2.4;
      g.rotation.z = Math.sin(e.t * 40) * 0.12; // shudder
      if (e.phaseT <= 0) {
        e.phase = "charge";
        e.phaseT = 0.5;
        e.chargeDir.set(px - g.position.x, 0, pz - g.position.z).normalize();
      }
    } else if (e.phase === "charge") {
      g.position.addScaledVector(e.chargeDir, e.speed * 7 * speedUp * dt);
      g.position.z = Math.min(g.position.z, pz + 2);
      if (e.phaseT <= 0) {
        e.phase = "recover";
        e.phaseT = enraged ? 0.8 : 1.4;
      }
    } else if (e.phase === "summon") {
      g.position.y = g.userData.hoverBase + Math.sin(e.t * 18) * 0.3;
      if (e.phaseT <= 0) {
        e.summonsLeft -= 1;
        const n = 3;
        for (let k = 0; k < n; k++) {
          const child = this.spawn({
            x: g.position.x + rand(-2, 2),
            z: g.position.z + 1,
            speed: e.speed * 2.6,
            hp: Math.round(e.maxHp * 0.05),
            dmg: 7,
            kind: "mini",
          });
          child.phaseT = 0;
        }
        this.effects.ring(g.position, 0x8fe36b);
        e.phase = "walk";
        e.phaseT = 2.2;
      }
    } else if (e.phase === "recover") {
      g.position.z += (BOSS_STOP_Z - g.position.z) * Math.min(1, 2 * dt);
      g.position.y = lerp(g.position.y, g.userData.hoverBase, 0.15);
      if (e.phaseT <= 0) {
        e.phase = "walk";
        e.phaseT = enraged ? 1.6 : 2.6;
      }
    }
  }

  _advance(e, targetX, dt, speed) {
    const g = e.group;
    g.position.z += speed * dt;
    g.position.x += clamp(targetX - g.position.x, -1, 1) * speed * 0.5 * dt;
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.group);
    for (const s of this.spits) this.scene.remove(s.mesh);
    this.list.length = 0;
    this.spits.length = 0;
  }
}
