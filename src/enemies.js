import * as THREE from "three";
import { makeZombee, addBlobShadow } from "./assets.js";
import { clamp, lerp, rand } from "./utils.js";
import { PLAYER_Z } from "./player.js";

// Grunts close to just in front of the player. The boss holds much further
// back — she's huge, and her threat is the telegraphed charge, not standing on
// top of the player blocking the view.
const STOP_Z = PLAYER_Z - 1.3;
const BOSS_STOP_Z = PLAYER_Z - 8;

export class Enemies {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.list = [];
  }

  get boss() {
    return this.list.find((e) => e.isBoss && !e.dead) || null;
  }

  spawn({ x, z, speed, hp, dmg = 10, chargeDmg = 30, boss = false }) {
    const laneX = x;
    const group = makeZombee(boss);
    group.position.set(x, group.userData.hoverBase, z);
    addBlobShadow(group, (boss ? 3.4 : 1.6));
    this.scene.add(group);

    const e = {
      group,
      isBoss: boss,
      hp,
      maxHp: hp,
      speed,
      radius: boss ? 2.9 : 1.15,
      contactDmg: dmg,
      chargeDmg,
      stagger: 0,
      dead: false,
      t: Math.random() * 10,
      laneX, // holds its spawn lane while far, only homes in when close
      // where this one sits in the crescent around the player, so the swarm
      // fans out in front instead of stacking into one lump
      xOffset: boss ? 0 : rand(-2.4, 2.4),
      stopJitter: boss ? 0 : rand(0, 1.1),
      attackCd: 0,
      hitPop: 0,
      // boss charge state machine
      phase: "walk",
      phaseT: boss ? 3.5 : 0,
      chargeDir: new THREE.Vector3(),
    };

    e.damage = (d) => {
      if (e.dead) return false;
      e.hp -= d;
      e.hitPop = 0.12;
      if (e.hp <= 0) {
        e.dead = true;
        return true;
      }
      return false;
    };

    this.list.push(e);
    return e;
  }

  _remove(i) {
    this.scene.remove(this.list[i].group);
    this.list.splice(i, 1);
  }

  update(dt, player, onPlayerHit) {
    const px = player.group.position.x;
    const pz = player.group.position.z;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const tx = clamp(px + e.xOffset, -7, 7); // this enemy's lane in the swarm
      if (e.dead) {
        this.effects.burst(e.group.position, 0x8fdc4a, e.isBoss ? 26 : 10, e.isBoss ? 11 : 7);
        this._remove(i);
        continue;
      }

      e.t += dt;
      const g = e.group;

      // wing flap + hover bob + zombie lurch
      const flap = Math.sin(e.t * 26) * 0.7;
      for (const w of g.userData.wings) w.rotation.z = w.userData.dir * (0.5 + flap);
      g.position.y = g.userData.hoverBase + Math.abs(Math.sin(e.t * 8)) * 0.14;
      g.rotation.z = Math.sin(e.t * 5) * 0.09;

      // face the player
      const wantYaw = Math.atan2(px - g.position.x, pz - g.position.z + 0.001);
      g.rotation.y = lerp(g.rotation.y, wantYaw, 0.15);

      // --- movement ---
      if (e.isBoss) {
        e.phaseT -= dt;
        const atStandoff = g.position.z >= BOSS_STOP_Z - 0.3;
        if (e.phase === "walk") {
          // ease toward the standoff line and hold
          g.position.z += clamp(BOSS_STOP_Z - g.position.z, -1, 1) * e.speed * dt;
          g.position.x += clamp(tx - g.position.x, -1, 1) * e.speed * 0.35 * dt;
          g.position.y = lerp(g.position.y, g.userData.hoverBase, 0.1);
          if (e.phaseT <= 0 && atStandoff) {
            e.phase = "telegraph";
            e.phaseT = 0.7;
          }
        } else if (e.phase === "telegraph") {
          g.position.y += dt * 2.4; // rear up
          if (e.phaseT <= 0) {
            e.phase = "charge";
            e.phaseT = 0.5;
            e.chargeDir.set(px - g.position.x, 0, pz - g.position.z).normalize();
          }
        } else if (e.phase === "charge") {
          g.position.addScaledVector(e.chargeDir, e.speed * 7 * dt);
          g.position.z = Math.min(g.position.z, pz + 2);
          if (e.phaseT <= 0) {
            e.phase = "recover";
            e.phaseT = 1.4;
          }
        } else if (e.phase === "recover") {
          // fall back to the standoff line
          g.position.z += (BOSS_STOP_Z - g.position.z) * Math.min(1, 2 * dt);
          g.position.y = lerp(g.position.y, g.userData.hoverBase, 0.15);
          if (e.phaseT <= 0) {
            e.phase = "walk";
            e.phaseT = 2.6;
          }
        }
      } else if (e.stagger > 0) {
        e.stagger -= dt; // recoiling from a bite — hold position briefly
      } else {
        // hold the spawn lane while far (staying wide, outside the firing
        // cone so a stationary player gets flanked), then curve in and lunge
        const close = g.position.z > pz - 11;
        const targetX = close ? tx : e.laneX;
        this._advance(e, targetX, dt, e.speed * (close ? 1.8 : 1));
      }

      const myStop = e.isBoss
        ? PLAYER_Z + 1
        : STOP_Z - Math.abs(e.xOffset) * 0.22 - e.stopJitter;
      g.position.z = Math.min(g.position.z, myStop);

      // hit pop feedback
      if (e.hitPop > 0) {
        e.hitPop -= dt;
        g.scale.setScalar(1 + e.hitPop * 1.6);
      } else {
        g.scale.setScalar(1);
      }

      // --- contact damage ---
      e.attackCd -= dt;
      const dx = g.position.x - px;
      const dz = g.position.z - pz;
      const reach = e.radius + player.radius;
      if (dx * dx + dz * dz <= reach * reach && e.attackCd <= 0) {
        const dmg = e.isBoss ? (e.phase === "charge" ? e.chargeDmg : e.contactDmg) : e.contactDmg;
        if (onPlayerHit(dmg)) {
          e.attackCd = e.isBoss ? 1.0 : 0.85;
          // real knockback: the biter recoils and has to close again, which
          // buys the player time to kill it instead of being chewed in place
          if (!e.isBoss) {
            g.position.z = Math.max(g.position.z - 1.3, -60);
            e.stagger = 0.25;
          } else {
            g.position.z -= 1.2;
          }
        }
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
    this.list.length = 0;
  }
}
