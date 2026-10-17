import * as THREE from 'three';
import { createHero } from './hero.js';
import { createWorld } from './world.js';
import { createTrack } from './track.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

const LANES = [-2.2, 0, 2.2];
const PLAYER_Z = 4.2;
const params = new URLSearchParams(window.location.search);
const requestedSeed = params.get('seed');
const seed = requestedSeed === null ? 2026 : /^-?\d+$/.test(requestedSeed) ? Number(requestedSeed) : requestedSeed;
const autoFall = params.get('autotest') === 'fall';
const RECORD_KEY = 'skyBabiesBest';

function readBest() {
  try {
    const value = Number(window.localStorage.getItem(RECORD_KEY));
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(RECORD_KEY, String(Math.max(0, Math.floor(value)))); }
  catch { /* Storage can be unavailable in private or sandboxed mode. */ }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7cde2');
const camera = new THREE.PerspectiveCamera(67, 1, 0.1, 900);
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: window.devicePixelRatio <= 1.5,
  alpha: false,
  powerPreference: 'default'
});
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

let track = createTrack(scene, { seed });
const world = createWorld(scene, { seed });
const hero = createHero(scene, { seed });
hero.group.position.set(0, 0, PLAYER_Z);

let state = 'start';
let lane = 1;
let playerX = 0;
let height = 0;
let verticalVelocity = 0;
let fallTime = 0;
let fallStartHeight = 0;
let elapsed = 0;
let distance = 0;
let speed = 11.5;
let score = 0;
let best = readBest();
let savedBest = best;
let lastPublishedScore = -1;
let lastPublishedBest = -1;
let autoHoleTimer = null;
let autoOverTimer = null;
let disposed = false;
let frameId = null;

const audio = createAudio();
const ui = createUI({ onStart: handleStart, onPause: handlePause });

const gameInfo = {
  state, score, best, speed, elapsed, seed,
  get lane() { return lane; }
};
window.__game = gameInfo;

function syncState(force = false) {
  Object.assign(gameInfo, { state, score, best, speed, elapsed });
  if (force || score !== lastPublishedScore || best !== lastPublishedBest) {
    ui.updateScore(score, best);
    lastPublishedScore = score;
    lastPublishedBest = best;
  }
}

function setState(next) {
  state = next;
  syncState(true);
  ui.setState(next, { score, best });
}

function clearAutotestTimers() {
  if (autoHoleTimer !== null) clearTimeout(autoHoleTimer);
  if (autoOverTimer !== null) clearTimeout(autoOverTimer);
  autoHoleTimer = null;
  autoOverTimer = null;
}

function startGame(fromGesture = false) {
  if (disposed) return;
  clearAutotestTimers();
  if (fromGesture) audio.unlock();
  track.dispose();
  track = createTrack(scene, { seed });
  lane = 1;
  playerX = 0;
  height = 0;
  verticalVelocity = 0;
  fallTime = 0;
  fallStartHeight = 0;
  elapsed = 0;
  distance = 0;
  speed = 11.5;
  score = 0;
  best = Math.max(best, readBest());
  hero.group.visible = true;
  hero.group.position.set(0, 0, PLAYER_Z);
  hero.group.rotation.set(0, 0, 0);
  setState('running');
  if (fromGesture) audio.play('start');

  if (autoFall) {
    // Timers deliberately use wall time rather than frames so slow headless
    // software rendering still completes ?autotest=fall within seven seconds.
    autoHoleTimer = setTimeout(() => {
      if (state !== 'running') return;
      track.forceHoleAt(playerX, PLAYER_Z);
      beginFall();
    }, 1950);
  }
}

function handleStart() {
  audio.unlock();
  if (state === 'paused') {
    setState('running');
    return;
  }
  if (state === 'running' || state === 'falling') return;
  startGame(true);
}

function handlePause() {
  if (state !== 'running' && state !== 'paused') return;
  audio.unlock();
  setState(state === 'running' ? 'paused' : 'running');
}

function handleMove(direction) {
  if (state !== 'running') return;
  const nextLane = THREE.MathUtils.clamp(lane + Math.sign(direction), 0, 2);
  if (nextLane !== lane) {
    audio.unlock();
    lane = nextLane;
    audio.play('switch');
  }
}

function handleJump() {
  if (state === 'start' || state === 'gameover') {
    handleStart(); // Touch: a tap starts/restarts; thereafter taps jump.
    return;
  }
  if (state !== 'running' || height > 0.025) return;
  audio.unlock();
  verticalVelocity = 11.2;
  height = 0.03;
  audio.play('jump');
}

const input = createInput({
  onMove: handleMove,
  onJump: handleJump,
  onStart: handleStart,
  onPause: handlePause
});

function beginFall() {
  if (state !== 'running') return;
  fallStartHeight = height;
  fallTime = 0;
  verticalVelocity = 0;
  audio.play('fall');
  setState('falling');
  // A timer guarantees a deterministic terminal state even if RAF is throttled.
  if (autoFall) autoOverTimer = setTimeout(() => {
    if (state === 'falling') finishFall();
  }, 1450);
}

