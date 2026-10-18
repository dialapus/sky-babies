// SKYLARK main: original 256x144 Canvas2D renderer, same-origin sprites only.
import { WIDTH, HEIGHT, TILE, createLoop } from './engine.js';
import { createInput } from './input.js';
import { createGame } from './gameplay.js';
import { createAudio } from './audio.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha:false });
ctx.imageSmoothingEnabled = false;
const uiStatus = document.querySelector('#status');
const soundStatus = document.querySelector('#sound-status');
const audio = createAudio();
const game = createGame({ onSfx: name => audio.play(name) });
const controls = createInput(canvas);
const resources = { atlas:null, image:null, title:null, sky:null, hills:null, clouds:null };
const mainPalette = {
  ink:'#14243d', night:'#293d65', mid:'#507994', cyan:'#89c6bc',
  ground:'#3e7c72', moss:'#80c5a0', gold:'#eec47d', pale:'#fff2d5',
  rose:'#f19e83', shadow:'#151e36'
};
let gameClock=0, lastMode='', highScore=0, didAutotest=false;
const autotest = new URLSearchParams(location.search).has('autotest');
const debug = {result:null};

// Persist a high score only: never store personal data or game state.
try { highScore = Number(localStorage.getItem('pxl-platformer.v1')) || 0; } catch {}

