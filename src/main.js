import * as THREE from "three";
import "./style.css";

import { resumeAudio, sfx } from "./audio.js";
import { createEnvironment } from "./environment.js";
import { createPlayer, PLAYER_Z } from "./player.js";
import { Bullets } from "./bullets.js";
import { createWeapon } from "./weapons.js";
import { Enemies } from "./enemies.js";
import { createWaves } from "./waves.js";
import { Pickups } from "./pickups.js";
import { Effects } from "./effects.js";
import { createHUD } from "./hud.js";
import { lerp } from "./utils.js";

const root = document.getElementById("game");

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1b271b);
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1b271b, 42, 175);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 8.6, PLAYER_Z + 11);
camera.lookAt(0, 1.2, PLAYER_Z - 12);

scene.add(new THREE.AmbientLight(0x5c6f52, 0.6));
scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x2a3a1e, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
sun.position.set(-8, 18, 6);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x77ffaa, 0.5);
rim.position.set(6, 6, -20);
scene.add(rim);

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------
const environment = createEnvironment(scene);
const effects = new Effects(scene);
const player = createPlayer(scene);
const bullets = new Bullets(scene, effects);
const weapon = createWeapon(player, bullets, effects);
const enemies = new Enemies(scene, effects);
const pickups = new Pickups(scene, effects);

let score = 0;
let state = "start"; // start | playing | over

const hud = createHUD(root, {
  onStart: () => startGame(),
  onRestart: () => startGame(),
});

function startGame() {
  resumeAudio();
  bullets.clear();
  enemies.clear();
  pickups.clear();
  effects.clear();
  player.reset();
  weapon.reset();
  waves.reset();
  waves.start();
  score = 0;
  hud.hideStart();
  hud.hideGameOver();
  state = "playing";
}

const waves = createWaves(enemies, hud);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const input = {
  left: false,
  right: false,
  pointerDown: false,
  targetX: null,
  laneHalf: environment.laneHalf,
};

addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
  if (e.code === "KeyR" && state === "over") startGame();
});
addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
});

function pointerX(clientX) {
  const nx = (clientX / window.innerWidth) * 2 - 1;
  input.targetX = nx * (input.laneHalf + 1);
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  input.pointerDown = true;
  pointerX(e.clientX);
});
addEventListener("pointerup", () => {
  input.pointerDown = false;
});
addEventListener("pointermove", (e) => {
  if (input.pointerDown) pointerX(e.clientX);
});

addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
function onPlayerHit(dmg) {
  const applied = player.hurt(dmg);
  if (applied) {
    sfx.hurt();
    hud.flashHurt();
  }
  return applied;
}

function onKill(e) {
  score += e.isBoss ? 500 : 12;
  if (e.isBoss) {
    hud.announce("BOSS DOWN", "#8fe36b");
    effects.ring(e.group.position, 0x8fe36b);
  }
  pickups.maybeDrop(e.group.position, e.isBoss);
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());

  if (state === "playing") {
    player.update(dt, input);
    weapon.update(dt, enemies.list);
    bullets.update(dt, enemies.list, onKill);
    enemies.update(dt, player, onPlayerHit);
    pickups.update(dt, player, weapon, hud);
    waves.update(dt);
    environment.update(dt, 9);

    if (player.health <= 0) {
      state = "over";
      sfx.boss();
      hud.showGameOver(score, waves.wave);
    }
  } else {
    environment.update(dt, state === "start" ? 5 : 1.5);
  }

  effects.update(dt);

  // camera eases with the player
  const tx = player.group.position.x * 0.35;
  camera.position.x = lerp(camera.position.x, tx, 0.08);
  camera.lookAt(tx * 0.7, 1.2, PLAYER_Z - 12);

  hud.update({
    hp: player.health / player.maxHealth,
    weapon: weapon.def.name,
    isMax: weapon.isMax,
    mods: weapon.mods,
    wave: waves.wave,
    score,
    boss: enemies.boss,
  });

  renderer.render(scene, camera);
}

frame();
