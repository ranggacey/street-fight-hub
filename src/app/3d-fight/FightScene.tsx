"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ------------------------------------------------------------------ */
/* Pose — semua sudut dalam radian, ruang LOKAL petarung (depan = +Z). */
/* Aturan anatomi: lutut hanya menekuk satu arah (shin ke belakang),   */
/* jadi knee di-clamp ke [0, 2.0] saat diterapkan.                     */
/* ------------------------------------------------------------------ */

type Pose = {
  rootZ: number; // geser maju (+) / mundur (-) dari posisi awal
  rootY: number; // jongkok (-) / tegak (0)
  lean: number; // condong ke depan (+) / ke belakang (-)
  twist: number; // putar badan (cross = kanan maju, jab = kiri maju)
  shLx: number; // bahu kiri: ayun ke depan (-) / ke belakang (+)
  shLz: number; // bahu kiri: renggang ke luar (-)
  shRx: number; // bahu kanan: ayun ke depan (-) / ke belakang (+)
  shRz: number; // bahu kanan: renggang ke luar (+)
  elL: number; // siku kiri: tekuk (-) = lengan bawah naik ke depan
  elR: number; // siku kanan: sama
  hipLx: number; // pinggul kiri: kaki ke depan (-) / ke belakang (+)
  hipRx: number; // pinggul kanan: sama
  kneeL: number; // lutut kiri: tekuk (+) = shin ke belakang
  kneeR: number; // lutut kanan: sama
};

const GUARD: Pose = {
  rootZ: 0,
  rootY: 0,
  lean: 0.06,
  twist: 0,
  shLx: -0.55,
  shLz: -0.25,
  shRx: -0.45,
  shRz: 0.25,
  elL: -1.15,
  elR: -1.05,
  hipLx: -0.38,
  hipRx: 0.28,
  kneeL: 0.38,
  kneeR: 0.32,
};

type MoveKind =
  | "jab"
  | "cross"
  | "roundhouse"
  | "knee"
  | "block"
  | "dashIn"
  | "dashOut";

type Keyframe = { t: number; pose: Partial<Pose> };
type MoveDef = {
  duration: number;
  /** detik impact (null = bukan serangan) */
  impactAt: number | null;
  keys: Keyframe[];
};

