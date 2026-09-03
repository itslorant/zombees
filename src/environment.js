import * as THREE from "three";
import { makeGroundTexture, makeProp, addBlobShadow } from "./assets.js";
import { rand, pick } from "./utils.js";

const LANE_HALF = 7;
const TRACK_LEN = 260;

export function createEnvironment(scene) {
  const tex = makeGroundTexture();
  tex.repeat.set(6, 26);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 320),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -120;
  scene.add(ground);

  // dark shoulders so the play lane reads clearly
  for (const dir of [-1, 1]) {
    const shoulder = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 320),
      new THREE.MeshStandardMaterial({ color: 0x161b15, roughness: 1 }),
    );
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(dir * 30, 0.01, -120);
    scene.add(shoulder);
  }

  const props = [];
  for (let i = 0; i < 18; i++) {
    const p = makeProp(pick([0, 1, 2]));
    p.position.set(
      (Math.random() < 0.5 ? -1 : 1) * rand(13, 27),
      0,
      -rand(0, TRACK_LEN),
    );
    p.rotation.y = rand(0, Math.PI * 2);
    const scl = rand(0.7, 1.4);
    p.scale.setScalar(scl);
    addBlobShadow(p, 2.4 * scl);
    scene.add(p);
    props.push(p);
  }

  return {
    laneHalf: LANE_HALF,
    update(dt, speed) {
      tex.offset.y -= speed * dt * 0.05;
      for (const p of props) {
        p.position.z += speed * dt;
        if (p.position.z > 26) {
          p.position.z -= TRACK_LEN + rand(0, 40);
          p.position.x = (Math.random() < 0.5 ? -1 : 1) * rand(13, 27);
        }
      }
    },
  };
}
