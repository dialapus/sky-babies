/**
 * Sky Babies — expressive procedural low-poly heroine.
 * Three.js 0.160.0 ESM; no textures, addons, DOM or animation loop required.
 *
 * The outer group is owned by the game controller: update() never changes
 * group.position.  Its local rig and limbs may animate freely.
 */
import * as THREE from 'three';

export function createHero(scene, { seed = 1 } = {}) {
  let randomState = hashSeed(seed);
  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };
  const phaseOffset = random() * Math.PI * 2;
  const blinkOffset = random() * 2.8;

  const group = new THREE.Group();
  group.name = 'SkyBaby';
  scene.add(group);

  const palette = {
    skin: material(0xffc59f),
    skinLight: material(0xffd3b6),
    earPink: material(0xf19d9c),
    cheeks: material(0xff8ea8, { transparent: true, opacity: 0.86 }),
    hair: material(0x38232c),
    hairLight: material(0x59404a),
    bow: material(0xff339d),
    bowLight: material(0xff69b7),
    bowDark: material(0xd91475),
    overalls: material(0xf44791),
    overallsLight: material(0xff77b3),
    overallsDark: material(0xd22f7a),
    shirt: material(0xffe4b7),
    white: material(0xffffff),
    eyes: material(0x201d30),
    iris: material(0x754844),
    mouth: material(0x923b57),
    tongue: material(0xff8a9b),
    shoes: material(0xf6e7ff),
    soles: material(0xd9a0dc),
    gold: material(0xffd466),
  };

  const allGeometries = new Set();
  const allMaterials = new Set(Object.values(palette));
  const sphereGeometries = new Map();
  function sphereGeometry(detail = 0) {
    if (!sphereGeometries.has(detail)) {
      const segments = detail === 2 ? [24, 16] : detail === 1 ? [16, 12] : [12, 8];
      const geometry = new THREE.SphereGeometry(1, ...segments);
      sphereGeometries.set(detail, geometry);
      allGeometries.add(geometry);
    }
    return sphereGeometries.get(detail);
  }

  function ellipsoid(parent, name, mat, position, scale, detail = 0) {
    const mesh = new THREE.Mesh(sphereGeometry(detail), mat);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function cone(parent, name, mat, position, radius, height, segments = 7) {
    const geo = new THREE.ConeGeometry(radius, height, segments);
    allGeometries.add(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  function curvedLine(parent, name, points, color, radius = 0.012) {
    const curve = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)));
    const geo = new THREE.TubeGeometry(curve, 18, radius, 5, false);
    allGeometries.add(geo);
    const mesh = new THREE.Mesh(geo, color);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }

  // Animation hierarchy: the group's origin stays exactly at the soles.
  const rig = new THREE.Group();
  rig.name = 'AnimatedRig';
  group.add(rig);
  const body = new THREE.Group();
  body.name = 'Body';
  rig.add(body);

  // Onesie has a chunky pear-shaped baby silhouette, short puffed legs,
  // inset bib, two bright straps, a small heart and a rear seam/pocket.
  ellipsoid(body, 'PinkOverall', palette.overalls, [0, 1.02, 0], [.45, .53, .34], 2);
  ellipsoid(body, 'Collar', palette.shirt, [0, 1.42, -.01], [.31, .15, .28], 1);
  ellipsoid(body, 'OverallBelly', palette.overallsLight, [0, 1.015, -.278], [.35, .38, .09], 1);
  ellipsoid(body, 'BabyBum', palette.overallsDark, [0, .80, .23], [.36, .23, .15], 1);
  ellipsoid(body, 'BackPocket', palette.overallsLight, [0, .94, .337], [.165, .16, .023], 0);

  [-1, 1].forEach(side => {
    const strap = ellipsoid(body, 'OverallStrap', palette.overalls, [side * .274, 1.35, -.265], [.095, .24, .065], 0);
    strap.rotation.z = side * -.22;
    const backStrap = ellipsoid(body, 'RearStrap', palette.overallsLight, [side * .268, 1.29, .267], [.082, .27, .052]);
    backStrap.rotation.z = side * .14;
    ellipsoid(body, 'GoldStrapButton', palette.gold, [side * .255, 1.22, -.332], [.043, .045, .021], 1);
  });

  ellipsoid(body, 'HeartLeft', palette.bowDark, [-.056, 1.115, -.374], [.077, .072, .025], 1);
  ellipsoid(body, 'HeartRight', palette.bowDark, [.056, 1.115, -.374], [.077, .072, .025], 1);
  const heartPoint = cone(body, 'HeartTip', palette.bowDark, [0, 1.048, -.372], .112, .15, 6);
  heartPoint.rotation.z = Math.PI;

  // Low-poly legs: all mesh coordinates are relative to the hip pivots.
  const legs = [];
  const ankles = [];
  [-1, 1].forEach(side => {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'LegLeft' : 'LegRight';
    leg.position.set(side * .24, .70, 0);
    body.add(leg);
    ellipsoid(leg, 'Shorts', palette.overallsDark, [0, -.08, 0], [.235, .235, .245]);
    ellipsoid(leg, 'Calf', palette.skin, [0, -.29, -.016], [.157, .25, .159], 1);
    ellipsoid(leg, 'Sock', palette.white, [0, -.475, -.013], [.156, .11, .152]);
    const ankle = new THREE.Group();
    ankle.name = 'Ankle';
    ankle.position.set(0, -.545, 0);
    leg.add(ankle);
    ellipsoid(ankle, 'LittleShoe', palette.shoes, [0, -.055, -.082], [.213, .145, .285], 1);
    ellipsoid(ankle, 'ShoeSole', palette.soles, [0, -.141, -.085], [.217, .045, .287], 1);
    ellipsoid(ankle, 'ShoePomPom', palette.bowLight, [0, .048, -.255], [.091, .049, .044], 0);
    legs.push(leg);
    ankles.push(ankle);
  });

  // Slightly asymmetrical hand poses make the run read as joyful, not robotic.
  const arms = [];
  const wrists = [];
  [-1, 1].forEach(side => {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'ArmLeft' : 'ArmRight';
    arm.position.set(side * .425, 1.335, 0);
    body.add(arm);
    const sleeve = ellipsoid(arm, 'PuffedSleeve', palette.shirt, [side * .045, -.105, 0], [.205, .215, .202], 1);
    sleeve.rotation.z = side * .21;
    const forearm = ellipsoid(arm, 'Forearm', palette.skin, [side * .08, -.348, 0], [.133, .227, .137], 1);
    forearm.rotation.z = side * .23;
    const wrist = new THREE.Group();
    wrist.position.set(side * .12, -.527, 0);
    arm.add(wrist);
    ellipsoid(wrist, 'Fist', palette.skinLight, [0, 0, 0], [.15, .157, .135], 1);
    ellipsoid(wrist, 'Thumb', palette.skin, [-side * .13, .01, -.056], [.07, .098, .073], 0);
    arms.push(arm);
    wrists.push(wrist);
  });

  // The player is filmed from +Z while moving toward -Z. The head looks
  // over the shoulder toward the camera, without turning the entire body.
  const neck = new THREE.Group();
  neck.name = 'HeadPivot';
  neck.position.set(0, 1.40, -.005);
  body.add(neck);

  const face = new THREE.Group();
  face.name = 'Face';
  neck.add(face);
  ellipsoid(face, 'OversizedHead', palette.skinLight, [0, .665, 0], [.651, .674, .594], 2);
  ellipsoid(face, 'RoundChin', palette.skin, [0, .31, -.235], [.465, .234, .377], 1);

  [-1, 1].forEach(side => {
    ellipsoid(face, 'Ear', palette.skinLight, [side * .639, .627, -.008], [.144, .207, .124], 1);
    ellipsoid(face, 'EarInside', palette.earPink, [side * .753, .61, -.011], [.025, .113, .072]);
    ellipsoid(face, 'BlushingCheek', palette.cheeks, [side * .472, .47, -.412], [.132, .083, .021], 1);
    ellipsoid(face, 'CheekLight', palette.skinLight, [side * .427, .492, -.455], [.034, .019, .009]);
  });

  // Large, layered cartoon eyes, including sclera, irises and true 3D
  // highlights. Eye groups scale down briefly to create seeded blinking.
  const eyeGroups = [];
  [-1, 1].forEach(side => {
    const eye = new THREE.Group();
    eye.name = side < 0 ? 'EyeLeft' : 'EyeRight';
    eye.position.set(side * .258, .727, -.522);
    face.add(eye);
    ellipsoid(eye, 'EyeWhite', palette.white, [0, 0, -.015], [.169, .214, .093], 1);
    ellipsoid(eye, 'Iris', palette.iris, [-side * .009, -.019, -.100], [.102, .159, .031], 1);
    ellipsoid(eye, 'Pupil', palette.eyes, [-side * .012, -.017, -.123], [.071, .128, .026], 1);
    ellipsoid(eye, 'EyeCatchlight', palette.white, [-.047, .067, -.153], [.040, .049, .018], 1);
    ellipsoid(eye, 'TinyCatchlight', palette.white, [.044, -.045, -.152], [.022, .026, .012], 1);
    const brow = ellipsoid(face, 'ExpressiveBrow', palette.hair, [side * .259, 1.01, -.516], [.158, .028, .028], 1);
    brow.rotation.z = side * -.11;
    curvedLine(face, 'OuterLashes', [
      [side * .376, .838, -.570],
      [side * .439, .874, -.555],
      [side * .469, .879, -.517]
    ], palette.hair, .014);
    eyeGroups.push(eye);
  });

  ellipsoid(face, 'ButtonNose', palette.skin, [0, .515, -.605], [.081, .058, .064], 1);
  curvedLine(face, 'SweetSmile', [
    [-.163, .344, -.554], [-.11, .298, -.595], [0, .28, -.621],
    [.11, .298, -.595], [.163, .344, -.554]
  ], palette.mouth, .016);
  ellipsoid(face, 'PinkTongue', palette.tongue, [0, .279, -.628], [.048, .022, .008], 1);

  // Dark hair cap, scalloped fringe, side locks and little high bun.
  ellipsoid(face, 'DarkHairCrown', palette.hair, [0, 1.102, .035], [.656, .355, .595], 2);
  ellipsoid(face, 'HairBack', palette.hair, [0, 1.035, .236], [.632, .389, .398], 1);
  [-1, 1].forEach(side => {
    const sideLock = ellipsoid(face, 'HairSideLock', palette.hair, [side * .538, .877, -.162], [.156, .251, .303], 1);
    sideLock.rotation.z = side * -.24;
    const bang = cone(face, 'HairFringe', palette.hair,
      [side * .223, .991, -.520], .185, .318, 6);
    bang.rotation.z = Math.PI + side * .17;
    bang.rotation.x = -.22;
    ellipsoid(face, 'HairSheen', palette.hairLight, [side * .432, 1.323, -.086], [.034, .089, .021]);
  });
  const centerBang = cone(face, 'CenterFringe', palette.hair, [0, 1.035, -.565], .163, .244, 6);
  centerBang.rotation.z = Math.PI;

  const bun = new THREE.Group();
  bun.name = 'LittleHairBun';
  bun.position.set(.384, 1.31, .299);
  face.add(bun);
  ellipsoid(bun, 'BunBase', palette.hair, [0, 0, 0], [.240, .255, .237], 1);
  ellipsoid(bun, 'BunCurl', palette.hairLight, [.08, .072, -.074], [.089, .105, .056]);

  // Oversized hot pink two-loop bow on the camera-facing side of the hair.
  const bow = new THREE.Group();
  bow.name = 'HotPinkBow';
  bow.position.set(.429, 1.231, -.511);
  bow.rotation.z = -.18;
  face.add(bow);
  const bowLeft = ellipsoid(bow, 'RibbonLoopLeft', palette.bow, [-.18, .027, 0], [.202, .142, .061], 1);
  bowLeft.rotation.z = .49;
  const bowRight = ellipsoid(bow, 'RibbonLoopRight', palette.bow, [.18, .027, 0], [.202, .142, .061], 1);
  bowRight.rotation.z = -.49;
  ellipsoid(bow, 'RibbonKnot', palette.bowLight, [0, 0, -.036], [.099, .110, .080], 1);
  const ribbonLeft = cone(bow, 'RibbonTailLeft', palette.bowDark, [-.09, -.176, .024], .086, .255, 5);
  ribbonLeft.rotation.z = Math.PI + .33;
  const ribbonRight = cone(bow, 'RibbonTailRight', palette.bow, [.111, -.170, .019], .082, .237, 5);
  ribbonRight.rotation.z = Math.PI - .31;
  ellipsoid(bow, 'RibbonHighlight', palette.bowLight, [-.184, .059, -.059], [.085, .026, .009]);

  let elapsed = 0;
  let stridePhase = phaseOffset;
  let runBlend = 0;
  let jumpBlend = 0;
  let fallBlend = 0;
  let disposed = false;
  const lerp = THREE.MathUtils.lerp;

  function update(dt, { mode = 'idle', speed = 0, jumpPhase = 0, fallTime = 0 } = {}) {
    if (disposed) return;
    const step = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0;
    const velocity = Number.isFinite(speed) ? THREE.MathUtils.clamp(Math.abs(speed), 0, 20) : 0;
    const jump = Number.isFinite(jumpPhase) ? THREE.MathUtils.clamp(jumpPhase, 0, 1) : 0;
    const fall = Number.isFinite(fallTime) ? Math.max(0, fallTime) : 0;
    elapsed += step;
    stridePhase += step * (6.2 + velocity * .85);
    const smoothing = 1 - Math.exp(-step * 12);
    runBlend = lerp(runBlend, mode === 'run' ? 1 : 0, smoothing);
    jumpBlend = lerp(jumpBlend, mode === 'jump' ? 1 : 0, smoothing);
    fallBlend = lerp(fallBlend, mode === 'fall' ? 1 : 0, smoothing);

    const run = Math.sin(stridePhase);
    const rebound = Math.abs(Math.cos(stridePhase));
    const breathe = Math.sin(elapsed * 2.3 + phaseOffset);
    const excited = Math.sin(elapsed * 3.4);
    const jumpTuck = Math.sin(jump * Math.PI);
    const fallSpin = Math.min(fall, 1.8);
    const f = fallBlend;
    const j = jumpBlend;
    const r = runBlend * (1 - j) * (1 - f);

    // The ONLY translation is on the internal, decorative skeleton,
    // never on the public hero.group.
    rig.position.y = .017 * breathe * (1 - j - f) + .072 * rebound * r + .05 * jumpTuck * j;
    rig.rotation.x = -.035 * r + .095 * Math.sin(elapsed * 1.8) * (1 - r - j - f)
      + (.29 + fallSpin * 1.1) * f;
    rig.rotation.z = .023 * excited * (1 - f) + Math.sin(fallSpin * 10.5) * .57 * f;
    rig.rotation.y = Math.sin(fallSpin * 4.6) * .48 * f;

    body.rotation.x = -.055 * r - .16 * j + Math.sin(fallSpin * 7) * .13 * f;
    body.rotation.z = .025 * Math.sin(stridePhase) * r + .016 * breathe * (1 - f);
    body.scale.y = 1 + .014 * breathe * (1 - j - f);

    legs.forEach((leg, index) => {
      const side = index === 0 ? -1 : 1;
      leg.rotation.x = side * .69 * run * r + (.18 + .47 * jumpTuck) * j
        + (side * .39 + Math.sin(fallSpin * 12 + index * 2) * .35) * f;
      leg.rotation.z = side * (.048 + .10 * j + .16 * f);
      ankles[index].rotation.x = side * -.22 * run * r + .23 * jumpTuck * j
        - .12 * Math.sin(fallSpin * 13 + index) * f;
    });
    arms.forEach((arm, index) => {
      const side = index === 0 ? -1 : 1;
      arm.rotation.x = -side * .65 * run * r + (2.06 + .18 * jumpTuck) * j
        + (1.32 + .58 * Math.sin(fallSpin * 14 + index * Math.PI)) * f
        + .11 * excited * (1 - r - j - f);
      arm.rotation.z = side * (.17 + .22 * j + .48 * f);
      arm.rotation.y = side * .12 * Math.cos(stridePhase) * r;
      wrists[index].rotation.x = .11 * Math.sin(elapsed * 4.4 + index) * (1 - f);
    });

    // Over-the-shoulder expression: facial features remain clearly visible
    // to the chasing +Z camera as the baby travels toward the -Z castle.
    neck.rotation.y = 2.89 + Math.sin(elapsed * 1.35) * .09 * (1 - f)
      + Math.sin(fallSpin * 8) * .30 * f;
    neck.rotation.z = .07 * Math.sin(elapsed * 1.7) * (1 - j - f)
      - .11 * run * r + .13 * j + .24 * Math.sin(fallSpin * 8) * f;
    neck.rotation.x = -.045 + .055 * breathe * (1 - j - f) - .15 * jumpTuck * j
      + .23 * Math.sin(fallSpin * 10) * f;
    bun.rotation.z = .11 * Math.sin(elapsed * 5.1) + .20 * run * r;
    bow.rotation.z = -.18 + .09 * Math.sin(elapsed * 6.8) + .12 * run * r;

    // Fast brief eyes-closed pose roughly once every 3–4 seconds. The
    // period and phase come from the seed, so replays are deterministic.
    const blinkClock = (elapsed + blinkOffset) % 3.65;
    const blink = blinkClock > 3.43 && blinkClock < 3.62
      ? Math.sin((blinkClock - 3.43) / .19 * Math.PI) : 0;
    const blinkScale = Math.max(.08, 1 - .92 * blink);
    eyeGroups.forEach(eye => { eye.scale.y = blinkScale; });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group);
    allGeometries.forEach(geometry => geometry.dispose());
    allMaterials.forEach(mat => mat.dispose());
    group.clear();
  }

  return { group, update, dispose };
}

function material(hex, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: .94,
    metalness: 0,
    flatShading: true,
    ...extra,
  });
}

function hashSeed(seed) {
  let hash = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}