function finishFall() {
  if (state !== 'falling') return;
  saveBest(best);
  savedBest = best;
  audio.play('over');
  setState('gameover');
}

function updateRun(dt) {
  elapsed += dt;
  speed = Math.min(26, 11.5 + elapsed * 0.26 + Math.floor(distance / 350) * 0.85);
  distance += speed * dt;
  const nextScore = Math.floor(distance * 12);
  if (nextScore !== score) {
    score = nextScore;
    if (score > best) {
      best = score;
      if (Math.floor(best / 250) > Math.floor(savedBest / 250)) {
        saveBest(best);
        savedBest = best;
      }
    }
  }

  track.update(dt, speed);
  world.update(dt, { speed, elapsed });

  // Critically damped lane follow; collisions sample actual horizontal feet.
  const factor = 1 - Math.exp(-dt * 17);
  playerX += (LANES[lane] - playerX) * factor;
  if (Math.abs(playerX - LANES[lane]) < 0.006) playerX = LANES[lane];

  if (height > 0 || verticalVelocity > 0) {
    verticalVelocity -= 25 * dt;
    height += verticalVelocity * dt;
    if (height <= 0) {
      height = 0;
      verticalVelocity = 0;
    }
  }

  hero.group.position.set(playerX, height, PLAYER_Z);
  hero.update(dt, {
    mode: height > 0 ? 'jump' : 'run',
    speed,
    jumpPhase: height > 0 ? Math.max(0, Math.min(1, (11.2 - verticalVelocity) / 22.4)) : 0,
    fallTime: 0
  });

  // Airborne feet clear the hole; an actual hole mesh is missing beneath them.
  if (height < 1.35 && track.hasHoleAt(playerX, PLAYER_Z, 0.38)) beginFall();
  syncState();
}

function updateFall(dt) {
  fallTime += dt;
  height = fallStartHeight - 1.5 * fallTime - 12.5 * fallTime * fallTime;
  hero.group.position.set(playerX, height, PLAYER_Z);
  hero.update(dt, { mode: 'fall', speed: 0, jumpPhase: 0, fallTime });
  world.update(dt, { speed: 0, elapsed });
  if (fallTime >= 1.45) finishFall();
}

function updateCamera(dt) {
  const aspect = Math.max(0.3, window.innerWidth / Math.max(1, window.innerHeight));
  const mobile = aspect < 0.75;
  const desiredX = playerX * 0.19;
  const desiredY = mobile ? 8.55 : 7.1;
  const desiredZ = mobile ? 15.4 : 13.2;
  const ease = Math.min(1, dt * 4.6);
  camera.position.x += (desiredX - camera.position.x) * ease;
  camera.position.y += (desiredY - camera.position.y) * ease;
  camera.position.z += (desiredZ - camera.position.z) * ease;
  camera.lookAt(playerX * 0.13, mobile ? 0.0 : 0.8, mobile ? -15 : -20);
}

function resize() {
  const width = Math.max(1, canvas.clientWidth || window.innerWidth);
  const height = Math.max(1, canvas.clientHeight || window.innerHeight);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = width < 540 ? 72 : 67;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'running' && !autoFall) setState('paused');
});

function cleanup() {
  if (disposed) return;
  disposed = true;
  clearAutotestTimers();
  if (frameId !== null) cancelAnimationFrame(frameId);
  window.removeEventListener('resize', resize);
  window.removeEventListener('orientationchange', resize);
  saveBest(best);
  input.dispose();
  ui.dispose();
  audio.dispose();
  hero.dispose?.();
  world.dispose?.();
  track.dispose();
  renderer.dispose();
}
window.addEventListener('pagehide', cleanup, { once: true });

resize();
camera.position.set(0, window.innerWidth / Math.max(window.innerHeight,1) < 0.75 ? 8.55 : 7.1,
  window.innerWidth / Math.max(window.innerHeight,1) < 0.75 ? 15.4 : 13.2);
camera.lookAt(0, 0.8, -20);
hero.update(0, { mode: 'idle', speed: 0, jumpPhase: 0, fallTime: 0 });
setState('start');

let previous = performance.now();
function animate(now) {
  if (disposed) return;
  const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
  previous = now;

  if (state === 'running') updateRun(dt);
  else if (state === 'falling') updateFall(dt);
  else {
    // The world remains gently alive while starting, pausing and after a fall.
    if (state !== 'paused') world.update(dt, { speed: 0, elapsed });
    hero.update(dt, {
      mode: state === 'gameover' ? 'fall' : state === 'paused' ? 'run' : 'idle',
      speed: state === 'paused' ? speed : 0,
      jumpPhase: 0, fallTime
    });
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(animate);
}
frameId = requestAnimationFrame(animate);

if (autoFall) {
  // Deliberately no audio unlock: autoplay must not create AudioContext.
  setTimeout(() => { if (state === 'start' && !disposed) startGame(false); }, 0);
}
