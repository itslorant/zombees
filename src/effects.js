import * as THREE from "three";
import { rand } from "./utils.js";

const SPARK = new THREE.SphereGeometry(0.09, 6, 5);
const FLASH = new THREE.SphereGeometry(0.13, 7, 5);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  _add(obj) {
    this.scene.add(obj.mesh);
    this.items.push(obj);
  }

  muzzleFlash(pos, color = 0xffe08a) {
    const m = new THREE.Mesh(FLASH, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    this._add({ mesh: m, life: 0.05, max: 0.05, grow: 1.6, fade: true });
  }

  burst(pos, color = 0x9fe66a, count = 8, speed = 7) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(SPARK, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos);
      this._add({
        mesh: m,
        life: 0.4,
        max: 0.4,
        fade: true,
        vel: new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(speed),
        gravity: true,
      });
    }
  }

  ring(pos, color = 0xff5a3c) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.06, 6, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    m.position.copy(pos);
    m.rotation.x = -Math.PI / 2;
    this._add({ mesh: m, life: 0.35, max: 0.35, grow: 10, fade: true, dispose: true });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const k = Math.max(0, it.life / it.max);
      if (it.vel) {
        it.mesh.position.addScaledVector(it.vel, dt);
        if (it.gravity) it.vel.y -= 22 * dt;
      }
      if (it.grow) it.mesh.scale.setScalar(1 + (1 - k) * it.grow);
      if (it.fade) it.mesh.material.opacity = k;
      if (it.life <= 0) {
        this.scene.remove(it.mesh);
        it.mesh.material.dispose();
        if (it.dispose) it.mesh.geometry.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      it.mesh.material.dispose();
    }
    this.items.length = 0;
  }
}