const MOVE_DEFS: Record<MoveKind, MoveDef> = {
  jab: {
    duration: 0.38,
    impactAt: 0.16,
    keys: [
      { t: 0, pose: {} },
      { t: 0.08, pose: { twist: 0.12, shLx: -0.75, elL: -1.35, rootZ: 0.02 } },
      {
        t: 0.16,
        pose: { twist: 0.28, shLx: -1.5, elL: -0.08, rootZ: 0.22, lean: 0.14 },
      },
      { t: 0.38, pose: {} },
    ],
  },
  cross: {
    duration: 0.48,
    impactAt: 0.2,
    keys: [
      { t: 0, pose: {} },
      { t: 0.1, pose: { twist: -0.15, shRx: -0.7, elR: -1.3, rootZ: 0.02 } },
      {
        t: 0.2,
        pose: { twist: -0.5, shRx: -1.55, elR: -0.05, rootZ: 0.26, lean: 0.16 },
      },
      { t: 0.48, pose: {} },
    ],
  },
  roundhouse: {
    duration: 0.65,
    impactAt: 0.3,
    keys: [
      { t: 0, pose: {} },
      {
        t: 0.14,
        pose: { twist: -0.25, hipRx: 0.5, kneeR: 1.5, lean: 0.05, rootZ: -0.05 },
      },
      {
        t: 0.3,
        pose: {
          twist: -0.55,
          hipRx: -1.15,
          kneeR: 0.12,
          lean: 0.12,
          rootZ: 0.18,
          shLx: -0.9,
        },
      },
      { t: 0.65, pose: {} },
    ],
  },
  knee: {
    duration: 0.55,
    impactAt: 0.26,
    keys: [
      { t: 0, pose: {} },
      { t: 0.12, pose: { hipLx: -0.5, kneeL: 1.2, lean: -0.05 } },
      {
        t: 0.26,
        pose: { hipLx: -1.05, kneeL: 1.85, lean: 0.22, rootZ: 0.2, twist: 0.1 },
      },
      { t: 0.55, pose: {} },
    ],
  },
  block: {
    duration: 0.5,
    impactAt: null,
    keys: [
      { t: 0, pose: {} },
      {
        t: 0.1,
        pose: {
          shLx: -0.95,
          shRx: -0.95,
          elL: -1.55,
          elR: -1.55,
          rootY: -0.07,
          kneeL: 0.55,
          kneeR: 0.5,
          lean: 0.02,
        },
      },
      {
        t: 0.35,
        pose: {
          shLx: -0.95,
          shRx: -0.95,
          elL: -1.55,
          elR: -1.55,
          rootY: -0.07,
          kneeL: 0.55,
          kneeR: 0.5,
          lean: 0.02,
        },
      },
      { t: 0.5, pose: {} },
    ],
  },
  dashIn: {
    duration: 0.42,
    impactAt: null,
    keys: [
      { t: 0, pose: {} },
      {
        t: 0.16,
        pose: { rootZ: 0.5, lean: 0.2, hipLx: -0.55, hipRx: -0.1, kneeL: 0.5 },
      },
      { t: 0.42, pose: {} },
    ],
  },
  dashOut: {
    duration: 0.42,
    impactAt: null,
    keys: [
      { t: 0, pose: {} },
      {
        t: 0.16,
        pose: { rootZ: -0.5, lean: -0.08, hipLx: 0.1, hipRx: -0.45 },
      },
      { t: 0.42, pose: {} },
    ],
  },
};

const MOVE_META: Record<MoveKind, { label: string; key: string }> = {
  jab: { label: "Jab", key: "J" },
  cross: { label: "Cross", key: "K" },
  roundhouse: { label: "Roundhouse", key: "T" },
  knee: { label: "Lutut", key: "U" },
  block: { label: "Block", key: "B" },
  dashIn: { label: "Dash masuk", key: "W" },
  dashOut: { label: "Dash mundur", key: "S" },
};

const MOVE_ORDER: MoveKind[] = [
  "jab",
  "cross",
  "roundhouse",
  "knee",
  "block",
  "dashIn",
  "dashOut",
];

/** Urutan demo otomatis: kombinasi serangan + pertahanan. */
const DEMO_SEQUENCE: MoveKind[] = [
  "jab",
  "cross",
  "roundhouse",
  "knee",
  "block",
  "dashIn",
  "cross",
  "jab",
  "dashOut",
];

const RED_HOME_Z = -0.8;
const BLUE_HOME_Z = 0.8;
const HIPS_Y = 0.98;

function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out = {} as Pose;
  (Object.keys(a) as (keyof Pose)[]).forEach((key) => {
    out[key] = a[key] + (b[key] - a[key]) * k;
  });
  return out;
}

/** Keyframe (parsial di atas GUARD) -> pose penuh, dihitung sekali. */
const EXPANDED: Record<MoveKind, { t: number; pose: Pose }[]> = Object.fromEntries(
  (Object.keys(MOVE_DEFS) as MoveKind[]).map((kind) => [
    kind,
    MOVE_DEFS[kind].keys.map((k) => ({ t: k.t, pose: { ...GUARD, ...k.pose } })),
  ]),
) as Record<MoveKind, { t: number; pose: Pose }[]>;

function sampleMove(kind: MoveKind, t: number): Pose {
  const keys = EXPANDED[kind];
  if (t <= keys[0].t) return keys[0].pose;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.pose;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t < b.t) {
      const k = smoothstep((t - a.t) / (b.t - a.t));
      return lerpPose(a.pose, b.pose, k);
    }
  }
  return last.pose;
}

/* ------------------------------------------------------------------ */
/* Rig stickman dari primitif Three.js.                                */
/* ------------------------------------------------------------------ */

