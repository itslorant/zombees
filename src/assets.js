import * as THREE from "three";

// ---------------------------------------------------------------------------
// Shared primitives (never disposed — reused for the whole session)
// ---------------------------------------------------------------------------
const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const LOWSPHERE = new THREE.SphereGeometry(1, 10, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const CONE = new THREE.ConeGeometry(1, 1, 12);

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });

// ---------------------------------------------------------------------------
// Blob shadow (cheap fake contact shadow under each entity)
// ---------------------------------------------------------------------------
const blobTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const blobGeo = new THREE.PlaneGeometry(1, 1);
const blobMat = new THREE.MeshBasicMaterial({
  map: blobTex,
  transparent: true,
  depthWrite: false,
});

export function addBlobShadow(group, size) {
  const s = new THREE.Mesh(blobGeo, blobMat);
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.02;
  s.scale.set(size, size, size);
  s.renderOrder = -1;
  group.add(s);
  return s;
}

// ---------------------------------------------------------------------------
// Player — a blocky human
// ---------------------------------------------------------------------------
export function makePlayer() {
  const g = new THREE.Group();
  const skin = mat(0xe0a878);
  const shirt = mat(0x2f6f3a);
  const pants = mat(0x2b3550);
  const boots = mat(0x1a1a22);

  const torso = new THREE.Mesh(BOX, shirt);
  torso.scale.set(0.92, 1.15, 0.5);
  torso.position.y = 1.62;
  g.add(torso);

  const hips = new THREE.Mesh(BOX, pants);
  hips.scale.set(0.86, 0.4, 0.48);
  hips.position.y = 1.0;
  g.add(hips);

  const neck = new THREE.Mesh(CYL, skin);
  neck.scale.set(0.12, 0.14, 0.12);
  neck.position.y = 2.28;
  g.add(neck);

  const head = new THREE.Mesh(SPHERE, skin);
  head.scale.setScalar(0.33);
  head.position.y = 2.55;
  g.add(head);

  const hair = new THREE.Mesh(SPHERE, mat(0x3a2415));
  hair.scale.set(0.36, 0.3, 0.36);
  hair.position.set(0, 2.62, -0.03);
  g.add(hair);

  const armGeoScale = [0.2, 1.0, 0.24];
  const lArm = new THREE.Mesh(BOX, skin);
  lArm.scale.set(...armGeoScale);
  lArm.position.set(-0.62, 1.55, 0);
  g.add(lArm);

  // right arm is raised, holding the gun forward (-Z)
  const rArmPivot = new THREE.Group();
  rArmPivot.position.set(0.58, 2.0, 0);
  g.add(rArmPivot);
  const rArm = new THREE.Mesh(BOX, skin);
  rArm.scale.set(0.2, 0.95, 0.24);
  rArm.position.set(0, -0.28, -0.34);
  rArm.rotation.x = -1.35;
  rArmPivot.add(rArm);

  const lLeg = new THREE.Mesh(BOX, pants);
  lLeg.scale.set(0.28, 0.95, 0.3);
  lLeg.position.set(-0.22, 0.45, 0);
  g.add(lLeg);
  const rLeg = new THREE.Mesh(BOX, pants);
  rLeg.scale.set(0.28, 0.95, 0.3);
  rLeg.position.set(0.22, 0.45, 0);
  g.add(rLeg);

  const lBoot = new THREE.Mesh(BOX, boots);
  lBoot.scale.set(0.3, 0.18, 0.44);
  lBoot.position.set(-0.22, 0.05, 0.06);
  g.add(lBoot);
  const rBoot = new THREE.Mesh(BOX, boots);
  rBoot.scale.set(0.3, 0.18, 0.44);
  rBoot.position.set(0.22, 0.05, 0.06);
  g.add(rBoot);

  // muzzle anchor: where the gun sits / bullets are born
  const hand = new THREE.Group();
  hand.position.set(0.58, 1.5, -0.62);
  g.add(hand);

  g.userData = { lLeg, rLeg, lArm, rArmPivot, torso, head };
  return { group: g, hand };
}

// ---------------------------------------------------------------------------
// Guns — one distinct silhouette per tier, barrel pointing -Z
// ---------------------------------------------------------------------------
const metal = mat(0x3b3f46, { metalness: 0.6, roughness: 0.4 });
const darkMetal = mat(0x23262c, { metalness: 0.5, roughness: 0.5 });
const grip = mat(0x4a3524, { roughness: 0.9 });

function part(geo, m, sx, sy, sz, px, py, pz) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(px, py, pz);
  return mesh;
}

