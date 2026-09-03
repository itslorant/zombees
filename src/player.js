import * as THREE from "three";
import { makePlayer, addBlobShadow } from "./assets.js";
import { clamp, lerp } from "./utils.js";

export const PLAYER_Z = 8;

export function createPlayer(scene) {
  const { group, hand } = makePlayer();
  group.position.set(0, 0, PLAYER_Z);
  addBlobShadow(group, 2.2);
  scene.add(group);

  const ud = group.userData;

  return {
    group,
    hand,
    radius: 1.1,
    maxHealth: 100,
    health: 100,
    speed: 13,
    invuln: 0,
    walkT: 0,
    _aimYaw: 0,

    reset() {
      this.health = this.maxHealth;
      this.invuln = 0;
      group.position.set(0, 0, PLAYER_Z);
      group.rotation.set(0, 0, 0);
    },

    hurt(dmg) {
      if (this.invuln > 0) return false;
      this.health = Math.max(0, this.health - dmg);
      this.invuln = 0.35;
      return true;
    },

    // aim the torso toward a world-space target
    aimAt(target) {
      if (!target) return;
      const dx = target.x - group.position.x;
      const dz = target.z - group.position.z;
      this._aimYaw = clamp(Math.atan2(dx, -dz), -0.7, 0.7);
    },

    update(dt, input) {
      let vx = 0;
      if (input.pointerDown && input.targetX != null) {
        const d = input.targetX - group.position.x;
        vx = clamp(d * 6, -this.speed, this.speed);
        if (Math.abs(d) < 0.04) vx = 0;
      } else {
        if (input.left) vx -= this.speed;
        if (input.right) vx += this.speed;
      }

      group.position.x = clamp(group.position.x + vx * dt, -input.laneHalf, input.laneHalf);

      // face roughly forward, leaning toward the aim target
      group.rotation.y = lerp(group.rotation.y, this._aimYaw * 0.5, 0.2);

      // leg / arm walk cycle
      const moving = Math.abs(vx) > 0.1;
      this.walkT += dt * (moving ? 12 : 6);
      const swing = Math.sin(this.walkT) * (moving ? 0.6 : 0.05);
      ud.lLeg.rotation.x = swing;
      ud.rLeg.rotation.x = -swing;
      ud.lArm.rotation.x = -swing * 0.6;
      ud.torso.position.y = 1.62 + Math.abs(Math.sin(this.walkT)) * (moving ? 0.04 : 0.01);

      if (this.invuln > 0) {
        this.invuln -= dt;
        group.visible = Math.floor(this.invuln * 30) % 2 === 0;
      } else {
        group.visible = true;
      }
    },
  };
}