type Rig = {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
};

function limb(
  mat: THREE.Material,
  r: number,
  len: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 12), mat);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  return mesh;
}

function buildStickman(color: number, accent: number): Rig {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 });

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = HIPS_Y;
  root.add(hips);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 12), mat);
  pelvis.castShadow = true;
  hips.add(pelvis);

  const makeLeg = (side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(0.11 * side, -0.04, 0);
    hips.add(hip);
    hip.add(limb(mat, 0.055, 0.46));
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    knee.add(limb(mat, 0.045, 0.44));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2), dark);
    foot.position.set(0, -0.46, 0.05);
    foot.castShadow = true;
    knee.add(foot);
    return { hip, knee };
  };

  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.52, 12), mat);
  chest.position.y = 0.3;
  chest.castShadow = true;
  torso.add(chest);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.06, 12), dark);
  belt.position.y = 0.06;
  torso.add(belt);

  const makeArm = (side: -1 | 1): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.17 * side, 0.52, 0);
    torso.add(shoulder);
    shoulder.add(limb(mat, 0.045, 0.3));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(limb(mat, 0.038, 0.28));
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), dark);
    glove.position.y = -0.3;
    glove.castShadow = true;
    elbow.add(glove);
    return { shoulder, elbow };
  };

  const armL = makeArm(-1);
  const armR = makeArm(1);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 20), mat);
  head.position.y = 0.66;
  head.castShadow = true;
  torso.add(head);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 8, 24), accentMat);
  band.position.y = 0.7;
  band.rotation.x = Math.PI / 2;
  torso.add(band);

  return {
    root,
    hips,
    torso,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
    hipL: legL.hip,
    hipR: legR.hip,
    kneeL: legL.knee,
    kneeR: legR.knee,
  };
}

function applyPose(rig: Rig, pose: Pose, homeZ: number): void {
  rig.root.position.z = homeZ + pose.rootZ;
  rig.hips.position.y = HIPS_Y + pose.rootY;
  rig.torso.rotation.set(pose.lean, pose.twist, 0);
  rig.shoulderL.rotation.set(pose.shLx, 0, pose.shLz);
  rig.shoulderR.rotation.set(pose.shRx, 0, pose.shRz);
  rig.elbowL.rotation.x = pose.elL;
  rig.elbowR.rotation.x = pose.elR;
  rig.hipL.rotation.x = pose.hipLx;
  rig.hipR.rotation.x = pose.hipRx;
  // Lutut hanya menekuk satu arah: clamp, tidak pernah ke depan.
  rig.kneeL.rotation.x = THREE.MathUtils.clamp(pose.kneeL, 0, 2.0);
  rig.kneeR.rotation.x = THREE.MathUtils.clamp(pose.kneeR, 0, 2.0);
}

/* ------------------------------------------------------------------ */
/* Komponen scene + kontrol.                                           */
/* ------------------------------------------------------------------ */