export const GUN_BUILDERS = {
  Pistol() {
    const g = new THREE.Group();
    g.add(part(BOX, metal, 0.16, 0.2, 0.5, 0, 0, -0.15));
    g.add(part(BOX, grip, 0.14, 0.3, 0.16, 0, -0.22, 0.05));
    g.add(part(CYL, darkMetal, 0.05, 0.05, 0.4, 0, 0.02, -0.45).rotateX(Math.PI / 2));
    g.userData.muzzle = -0.62;
    return g;
  },
  SMG() {
    const g = new THREE.Group();
    g.add(part(BOX, darkMetal, 0.16, 0.22, 0.8, 0, 0, -0.2));
    g.add(part(BOX, grip, 0.13, 0.34, 0.16, 0, -0.24, 0.12));
    g.add(part(BOX, metal, 0.1, 0.32, 0.14, 0, -0.28, -0.25));
    g.add(part(CYL, darkMetal, 0.04, 0.04, 0.5, 0, 0.03, -0.7).rotateX(Math.PI / 2));
    g.userData.muzzle = -0.95;
    return g;
  },
  Shotgun() {
    const g = new THREE.Group();
    g.add(part(BOX, grip, 0.16, 0.18, 1.0, 0, -0.05, 0.0));
    g.add(part(CYL, darkMetal, 0.06, 0.06, 0.9, -0.07, 0.06, -0.6).rotateX(Math.PI / 2));
    g.add(part(CYL, darkMetal, 0.06, 0.06, 0.9, 0.07, 0.06, -0.6).rotateX(Math.PI / 2));
    g.add(part(BOX, grip, 0.14, 0.26, 0.18, 0, -0.2, 0.4));
    g.userData.muzzle = -1.05;
    return g;
  },
  Minigun() {
    const g = new THREE.Group();
    g.add(part(CYL, darkMetal, 0.2, 0.2, 0.5, 0, 0, -0.05).rotateX(Math.PI / 2));
    const barrels = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      barrels.add(
        part(CYL, metal, 0.035, 0.035, 0.9, Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.55).rotateX(
          Math.PI / 2,
        ),
      );
    }
    g.add(barrels);
    g.add(part(BOX, grip, 0.14, 0.3, 0.18, 0, -0.28, 0.2));
    g.userData.muzzle = -1.05;
    g.userData.spin = barrels;
    return g;
  },
  Plasma() {
    const g = new THREE.Group();
    const glow = mat(0x38f0ff, { emissive: 0x28d8ff, emissiveIntensity: 1.4, roughness: 0.3 });
    g.add(part(BOX, darkMetal, 0.22, 0.26, 0.7, 0, 0, -0.15));
    g.add(part(CYL, glow, 0.09, 0.09, 0.55, 0, 0.03, -0.5).rotateX(Math.PI / 2));
    g.add(part(SPHERE, glow, 0.13, 0.13, 0.13, 0, 0.03, -0.78));
    g.add(part(BOX, grip, 0.14, 0.32, 0.18, 0, -0.26, 0.1));
    g.add(part(CYL, glow, 0.03, 0.03, 0.5, 0, 0.18, -0.1).rotateX(Math.PI / 2));
    g.userData.muzzle = -0.9;
    return g;
  },
};

// ---------------------------------------------------------------------------
// Zombee — a zombified bee
// ---------------------------------------------------------------------------
const beeFuzz = mat(0x93c74a, { flatShading: true, roughness: 1 });
const beeStripe = mat(0xf2c53d, { flatShading: true, roughness: 1 });
const beeDark = mat(0x1c2716, { flatShading: true });
const beeHead = mat(0x6f9b3a, { flatShading: true, roughness: 1 });
const beeEye = mat(0xff2b2b, { emissive: 0xff2b2b, emissiveIntensity: 0.9 });
const wingMat = new THREE.MeshStandardMaterial({
  color: 0xdff3ff,
  transparent: true,
  opacity: 0.32,
  roughness: 0.2,
  side: THREE.DoubleSide,
});

const bossFuzz = mat(0x6b8f2e, { flatShading: true, roughness: 1 });
const bossStripe = mat(0xc23b2b, { flatShading: true, roughness: 1 });
const bossEye = mat(0xff1e1e, { emissive: 0xff2200, emissiveIntensity: 1.6 });

// rusher — lean, orange, aggressive
const rushFuzz = mat(0xd9622e, { flatShading: true, roughness: 1 });
const rushStripe = mat(0x2a1410, { flatShading: true });
// spitter — bloated, sickly, glowing venom sac
const spitFuzz = mat(0xa7bf3e, { flatShading: true, roughness: 1 });
const spitSac = mat(0xdcff4a, { emissive: 0xbfff2a, emissiveIntensity: 1.1, flatShading: true });
// tank — dark armoured plates
const tankFuzz = mat(0x4a5b34, { flatShading: true, roughness: 0.8, metalness: 0.3 });
const tankPlate = mat(0x30362a, { flatShading: true, roughness: 0.6, metalness: 0.4 });
// splitter — pale, bulbous
const splitFuzz = mat(0xccd894, { flatShading: true, roughness: 1 });

const flashShellMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Per-kind tuning knobs for the shared bee builder.
const KIND = {
  grunt: { s: 1.15, fuzz: beeFuzz, stripe: beeStripe, head: beeHead },
  rusher: { s: 1.0, fuzz: rushFuzz, stripe: rushStripe, head: rushFuzz, lean: 0.5, wing: 1.3 },
  spitter: { s: 1.3, fuzz: spitFuzz, stripe: spitFuzz, head: spitFuzz, fat: 1.5, sac: true },
  tank: { s: 1.95, fuzz: tankFuzz, stripe: tankPlate, head: tankFuzz, fat: 1.35, armour: true, wing: 0.6 },
  splitter: { s: 1.3, fuzz: splitFuzz, stripe: splitFuzz, head: splitFuzz, fat: 1.45 },
  mini: { s: 0.7, fuzz: splitFuzz, stripe: splitFuzz, head: splitFuzz },
  boss: { s: 3.0, fuzz: bossFuzz, stripe: bossStripe, head: bossFuzz, armour: true },
};

export function makeZombee(kind = "grunt") {
  const k = KIND[kind] || KIND.grunt;
  const boss = kind === "boss";
  const g = new THREE.Group();
  const s = k.s;
  const fat = k.fat || 1;
  const eyeM = boss ? bossEye : beeEye;

  // thorax
  const thorax = new THREE.Mesh(LOWSPHERE, k.fuzz);
  thorax.scale.setScalar(0.45 * s * (k.fat ? 1.15 : 1));
  g.add(thorax);

  // striped abdomen trailing behind (-Z)
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(LOWSPHERE, i % 2 === 0 ? k.stripe : beeDark);
    const r = (0.42 - i * 0.07) * s * fat;
    seg.scale.set(r, r, r * 1.15);
    seg.position.set(0, -0.02 * s, -(0.42 + i * 0.34) * s);
    g.add(seg);
  }

  // spitter venom sac
  if (k.sac) {
    const sac = new THREE.Mesh(LOWSPHERE, spitSac);
    sac.scale.setScalar(0.34 * s);
    sac.position.set(0, 0.12 * s, -0.7 * s);
    g.add(sac);
  }

  // stinger
  const stinger = new THREE.Mesh(CONE, beeDark);
  stinger.scale.set(0.12 * s, 0.4 * s, 0.12 * s);
  stinger.position.set(0, -0.02 * s, -(1.5 * s));
  stinger.rotation.x = -Math.PI / 2;
  g.add(stinger);

  // head (faces +Z, toward the player)
  const head = new THREE.Mesh(LOWSPHERE, k.head);
  head.scale.setScalar(0.34 * s);
  head.position.set(0, 0.05 * s, 0.5 * s);
  g.add(head);

  for (const dir of [-1, 1]) {
    const eye = new THREE.Mesh(SPHERE, eyeM);
    eye.scale.setScalar(0.11 * s);
    eye.position.set(dir * 0.16 * s, 0.1 * s, 0.72 * s);
    g.add(eye);

    const ant = new THREE.Mesh(CYL, beeDark);
    ant.scale.set(0.02 * s, 0.34 * s, 0.02 * s);
    ant.position.set(dir * 0.12 * s, 0.32 * s, 0.6 * s);
    ant.rotation.set(-0.7, 0, dir * 0.3);
    g.add(ant);
  }

  // wings
  const wings = [];
  const wingScale = k.wing || 1;
  for (const dir of [-1, 1]) {
    const wing = new THREE.Mesh(SPHERE, wingMat);
    wing.scale.set(0.62 * s * wingScale, 0.05 * s, 0.42 * s * wingScale);
    wing.position.set(dir * 0.5 * s, 0.42 * s, -0.05 * s);
    wing.userData.dir = dir;
    g.add(wing);
    wings.push(wing);
  }

  // stubby legs
  for (let i = 0; i < 2; i++) {
    for (const dir of [-1, 1]) {
      const leg = new THREE.Mesh(CYL, beeDark);
      leg.scale.set(0.035 * s, 0.3 * s, 0.035 * s);
      leg.position.set(dir * 0.32 * s, -0.34 * s, (0.1 - i * 0.32) * s);
      leg.rotation.z = dir * 0.9;
      g.add(leg);
    }
  }

  // armour plates (tank + boss)
  if (k.armour) {
    const plateN = boss ? 5 : 3;
    for (let i = 0; i < plateN; i++) {
      const plate = new THREE.Mesh(boss ? CONE : BOX, boss ? beeDark : tankPlate);
      if (boss) {
        plate.scale.set(0.12 * s, 0.5 * s, 0.12 * s);
        plate.position.set(0, 0.4 * s, -(0.2 + i * 0.3) * s);
        plate.rotation.x = -0.3;
      } else {
        plate.scale.set(0.5 * s, 0.16 * s, 0.34 * s);
        plate.position.set(0, 0.34 * s, -(0.1 + i * 0.34) * s);
        plate.rotation.x = -0.2;
      }
      g.add(plate);
    }
    if (boss) {
      for (const dir of [-1, 1]) {
        const horn = new THREE.Mesh(CONE, beeDark);
        horn.scale.set(0.09 * s, 0.5 * s, 0.09 * s);
        horn.position.set(dir * 0.22 * s, 0.4 * s, 0.5 * s);
        horn.rotation.set(-0.4, 0, dir * 0.5);
        g.add(horn);
      }
    }
  }

  if (k.lean) g.rotation.x = k.lean * 0.12;

  // white flash shell for hit feedback (hidden until struck)
  const flashShell = new THREE.Mesh(LOWSPHERE, flashShellMat);
  flashShell.scale.setScalar(0.5 * s * fat);
  flashShell.visible = false;
  g.add(flashShell);

  const hoverBase = boss ? 1.4 : kind === "tank" ? 0.4 : kind === "mini" ? 0.4 : 0.55;
  g.position.y = hoverBase;
  g.userData = { wings, hoverBase, s, flashShell, kind };
  return g;
}

