// SKYLARK gameplay state, intentionally independent of rendering and browser globals.
import { moveAndCollide, TILE, WIDTH, HEIGHT } from './engine.js';
import { LEVELS } from './levels.js';

const GRAVITY = 1050;
const RUN_SPEED = 96;
const JUMP_SPEED = 335;
const SOLID = '#B?=';
const intersects = (a,b) =>
  a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

export function createGame({onSfx=()=>{}}={}) {
  const state = {
    mode:'title', levelIndex:0, lives:3, coins:0, score:0, time:180,
    player:null, enemies:[], blocks:new Map(), pickups:[], cameraX:0,
    level:null, elapsed:0
  };
  function loadLevel(index) {
    const base=LEVELS[index];
    state.level={name:base.name,rows:[...base.rows],width:base.rows[0].length,height:base.rows.length};
    state.enemies=[];state.blocks=new Map();state.pickups=[];state.cameraX=0;
    let spawnX=TILE*2, spawnY=91;
    for(let y=0;y<state.level.height;y++)for(let x=0;x<state.level.width;x++) {
      const ch=base.rows[y][x];
      if(ch==='S'){spawnX=x*TILE+2;spawnY=y*TILE-5;}
      if(ch==='C')state.pickups.push({x:x*TILE+2,y:y*TILE+2,w:12,h:12,collected:false});
      if('emr'.includes(ch))state.enemies.push({x:x*TILE,y:y*TILE,w:16,h:16,vx:0,vy:0,type:({e:'beetle',m:'moth',r:'roller'})[ch],alive:true,dir:-1,grounded:false});
    }
    state.player={x:spawnX,y:spawnY,w:12,h:21,vx:0,vy:0,grounded:false,
      spawnX,spawnY,invuln:0,hurt:0,coyote:0,jumpBuffer:0,jumpHeld:false};
    state.time=180;
  }
  const tileAt=(x,y)=>state.level.rows[y]?.[x]||'.';
  const isSolid=(x,y)=>SOLID.includes(tileAt(x,y));
  function collectCoin(pickup){
    if(pickup.collected)return;
    pickup.collected=true;state.coins++;state.score+=100;onSfx('coin');
  }
  function bumpBlocks(){
    const p=state.player;
    const ty=Math.floor((p.y-1)/TILE);
    const tx0=Math.floor((p.x+1)/TILE),tx1=Math.floor((p.x+p.w-1)/TILE);
    for(let tx=tx0;tx<=tx1;tx++){
      if(tileAt(tx,ty)!=='?')continue;
      const key=tx+','+ty;
      if(state.blocks.get(key))continue;
      state.blocks.set(key,true);
      state.coins++;state.score+=150;
      onSfx('block');onSfx('coin');
    }
  }
  function hurt(reason='contact'){
    const p=state.player;
    if(state.mode!=='playing'||p.invuln>0)return;
    state.lives=Math.max(0,state.lives-1);
    onSfx(state.lives>0?'hurt':'lose');
    if(state.lives===0){state.mode='gameover';p.vx=0;return;}
    if(reason==='fall'||reason==='timeout'){
      p.x=p.spawnX;p.y=p.spawnY;p.vx=0;p.vy=0;p.grounded=false;
      p.jumpBuffer=0;p.coyote=0;
      if(reason==='timeout')state.time=180;
    }else{
      p.vy=-180;p.vx=-(Math.sign(p.vx)||1)*85;
    }
    p.invuln=1.7;p.hurt=0.28;
  }
  function flagReached(){
    state.score+=Math.ceil(state.time)*10+500;
    onSfx('win');
    if(state.levelIndex+1>=LEVELS.length){
      state.mode='won';
      return;
    }
    state.levelIndex++;
    loadLevel(state.levelIndex);
  }
  function updateEnemies(dt,previousBottom){
    const p=state.player;
    for(const e of state.enemies){
      if(!e.alive){
        e.deadTimer=Math.max(0,(e.deadTimer||0)-dt);
        if(e.deadTimer===0)e.flattened=false;
        continue;
      }
      const speed=e.type==='roller'?38:e.type==='moth'?26:24;
      const nextX=e.x+(e.dir||-1)*(e.w+3);
      const probeX=Math.floor(nextX/TILE);
      const underY=Math.floor((e.y+e.h+3)/TILE);
      const aheadY=Math.floor((e.y+e.h/2)/TILE);
      if(!isSolid(probeX,underY)||isSolid(probeX,aheadY))e.dir=-(e.dir||-1);
      e.vx=e.dir*speed;
      e.vy=Math.min(540,e.vy+GRAVITY*dt);
      moveAndCollide(e,isSolid,dt);
      if(e.x<1){e.x=1;e.dir=1;}
      if(e.x+e.w>state.level.width*TILE-1){e.x=state.level.width*TILE-e.w-1;e.dir=-1;}
      if(!intersects(p,e))continue;
      const fallingOnto=e.y+8>=previousBottom && p.vy>=0 && p.y+p.h>e.y;
      if(fallingOnto){
        e.alive=false;e.flattened=true;e.deadTimer=.5;e.vx=0;
        p.vy=-220;p.grounded=false;p.coyote=0;p.jumpBuffer=0;
        state.score+=200;onSfx('stomp');
      }else hurt('contact');
    }
  }
  function start(){if(state.mode==='title')state.mode='playing';}
  function restart(){
    state.levelIndex=0;state.lives=3;state.coins=0;state.score=0;state.elapsed=0;
    loadLevel(0);state.mode='playing';
  }
  function snapshot(){
    return Object.freeze({level:state.levelIndex+1,x:state.player.x,y:state.player.y,
      coins:state.coins,lives:state.lives,state:state.mode,mode:state.mode});
  }
  function step(input={},dt=1/60){
    if(state.mode==='title'){if(input.jumpPressed||input.jump)start();return;}
    if(input.pausePressed){if(state.mode==='paused')state.mode='playing';else if(state.mode==='playing')state.mode='paused';}
    if(state.mode==='paused'){if(input.jumpPressed)state.mode='playing';return;}
    if(state.mode==='won'||state.mode==='gameover'){if(input.jumpPressed)restart();return;}
    if(state.mode!=='playing')return;
    dt=Math.max(0,Math.min(dt,1/30));
    state.elapsed+=dt;state.time=Math.max(0,state.time-dt);
    const p=state.player;
    p.invuln=Math.max(0,p.invuln-dt);p.hurt=Math.max(0,p.hurt-dt);
    p.coyote=p.grounded?0.105:Math.max(0,p.coyote-dt);
    const held=!!input.jump;
    p.jumpBuffer=(input.jumpPressed||(held&&!p.jumpHeld))?0.15:Math.max(0,p.jumpBuffer-dt);
    if(p.jumpBuffer>0&&p.coyote>0){
      p.vy=-JUMP_SPEED;p.grounded=false;p.coyote=0;p.jumpBuffer=0;onSfx('jump');
    }
    if(!held&&p.jumpHeld&&p.vy<0)p.vy*=0.52;
    p.jumpHeld=held;
    const target=(Number(!!input.right)-Number(!!input.left))*RUN_SPEED;
    const acceleration=target===0?1400:840;
    const dv=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-p.vx));
    p.vx+=dv;
    p.vy=Math.min(580,p.vy+GRAVITY*dt);
    const previousBottom=p.y+p.h;
    const result=moveAndCollide(p,isSolid,dt);
    if(result?.hitCeiling)bumpBlocks();
    p.x=Math.max(0,Math.min(state.level.width*TILE-p.w,p.x));
    for(const coin of state.pickups)if(!coin.collected&&intersects(p,coin))collectCoin(coin);
    const maxCamera=Math.max(0,state.level.width*TILE-WIDTH);
    const desired=Math.max(0,Math.min(maxCamera,p.x-WIDTH*.36));
    state.cameraX=desired;
    updateEnemies(dt,previousBottom);
    if(p.y>HEIGHT+40){
      if(p.invuln>0){p.x=p.spawnX;p.y=p.spawnY;p.vx=0;p.vy=0;p.grounded=false;}
      else hurt('fall');
    }
    for(let ty=Math.floor(p.y/TILE);ty<=Math.floor((p.y+p.h-1)/TILE);ty++){
      for(let tx=Math.floor(p.x/TILE);tx<=Math.floor((p.x+p.w-1)/TILE);tx++){
        if(tileAt(tx,ty)==='^')hurt('spikes');
      }
    }
    if(state.time<=0)hurt('timeout');
    if(state.mode!=='playing')return;
    for(let ty=0;ty<state.level.height;ty++){
      for(let tx=Math.floor(p.x/TILE);tx<=Math.floor((p.x+p.w)/TILE);tx++){
        if(tileAt(tx,ty)==='F'&&intersects(p,{
          x:tx*TILE,y:ty*TILE-32,w:TILE,h:48
        })){flagReached();return;}
      }
    }
  }
  loadLevel(0);
  return {state,step,start,restart,snapshot};
}