function bitmap(path) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = './assets/' + path;
  });
}
async function loadAssets() {
  const list = await Promise.all([
    fetch('./assets/atlas.json').then(r=>r.ok?r.json():null).catch(()=>null),
    bitmap('atlas.png'), bitmap('title.png'),
    bitmap('bg_sky.png'), bitmap('bg_hills.png'), bitmap('bg_clouds.png')
  ]);
  [resources.atlas, resources.image, resources.title, resources.sky, resources.hills, resources.clouds] = list;
}
function sprite(name,x,y,flip=false,w,h) {
  const source=resources.atlas?.frames?.[name]?.frame;
  const image=resources.image;
  if (!source || !image) return false;
  const dx=Math.round(x), dy=Math.round(y);
  const dw=w||source.w, dh=h||source.h;
  if(flip) {
    ctx.save();
    ctx.translate(dx+dw,0);
    ctx.scale(-1,1);
    ctx.drawImage(image,source.x,source.y,source.w,source.h,0,dy,dw,dh);
    ctx.restore();
  } else ctx.drawImage(image,source.x,source.y,source.w,source.h,dx,dy,dw,dh);
  return true;
}
function fallback(x,y,w,h,color) {
  ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);
}
function label(msg,x,y,{size=7,color=mainPalette.pale,align='left',shadow=true}={}) {
  ctx.font='bold '+size+'px monospace';
  ctx.textAlign=align;
  ctx.textBaseline='top';
  if(shadow){ctx.fillStyle=mainPalette.shadow;ctx.fillText(msg,x+1,y+1)}
  ctx.fillStyle=color;
  ctx.fillText(msg,x,y);
}
function background(camera=0) {
  const grd=ctx.createLinearGradient(0,0,0,HEIGHT);
  grd.addColorStop(0,'#213552');grd.addColorStop(.6,'#72678d');grd.addColorStop(1,'#b49b96');
  ctx.fillStyle=grd;ctx.fillRect(0,0,WIDTH,HEIGHT);
  if(resources.sky) ctx.drawImage(resources.sky,0,0);
  function repeat(im,ratio) {
    if(!im)return;
    const shift=-Math.floor(camera*ratio)%WIDTH;
    const x=shift>0?shift-WIDTH:shift;
    ctx.drawImage(im,x,0);
    ctx.drawImage(im,x+WIDTH,0);
    if(x<-WIDTH)ctx.drawImage(im,x+WIDTH*2,0);
  }
  repeat(resources.clouds,.1);repeat(resources.hills,.26);
}
function rowArray(level) {
  if (Array.isArray(level?.rows))return level.rows;
  if (Array.isArray(level?.grid))return level.grid;
  return [];
}
function drawTiles(state,camera) {
  const rows=rowArray(state.level);
  const startCol=Math.max(0,Math.floor(camera/TILE));
  const endCol=startCol+Math.ceil(WIDTH/TILE)+2;
  for (let y=0;y<rows.length;y++) {
    const row=rows[y]||'';
    for (let x=startCol;x<Math.min(row.length,endCol);x++){
      const ch=row[x];
      let id;
      switch(ch) {
        case '#':id='tile_ground';break;
        case 'B':id='tile_brick';break;
        case '?':id='tile_block_full';break;
        case '=':id='tile_platform';break;
        case '^':id='tile_spike';break;
        case 'd':id='tile_decor';break;
        default: continue;
      }
      const key=x+','+y;
      if(ch==='?' && (state.blocks?.has?.(key)||state.blocks?.[key]===true || state.blocks?.get?.(key)===true)) id='tile_block_empty';
      const sx=x*TILE-camera, sy=y*TILE;
      if(!sprite(id,sx,sy))fallback(sx,sy,16,ch==='#'?16:12,ch==='#'?mainPalette.ground:mainPalette.gold);
    }
  }
  // Coins: render from explicitly tracked pickups, or static map.
  if(Array.isArray(state.pickups)) {
    for(const coin of state.pickups) {
      if(coin.collected||coin.taken||coin.active===false)continue;
      const sx=(coin.x??0)-camera, sy=coin.y??0;
      if(sx>-20&&sx<WIDTH+20&&!sprite('tile_coin_'+(Math.floor(gameClock*8)%4),sx,sy))
        if(!sprite('tile_coin_0',sx,sy))fallback(sx+3,sy+3,8,8,mainPalette.gold);
    }
  } else {
    for(let y=0;y<rows.length;y++)for(let x=startCol;x<Math.min((rows[y]||'').length,endCol);x++){
      if(rows[y][x]!=='C')continue;
      const key=x+','+y;
      if(state.collected?.has?.(key)||state.collected?.[key])continue;
      const sx=x*TILE+2-camera,sy=y*TILE+2;
      if(!sprite('tile_coin_'+(Math.floor(gameClock*8)%4),sx,sy))
        if(!sprite('tile_coin_0',sx,sy))fallback(sx,sy,11,11,mainPalette.gold);
    }
  }
  // Flag: marker is one cell at any level height; draw from marker's row to above.
  for(let y=0;y<rows.length;y++)for(let x=startCol;x<Math.min((rows[y]||'').length,endCol);x++){
    if(rows[y][x]==='F') {
      const sx=x*TILE-camera, sy=y*TILE-32;
      if(!sprite('tile_finish',sx,sy)) { fallback(sx,sy,3,48,mainPalette.gold);fallback(sx+4,sy+3,12,12,mainPalette.moss); }
    }
  }
}
function drawEnemies(state,camera) {
  for(const e of (state.enemies||[])) {
    if(e.alive===false && !e.flattened && !e.squashed && !(e.deadTimer>0))continue;
    const x=Math.round(e.x-camera),y=Math.round(e.y);
    if(x<-24||x>WIDTH+16)continue;
    const type=(e.type||'beetle').replace(/^enemy_/,'').replace(/_walk$/,'');
    const squashed=e.flattened||e.squashed||e.alive===false;
    const frame=Math.floor(gameClock*8)%4;
    const id=squashed?'enemy_'+type+'_flat':'enemy_'+type+'_walk_'+frame;
    if(!sprite(id,x,y,(e.vx||e.dir||1)<0))
      if(!sprite(squashed?'enemy_beetle_flat':'enemy_beetle_walk_0',x,y))
        fallback(x,y,16,16,mainPalette.rose);
  }
}
function drawPlayer(state,camera) {
  const p=state.player;
  if(!p)return;
  if(p.invuln>0 && Math.floor(gameClock*12)%2===0)return;
  const x=p.x-camera-2,y=p.y-3;
  const frame=Math.floor(gameClock*10)%4;
  let id=!p.grounded?'hero_jump':Math.abs(p.vx||0)>8?'hero_run_'+frame:'hero_idle';
  if((p.hurt||0)>0)id='hero_hurt';
  if(!sprite(id,x,y,p.vx<-1))
    if(!sprite('hero_idle',x,y,p.vx<-1))fallback(x,y,16,24,mainPalette.moss);
}
function drawHUD(state) {
  fallback(0,0,WIDTH,15,'#172a44');
  ctx.fillStyle='#3a5b6a';ctx.fillRect(0,14,WIDTH,1);
  sprite('ui_heart',5,3)||fallback(5,4,8,7,mainPalette.rose);
  label('x'+Math.max(0,state.lives??3),18,4,{size:7});
  sprite('ui_coin',50,3)||fallback(50,4,8,8,mainPalette.gold);
  label('x'+(state.coins||0).toString().padStart(2,'0'),62,4,{size:7});
  sprite('ui_clock',104,3)||fallback(105,4,8,8,mainPalette.gold);
  label(String(Math.ceil(state.time??180)).padStart(3,'0'),116,4,{size:7});
  label('ZONE '+((state.levelIndex||0)+1),WIDTH-7,4,{size:7,align:'right',color:'#f8db9a'});
}
function dimmer(alpha=.7) {ctx.fillStyle='rgba(11,20,35,'+alpha+')';ctx.fillRect(0,0,WIDTH,HEIGHT)}
function menu(state) {
  if(state.mode==='playing')return;
  if(state.mode==='title') {
    if(resources.title) ctx.drawImage(resources.title,0,0,WIDTH,HEIGHT);
    else {
      dimmer(.48);
      sprite('ui_logo',40,19)||label('SKYLARK',128,29,{size:20,align:'center',color:mainPalette.gold});
      label('THE LANTERN TRAIL',128,62,{align:'center',size:9});
      label('JUMP / TAP TO START',128,123,{align:'center',size:8,color:mainPalette.gold});
    }
    return;
  }
  dimmer(.78);
  const isWon=state.mode==='won';
  const title=state.mode==='paused'?'PAUSED':isWon?'TRAIL COMPLETE!':'NO LIVES LEFT';
  const sub=state.mode==='paused'?'P / ESC TO RESUME':isWon?'THE LANTERNS ARE LIT':'TRY THE TRAIL AGAIN';
  label(title,128,43,{size:state.mode==='paused'?16:13,align:'center',color:mainPalette.gold});
  label(sub,128,73,{size:8,align:'center'});
  label('JUMP / TAP TO '+(state.mode==='paused'?'CONTINUE':'RESTART'),128,104,{size:8,align:'center',color:mainPalette.rose});
  if(isWon)label('SCORE '+(state.score||0),128,90,{size:8,align:'center'});
}
function render() {
  ctx.imageSmoothingEnabled=false;
  const state=game.state||{};
  const rows=rowArray(state.level);
  const maxX=Math.max(0,(rows[0]?.length||16)*16-WIDTH);
  const desired=(state.player?.x||0)-WIDTH*.35;
  const camera=Math.max(0,Math.min(maxX,state.cameraX??desired));
  background(camera);
  if(state.level) {
    drawTiles(state,camera);
    drawEnemies(state,camera);
    drawPlayer(state,camera);
  }
  if(state.mode!=='title')drawHUD(state);
  menu(state);
  const displayed=state.mode?.toUpperCase()||'LOADING';
  if(displayed!==lastMode) {lastMode=displayed;if(uiStatus)uiStatus.textContent=displayed;}
}
function snapshot() {
  // Stable read-only telemetry; never expose a mutable game object.
  const raw=game.snapshot?.()||{};
  return Object.freeze({
    level:raw.level??(game.state.levelIndex||0)+1,
    x:raw.x??game.state.player?.x??0,
    y:raw.y??game.state.player?.y??0,
    coins:raw.coins??game.state.coins??0,
    lives:raw.lives??game.state.lives??0,
    state:raw.state??game.state.mode,
    mode:game.state.mode,
    time:game.state.time??0
  });
}
Object.defineProperty(window,'__PLATFORMER__',{configurable:false,writable:false,value:Object.freeze({
  snapshot,
  get result(){return debug.result},
  get ready(){return !!resources.atlas},
})});
function autopilotInput() {
  const s=game.state,p=s.player||{};
  const rows=rowArray(s.level);
  const tx=Math.floor(((p.x||0)+12)/16);
  const ty=Math.floor(((p.y||0)+18)/16);
  const ahead=rows[ty]?.[tx+1]||'.';
  const below=rows[ty+1]?.[tx+1]||'.';
  const groundAhead='#B?='.includes(below);
  const obstacle='#B?='.includes(ahead);
  const occasional=(Math.floor(gameClock*1.2)%6===0);
  // Prefer straightforward movement; jump over obstacles and pits.
  const jump=obstacle||(!groundAhead && p.grounded)||occasionaLOrJump(p,occasional);
  return {left:false,right:true,jump,jumpPressed:jump,pausePressed:false};
}
function occasionaLOrJump(p,occasional) {return !!(occasional && p.grounded);}
let testStarted=0, initialLevel=0, testRespawns=0;
function update(_input,dt) {
  gameClock+=dt;
  let input=_input;
  if(autotest) {
    if(!testStarted) {
      game.start();
      testStarted=performance.now();initialLevel=game.state.levelIndex||0;
    }
    input=autopilotInput();
  }
  game.step(input,dt);
  if(game.state.mode==='won' && (game.state.score||0)>highScore) {
    highScore=game.state.score||0;
    try{localStorage.setItem('pxl-platformer.v1',String(highScore))}catch{}
  }
  if(autotest&&!debug.result) {
    if((game.state.levelIndex||0)>initialLevel || game.state.mode==='won') {
      debug.result={status:'passed',detail:'Reached level 1 flag',snapshot:snapshot(),elapsedSeconds:Math.round((performance.now()-testStarted)/1000)};
    } else if(game.state.mode==='gameover'&&testRespawns++<2) {
      game.restart();initialLevel=game.state.levelIndex||0;
    } else if(performance.now()-testStarted>35000) {
      debug.result={status:'failed',detail:'Autotest timeout before level 1 flag',snapshot:snapshot()};
    }
  }
}
function ensureSound() {
  audio.resume();
  if(soundStatus)soundStatus.textContent='♪ ON';
}
document.addEventListener('pointerdown',ensureSound,{once:true});
document.addEventListener('keydown',ensureSound,{once:true});
canvas.addEventListener('pointerdown',()=>{
  canvas.focus();
  if(game.state.mode==='title')game.start();
  else if(game.state.mode==='won'||game.state.mode==='gameover')game.restart();
});
document.querySelector('#pause')?.addEventListener('click',()=>{
  ensureSound();
  game.step({left:false,right:false,jump:false,jumpPressed:false,pausePressed:true},1/60);
});
document.querySelector('#jump')?.addEventListener('click',()=>{
  if(game.state.mode==='title')game.start();
  else if(['won','gameover'].includes(game.state.mode))game.restart();
});
await loadAssets();
render();
// Keep internal logical resolution 256x144, letterbox by CSS: crisp sprite pixels.
const loop=createLoop({update:(dt)=>update(controls.read(),dt),render});
loop.start();
