import { makeCrate, makeWeaponDrop, addBlobShadow } from "./assets.js";
import { WEAPONS } from "./weapons.js";
import { intensity } from "./difficulty.js";
import { sfx } from "./audio.js";
import { pick, lerp, clamp } from "./utils.js";
import { PLAYER_Z } from "./player.js";

// Stat mods auto-grab (no interesting reason to skip "+damage"). Weapon drops
// are opt-in: labeled, they linger, you walk into them if you want them.
const MOD_TYPES = ["firerate", "damage", "pierce"];
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

// Highest weapon tier allowed to drop at this wave (so Plasma can't show up in
// the warmup). Climbs with intensity.
function maxTierFor(wave) {
  return clamp(Math.round(intensity(wave) * 4 + 0.4), 1, WEAPONS.length - 1);
}

// What weapon a non-boss drop offers. Usually a step up, sometimes a spare or a
// jump, occasionally a wildcard that can be *below* what you're holding.
function rollWeaponTier(current, wave) {
  const cap = maxTierFor(wave);
  const r = Math.random();
  let t;
  if (r < 0.5) t = current + 1;
  else if (r < 0.7) t = current + 2;
  else if (r < 0.85) t = current;
  else t = (Math.random() * WEAPONS.length) | 0;
  return clamp(t, 0, Math.max(current, cap));
}

export class Pickups {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.mods = [];
    this.weapons = [];
  }

  maybeDrop(pos, boss, wave, currentTier) {
    if (boss) {
      // boss reward always lands; trim clutter to make room
      while (this.weapons.length >= 3) this._despawnWeapon(0);
      this._spawnWeapon(pos, maxTierFor(wave), 12);
      return;
    }
    // never litter the field with more than a couple of guns at once
    if (this.weapons.length >= 2) return;
    const r = Math.random();
    if (r < 0.08) this._spawnWeapon(pos, rollWeaponTier(currentTier, wave), 6.5);
    else if (r < 0.19) this._spawnMod(pos);
  }

  _despawnWeapon(i) {
    this.scene.remove(this.weapons[i].mesh);
    this.weapons.splice(i, 1);
  }

  _spawnMod(pos) {
    const type = pick(MOD_TYPES);
    const mesh = makeCrate(type);
    mesh.position.set(pos.x, 0.7, pos.z);
    addBlobShadow(mesh, 1.3);
    this.scene.add(mesh);
    this.mods.push({ mesh, type, t: 0 });
  }

  _spawnWeapon(pos, tier, life) {
    const w = WEAPONS[tier];
    const mesh = makeWeaponDrop(w.name, w.color, tier);
    mesh.position.set(clamp(pos.x, -6, 6), 0, pos.z);
    addBlobShadow(mesh, 1.9);
    this.scene.add(mesh);
    this.weapons.push({ mesh, tier, name: w.name, color: w.color, t: 0, life });
  }

  update(dt, player, weapon, hud) {
    const p = player.group.position;

    // --- stat mods: gentle homing, auto-grab ---
    for (let i = this.mods.length - 1; i >= 0; i--) {
      const c = this.mods[i];
      c.t += dt;
      c.mesh.rotation.y += dt * 1.8;
      c.mesh.position.y = 0.7 + Math.sin(c.t * 3) * 0.12;
      c.mesh.position.z += 4.5 * dt;
      c.mesh.position.x = lerp(c.mesh.position.x, p.x, dt * 1.3);
      c.mesh.userData.halo.rotation.z += dt * 2;

      const dx = c.mesh.position.x - p.x;
      const dz = c.mesh.position.z - p.z;
      if (dx * dx + dz * dz < 4.2) {
        const msg = weapon.addMod(c.type);
        hud.announce(msg, "#ffd23f");
        this.effects.ring(c.mesh.position, 0xffd23f);
        sfx.pickup();
        this.scene.remove(c.mesh);
        this.mods.splice(i, 1);
        continue;
      }
      if (c.mesh.position.z > PLAYER_Z + 6) {
        this.scene.remove(c.mesh);
        this.mods.splice(i, 1);
      }
    }

    // --- weapon drops: opt-in, drift slowly, linger then fade ---
    for (let i = this.weapons.length - 1; i >= 0; i--) {
      const d = this.weapons[i];
      const g = d.mesh;
      d.t += dt;
      d.life -= dt;

      g.userData.gun.rotation.y += dt * 1.5;
      g.userData.gun.position.y = 1.5 + Math.sin(d.t * 2.6) * 0.16;
      g.userData.ring.rotation.z += dt * 1.6;
      g.userData.ring.scale.setScalar(1 + Math.sin(d.t * 4) * 0.07);

      // drifts toward you — slower than a stat crate, and you can still
      // sidestep one you don't want — but a gun you DO want comes to meet you
      g.position.x = lerp(g.position.x, clamp(p.x, -6, 6), dt * 0.9);
      g.position.z += 3 * dt;

      const fade = d.life < 2 ? clamp(d.life / 2, 0, 1) : 1;
      for (const f of g.userData.fadeMats) f.m.opacity = f.base * fade;
      if (d.life < 1) g.scale.setScalar(0.85 + 0.15 * fade);

      if (d.life <= 0 || g.position.z > PLAYER_Z + 8) {
        this.scene.remove(g);
        this.weapons.splice(i, 1);
        continue;
      }

      const dx = g.position.x - p.x;
      const dz = g.position.z - p.z;
      if (dx * dx + dz * dz < 3.0 * 3.0) {
        const got = weapon.switchTo(d.tier);
        hud.announce(got || d.name.toUpperCase() + " — SPARE", hex(d.color));
        this.effects.ring(g.position, d.color);
        sfx.pickup();
        this.scene.remove(g);
        this.weapons.splice(i, 1);
      }
    }
  }

  clear() {
    for (const c of this.mods) this.scene.remove(c.mesh);
    for (const d of this.weapons) this.scene.remove(d.mesh);
    this.mods.length = 0;
    this.weapons.length = 0;
  }
}
