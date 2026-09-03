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
  if (r < 0.52) t = current + 1;
  else if (r < 0.74) t = current + 2;
  else if (r < 0.9) t = current;
  else t = (Math.random() * WEAPONS.length) | 0; // wildcard — can be below you
  return clamp(t, 0, Math.max(current, cap));
}

export class Pickups {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.mods = [];
    this.weapons = [];
    this._lastWeaponTier = -1;
  }

  // roll a weapon tier, rerolling a couple of times to avoid offering the same
  // gun over and over
  _pickTier(currentTier, wave) {
    let t = rollWeaponTier(currentTier, wave);
    for (let i = 0; i < 2 && t === this._lastWeaponTier; i++) {
      t = rollWeaponTier(currentTier, wave);
    }
    this._lastWeaponTier = t;
    return t;
  }

  maybeDrop(pos, boss, wave, currentTier, target) {
    if (boss) {
      // boss reward always lands; trim clutter to make room
      while (this.weapons.length >= 3) this._despawnWeapon(0);
      const t = maxTierFor(wave);
      if (t === currentTier) {
        // already holding the best gun for this wave — hand over two mods
        this._spawnMod(pos);
        this._spawnMod({ x: pos.x + 1.5, z: pos.z });
      } else {
        this._lastWeaponTier = t;
        this._spawnWeapon(pos, t, 8, target);
      }
      return;
    }
    const r = Math.random();
    if (r < 0.08) {
      // never litter the field with more than a couple of guns at once
      if (this.weapons.length >= 2) return;
      const t = this._pickTier(currentTier, wave);
      // a "spare" of the gun you're already holding does nothing — hand over a
      // stat crate instead. Weapon drops always mean a real gun change.
      if (t === currentTier) this._spawnMod(pos);
      else this._spawnWeapon(pos, t, 6, target);
    } else if (r < 0.19) {
      this._spawnMod(pos);
    }
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

  _spawnWeapon(pos, tier, life, target) {
    const w = WEAPONS[tier];
    const mesh = makeWeaponDrop(w.name, w.color, tier);
    const sx = clamp(pos.x, -8, 8);
    mesh.position.set(sx, 0, pos.z);
    addBlobShadow(mesh, 1.9);
    this.scene.add(mesh);
    // locked straight-line heading toward where the player was — fast enough to
    // reach you, but it won't track, so you can sidestep one you don't want
    let dx = (target ? target.x : 0) - sx;
    let dz = (target ? target.z : PLAYER_Z) - pos.z;
    const len = Math.hypot(dx, dz) || 1;
    this.weapons.push({
      mesh,
      tier,
      name: w.name,
      color: w.color,
      t: 0,
      life,
      dir: { x: dx / len, z: dz / len },
    });
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

      // straight line, rusher-ish speed. It won't turn to follow you — step
      // into its path to take it, step out of it to keep what you've got.
      const SPEED = 8.5;
      g.position.x += d.dir.x * SPEED * dt;
      g.position.z += d.dir.z * SPEED * dt;

      const fade = d.life < 2 ? clamp(d.life / 2, 0, 1) : 1;
      for (const f of g.userData.fadeMats) f.m.opacity = f.base * fade;
      if (d.life < 1) g.scale.setScalar(0.85 + 0.15 * fade);

      if (
        d.life <= 0 ||
        g.position.z > PLAYER_Z + 6 ||
        Math.abs(g.position.x) > 13
      ) {
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
    this._lastWeaponTier = -1;
  }
}
