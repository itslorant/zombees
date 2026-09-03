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
import { loadBest, saveBest } from "./progress.js";
import { lerp, clamp } from "./utils.js";

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
const CAM_BASE = new THREE.Vector3(0, 8.6, PLAYER_Z + 11);
camera.position.copy(CAM_BASE);
camera.lookAt(0, 1.2, PLAYER_Z - 12);

scene.add(new THREE.AmbientLight(0x5c6f52, 0.6));
scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x2a3a1e, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
sun.position.set(-8, 18, 6);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x77ffaa, 0.5);
rim.position.set(6, 6, -20);
scene.add(rim);

// muzzle flash light — one shared point light, pulsed each shot
const muzzleLight = new THREE.PointLight(0xffd27a, 0, 10, 2);
scene.add(muzzleLight);
let muzzleGlow = 0;

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------
const environment = createEnvironment(scene);
const effects = new Effects(scene);
const player = createPlayer(scene);
const bullets = new Bullets(scene, effects);
const weapon = createWeapon(player, bullets, effects, (pos, color) => {
  muzzleLight.position.copy(pos);
  muzzleLight.color.set(color);
  muzzleGlow = 1;
});
const enemies = new Enemies(scene, effects);
const pickups = new Pickups(scene, effects);

const best = loadBest();

let score = 0;
let combo = 0;
let comboTimer = 0;
let mult = 1;
let shake = 0;
let hitstop = 0;
let state = "start"; // start | playing | over

const COMBO_WINDOW = 3.2;
const comboMult = (c) => Math.min(6, 1 + Math.floor(c / 6));

const hud = createHUD(root, {
  onStart: () => startGame(),
  onRestart: () => startGame(),
});
hud.setBest(best);

const waves = createWaves(enemies, hud);

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
  combo = 0;
  comboTimer = 0;
  mult = 1;
  shake = 0;
  hitstop = 0;
  hud.hideStart();
  hud.hideGameOver();
  state = "playing";
}

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
// Score / juice helpers
// ---------------------------------------------------------------------------
const _pv = new THREE.Vector3();
function popupAt(world, text, kind, dy = 1.4) {
  _pv.set(world.x, world.y + dy, world.z).project(camera);
  if (_pv.z > 1) return;
  hud.popup(
    (_pv.x * 0.5 + 0.5) * window.innerWidth,
    (-_pv.y * 0.5 + 0.5) * window.innerHeight,
    text,
    kind,
  );
}

function onPlayerHit(dmg) {
  const applied = player.hurt(dmg);
  if (applied) {
    sfx.hurt();
    hud.flashHurt();
    combo = 0;
    comboTimer = 0;
    mult = 1;
    shake = Math.max(shake, dmg > 20 ? 1.1 : 0.55);
    hitstop = Math.max(hitstop, 0.04);
    popupAt(player.group.position, "-" + dmg, "hurt", 2.4);
  }
  return applied;
}

function onKill(e) {
  const base = e.isBoss ? 500 : e.kind === "tank" ? 40 : e.kind === "spitter" ? 18 : 12;

  combo += 1;
  comboTimer = COMBO_WINDOW;
  const newMult = comboMult(combo);
  if (newMult > mult) {
    mult = newMult;
    popupAt(player.group.position, mult + "× COMBO", "combo", 3.4);
    sfx.pickup();
  }
  mult = newMult;

  const gained = base * mult;
  score += gained;

  if (e.isBoss) {
    hud.announce("BOSS DOWN", "#8fe36b");
    effects.ring(e.group.position, 0x8fe36b);
    shake = Math.max(shake, 0.9);
    hitstop = Math.max(hitstop, 0.09);
    popupAt(e.group.position, "+" + gained, "big", 2.6);
  } else {
    popupAt(e.group.position, "+" + gained, "score");
    if (e.kind === "tank") {
      shake = Math.max(shake, 0.3);
      hitstop = Math.max(hitstop, 0.05);
    } else {
      hitstop = Math.max(hitstop, 0.022);
    }
  }

  pickups.maybeDrop(e.group.position, e.isBoss);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, clock.getDelta());

  // hitstop: freeze the sim for a few frames on impactful events
  let dt = raw;
  if (hitstop > 0) {
    hitstop -= raw;
    dt = 0;
  }

  if (state === "playing" && dt > 0) {
    player.update(dt, input);
    weapon.update(dt, enemies.list);
    bullets.update(dt, enemies.list, onKill);
    enemies.update(dt, player, onPlayerHit);
    pickups.update(dt, player, weapon, hud);
    waves.update(dt);
    environment.update(dt, 9);

    comboTimer -= dt;
    if (comboTimer <= 0 && combo > 0) {
      combo = 0;
      mult = 1;
    }

    if (player.health <= 0) {
      state = "over";
      sfx.boss();
      shake = 1.2;
      const result = saveBest(score, waves.wave);
      Object.assign(best, result.best);
      hud.setBest(best);
      hud.showGameOver(score, waves.wave, result);
    }
  } else if (state !== "playing") {
    environment.update(raw, state === "start" ? 5 : 1.5);
  }

  effects.update(dt);

  // muzzle light decay
  muzzleGlow = Math.max(0, muzzleGlow - raw * 14);
  muzzleLight.intensity = muzzleGlow * 3.2;

  // camera: ease toward player, then apply shake
  const tx = player.group.position.x * 0.35;
  camera.position.x = lerp(camera.position.x, tx, 0.08);
  camera.position.y = CAM_BASE.y;
  camera.position.z = CAM_BASE.z;
  camera.lookAt(tx * 0.7, 1.2, PLAYER_Z - 12);
  shake = Math.max(0, shake - raw * 3.2);
  if (shake > 0.001) {
    const s = shake * shake;
    camera.position.x += (Math.random() - 0.5) * s * 3;
    camera.position.y += (Math.random() - 0.5) * s * 2;
  }

  const comboFrac = combo >= 3 ? clamp(comboTimer / COMBO_WINDOW, 0, 1) : 0;
  hud.update({
    hp: player.health / player.maxHealth,
    weapon: weapon.def.name,
    isMax: weapon.isMax,
    mods: weapon.mods,
    wave: waves.wave,
    score,
    best,
    combo,
    mult,
    comboFrac,
    boss: enemies.boss,
    dt: raw,
  });

  renderer.render(scene, camera);
}

frame();
