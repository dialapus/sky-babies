import * as THREE from 'three';

// Sky Babies — scenery only. The track, camera and game state belong to main.js.
export function createWorld(scene, { seed = 1 } = {}) {
  let state = (Number(seed) >>> 0) || 0x51eada7;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const between = (a, b) => a + (b - a) * random();
  const world = new THREE.Group();
  world.name = 'Sky Babies · enchanted heaven';
  scene.add(world);

  const originalFog = scene.fog;
  const originalBackground = scene.background;
  scene.background = new THREE.Color(0xc5b0d7); // fallback behind the gradient dome
  scene.fog = new THREE.FogExp2(0xe8bed0, 0.00175);

  const mat = (color, options = {}) =>
    new THREE.MeshLambertMaterial({ color, flatShading: true, ...options });
  const basic = (color, options = {}) => new THREE.MeshBasicMaterial({ color, ...options });
  const pearl = mat(0xfff3ea);
  const cream = mat(0xffe1c8);
  const pinkStone = mat(0xf4a6be);
  const roseStone = mat(0xe686a7);
  const gold = mat(0xf7c55a, { emissive: 0x694014, emissiveIntensity: 0.24 });
  const lightGold = mat(0xffedac, { emissive: 0x8e5915, emissiveIntensity: 0.26 });
  const lilac = mat(0x9984cc);
  const shadowStone = mat(0x796fae);
  const roof = mat(0x7d8bc5);
  const windowGlow = basic(0xffefae);
  const glassBlue = basic(0x79daff, { transparent: true, opacity: 0.75 });
  const glassPink = basic(0xff9bdb, { transparent: true, opacity: 0.75 });

  const geometryCache = new Map();
  function geometry(key, factory) {
    if (!geometryCache.has(key)) geometryCache.set(key, factory());
    return geometryCache.get(key);
  }
  function box(parent, material, x, y, z, w, h, d, radius = 0) {
    const mesh = new THREE.Mesh(
      geometry('box', () => new THREE.BoxGeometry(1, 1, 1)), material
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    if (radius) mesh.rotation.z = radius;
    parent.add(mesh);
    return mesh;
  }
  function orb(parent, material, x, y, z, sx, sy = sx, sz = sx, detail = 1) {
    const sphere = new THREE.Mesh(
      geometry('ico:' + detail, () => new THREE.IcosahedronGeometry(1, detail)),
      material
    );
    sphere.position.set(x, y, z);
    sphere.scale.set(sx, sy, sz);
    parent.add(sphere);
    return sphere;
  }
  function cone(parent, material, x, y, z, r, h, n = 8) {
    const mesh = new THREE.Mesh(
      geometry('cone:' + n, () => new THREE.ConeGeometry(1, 1, n)),
      material
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(r, h, r);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, material, x, y, z, r, h, n = 12, bottom = r) {
    const mesh = new THREE.Mesh(
      geometry('cylinder:' + n + ':' + (bottom / r).toFixed(2),
        () => new THREE.CylinderGeometry(1, bottom / r, 1, n)),
      material
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(r, h, r);
    parent.add(mesh);
    return mesh;
  }
  function torus(parent, material, x, y, z, r, tube = 0.16, radial = 7) {
    const mesh = new THREE.Mesh(
      geometry('torus:' + r + ':' + tube + ':' + radial,
        () => new THREE.TorusGeometry(r, tube, radial, 40)),
      material
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function polygon(parent, material, x, y, z, w, h) {
    const shape = new THREE.Mesh(
      geometry('octa', () => new THREE.OctahedronGeometry(1, 0)),
      material
    );
    shape.position.set(x, y, z);
    shape.scale.set(w, h, w);
    parent.add(shape);
    return shape;
  }

  // Unlit sunset: dusk-violet zenith, peach horizon, apricot lower haze.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(175, 36, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x60558f) },
        mid: { value: new THREE.Color(0xa989c1) },
        sunset: { value: new THREE.Color(0xf5a89d) },
        horizon: { value: new THREE.Color(0xffd6a0) },
        low: { value: new THREE.Color(0xd69bbf) }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenith, mid, sunset, horizon, low;
        varying vec3 vDir;
        void main() {
          float h = normalize(vDir).y;
          vec3 c = mix(low, horizon, smoothstep(-0.48, -0.11, h));
          c = mix(c, sunset, smoothstep(-0.11, 0.08, h));
          c = mix(c, mid, smoothstep(0.06, 0.42, h));
          c = mix(c, zenith, smoothstep(0.41, 0.95, h));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
  );
  sky.name = 'Sunset gradient sky dome';
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  world.add(sky);

  // Sun and restrained halo; positioned behind the palace silhouette.
  const sunMat = basic(0xfff5be, { fog: false, depthWrite: false });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 12), sunMat);
  sun.position.set(-84, 75, -155);
  world.add(sun);
  for (const [size, opacity] of [[16, 0.095], [23, 0.055], [34, 0.025]]) {
    orb(world, basic(0xffddb7, {
      transparent: true, opacity, depthWrite: false, fog: false
    }), -84, 75, -156, size, size, 0.16);
  }

  const hemi = new THREE.HemisphereLight(0xffebdf, 0x947eac, 2.05);
  const sunlight = new THREE.DirectionalLight(0xffd8a1, 2.0);
  sunlight.position.set(-68, 85, 22);
  sunlight.castShadow = false;
  world.add(hemi, sunlight);

  // Cloud sculptures: icy bright tops, lavender shadow bellies, irregular silhouettes.
  const cloudWhite = mat(0xfff7ef, { emissive: 0x46263c, emissiveIntensity: 0.035 });
  const cloudBlush = mat(0xffe4ed);
  const cloudPeach = mat(0xffd9bd);
  const cloudShade = mat(0xc8b9de);
  const drifting = [];
  function cloud(parent, x, y, z, scale = 1, tone = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    parent.add(g);
    const tint = [cloudWhite, cloudBlush, cloudPeach][tone % 3];
    orb(g, cloudShade, 0, -1.9, 0, 7.2, 2.1, 3.5);
    orb(g, tint, -5.0, 0, 0, 4.8, 3.2, 3.8);
    orb(g, cloudWhite, 0, 1.8, 0, 5.9, 4.0, 4.1);
    orb(g, tint, 5.3, 0.3, 0.3, 5.2, 3.4, 3.7);
    orb(g, cloudWhite, -0.8, 3.5, -0.6, 3.0, 3.0, 2.7);
    return g;
  }
  for (let i = 0; i < 35; i++) {
    const sign = i % 2 ? -1 : 1;
    const scale = between(0.58, 2.2);
    // Even the widest opaque banks must stay clear of the entire three-lane track.
    const x = sign * between(20 + 12 * scale, 90 + 15 * scale);
    const y = between(-15, 44);
    const z = between(-178, 28);
    const g = cloud(world, x, y, z, scale, i % 3);
    drifting.push({ object: g, startX: x, startY: y, phase: between(0, 6.28),
      factor: between(0.025, 0.092), speed: between(0.02, 0.07) });
  }

  // Sky islands silhouette behind the skyline, never above the playable roadway.
  function island(x, z, size) {
    const group = new THREE.Group();
    group.position.set(x, -9, z);
    world.add(group);
    cylinder(group, shadowStone, 0, -3, 0, size * 1.18, 5, 9);
    cone(group, lilac, 0, -13, 0, size * 1.02, 22, 9).rotation.z = Math.PI;
    cloud(group, -size * 0.72, 0, 0, size / 7, 1);
    cloud(group, size * 0.75, -2, -1, size / 8, 0);
    return group;
  }
  island(-77, -204, 17);
  island(79, -209, 20);

  // Pastel fairytale palace at z < -150: never covers the gaps in the run.
  const palace = new THREE.Group();
  palace.name = 'Castle of the heavenly clock';
  palace.position.set(0, 0, -201);
  world.add(palace);

  box(palace, shadowStone, 0, -15, 0, 76, 13, 24);
  box(palace, cream, 0, 5, 0, 65, 32, 19);
  box(palace, pearl, 0, 22, 0, 57, 4, 21);
  box(palace, roseStone, 0, -9, 10, 74, 3.2, 4);
  box(palace, lightGold, 0, 21.8, 11, 60, 1.4, 2.0);
  for (let x = -29; x <= 29; x += 5.8) {
    box(palace, pearl, x, 25.3, 8.5, 3.6, 6, 4.6);
  }
  // Main gate: layered tall arch with warm glowing inner threshold.
  box(palace, roseStone, 0, -0.5, 11.7, 13.8, 18, 1.2);
  box(palace, shadowStone, 0, -3.2, 12.4, 9.6, 13.8, 0.8);
  orb(palace, shadowStone, 0, 3.7, 12.4, 4.8, 5, 0.5, 1);
  box(palace, windowGlow, 0, -3.0, 12.9, 7.9, 12, 0.12);
  orb(palace, windowGlow, 0, 3.7, 12.9, 4, 4.0, 0.11);
  box(palace, gold, 0, -1, 13.25, 0.5, 14.8, 0.4);
  orb(palace, gold, 2.7, -3.0, 13.35, 0.43);

  // Repeated arched windows and vertical gilded pilasters.
  for (let x = -26; x <= 26; x += 8.5) {
    if (Math.abs(x) < 6) continue;
    for (const y of [1, 13.5]) {
      box(palace, roseStone, x, y, 10.5, 4.9, 8.8, 0.55);
      box(palace, windowGlow, x, y, 10.9, 3.5, 7.1, 0.25);
      orb(palace, gold, x, y + 4.1, 10.8, 2.55, 1.35, 0.29);
      box(palace, gold, x, y, 11.13, 0.26, 7, 0.1);
    }
  }
  for (const x of [-31.5, -23.5, 23.5, 31.5]) {
    box(palace, lightGold, x, 6.5, 11.1, 0.7, 28, 1);
  }

  function dome(x, base, z, r) {
    cylinder(palace, lightGold, x, base + 1.0, z, r, 2.3, 12);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 9, 0, 2 * Math.PI, 0, Math.PI / 2),
      gold
    );
    mesh.position.set(x, base + 2.3, z);
    palace.add(mesh);
    orb(palace, lightGold, x, base + r + 2.8, z, 1.2);
    cone(palace, gold, x, base + r + 6.2, z, 0.72, 6.1);
    orb(palace, windowGlow, x, base + r + 9.0, z, 1.5);
  }
  function tower(x, z, r, h) {
    cylinder(palace, pinkStone, x, h / 2 - 9, z, r, h, 12);
    cylinder(palace, pearl, x, h - 7, z, r * 1.13, 2.5, 12);
    for (let i = 0; i < 8; i++) {
      const a = (2 * Math.PI * i) / 8;
      const px = x + Math.sin(a) * r * 1.025;
      const pz = z + Math.cos(a) * r * 1.025;
      box(palace, pearl, px, h - 3.3, pz, 2.0, 5.7, 2.0);
    }
    for (const y of [h - 17, h - 30]) {
      box(palace, windowGlow, x, y, z + r + 0.25, 2.6, 6.3, 0.25);
      orb(palace, gold, x, y + 3.2, z + r + 0.29, 1.65, 0.95, 0.25);
    }
    dome(x, h + 1, z, r * 0.85);
  }
  tower(-36, 0, 9.7, 48);
  tower(36, 0, 9.7, 48);
  tower(-54, -9, 7.4, 34);
  tower(54, -9, 7.4, 34);
  tower(-19, -6, 6.0, 57);
  tower(19, -6, 6.0, 57);

  // Central belfry: giant readable clock facing toward +Z and the player.
  box(palace, pearl, 0, 39.5, 0, 21, 33, 18);
  box(palace, roseStone, 0, 55.8, 0, 24, 3.5, 20);
  for (const x of [-9.7, 9.7]) box(palace, lightGold, x, 40.8, 9.3, 1.3, 29, 1.4);
  dome(0, 58, -1.5, 11.5);

  const clock = new THREE.Group();
  clock.name = 'Working clock face';
  clock.position.set(0, 42, 10.6);
  palace.add(clock);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(9.2, 40), basic(0xfff5db));
  clock.add(dial);
  const faceInner = new THREE.Mesh(new THREE.CircleGeometry(7.7, 40), basic(0xffeac2));
  faceInner.position.z = 0.045;
  clock.add(faceInner);
  torus(clock, gold, 0, 0, 0.22, 9.3, 0.73);
  torus(clock, shadowStone, 0, 0, 0.25, 7.25, 0.12);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const large = i % 3 === 0;
    const mark = box(clock, shadowStone,
      Math.sin(a) * 6.4, Math.cos(a) * 6.4, 0.34,
      large ? 0.43 : 0.23, large ? 1.55 : 0.8, 0.25);
    mark.rotation.z = -a;
  }
  const hourHand = new THREE.Group();
  const minuteHand = new THREE.Group();
  clock.add(hourHand, minuteHand);
  box(hourHand, shadowStone, 0, 2.25, 0.55, 0.82, 5.3, 0.53);
  box(minuteHand, shadowStone, 0, 3.35, 0.7, 0.48, 7.7, 0.34);
  orb(clock, gold, 0, 0, 0.89, 1.0, 1.0, 0.65);
  hourHand.rotation.z = -Math.PI * 0.24;
  minuteHand.rotation.z = Math.PI * 0.22;

  // Stained-glass sky slides; fully outside x +/-3.3, no collision geometry.
  const slides = [];
  function slide(side, index, tint, railTint) {
    const x0 = side * (17 + index * 7);
    const points = [];
    for (let i = 0; i <= 21; i++) {
      const t = i / 21;
      points.push(new THREE.Vector3(
        x0 + side * Math.sin(t * Math.PI * (2.2 + index * 0.32)) * 3.4,
        34 - 25 * t + Math.sin(t * Math.PI * 3) * 3,
        -178 + t * 154
      ));
    }
    const path = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(path, 90, 2.05, 9, false),
      new THREE.MeshPhongMaterial({
        color: tint, transparent: true, opacity: 0.27, shininess: 115,
        specular: 0xffffff, side: THREE.DoubleSide, depthWrite: false
      })
    );
    tube.renderOrder = 3;
    world.add(tube);
    const ridge = new THREE.Mesh(
      new THREE.TubeGeometry(path, 100, 0.16, 5, false),
      basic(railTint, { transparent: true, opacity: 0.85 })
    );
    ridge.position.y = 2.02;
    ridge.renderOrder = 4;
    world.add(ridge);
    // Floating glitter checkpoints trace the mouth of the transparent slide.
    for (let j = 0; j < 6; j++) {
      const p = path.getPoint(j / 6 + 0.04);
      const sparkle = polygon(world, lightGold, p.x + side * 2.7, p.y + 2.4, p.z, 0.45, 1.0);
      sparkle.rotation.y = between(0, Math.PI);
    }
    slides.push(tube);
  }
  slide(-1, 0, 0x68dbff, 0xd9fbff);
  slide(1, 0, 0xff83d6, 0xffd6ec);
  slide(-1, 1, 0xf0c5ff, 0xe5baff);
  slide(1, 1, 0xf9d36e, 0xfff1af);

  // Winged gifts and tiny cherubs: animated bobbing, flapping and slow parallax.
  const floaters = [];
  const wing = mat(0xfffbf5, { side: THREE.DoubleSide });
  const haloGold = basic(0xffeb93);
  const giftColors = [mat(0xf48ba9), mat(0x82d9f2), mat(0xb7a0eb), mat(0xffbf73)];
  function flier(group, x, y, z, phase, drift) {
    group.position.set(x, y, z);
    world.add(group);
    floaters.push({ group, original: new THREE.Vector3(x, y, z), phase, drift,
      left: group.getObjectByName('leftWing'),
      right: group.getObjectByName('rightWing') });
  }
  function makeGift(x, y, z, i) {
    const g = new THREE.Group();
    const c = giftColors[i % giftColors.length];
    box(g, c, 0, 0, 0, 2.3, 2.15, 2.3);
    box(g, lightGold, 0, 0, 1.21, 0.42, 2.24, 0.1);
    box(g, lightGold, 0, 0, 1.26, 2.34, 0.36, 0.12);
    box(g, gold, 0, 1.18, 0, 2.53, 0.44, 2.53);
    const left = orb(g, wing, -1.95, 0.36, 0, 1.35, 0.56, 0.35);
    left.name = 'leftWing'; left.rotation.z = -0.45;
    const right = orb(g, wing, 1.95, 0.36, 0, 1.35, 0.56, 0.35);
    right.name = 'rightWing'; right.rotation.z = 0.45;
    const halo = torus(g, haloGold, 0, 2.8, 0, 1.35, 0.16);
    halo.rotation.x = Math.PI / 2.8;
    cone(g, lightGold, 0, 1.82, 0, 0.68, 0.8);
    flier(g, x, y, z, between(0, 6.28), between(0.15, 0.35));
  }
  function makeCherub(x, y, z, i) {
    const g = new THREE.Group();
    const skin = mat(0xffd6b3);
    const tunic = i % 2 ? mat(0xf5d9fa) : mat(0xecf3ff);
    cone(g, tunic, 0, -0.05, 0, 1.15, 2.9, 8);
    orb(g, skin, 0, 1.94, 0, 1.1, 1.16, 1.04);
    orb(g, gold, 0, 2.69, -0.06, 1.17, 0.46, 1.06);
    orb(g, shadowStone, -0.38, 2.03, 0.99, 0.12, 0.17, 0.10);
    orb(g, shadowStone, 0.38, 2.03, 0.99, 0.12, 0.17, 0.10);
    orb(g, pinkStone, -0.66, 1.72, 0.85, 0.23, 0.13, 0.08);
    orb(g, pinkStone, 0.66, 1.72, 0.85, 0.23, 0.13, 0.08);
    const left = orb(g, wing, -1.65, 0.35, -0.4, 1.25, 1.15, 0.38);
    left.name = 'leftWing'; left.rotation.z = -0.35;
    const right = orb(g, wing, 1.65, 0.35, -0.4, 1.25, 1.15, 0.38);
    right.name = 'rightWing'; right.rotation.z = 0.35;
    const halo = torus(g, haloGold, 0, 3.65, 0, 1.05, 0.12);
    halo.rotation.x = Math.PI / 2;
    flier(g, x, y, z, between(0, 6.28), between(0.08, 0.2));
  }
  for (let i = 0; i < 11; i++) {
    const x = (i % 2 ? 1 : -1) * between(11, 42);
    const z = between(-155, 11);
    const y = between(8, 35);
    if (i % 3 === 0) makeCherub(x, y, z, i);
    else makeGift(x, y, z, i);
  }

  // Star points frame the highest towers. They are decorative, not collectibles.
  const stars = [];
  for (let i = 0; i < 28; i++) {
    const x = (i % 2 ? 1 : -1) * between(13, 95);
    const y = between(15, 82);
    const z = between(-170, -50);
    const star = polygon(world, i % 3 ? lightGold : windowGlow, x, y, z,
      between(0.20, 0.65), between(0.55, 1.3));
    stars.push({ star, phase: between(0, 6.28) });
  }

  let time = 0;
  let disposed = false;
  return {
    update(dt, { speed = 0, elapsed } = {}) {
      if (disposed) return;
      const step = Math.max(0, Math.min(Number(dt) || 0, 0.05));
      time += step;
      const t = Number.isFinite(elapsed) ? elapsed : time;
      const velocity = Math.max(0, Number(speed) || 0);
      // Castle remains a fixed distant landmark; clouds translate for depth.
      for (const c of drifting) {
        c.object.position.z += velocity * step * c.factor;
        if (c.object.position.z > 40) c.object.position.z -= 225;
        c.object.position.y = c.startY + Math.sin(t * c.speed + c.phase) * 1.15;
      }
      for (const f of floaters) {
        f.group.position.y = f.original.y + Math.sin(t * 1.52 + f.phase) * 1.05;
        f.group.position.x = f.original.x + Math.sin(t * f.drift + f.phase) * 1.6;
        f.group.rotation.y = Math.sin(t * 0.3 + f.phase) * 0.2;
        if (f.left) f.left.rotation.z = -0.45 - Math.sin(t * 7 + f.phase) * 0.38;
        if (f.right) f.right.rotation.z = 0.45 + Math.sin(t * 7 + f.phase) * 0.38;
      }
      // A whimsical moving clock (one revolution per 60 s).
      minuteHand.rotation.z = Math.PI * 0.22 - t * (Math.PI * 2 / 60);
      hourHand.rotation.z = -Math.PI * 0.24 - t * (Math.PI * 2 / 720);
      for (const item of stars) {
        const s = 0.8 + 0.2 * Math.sin(t * 2.1 + item.phase);
        item.star.scale.y = s;
        item.star.rotation.y += step * 0.23;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(world);
      if (scene.fog && scene.fog.isFogExp2 && scene.fog.color.getHex() === 0xe8bed0)
        scene.fog = originalFog;
      if (scene.background && scene.background.isColor && scene.background.getHex() === 0xc5b0d7)
        scene.background = originalBackground;
      const geometries = new Set();
      const materials = new Set();
      world.traverse(obj => {
        if (obj.geometry) geometries.add(obj.geometry);
        if (obj.material) {
          const list = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of list) materials.add(m);
        }
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    }
  };
}
