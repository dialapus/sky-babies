// SKYLARK decorative lighting layer. World objects are read-only; all positions are logical pixels.
// Rendering uses the project's existing atlas and Canvas2D only (no per-pixel frame processing).

const QUALITIES = new Set(['high', 'low', 'off']);
const PALETTES = Object.freeze([
  Object.freeze({
    ambient: '#6c527d', sky: '#d88b74',
    multiply: 'rgba(123,93,119,0.24)',
    warm: '#ffd18b', cool: '#9adbd2', hero: '#9ce0d1',
    coin: '#ffdc89', flag: '#ffe1a0'
  }),
  Object.freeze({
    ambient: '#162e55', sky: '#789fc2',
    multiply: 'rgba(55,76,122,0.37)',
    warm: '#ffd08a', cool: '#99c8e9', hero: '#93d6de',
    coin: '#ffd580', flag: '#ffe09c'
  }),
  Object.freeze({
    ambient: '#10162d', sky: '#484d77',
    multiply: 'rgba(37,43,83,0.51)',
    warm: '#ffcb80', cool: '#a4b7ed', hero: '#9cdbda',
    coin: '#ffe19b', flag: '#ffe6a8'
  })
]);

/** Returns the normalized quality; unknown settings default to 'high'. */
export function selectQuality(input) {
  let requested = input;
  if (typeof input === 'string') {
    const string = input.trim().toLowerCase();
    if (QUALITIES.has(string)) return string;
    if (string.includes('light=') || string.startsWith('?')) {
      requested = new URLSearchParams(string.replace(/^.*\?/, '')).get('light');
    }
  } else if (input && typeof input.get === 'function') {
    requested = input.get('light');
  } else if (input && typeof input === 'object') {
    requested = input.light ?? input.quality;
  }
  const normalized = typeof requested === 'string' ? requested.trim().toLowerCase() : '';
  return QUALITIES.has(normalized) ? normalized : 'high';
}

/** Immutable colors for level 0 (sunset), 1 (moonlit), 2 (deep cave). */
export function levelLightPalette(levelIndex = 0) {
  const index = Number.isFinite(Number(levelIndex)) ? Math.trunc(Number(levelIndex)) : 0;
  return PALETTES[Math.max(0, Math.min(2, index))];
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positionX(camera) {
  return typeof camera === 'number'
    ? finite(camera)
    : finite(camera?.x ?? camera?.cameraX);
}

function createLayer(width, height, tint) {
  const Offscreen = typeof globalThis !== 'undefined' ? globalThis.OffscreenCanvas : null;
  let canvas = null;
  const w = Math.max(1, Math.ceil(width / 2));
  const h = Math.max(1, Math.ceil(height / 2));
  try {
    if (typeof Offscreen === 'function') canvas = new Offscreen(w, h);
    else if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
    }
    const layer = canvas?.getContext?.('2d', {alpha:true});
    if (!layer) return null;
    layer.clearRect(0, 0, w, h);
    layer.fillStyle = tint;
    layer.fillRect(0, 0, w, h);
    return canvas;
  } catch {
    return null;
  }
}

/** Draw a small stepped, checker-dither fallback only when an atlas aura is unavailable. */
function ditherHalo(ctx, cx, cy, diameter, color) {
  const radius = Math.max(4, diameter / 2);
  const step = 5;
  ctx.fillStyle = color;
  for (let gy = -radius; gy <= radius; gy += step) {
    for (let gx = -radius; gx <= radius; gx += step) {
      const distance = Math.abs(gx) / radius * 0.8 + Math.abs(gy) / radius * 0.8;
      if (distance >= 1.15) continue;
      const checker = (Math.floor(gx / step) + Math.floor(gy / step)) & 1;
      if (distance > 0.75 && checker) continue;
      ctx.globalAlpha = distance < 0.35 ? 0.18 : distance < 0.7 ? 0.10 : 0.055;
      ctx.fillRect(Math.round(cx + gx), Math.round(cy + gy), distance < 0.6 ? 4 : 2, distance < 0.6 ? 4 : 2);
    }
  }
  ctx.globalAlpha = 0.22;
  ctx.fillRect(Math.round(cx - 3), Math.round(cy - 3), 6, 6);
}

/** Callback returns false for a missing name; undefined is accepted as successful draw. */
function atlasHalo(ctx, drawAtlas, name, cx, cy, width, height, fallbackColor, opacity) {
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = opacity;
    let found = false;
    if (typeof drawAtlas === 'function') {
      try {
        found = drawAtlas(
          ctx, name, Math.round(cx - width / 2), Math.round(cy - height / 2),
          Math.round(width), Math.round(height)
        ) !== false;
      } catch {
        found = false;
      }
    }
    if (!found) ditherHalo(ctx, cx, cy, Math.max(width, height), fallbackColor);
  } finally {
    ctx.restore();
  }
}

function lampFloor(ctx, cx, cy, color, strength) {
  // Three short luminous bands create a pixel-art pool rather than a smooth gradient.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  for (let band = 0; band < 3; band++) {
    const halfWidth = (24 - band * 5) * strength;
    const offset = band * 3;
    ctx.globalAlpha = 0.038 - band * 0.009;
    ctx.fillRect(Math.round(cx - halfWidth), Math.round(cy + offset),
      Math.round(halfWidth * 2), 2);
  }
  ctx.restore();
}

