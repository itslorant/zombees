import { makeCrate, addBlobShadow } from "./assets.js";
import { sfx } from "./audio.js";
import { rand, pick, lerp } from "./utils.js";
import { PLAYER_Z } from "./player.js";

// Normal kills only drop stat mods. Weapon TIER upgrades come from bosses
// (guaranteed) or a rare lucky drop — see maybeDrop.
const MOD_TYPES = ["firerate", "damage", "pierce"];

export class Pickups {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.list = [];
  }

  maybeDrop(pos, boss) {
    const chance = boss ? 1 : 0.12;
    if (Math.random() > chance) return;
    const type = boss ? "upgrade" : Math.random() < 0.03 ? "upgrade" : pick(MOD_TYPES);
    const mesh = makeCrate(type);
    mesh.position.set(pos.x, 0.7, pos.z);
    addBlobShadow(mesh, 1.4);
    this.scene.add(mesh);
    this.list.push({ mesh, type, t: 0 });
  }

  update(dt, player, weapon, hud) {
    const p = player.group.position;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.t += dt;
      c.mesh.rotation.y += dt * 1.8;
      c.mesh.position.y = 0.7 + Math.sin(c.t * 3) * 0.12;
      c.mesh.position.z += 4.5 * dt; // drift toward the player so near-misses still count
      c.mesh.position.x = lerp(c.mesh.position.x, p.x, dt * 1.3); // gentle homing
      c.mesh.userData.halo.rotation.z += dt * 2;

      const dx = c.mesh.position.x - p.x;
      const dz = c.mesh.position.z - p.z;
      if (dx * dx + dz * dz < 4.2) {
        const msg =
          c.type === "upgrade" ? weapon.upgradeTier() : weapon.addMod(c.type);
        hud.announce(msg, "#ffd23f");
        this.effects.ring(c.mesh.position, 0xffd23f);
        sfx.pickup();
        this.scene.remove(c.mesh);
        this.list.splice(i, 1);
        continue;
      }

      if (c.mesh.position.z > PLAYER_Z + 6) {
        this.scene.remove(c.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const c of this.list) this.scene.remove(c.mesh);
    this.list.length = 0;
  }
}
