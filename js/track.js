import * as THREE from 'three';

const LANES = [-2.2, 0, 2.2];
const ROW_LENGTH = 5.4;
const HALF_ROW = ROW_LENGTH / 2;
const ROW_COUNT = 39;
const FRONT_Z = 17;
const LANE_WIDTH = 2.12;

// A seeded, instance-local generator. No Math.random() is used by the course.
function randomFromSeed(seed) {
  let h = 2166136261 >>> 0;
  for (const c of String(seed ?? 42)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTrack(scene, { seed = 42 } = {}) {
  const rng = randomFromSeed(seed);
  const group = new THREE.Group();
  group.name = 'cloud-lane-track';
  scene.add(group);
  const earth = new THREE.Group();
  earth.name = 'earth-visible-through-holes';
  scene.add(earth);

  const geometries = new Set();
  const materials = new Set();
  const geo = g => (geometries.add(g), g);
  const mat = m => (materials.add(m), m);

  const cloudPalette = [
    mat(new THREE.MeshLambertMaterial({ color: 0xfff8ef, flatShading: true })),
    mat(new THREE.MeshLambertMaterial({ color: 0xfff2ef, flatShading: true })),
    mat(new THREE.MeshLambertMaterial({ color: 0xf3faff, flatShading: true })),
    mat(new THREE.MeshLambertMaterial({ color: 0xfff9db, flatShading: true }))
  ];
  const fluffMat = mat(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
  const shadeMat = mat(new THREE.MeshLambertMaterial({ color: 0xe6ddfb, transparent: true, opacity: 0.7 }));
  const tileGeo = geo(new THREE.BoxGeometry(LANE_WIDTH, 0.32, ROW_LENGTH - 0.07));
  const cloudGeo = geo(new THREE.IcosahedronGeometry(1, 1));
  const haloGeo = geo(new THREE.TorusGeometry(0.38, 0.055, 5, 16));
  const haloMat = mat(new THREE.MeshBasicMaterial({ color: 0xffe1a1, transparent: true, opacity: 0.42 }));

  const oceanMat = mat(new THREE.MeshLambertMaterial({ color: 0x3f93be, side: THREE.DoubleSide, flatShading: true }));
  const landMats = [
    mat(new THREE.MeshLambertMaterial({ color: 0x7fbc88, side: THREE.DoubleSide, flatShading: true })),
    mat(new THREE.MeshLambertMaterial({ color: 0x9dc87e, side: THREE.DoubleSide, flatShading: true })),
    mat(new THREE.MeshLambertMaterial({ color: 0xb0ca8a, side: THREE.DoubleSide, flatShading: true })),
    mat(new THREE.MeshLambertMaterial({ color: 0x65af91, side: THREE.DoubleSide, flatShading: true }))
  ];
  const riverMat = mat(new THREE.MeshBasicMaterial({ color: 0x85d7ea }));

  // Earth is real 3D geometry, tens of metres below every transparent-through hole.
  const ocean = new THREE.Mesh(geo(new THREE.PlaneGeometry(600, 600, 1, 1)), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -48, -110);
  earth.add(ocean);
  for (let i = 0; i < 20; i++) {
    const x = (rng() - 0.5) * 260;
    const z = (rng() - 0.5) * 380 - 115;
    const rx = 10 + rng() * 32;
    const rz = 15 + rng() * 40;
    const shape = new THREE.Shape();
    const count = 12;
    for (let j = 0; j < count; j++) {
      const angle = (Math.PI * 2 * j) / count;
      const wobble = 0.68 + rng() * 0.48;
      const px = Math.cos(angle) * rx * wobble;
      const py = Math.sin(angle) * rz * wobble;
      if (j === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    const island = new THREE.Mesh(geo(new THREE.ShapeGeometry(shape)), landMats[i % landMats.length]);
    island.rotation.x = -Math.PI / 2;
    island.position.set(x, -47.78 + i * 0.002, z);
    earth.add(island);
    if (i % 3 === 0) {
      const points = [];
      for (let n = 0; n <= 9; n++) {
        const t = n / 9;
        points.push(new THREE.Vector3(x - rx * 0.7 + t * rx * 1.4,
          -47.63, z + Math.sin(t * Math.PI * 2.8 + i) * rz * 0.18));
      }
      const river = new THREE.Mesh(geo(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points), 26, 0.7, 5, false)), riverMat);
      earth.add(river);
    }
  }

  const rows = [];
  let rowSerial = 0;
  let hazardCountdown = 2;

  function nextPattern() {
    const index = rowSerial++;
    // 8 empty rows at the start give the player time to read the road.
    if (index < 8) return [false, false, false];
    if (hazardCountdown-- > 0) return [false, false, false];
    hazardCountdown = 1 + Math.floor(rng() * 3);
    const holes = [false, false, false];
    const primary = Math.floor(rng() * 3);
    holes[primary] = true;
    if (rng() < 0.29) {
      const secondary = (primary + 1 + Math.floor(rng() * 2)) % 3;
      holes[secondary] = true;
    }
    return holes; // At least one lane is always passable.
  }

  function createCell(parent, lane, index) {
    const cell = new THREE.Group();
    cell.position.x = lane;
    parent.add(cell);

    const solid = new THREE.Group();
    cell.add(solid);
    const tile = new THREE.Mesh(tileGeo, cloudPalette[index % cloudPalette.length]);
    tile.position.y = -0.22;
    solid.add(tile);
    for (const endZ of [-2.5, 2.5]) {
      const puff = new THREE.Mesh(cloudGeo, fluffMat);
      puff.position.set(0, -0.17, endZ);
      puff.scale.set(1.06, 0.24, 0.32);
      solid.add(puff);
    }

    // Nothing covers the interior when this cell is a hole. The eight
    // cloudlets form a readable rim instead of an opaque fake hole texture.
    const gap = new THREE.Group();
    cell.add(gap);
    const points = [
      [-0.95, -2.30], [0, -2.36], [0.95, -2.30],
      [-1.01, 0], [1.01, 0],
      [-0.95, 2.30], [0, 2.36], [0.95, 2.30]
    ];
    for (let i = 0; i < points.length; i++) {
      const [px, pz] = points[i];
      const puff = new THREE.Mesh(cloudGeo, i % 2 ? shadeMat : fluffMat);
      puff.position.set(px, -0.18, pz);
      puff.scale.set(i === 3 || i === 4 ? 0.24 : 0.32, 0.20, 0.40);
      gap.add(puff);
    }
    const glowRing = new THREE.Mesh(haloGeo, haloMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = -0.14;
    glowRing.scale.set(2.13, 5.25, 1);
    glowRing.visible = false; // visual optional; never close a gap
    gap.add(glowRing);
    return { solid, gap };
  }

  function setPattern(row, pattern) {
    row.holes = [...pattern];
    row.cells.forEach((cell, i) => {
      cell.solid.visible = !row.holes[i];
      cell.gap.visible = row.holes[i];
    });
  }

  for (let i = 0; i < ROW_COUNT; i++) {
    const rowGroup = new THREE.Group();
    rowGroup.position.z = FRONT_Z - i * ROW_LENGTH;
    group.add(rowGroup);
    const cells = LANES.map((x, lane) => createCell(rowGroup, x, lane));
    const row = { group: rowGroup, holes: [false, false, false], cells };
    setPattern(row, nextPattern());
    rows.push(row);
  }

  function update(dt, speed) {
    const dz = Math.max(0, speed) * Math.max(0, Math.min(dt, 0.05));
    if (!dz) return;
    for (const row of rows) {
      row.group.position.z += dz;
      if (row.group.position.z > FRONT_Z + ROW_LENGTH) {
        row.group.position.z -= ROW_COUNT * ROW_LENGTH;
        setPattern(row, nextPattern());
      }
    }
  }

  function findRow(z) {
    return rows.find(row => Math.abs(z - row.group.position.z) <= HALF_ROW);
  }

  function laneAt(x) {
    let nearest = 0;
    for (let i = 1; i < 3; i++) {
      if (Math.abs(x - LANES[i]) < Math.abs(x - LANES[nearest])) nearest = i;
    }
    return nearest;
  }

  function hasHoleAt(x, z, radius = 0.38) {
    const row = findRow(z);
    if (!row) return false;
    const lane = laneAt(x);
    if (Math.abs(x - LANES[lane]) > LANE_WIDTH * 0.5 + radius * 0.1) return false;
    return row.holes[lane];
  }

  function forceHoleAt(x, z) {
    const row = findRow(z) ?? rows.reduce((best, cur) =>
      Math.abs(z - cur.group.position.z) < Math.abs(z - best.group.position.z) ? cur : best, rows[0]);
    if (!row) return false;
    const holes = [...row.holes];
    holes[laneAt(x)] = true;
    setPattern(row, holes);
    return true;
  }

  function dispose() {
    scene.remove(group);
    scene.remove(earth);
    group.clear();
    earth.clear();
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
  }

  return { update, hasHoleAt, forceHoleAt, dispose };
}