/**
 * @param {object} options
 * @param {(ctx:CanvasRenderingContext2D,name:string,x:number,y:number,w?:number,h?:number)=>boolean|void} options.drawAtlas
 * @param {'high'|'low'|'off'} options.quality
 */
export function createLighting({drawAtlas, quality = 'high'} = {}) {
  let activeQuality = selectQuality(quality);
  let cache = null;
  let frameTotal = 0;
  const frameTimes = [];
  let measuredFps = 60;

  function drawAmbient(ctx, width, height, levelIndex) {
    const palette = levelLightPalette(levelIndex);
    const cacheKey = width + 'x' + height + ':' + Math.max(0, Math.min(2, Math.trunc(finite(levelIndex))));
    if (!cache || cache.key !== cacheKey) {
      cache = {
        key: cacheKey,
        canvas: createLayer(width, height, palette.multiply),
      };
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = activeQuality === 'low' ? 0.64 : 1;
    ctx.imageSmoothingEnabled = false;
    if (cache.canvas) ctx.drawImage(cache.canvas, 0, 0, width, height);
    else {
      ctx.fillStyle = palette.multiply;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function render(ctx, {
    width = 256, height = 144, levelIndex = 0, camera = 0,
    hero = null, lamps = [], coins = [], flag = null, clock = 0
  } = {}) {
    if (activeQuality === 'off' || !ctx) return;
    const w = Math.max(1, Math.floor(finite(width, 256)));
    const h = Math.max(1, Math.floor(finite(height, 144)));
    const scroll = positionX(camera);
    const high = activeQuality === 'high';
    const palette = levelLightPalette(levelIndex);
    const phase = Math.floor(finite(clock) * 8);
    const breathing = 1 + ((phase % 5) - 2) * 0.024;

    ctx.save();
    try {
      drawAmbient(ctx, w, h, levelIndex);
      const lampLimit = high ? 14 : 8;
      let lampsDrawn = 0;
      for (const lamp of Array.isArray(lamps) ? lamps : []) {
        if (!lamp || lampsDrawn >= lampLimit) break;
        const worldX = Number(lamp.x), worldY = Number(lamp.y);
        if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) continue;
        const lx = Math.round(worldX - scroll), ly = Math.round(worldY);
        if (lx < -60 || lx > w + 60 || ly < -65 || ly > h + 65) continue;
        const cool = lamp.color === 'cool';
        const tint = cool ? palette.cool : palette.warm;
        const atlas = cool ? 'lantern_glow_cool' : 'lantern_glow_warm';
        atlasHalo(ctx, drawAtlas, atlas, lx, ly,
          high ? 96 : 66, high ? 88 : 62, tint,
          (high ? 0.48 : 0.38) * breathing);
        if (high) atlasHalo(ctx, drawAtlas, atlas, lx, ly,
          48, 48, tint, 0.37);
        if (lamp.kind !== 'hanging' && high) lampFloor(ctx, lx, ly + 23, tint, 1);
        lampsDrawn++;
      }

      if (hero && Number.isFinite(Number(hero.x)) && Number.isFinite(Number(hero.y))) {
        const x = finite(hero.x) - scroll + finite(hero.w, 12) / 2;
        const y = finite(hero.y) + finite(hero.h, 18) / 2;
        if (x > -42 && x < w + 42) {
          atlasHalo(ctx, drawAtlas, 'aura_hero', x, y,
            high ? 56 : 42, high ? 56 : 42, palette.hero,
            high ? 0.42 * breathing : 0.27);
        }
      }

      let count = 0;
      for (const coin of Array.isArray(coins) ? coins : []) {
        if (!coin || coin.collected || coin.taken || coin.active === false) continue;
        const x = Number(coin.x), y = Number(coin.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const cx = x - scroll + 6, cy = y + 6;
        if (cx < -25 || cx > w + 25 || cy < -25 || cy > h + 25) continue;
        atlasHalo(ctx, drawAtlas, 'aura_coin', cx, cy,
          high ? 36 : 27, high ? 36 : 27, palette.coin,
          high ? 0.42 : 0.24);
        if (++count >= (high ? 18 : 8)) break;
      }

      if (flag && Number.isFinite(Number(flag.x)) && Number.isFinite(Number(flag.y))) {
        const x = finite(flag.x) - scroll + 8;
        const y = finite(flag.y) - 13;
        if (x > -48 && x < w + 48) {
          atlasHalo(ctx, drawAtlas, 'aura_flag', x, y,
            high ? 64 : 44, high ? 64 : 44, palette.flag,
            high ? 0.54 : 0.32);
        }
      }
    } finally {
      ctx.restore();
    }
  }

  function noteFrame(ms) {
    const elapsed = Number(ms);
    // Hidden-tab or first-frame pauses aren't evidence of a slow GPU.
    if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > 250) return measuredFps;
    frameTimes.push(elapsed);
    frameTotal += elapsed;
    while (frameTimes.length > 1 && frameTotal - frameTimes[0] >= 2000) {
      frameTotal -= frameTimes.shift();
    }
    const average = frameTotal / frameTimes.length;
    measuredFps = Math.round(1000 / average);
    if (activeQuality === 'high' && frameTotal >= 1900 && average > 22) {
      activeQuality = 'low';
    }
    return measuredFps;
  }

  function setQuality(value) {
    activeQuality = selectQuality(value);
    frameTimes.length = 0;
    frameTotal = 0;
    return activeQuality;
  }

  return {
    render,
    noteFrame,
    setQuality,
    get quality() { return activeQuality; },
    get fps() { return measuredFps; },
  };
}
