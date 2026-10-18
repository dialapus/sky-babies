// SKYLARK R2: seeded, purely cosmetic Canvas2D atmosphere.
// All coordinates are logical pixels. Never mutates gameplay data.
const DEFAULT_SEED = 0x5a17c3;
const PALETTES = [
  { ray: 'rgba(255,215,166,0.16)', mist: 'rgba(201,157,178,0.16)', glint: '#ffe7a5' },
  { ray: 'rgba(182,216,255,0.12)', mist: 'rgba(139,182,224,0.14)', glint: '#e2f2ff' },
  { ray: 'rgba(172,161,236,0.10)', mist: 'rgba(105,119,168,0.17)', glint: '#d9d8ff' }
];

function stableSeed(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input | 0 : DEFAULT_SEED;
  if (typeof input !== 'string') return DEFAULT_SEED;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return h | 0;
}

/** Stateless pseudo-random number in [0, 1) for a fixed seed and integer coordinate. */
export function hashNoise(seed, x, y) {
  let h = stableSeed(seed) ^ Math.imul(Math.trunc(Number(x) || 0), 0x9e3779b1);
  h ^= Math.imul(Math.trunc(Number(y) || 0), 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function xCamera(camera) {
  if (typeof camera === 'number') return Number.isFinite(camera) ? camera : 0;
  const x = camera?.x ?? camera?.cameraX ?? camera?.offsetX ?? 0;
  return Number.isFinite(x) ? x : 0;
}

function paletteFor(index) {
  const i = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return PALETTES[Math.min(i, PALETTES.length - 1)];
}

function viewOf(opts) {
  return {
    width: Math.max(0, Math.floor(Number(opts?.width) || 0)),
    height: Math.max(0, Math.floor(Number(opts?.height) || 0)),
    camera: xCamera(opts?.camera),
    clock: Number.isFinite(opts?.clock) ? opts.clock : 0,
    palette: paletteFor(opts?.levelIndex)
  };
}

function sprite(drawAtlas, ctx, name, x, y, w, h) {
  if (typeof drawAtlas !== 'function') return false;
  try {
    // The renderer callback explicitly returns false for an absent sprite.
    return drawAtlas(ctx, name, Math.round(x), Math.round(y), w, h) !== false;
  } catch {
    // Missing or unready atlas must never stop gameplay.
    return false;
  }
}

function pixel(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawRayFallback(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + i * 3, y + i * 8, Math.max(1, 4 - i), 45 + i * 3);
  }
  ctx.restore();
}

function drawMistFallback(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 8, y + 7, 64, 3);
  ctx.fillRect(x + 1, y + 11, 89, 3);
  ctx.fillRect(x + 19, y + 15, 58, 2);
  ctx.fillRect(x + 31, y + 18, 29, 1);
}

function drawCross(ctx, x, y, size, color) {
  const r = Math.round(size);
  pixel(ctx, x - r, y, r * 2 + 1, 1, color);
  pixel(ctx, x, y - r, 1, r * 2 + 1, color);
  pixel(ctx, x, y, 1, 1, '#ffffff');
}

function drawFirefly(ctx, drawAtlas, x, y, alpha, color) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (!sprite(drawAtlas, ctx, 'aura_firefly', x - 4, y - 4, 8, 8)) {
    pixel(ctx, x, y, 1, 1, color);
    if (alpha > 0.65) pixel(ctx, x - 1, y, 3, 1, color);
  }
  ctx.restore();
}

