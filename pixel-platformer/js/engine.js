// SKYLARK — deterministic logical resolution and tile physics.
export const WIDTH = 256;
export const HEIGHT = 144;
export const TILE = 16;

const EPS = 1e-7;
const STEP = 1 / 60;

/**
 * Move an axis-aligned body against integer tile coordinates. The sweep checks
 * every entered row/column: a fast body cannot pass through a one-tile wall.
 * Input velocities are pixels/second; dt is in seconds.
 */
export function moveAndCollide(body, isSolid, dt) {
  const solid = (tx, ty) => !!isSolid(tx, ty);
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const dx = (Number.isFinite(body.vx) ? body.vx : 0) * seconds;
  const dy = (Number.isFinite(body.vy) ? body.vy : 0) * seconds;
  const minRow = Math.floor((body.y + EPS) / TILE);
  const maxRow = Math.floor((body.y + body.h - EPS) / TILE);
  let nextX = body.x + dx;

  if (dx > 0) {
    const first = Math.floor((body.x + body.w + EPS) / TILE);
    const last = Math.floor((nextX + body.w + EPS) / TILE);
    collisionX: for (let tx = first; tx <= last; tx++) {
      for (let ty = minRow; ty <= maxRow; ty++) {
        if (!solid(tx, ty)) continue;
        nextX = tx * TILE - body.w;
        body.vx = 0;
        break collisionX;
      }
    }
  } else if (dx < 0) {
    const first = Math.floor((body.x - EPS) / TILE);
    const last = Math.floor((nextX - EPS) / TILE);
    collisionX: for (let tx = first; tx >= last; tx--) {
      for (let ty = minRow; ty <= maxRow; ty++) {
        if (!solid(tx, ty)) continue;
        nextX = (tx + 1) * TILE;
        body.vx = 0;
        break collisionX;
      }
    }
  }
  body.x = nextX;

  const minCol = Math.floor((body.x + EPS) / TILE);
  const maxCol = Math.floor((body.x + body.w - EPS) / TILE);
  let nextY = body.y + dy;
  let hitCeiling = false;
  body.grounded = false;

  if (dy > 0) {
    const first = Math.floor((body.y + body.h + EPS) / TILE);
    const last = Math.floor((nextY + body.h + EPS) / TILE);
    collisionY: for (let ty = first; ty <= last; ty++) {
      for (let tx = minCol; tx <= maxCol; tx++) {
        if (!solid(tx, ty)) continue;
        nextY = ty * TILE - body.h;
        body.vy = 0;
        body.grounded = true;
        break collisionY;
      }
    }
  } else if (dy < 0) {
    const first = Math.floor((body.y - EPS) / TILE);
    const last = Math.floor((nextY - EPS) / TILE);
    collisionY: for (let ty = first; ty >= last; ty--) {
      for (let tx = minCol; tx <= maxCol; tx++) {
        if (!solid(tx, ty)) continue;
        nextY = (ty + 1) * TILE;
        body.vy = 0;
        hitCeiling = true;
        break collisionY;
      }
    }
  } else {
    // Retain contact when a standing body receives no vertical acceleration.
    const foot = body.y + body.h;
    if (Math.abs(foot / TILE - Math.round(foot / TILE)) < EPS) {
      const below = Math.floor((foot + EPS) / TILE);
      for (let tx = minCol; tx <= maxCol; tx++) {
        if (solid(tx, below)) { body.grounded = true; break; }
      }
    }
  }
  body.y = nextY;
  return { hitCeiling };
}

/**
 * Fixed-time simulation (60 Hz), with max 5 catch-up ticks per animation frame.
 * Render exactly once per RAF, interpolant alpha in [0,1).
 */
export function createLoop({ update, render }) {
  let running = false;
  let frameId = null;
  let previous = null;
  let accumulator = 0;

  function frame(timestamp) {
    if (!running) return;
    if (previous === null) previous = timestamp;
    const seconds = Math.max(0, Math.min(0.25, (timestamp - previous) / 1000));
    previous = timestamp;
    accumulator += seconds;
    let ticks = 0;
    // Tolerate sub-nanosecond RAF timestamp rounding near a fixed tick.
    while (running && accumulator + 1e-9 >= STEP && ticks < 5) {
      update(STEP);
      accumulator = Math.max(0, accumulator - STEP);
      ticks++;
    }
    if (!running) return;
    if (ticks === 5 && accumulator >= STEP) accumulator %= STEP;
    render(Math.min(1, Math.max(0, accumulator / STEP)));
    if (running) frameId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      previous = null;
      accumulator = 0;
      frameId = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      previous = null;
      accumulator = 0;
    }
  };
}
