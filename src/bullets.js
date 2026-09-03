import * as THREE from "three";

const GEO = new THREE.CapsuleGeometry(0.09, 0.55, 3, 6);
GEO.rotateX(Math.PI / 2); // length along +Z

const FWD = new THREE.Vector3(0, 0, 1);
const matCache = new Map();
function bulletMat(color) {
  if (!matCache.has(color)) {
    matCache.set(color, new THREE.MeshBasicMaterial({ color }));
  }
  return matCache.get(color);
}

export class Bullets {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.list = [];
  }

  spawn(pos, vel, damage, pierce, color) {
    const mesh = new THREE.Mesh(GEO, bulletMat(color));
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(FWD, vel.clone().normalize());
    const glow = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28 }));
    glow.scale.set(2.4, 2.4, 1.3);
    mesh.add(glow);
    this.scene.add(mesh);
    this.list.push({ mesh, vel, damage, pierce, life: 1.6, hit: new Set(), color });
  }

  update(dt, enemies, onKill) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;

      let dead = b.life <= 0 || b.mesh.position.z > 14 || Math.abs(b.mesh.position.x) > 40;

      if (!dead) {
        for (const e of enemies) {
          if (e.dead || b.hit.has(e)) continue;
          const c = e.group.position;
          const dx = b.mesh.position.x - c.x;
          const dz = b.mesh.position.z - c.z;
          const dy = b.mesh.position.y - (c.y + 0.2);
          if (dx * dx + dz * dz + dy * dy * 0.4 <= e.radius * e.radius) {
            b.hit.add(e);
            const killed = e.damage(b.damage);
            this.effects.burst(b.mesh.position, 0xcaff8f, 4, 5);
            if (killed) onKill(e);
            if (b.pierce <= 0) {
              dead = true;
              break;
            }
            b.pierce -= 1;
          }
        }
      }

      if (dead) {
        b.mesh.geometry = GEO;
        this.scene.remove(b.mesh);
        b.mesh.children[0].material.dispose();
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const b of this.list) {
      this.scene.remove(b.mesh);
      b.mesh.children[0].material.dispose();
    }
    this.list.length = 0;
  }
}