/** Effects keep only the immutable seed; time and viewport come from render arguments. */
export function createFx({ seed = DEFAULT_SEED } = {}) {
  const basis = stableSeed(seed);

  function drawBack(ctx, options = {}) {
    if (!ctx || options.quality === 'off' || options.quality === 'low') return;
    const { width, height, camera, clock, palette } = viewOf(options);
    if (!width || !height) return;
    const drawAtlas = options.drawAtlas;
    const shifted = Math.floor(camera / 5);
    const drift = Math.floor(clock * 1.5);
    ctx.save();
    try {
      // Several distant rays: world-anchored; moving a few pixels over time.
      const spacing = 156;
      const first = Math.floor((shifted - 72) / spacing);
      const last = Math.ceil((shifted + width + 72) / spacing);
      let rays = 0;
      for (let i = first; i <= last && rays < 3; i++) {
        if (hashNoise(basis, i, 29) < 0.28) continue;
        const x = Math.round(i * spacing - shifted + (hashNoise(basis, i, 31) * 22 | 0) + (drift % 5));
        const y = 13 + (hashNoise(basis, i, 32) * 17 | 0);
        if (x < -48 || x > width) continue;
        ctx.globalAlpha = 0.42;
        if (!sprite(drawAtlas, ctx, 'atmos_ray', x, y, 48, Math.min(80, Math.max(32, height - y)))) {
          drawRayFallback(ctx, x + 12, y, palette.ray);
        }
        rays++;
      }
      // Chunked pixel mist follows terrain, with only quantized subpixel-free drift.
      const mistStride = 132;
      const hazeShift = Math.floor(camera * 0.36) - Math.floor(clock * 0.7);
      const mistFirst = Math.floor((hazeShift - 96) / mistStride);
      const mistLast = Math.ceil((hazeShift + width) / mistStride);
      ctx.globalAlpha = 0.65;
      for (let i = mistFirst; i <= mistLast; i++) {
        if (hashNoise(basis, i, 41) < 0.18) continue;
        const x = Math.round(i * mistStride - hazeShift);
        const y = Math.min(99, Math.max(38, height - 52)) + Math.round(hashNoise(basis, i, 42) * 15);
        if (!sprite(drawAtlas, ctx, 'atmos_mist', x, y, 96, 24)) {
          drawMistFallback(ctx, x, y, palette.mist);
        }
      }
    } finally {
      ctx.restore();
    }
  }

  function drawFront(ctx, options = {}) {
    const quality = options.quality;
    if (!ctx || quality === 'off') return;
    const { width, height, camera, clock, palette } = viewOf(options);
    if (!width || !height) return;
    const drawAtlas = options.drawAtlas;
    ctx.save();
    try {
      // Fixed world-space fireflies. Low quality uses one in four candidate cells.
      const stride = 47;
      const start = Math.floor((camera - 8) / stride);
      const end = Math.ceil((camera + width + 8) / stride);
      for (let col = start; col <= end; col++) {
        if (quality === 'low' && ((col % 4 + 4) % 4) >= 2) continue;
        if (hashNoise(basis, col, 71) < 0.37) continue;
        const worldX = col * stride + Math.round(hashNoise(basis, col, 72) * 28);
        const baseY = 22 + Math.round(hashNoise(basis, col, 73) * 76);
        // Quantized breathing and bounded sway, stable at a given timestamp.
        const phase = hashNoise(basis, col, 74) * Math.PI * 2;
        const sway = Math.round(Math.sin(clock * 0.8 + phase) * 2);
        const bob = Math.round(Math.sin(clock * 1.1 + phase) * 2);
        const brightness = Math.max(0.2, Math.min(0.85, 0.53 + 0.29 * Math.sin(clock * 2.6 + phase)));
        const x = Math.round(worldX - camera + sway);
        const y = baseY + bob;
        if (x < -6 || x > width + 6 || y < 8 || y > height - 8) continue;
        drawFirefly(ctx, drawAtlas, x, y, brightness, palette.glint);
      }

      // Coin sparkles are brief and sparse; no change to pickups or scoring.
      const coins = Array.isArray(options.coins) ? options.coins : [];
      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        if (!coin || coin.collected || coin.taken || coin.active === false) continue;
        const x = Number(coin.x);
        const y = Number(coin.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const screenX = Math.round(x - camera + 6);
        const screenY = Math.round(y + 5);
        if (screenX < -8 || screenX > width + 8 || screenY < 10 || screenY > height) continue;
        const phase = hashNoise(basis, Math.floor(x), Math.floor(y)) * 6.2831853;
        if (Math.sin(clock * 2.8 + phase) < 0.67) continue;
        ctx.globalAlpha = 0.7;
        drawCross(ctx, screenX + 5, screenY - 5, 2, palette.glint);
      }

      const flag = options.flag;
      if (flag && Number.isFinite(flag.x) && Number.isFinite(flag.y)) {
        const fx = Math.round(flag.x - camera);
        const fy = Math.round(flag.y);
        if (fx > -15 && fx < width + 15 && fy >= -25 && fy < height + 35) {
          const beat = Math.sin(clock * 1.7 + basis / 1031);
          if (beat > 0.45) {
            ctx.globalAlpha = Math.min(0.8, 0.3 + (beat - 0.45) * 0.8);
            drawCross(ctx, fx + 8, fy - 10, 3, palette.glint);
          }
        }
      }
    } finally {
      ctx.restore();
    }
  }

  return Object.freeze({ drawBack, drawFront });
}
