import * as THREE from "three";
import { GUN_BUILDERS } from "./assets.js";
import { sfx } from "./audio.js";
import { clamp } from "./utils.js";

// Tier list — walking over a crate bumps you up the ladder.
export const WEAPONS = [
  { name: "Pistol", fireInterval: 0.42, damage: 10, pellets: 1, spread: 0.02, speed: 62, pierce: 0, color: 0xffe066 },
  { name: "SMG", fireInterval: 0.11, damage: 6, pellets: 1, spread: 0.06, speed: 70, pierce: 0, color: 0xffd166 },
  { name: "Shotgun", fireInterval: 0.75, damage: 6, pellets: 7, spread: 0.36, speed: 58, pierce: 0, color: 0xffb84d },
  { name: "Minigun", fireInterval: 0.06, damage: 4, pellets: 1, spread: 0.12, speed: 78, pierce: 0, color: 0xfff0a0 },
  { name: "Plasma", fireInterval: 0.24, damage: 15, pellets: 1, spread: 0.035, speed: 92, pierce: 1, color: 0x5ef0ff },
];

const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export function createWeapon(player, bullets, effects, onShoot = () => {}) {
  let tier = 0;
  let mesh = null;
  const mods = { fireRate: 1, damage: 1, pierce: 0 };
  let cooldown = 0;
  let lastTarget = null;

  function equip(t) {
    tier = clamp(t, 0, WEAPONS.length - 1);
    if (mesh) player.hand.remove(mesh);
    mesh = GUN_BUILDERS[WEAPONS[tier].name]();
    mesh.scale.setScalar(1.35);
    player.hand.add(mesh);
  }

  equip(0);

  // The soldier fires into a wide cone centred on where he's facing (which
  // swings with your strafe — movement is aiming). Two extra rules keep it fair:
  //  - anything inside CLOSE_R is always a valid target, cone or not, so a bee
  //    right on top of you always gets shot;
  //  - far enemies outside the cone stay unengaged, so splitting the swarm
  //    across both flanks still overwhelms a single gun.
  const CONE_HALF = 1.15; // ~66 degrees each side of facing
  const CLOSE_SQ = 5.5 * 5.5;

  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function nearestTarget(from, enemies) {
    let best = null;
    let bestD = Infinity;
    let boss = null;
    let closestGrunt = Infinity;
    const pz = player.group.position.z;
    const px = player.group.position.x;
    const facing = player.facing || 0;
    for (const e of enemies) {
      const ep = e.group.position;
      if (e.dead || ep.z > pz + 6) continue;
      const vx = ep.x - px;
      const vz = ep.z - pz;
      const dsq = vx * vx + vz * vz;
      if (!e.isBoss && dsq > CLOSE_SQ) {
        const ang = Math.atan2(vx, -vz); // 0 = straight ahead, + = toward +x
        if (Math.abs(wrap(ang - facing)) > CONE_HALF) continue;
      }
      const d = _tmp.copy(ep).sub(from).lengthSq();
      if (e.isBoss) {
        boss = e;
        continue;
      }
      if (d < closestGrunt) closestGrunt = d;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    // shoot the boss only when no grunt is breathing down your neck
    if (boss && closestGrunt > 7 * 7) return boss;
    return best || boss;
  }

  return {
    get def() {
      return WEAPONS[tier];
    },
    get target() {
      return lastTarget;
    },
    get tier() {
      return tier;
    },
    get mods() {
      return mods;
    },
    get isMax() {
      return tier === WEAPONS.length - 1;
    },

    reset() {
      mods.fireRate = 1;
      mods.damage = 1;
      mods.pierce = 0;
      cooldown = 0;
      equip(0);
    },

    upgradeTier() {
      if (tier < WEAPONS.length - 1) {
        equip(tier + 1);
        return WEAPONS[tier].name + "!";
      }
      mods.damage = Math.min(2.6, mods.damage + 0.2);
      return "Overcharge DMG";
    },

    addMod(type) {
      // capped so a long run doesn't turn the gun into a god-cannon
      if (type === "firerate") {
        mods.fireRate = Math.min(1.9, mods.fireRate + 0.12);
        return mods.fireRate >= 1.9 ? "Fire rate MAX" : "Fire rate +";
      }
      if (type === "damage") {
        mods.damage = Math.min(2.2, mods.damage + 0.15);
        return mods.damage >= 2.2 ? "Damage MAX" : "Damage +";
      }
      if (type === "pierce") {
        mods.pierce = Math.min(3, mods.pierce + 1);
        return mods.pierce >= 3 ? "Pierce MAX" : "Pierce +";
      }
      return "";
    },

    update(dt, enemies) {
      cooldown -= dt;
      player.group.updateWorldMatrix(true, false);
      player.hand.getWorldPosition(_muzzle);

      const target = nearestTarget(_muzzle, enemies);
      lastTarget = target;
      player.aimAt(target ? target.group.position : null);

      if (mesh.userData.spin) mesh.userData.spin.rotation.z += dt * (cooldown < 0 ? 40 : 6);
      if (!target || cooldown > 0) return;

      const def = WEAPONS[tier];
      cooldown = def.fireInterval / mods.fireRate;

      _aim.copy(target.group.position).setY(target.group.position.y + 0.2).sub(_muzzle).normalize();
      const dmg = def.damage * mods.damage;
      const pierce = def.pierce + mods.pierce;

      for (let p = 0; p < def.pellets; p++) {
        const dir = _aim.clone();
        const spread = def.spread;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread * 0.5;
        dir.z += (Math.random() - 0.5) * spread * 0.3;
        dir.normalize();
        bullets.spawn(_muzzle, dir.multiplyScalar(def.speed), dmg, pierce, def.color);
      }

      effects.muzzleFlash(_muzzle, def.color);
      sfx.shoot();
      onShoot(_muzzle, def.color);
    },
  };
}