export default function FightScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<MoveKind[]>([]);
  const resetRef = useRef(false);
  const autoDemoRef = useRef(false);
  const setLastMoveRef = useRef<(label: string) => void>(() => {});
  const [autoDemo, setAutoDemo] = useState(false);
  const [lastMove, setLastMove] = useState("Siap — pilih gerakan");
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    setLastMoveRef.current = setLastMove;
  }, []);
  useEffect(() => {
    autoDemoRef.current = autoDemo;
  }, [autoDemo]);

  const triggerMove = useCallback((kind: MoveKind) => {
    queueRef.current.push(kind);
    setLastMove(MOVE_META[kind].label);
  }, []);

  const resetPositions = useCallback(() => {
    resetRef.current = true;
    setLastMove("Reset posisi");
  }, []);

  const toggleDemo = useCallback(() => {
    setAutoDemo((v) => !v);
  }, []);

  /* Keyboard: J/K/T/U/B/W/S/R/D. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "j") triggerMove("jab");
      else if (k === "k") triggerMove("cross");
      else if (k === "t") triggerMove("roundhouse");
      else if (k === "u") triggerMove("knee");
      else if (k === "b") triggerMove("block");
      else if (k === "w" || e.key === "ArrowUp") triggerMove("dashIn");
      else if (k === "s" || e.key === "ArrowDown") triggerMove("dashOut");
      else if (k === "r") resetPositions();
      else if (k === "d") toggleDemo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerMove, resetPositions, toggleDemo]);

  /* Scene Three.js — dibuat sekali saat mount, dibersihkan saat unmount. */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      // setState ditunda satu microtask supaya tidak synchronous di effect.
      const message = `WebGL tidak bisa dibuat di perangkat ini: ${err instanceof Error ? err.message : String(err)}`;
      queueMicrotask(() => setWebglError(message));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0a09);
    scene.fog = new THREE.Fog(0x0c0a09, 10, 22);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(2.4, 1.9, 3.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.update();

    const hemi = new THREE.HemisphereLight(0xfaf5ec, 0x221d1a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 6, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    scene.add(sun);
    const warm = new THREE.PointLight(0xf5a623, 12, 9);
    warm.position.set(-2.5, 3, -2);
    scene.add(warm);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(14, 28, 0x3a2f26, 0x221d1a);
    grid.position.y = 0.01;
    scene.add(grid);

    const ringLine = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 2.65, 64),
      new THREE.MeshBasicMaterial({ color: 0xf5a623 }),
    );
    ringLine.rotation.x = -Math.PI / 2;
    ringLine.position.y = 0.015;
    scene.add(ringLine);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x332b26, roughness: 0.6 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.4 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe5382e, roughness: 0.5 });
    [-2.6, 2.6].forEach((x) => {
      [-2.6, 2.6].forEach((z) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 10), postMat);
        post.position.set(x, 0.55, z);
        post.castShadow = true;
        scene.add(post);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), capMat);
        cap.position.set(x, 1.12, z);
        scene.add(cap);
      });
    });
    [0.6, 0.95].forEach((y) => {
      [-2.6, 2.6].forEach((z) => {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.2, 8), ropeMat);
        rope.rotation.z = Math.PI / 2;
        rope.position.set(0, y, z);
        scene.add(rope);
      });
      [-2.6, 2.6].forEach((x) => {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.2, 8), ropeMat);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(x, y, 0);
        scene.add(rope);
      });
    });

    const red = buildStickman(0xe5382e, 0xf5a623);
    red.root.position.set(0, 0, RED_HOME_Z);
    red.root.rotation.y = 0;
    scene.add(red.root);

    const blue = buildStickman(0x2563eb, 0x22d3ee);
    blue.root.position.set(0, 0, BLUE_HOME_Z);
    blue.root.rotation.y = Math.PI;
    scene.add(blue.root);

    const impactRing = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.3, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf5a623,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    impactRing.position.set(0, 1.3, BLUE_HOME_Z - 0.45);
    scene.add(impactRing);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    /* ---- State animasi (semua digerakkan delta time, bukan frame) ---- */
    const clock = new THREE.Clock();
    let time = 0;
    let active: { kind: MoveKind; start: number } | null = null;
    let blend: { from: Pose; start: number; dur: number } | null = null;
    let currentPose: Pose = { ...GUARD };
    let pendingImpact: { at: number } | null = null;
    let flinchStart = -10;
    let impactStart = -10;
    const demo = { idx: 0, nextAt: 0 };

    const startMove = (kind: MoveKind, now: number) => {
      active = { kind, start: now };
      blend = { from: { ...currentPose }, start: now, dur: 0.1 };
      const def = MOVE_DEFS[kind];
      if (def.impactAt !== null) {
        pendingImpact = { at: now + def.impactAt };
      }
      demo.nextAt = now + def.duration + 0.45;
    };

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      time += dt;

      if (resetRef.current) {
        resetRef.current = false;
        active = null;
        pendingImpact = null;
        blend = { from: { ...currentPose }, start: time, dur: 0.25 };
      }

      if (!active) {
        const next = queueRef.current.shift();
        if (next) {
          startMove(next, time);
        } else if (autoDemoRef.current && time >= demo.nextAt) {
          const kind = DEMO_SEQUENCE[demo.idx % DEMO_SEQUENCE.length];
          demo.idx += 1;
          setLastMoveRef.current(MOVE_META[kind].label);
          startMove(kind, time);
        }
      } else {
        const def = MOVE_DEFS[active.kind];
        if (time - active.start >= def.duration) {
          active = null;
        }
      }

      let pose: Pose = { ...GUARD };
      if (active) {
        pose = sampleMove(active.kind, time - active.start);
      }
      if (blend) {
        const k = smoothstep((time - blend.start) / blend.dur);
        pose = lerpPose(blend.from, pose, k);
        if (k >= 1) blend = null;
      }
      currentPose = pose;
      applyPose(red, pose, RED_HOME_Z);

      if (pendingImpact && time >= pendingImpact.at) {
        pendingImpact = null;
        flinchStart = time;
        impactStart = time;
      }
      const flinchAge = time - flinchStart;
      const bluePose: Pose = { ...GUARD };
      if (flinchAge < 0.4) {
        const s = 1 - flinchAge / 0.4;
        bluePose.lean -= 0.18 * s;
        bluePose.elL -= 0.25 * s;
        bluePose.elR -= 0.25 * s;
        bluePose.rootZ += 0.08 * s;
        bluePose.twist += 0.1 * s;
      }
      applyPose(blue, bluePose, BLUE_HOME_Z);

      const impactAge = time - impactStart;
      const ringMat = impactRing.material as THREE.MeshBasicMaterial;
      if (impactAge >= 0 && impactAge < 0.3) {
        const s = 1 + impactAge * 6;
        impactRing.scale.set(s, s, s);
        ringMat.opacity = 0.9 * (1 - impactAge / 0.3);
      } else {
        ringMat.opacity = 0;
      }

      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      controls.dispose();
      observer.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="rounded-2xl border border-red-brand/40 bg-red-brand/10 p-6 text-paper">
        <p className="font-semibold">Arena 3D tidak bisa dibuka</p>
        <p className="mt-1 text-sm text-paper-dim">{webglError}</p>
        <p className="mt-2 text-sm text-paper-dim">
          Coba browser lain atau aktifkan akselerasi hardware.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-950">
        <div
          ref={mountRef}
          className="h-[52vh] w-full touch-none md:h-[60vh]"
          aria-label="Arena 3D: dua petarung stickman, merah lawan biru"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-red-brand px-2.5 py-1 text-xs font-bold text-white">
            MERAH
          </span>
          <span className="text-xs font-bold text-paper">VS</span>
          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
            BIRU
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-paper">
          Gerakan terakhir: {lastMove}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MOVE_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => triggerMove(kind)}
            className="glass min-h-11 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-paper transition active:scale-95"
          >
            {MOVE_META[kind].label}
            <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-paper-dim">
              {MOVE_META[kind].key}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={resetPositions}
          className="glass min-h-11 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-paper transition active:scale-95"
        >
          Reset posisi
          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-paper-dim">
            R
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={toggleDemo}
        aria-pressed={autoDemo}
        className={`mt-2 min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] ${
          autoDemo
            ? "bg-amber-brand text-on-amber"
            : "border border-amber-brand/40 bg-amber-brand/10 text-amber-brand"
        }`}
      >
        {autoDemo ? "■ Hentikan demo otomatis" : "▶ Demo otomatis"}
        <span className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-[11px] font-bold">
          D
        </span>
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-paper-mute">
        Seret untuk memutar kamera • Scroll untuk zoom • Keyboard: J jab,
        K cross, T roundhouse, U lutut, B block, W dash masuk, S dash
        mundur, R reset, D demo otomatis.
      </p>
    </div>
  );
}