// ---------------------------------------------------------------------------
// Weapon crate pickup
// ---------------------------------------------------------------------------
const crateColors = {
  upgrade: 0xffd23f,
  firerate: 0x4fd0ff,
  damage: 0xff6b4f,
  pierce: 0xb47cff,
};

export function makeCrate(type) {
  const g = new THREE.Group();
  const color = crateColors[type] || 0xffffff;
  const body = new THREE.Mesh(BOX, mat(0x2a2f26, { roughness: 0.7 }));
  body.scale.setScalar(0.6);
  g.add(body);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(BOX),
    new THREE.LineBasicMaterial({ color }),
  );
  edges.scale.setScalar(0.61);
  g.add(edges);

  const core = new THREE.Mesh(SPHERE, mat(color, { emissive: color, emissiveIntensity: 1.2 }));
  core.scale.setScalar(0.16);
  core.position.y = 0.02;
  g.add(core);
  g.userData.core = core;

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.03, 8, 24),
    mat(color, { emissive: color, emissiveIntensity: 1 }),
  );
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  g.userData.halo = halo;

  g.position.y = 0.7;
  return g;
}

// ---------------------------------------------------------------------------
// Environment props (recycled along the roadside)
// ---------------------------------------------------------------------------
export function makeProp(kind) {
  const g = new THREE.Group();
  if (kind === 0) {
    // dead tree
    const trunk = new THREE.Mesh(CYL, mat(0x3a2c1e));
    trunk.scale.set(0.2, 3, 0.2);
    trunk.position.y = 1.5;
    g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(CYL, mat(0x3a2c1e));
      b.scale.set(0.08, 1.2, 0.08);
      b.position.set(0, 2.2 + i * 0.3, 0);
      b.rotation.z = (i % 2 ? 1 : -1) * 0.9;
      g.add(b);
    }
  } else if (kind === 1) {
    // rock
    const r = new THREE.Mesh(LOWSPHERE, mat(0x555a5e, { flatShading: true }));
    r.scale.set(1.2, 0.8, 1.1);
    r.position.y = 0.4;
    g.add(r);
  } else {
    // busted hive
    const h = new THREE.Mesh(CYL, mat(0xb98a2e, { flatShading: true, roughness: 1 }));
    h.scale.set(0.9, 1.6, 0.9);
    h.position.y = 1.4;
    g.add(h);
    const h2 = new THREE.Mesh(CYL, mat(0xa9791e, { flatShading: true, roughness: 1 }));
    h2.scale.set(0.7, 0.8, 0.7);
    h2.position.y = 2.4;
    g.add(h2);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Ground texture (procedural asphalt + lane line)
// ---------------------------------------------------------------------------
export function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#20261f";
  g.fillRect(0, 0, 256, 256);

  // grime
  for (let i = 0; i < 900; i++) {
    const v = 20 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v + 6},${v},0.4)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // road
  g.fillStyle = "#2b2f2a";
  g.fillRect(96, 0, 64, 256);
  g.fillStyle = "#3a3f38";
  g.fillRect(96, 0, 3, 256);
  g.fillRect(157, 0, 3, 256);
  // dashed centre line
  g.fillStyle = "#c9b24a";
  for (let y = 0; y < 256; y += 48) g.fillRect(125, y, 6, 26);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
