import * as THREE from 'three';
import { CFG, rng } from './core.js';

const G = {
  sphere: new THREE.SphereGeometry(1, 12, 8), puff: new THREE.SphereGeometry(1, 8, 5), lowSphere: new THREE.IcosahedronGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 12), torus: new THREE.TorusGeometry(1, .12, 6, 24),
  circle: new THREE.CircleGeometry(1, 24), hair: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI*2, 0, Math.PI*.40),
};
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: 0, ...extra }); }
const M = {
  cream: mat('#fff4df'), cloud: mat('#fff8ef'), pinkCloud: mat('#ebc7da'), gold: mat('#e6b85e', { metalness:.3, roughness:.45 }),
  darkGold: mat('#b78a43'), wall: mat('#f4e6ec'), lilac: mat('#c9b1d9'), roof: mat('#d4a9d9'),
  window: mat('#ffe9a9', { emissive:'#ffd688', emissiveIntensity:.4 }), skin: mat('#efb18a'), blush:mat('#ec9594'),
  hair: mat('#513126'), hairLight:mat('#69402e'), eyes:mat('#38262b'), mouth:mat('#852e46'), pink:mat('#ed96bc'),
  pinkDark:mat('#ce77a1'), blue:mat('#8bbbd9'), navy:mat('#527aa0'), white:mat('#fff7ed'), giftPink:mat('#ef88b6'),
  glass: new THREE.MeshPhongMaterial({ color:'#b5daed', transparent:true, opacity:.37, shininess:65, depthWrite:false, side:THREE.DoubleSide }),
  wheel: mat('#766b8d'), envelope:mat('#f5aed0'), plum:mat('#8e669f')
};
function mesh(parent, geo, material, x=0, y=0, z=0, sx=1, sy=sx, sz=sx) {
  const o = new THREE.Mesh(typeof geo === 'string' ? G[geo] : geo, material);
  o.position.set(x,y,z); o.scale.set(sx,sy,sz); parent.add(o); return o;
}
function group(parent, x=0,y=0,z=0) { const g = new THREE.Group(); g.position.set(x,y,z); if(parent) parent.add(g); return g; }
function wing(parent, side, scale=1) {
  const w = group(parent, side*.36, 1.23, -.19); w.scale.setScalar(scale);
  for(let i=0;i<4;i++) {
    const p = mesh(w,'sphere',M.white,side*(.18+i*.16),.06+i*.16,0,.22,.4-i*.035,.09);
    p.rotation.z=side*(-.65-i*.11);
  }
  return w;
}

/** Merge rigid decorative meshes by material, keeping draw calls low without addons. */
function mergeRigid(root) {
  root.updateMatrixWorld(true); const buckets = new Map();
  root.traverse(o => {
    if(!o.isMesh) return;
    const src=o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); src.applyMatrix4(o.matrixWorld);
    if(!buckets.has(o.material)) buckets.set(o.material,[]); buckets.get(o.material).push(src);
  });
  const out=new THREE.Group();
  for(const [material, list] of buckets) {
    const geo=new THREE.BufferGeometry();
    for(const key of ['position','normal']) {
      const size=list.reduce((s,g)=>s+g.attributes[key].array.length,0), data=new Float32Array(size); let i=0;
      for(const g of list){data.set(g.attributes[key].array,i);i+=g.attributes[key].array.length;}
      geo.setAttribute(key,new THREE.BufferAttribute(data,3));
    }
    geo.computeBoundingSphere(); out.add(new THREE.Mesh(geo,material)); list.forEach(g=>g.dispose());
  }
  return out;
}

export function createBaby() {
  const root=group(), rig=group(root), suit=mat('#ec8fb6');
  mesh(rig,'sphere',suit,0,.84,0,.43,.56,.32);
  mesh(rig,'sphere',suit,0,.53,0,.38,.29,.31);
  const hood=mesh(rig,'torus',suit,0,1.18,-.04,.3,.3,.3); hood.rotation.x=Math.PI/2;
  mesh(rig,'box',M.cream,0,.92,.31,.027,.48,.028);
  for(let i=0;i<3;i++) mesh(rig,'sphere',M.cream,.065,1.04-i*.16,.324,.025);
  // Small embroidered heart, on the chest AND back so it stays visible while running.
  for(const z of [-.323,.329]) {
    mesh(rig,'sphere',M.cream,-.054,1.005,z,.077,.077,.013);
    mesh(rig,'sphere',M.cream,.054,1.005,z,.077,.077,.013);
    const tip=mesh(rig,'cone',M.cream,0,.93,z,.117,.16,.013);tip.rotation.z=Math.PI;
  }
  const head=group(rig,0,1.64,0);
  mesh(head,'sphere',M.skin,0,0,.04,.59,.61,.55);
  mesh(head,'sphere',M.skin,-.57,-.04,.045,.115,.15,.105);mesh(head,'sphere',M.skin,.57,-.04,.045,.115,.15,.105);
  mesh(head,'sphere',M.hair,0,.1,-.22,.61,.55,.39);
  mesh(head,'hair',M.hair,0,.025,.045,.638,.65,.615);
  for(let i=0;i<4;i++) {const h=mesh(head,'sphere',i%2?M.hair:M.hairLight,-.32+i*.18,.38-i*.035,.46,.17,.085,.20);h.rotation.z=-.45;h.rotation.y=-.35;}
  mesh(head,'sphere',M.hair,.17,.52,-.38,.23,.24,.2);
  mesh(head,'sphere',M.hair,.19,.69,-.37,.11,.22,.1).rotation.z=-.27;
  for(const side of [-1,1]) {
    const bow=mesh(head,'sphere',M.pink,side*.16+.13,.67,-.17,.19,.13,.085);bow.rotation.z=side*.3;
    mesh(head,'sphere',M.eyes,side*.22,-.005,.552,.085,.105,.032);
    mesh(head,'sphere',M.white,side*.22-.023,.035,.580,.025,.031,.013);
    mesh(head,'sphere',M.blush,side*.37,-.20,.484,.105,.060,.024);
    mesh(head,'sphere',M.hair,side*.23,.14,.558,.076,.013,.012).rotation.z=side*-.10;
  }
  mesh(head,'sphere',M.pinkDark,.13,.67,-.16,.07,.09,.09);
  mesh(head,'sphere',M.skin,0,-.14,.602,.09,.08,.07);
  const smile=new THREE.Shape();smile.moveTo(-.16,0);smile.quadraticCurveTo(0,-.04,.16,0);smile.quadraticCurveTo(.10,-.14,0,-.15);smile.quadraticCurveTo(-.11,-.14,-.16,0);
  mesh(head,new THREE.ShapeGeometry(smile),M.mouth,0,-.22,.580);
  mesh(head,'sphere',M.blush,0,-.335,.591,.071,.023,.010);
  mesh(head,'sphere',M.white,0,-.252,.592,.093,.017,.012);
  const arms=[],legs=[];
  for(const side of [-1,1]) {
    const a=group(rig,side*.39,1.11,0); a.rotation.z=side*.10;
    mesh(a,'sphere',suit,side*.025,-.17,0,.145,.245,.155);
    mesh(a,'sphere',M.skin,side*.044,-.405,.015,.13,.14,.12);arms.push(a);
    const l=group(rig,side*.2,.49,0);
    mesh(l,'sphere',suit,0,-.14,0,.18,.25,.19);
    mesh(l,'sphere',suit,0,-.355,.075,.19,.12,.24);
    mesh(l,'sphere',M.cream,0,-.421,.08,.185,.038,.229);legs.push(l);
  }
  const wings=[wing(rig,-1),wing(rig,1)];wings.forEach(w=>w.visible=false);
  const halo=mesh(rig,'torus',M.gold,0,2.52,0,.37,.37,.37);halo.rotation.x=Math.PI/2;halo.visible=false;
  const shadowMat=new THREE.MeshBasicMaterial({color:'#9f79a9',transparent:true,opacity:.12,depthWrite:false});
  const shadow=mesh(root,'circle',shadowMat,0,.075,0,.45,.32,.45);shadow.rotation.x=-Math.PI/2;
  root.userData={rig,head,arms,legs,wings,halo,suit,shadow}; return root;
}

export function animateBaby(baby, model, t, menu=false) {
  const {rig,head,arms,legs,wings,halo,shadow}=baby.userData;
  const sliding=!menu&&model.slide>0&&model.y<.3, flying=!menu&&model.wings>0;
  const falling=model.state==='falling', running=model.state==='running';
  const phase=t*(menu?2:Math.min(17,model.speed*.9)), bounce=menu?Math.sin(t*2.3)*.035:running&&model.y===0&&!sliding?Math.abs(Math.sin(phase))*.055:0;
  rig.position.y=(menu?0:model.y)+bounce+(sliding?.1:0);
  rig.rotation.x=sliding?1.31:falling?-.35:0;
  rig.rotation.z=falling?Math.sin(t*13)*.2:menu?Math.sin(t*1.6)*.02:-(model.lane-1-model.x/CFG.laneWidth)*.12;
  head.rotation.y=menu?Math.sin(t*.7)*.12:0;head.rotation.x=flying?-.1:0;
  for(let i=0;i<2;i++) {
    const side=i===0?-1:1;
    legs[i].rotation.x=sliding?.12:flying?-.25+Math.sin(t*6+i)*.12:falling?side*.5:menu?0:Math.sin(phase+i*Math.PI)*.59;
    arms[i].rotation.x=sliding?-1.35:flying?-1.2:falling?-2.2:menu?-.14:Math.sin(phase+i*Math.PI+Math.PI)*.6;
    arms[i].rotation.z=side*(flying?-.7:falling?-.9:menu?.15:.1);
    wings[i].visible=flying;wings[i].rotation.y=side*(.35+Math.sin(t*11)*.3);
  }
  halo.visible=flying;halo.position.y=2.52+Math.sin(t*4)*.06;
  shadow.visible=!falling;shadow.scale.setScalar(1/(1+model.y*.3));
  if(!menu&&model.invulnerable>0) rig.visible=Math.sin(t*35)>-.25;else rig.visible=true;
}

function tower(parent,x,z,height,radius,roofMaterial=M.gold) {
  mesh(parent,'cylinder',M.wall,x,height/2,z,radius,height,radius);
  mesh(parent,'cylinder',M.cream,x,.8,z,radius*1.16,.6,radius*1.16);
  for(const y of [height*.34,height*.69,height-.2]) mesh(parent,'cylinder',M.gold,x,y,z,radius*1.05,.17,radius*1.05);
  mesh(parent,'sphere',roofMaterial,x,height+.9,z,radius*1.25,radius*1.1,radius*1.25);
  mesh(parent,'cone',M.gold,x,height+radius*1.65,z,radius*.23,radius*1.6,radius*.23);
  mesh(parent,'sphere',M.gold,x,height+radius*2.45,z,radius*.18);
  for(const y of [height*.26,height*.52,height*.8]) {
    mesh(parent,'box',M.window,x,y,z+radius*.986,radius*.38,height*.13,.045);
    mesh(parent,'sphere',M.window,x,y+height*.067,z+radius*.986,radius*.19,radius*.25,.047);
    mesh(parent,'box',M.gold,x,y,z+radius*1.01,.08,height*.14,.07);
  }
  const flag=mesh(parent,'box',x<0?M.pink:M.blue,x+radius*.4,height+radius*2.9,z,radius*.65,radius*.32,.08);flag.rotation.z=-.15;
  mesh(parent,'cylinder',M.gold,x,height+radius*2.8,z,.045,radius*.8,.045);
}
function makeCastle() {
  const c=group();
  mesh(c,'box',M.wall,0,7,0,14,14,8);
  mesh(c,'box',M.cream,0,.7,0,23,1.4,13);
  for(const y of [3,9,13.5]) mesh(c,'box',M.gold,0,y,.1,14.4,.2,8.4);
  mesh(c,'sphere',M.roof,0,14.2,0,7,5,5.4);
  mesh(c,'torus',M.gold,0,14.3,0,5.7,5.7,5.7).rotation.x=Math.PI/2;
  tower(c,0,-1.7,25,2.2);tower(c,-8,1,15,1.9,M.roof);tower(c,8,1,15,1.9,M.roof);
  tower(c,-12,-3,12,1.55);tower(c,12,-3,12,1.55);tower(c,-5,-5,20,1.6);tower(c,5,-5,20,1.6);
  const door=new THREE.Shape();door.moveTo(-2.2,0);door.lineTo(2.2,0);door.lineTo(2.2,5.3);door.absarc(0,5.3,2.2,0,Math.PI,false);door.lineTo(-2.2,0);
  mesh(c,new THREE.ShapeGeometry(door),M.gold,0,1.05,4.12,1.12,1.1,1);
  mesh(c,new THREE.ShapeGeometry(door),M.window,0,1.05,4.17,.94,1.01,1);
  for(const x of [-4.8,4.8]) {mesh(c,'box',M.window,x,7.5,4.07,1.1,3.7,.04);mesh(c,'sphere',M.window,x,9.3,4.07,.55,.7,.04);}
  const clock=mesh(c,'circle',M.cream,0,12.1,5.02,1.42,1.42,1);clock.rotation.z=0;
  mesh(c,'torus',M.gold,0,12.1,5.06,1.46,1.46,1.46);
  mesh(c,'box',M.darkGold,0,12.5,5.11,.1,.81,.05);
  mesh(c,'box',M.darkGold,.32,12.02,5.12,.72,.1,.05).rotation.z=-.32;
  for(let i=0;i<12;i++) {const a=i*Math.PI/6;mesh(c,'sphere',M.gold,Math.sin(a)*1.15,12.1+Math.cos(a)*1.15,5.09,.065,.065,.03);}
  for(const x of [-5.7,5.7]) {
    mesh(c,'cylinder',M.cream,x,6,4.35,.32,11,.32);
    mesh(c,'cylinder',M.gold,x,1.3,4.35,.5,.6,.5);
  }
  const r=rng(78);for(let i=0;i<32;i++) {const a=r()*Math.PI*2;mesh(c,'sphere',i%4?M.cloud:M.pinkCloud,Math.cos(a)*(9+r()*6),-.4+r()*1.5,Math.sin(a)*6,2+r()*2,1+r()*1.4,1.7+r()*2);}
  return mergeRigid(c);
}
function makePipe() {
  const p=group();
  const glass=mesh(p,'cylinder',M.glass,0,.68,0,.51,1.91,.51);glass.rotation.z=Math.PI/2;
  for(const x of [-1,1]) {
    mesh(p,'torus',M.gold,x,.68,0,.52,.52,.52).rotation.y=Math.PI/2;
    mesh(p,'box',M.gold,x,.17,0,.18,.31,.55);
  }
  const e=mesh(p,'box',M.envelope,0,.72,.24,.67,.39,.05);e.rotation.z=-.06;
  const edge=mesh(p,'box',M.cream,0,.80,.274,.45,.035,.025);edge.rotation.z=-.40;
  const edge2=mesh(p,'box',M.cream,0,.80,.28,.45,.035,.025);edge2.rotation.z=.4;
  return mergeRigid(p);
}
function makeArch() {
  const p=group();
  for(const side of [-1,1]) for(let i=0;i<3;i++) {
    const x=side*.99,y=.28+i*.52, material=(i+(side===1?1:0))%2?M.blue:M.giftPink;
    mesh(p,'box',material,x,y,0,.53,.51,.7);
    mesh(p,'box',M.gold,x,y,.359,.07,.51,.027);
    mesh(p,'box',M.gold,x,y,0,.56,.06,.72);
  }
  mesh(p,'box',M.giftPink,0,1.65,0,2.5,.44,.76);
  mesh(p,'box',M.gold,0,1.65,.393,2.52,.085,.03);
  for(const x of [-.5,.5]) mesh(p,'sphere',M.gold,x*.4,2.05,0,.23,.13,.12).rotation.z=x;
  // White downward chevrons: legible, geometry-only slide affordance.
  for(const x of [-.14,.14]) mesh(p,'box',M.cream,x,1.67,.421,.38,.06,.025).rotation.z=x>0?.5:-.5;
  return mergeRigid(p);
}
function makeWingPickup() {
  const p=group();const w1=wing(p,-1,.85),w2=wing(p,1,.85);w1.position.y=0;w2.position.y=0;
  mesh(p,'sphere',M.gold,0,.1,0,.20,.26,.12);
  const h=mesh(p,'torus',M.gold,0,.77,0,.28,.28,.28);h.rotation.x=Math.PI/2;
  return mergeRigid(p);
}
function makePostman() {
  const p=group();
  mesh(p,'box',M.gold,0,.34,0,.61,.18,1.37);
  for(const z of [-.5,.5]) {const w=mesh(p,'cylinder',M.wheel,0,.28,z,.23,.16,.23);w.rotation.z=Math.PI/2;}
  mesh(p,'cylinder',M.gold,0,.98,-.47,.07,1.2,.07).rotation.x=-.14;
  mesh(p,'cylinder',M.navy,0,1.59,-.4,.06,.66,.06).rotation.z=Math.PI/2;
  mesh(p,'sphere',M.navy,0,1.2,.10,.36,.49,.3);
  mesh(p,'sphere',M.skin,0,1.96,.08,.35,.4,.32);
  mesh(p,'sphere',M.navy,0,2.22,.09,.39,.17,.37);
  mesh(p,'box',M.gold,0,2.18,-.23,.52,.08,.17);
  mesh(p,'box',M.envelope,0,2.29,-.249,.16,.10,.025);
  for(const x of [-.15,.15]) mesh(p,'sphere',M.eyes,x,1.98,-.212,.035,.045,.026);
  for(const x of [-.28,.28]) {
    mesh(p,'sphere',M.navy,x,1.39,-.16,.13,.24,.2).rotation.x=-.6;
    mesh(p,'sphere',M.white,x,1.56,-.35,.11);
    mesh(p,'sphere',M.navy,x*.65,.67,.1,.13,.28,.15);
  }
  const w1=wing(p,-1,.8),w2=wing(p,1,.8);w1.position.z=.26;w2.position.z=.26;w1.position.y=1.5;w2.position.y=1.5;
  const h=mesh(p,'torus',M.gold,0,2.62,.1,.3,.3,.3);h.rotation.x=Math.PI/2;
  return mergeRigid(p);
}

function batch(scene,geo,material,count) { const b=new THREE.InstancedMesh(geo,material,count); b.instanceMatrix.setUsage(THREE.DynamicDrawUsage); b.frustumCulled=false; b.count=0;scene.add(b);return b; }
const dummy=new THREE.Object3D();
function put(b,i,x,y,z,sx=1,sy=sx,sz=sx,ry=0,rz=0) { dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,ry,rz);dummy.updateMatrix();b.setMatrixAt(i,dummy.matrix); }
function endBatch(b,count) { b.count=count;b.instanceMatrix.needsUpdate=true; }

export class Stage {
  constructor(container) {
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#edc5d9',65,240);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;
    this.renderer.shadowMap.enabled=false;container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Облачные дорожки, малышка и небесный замок');
    this.camera=new THREE.PerspectiveCamera(51,1,.1,280);
    this.scene.add(new THREE.HemisphereLight('#fff5e6','#be92c6',1.85));
    const sun=new THREE.DirectionalLight('#ffebcf',2.1);sun.position.set(-25,40,18);this.scene.add(sun);
    const fill=new THREE.DirectionalLight('#e0dfff',.6);fill.position.set(20,8,-30);this.scene.add(fill);
    this.baby=createBaby();this.scene.add(this.baby);
    this.postman=makePostman();this.scene.add(this.postman);
    this.castle=makeCastle();this.castle.position.set(0,-.5,-118);this.castle.scale.setScalar(1.33);this.scene.add(this.castle);
    this.sun=mesh(this.scene,'sphere',new THREE.MeshBasicMaterial({color:'#fff0cd',fog:false}),-66,23,-147,10.5,10.5,3);
    this.road=batch(this.scene,G.box,M.cloud,144);
    this.puffs=batch(this.scene,G.puff,M.cloud,460);
    this.rails=batch(this.scene,G.box,M.gold,288);
    this.holeEnds=batch(this.scene,G.box,M.gold,64);
    this.giftBoxes=batch(this.scene,G.box,M.giftPink,180);
    this.giftRibbons=batch(this.scene,G.box,M.gold,540);
    this.giftFeathers=batch(this.scene,G.puff,M.white,720);
    this.giftBows=batch(this.scene,G.puff,M.gold,360);
    this.sparkles=batch(this.scene,G.lowSphere,new THREE.MeshBasicMaterial({color:'#fff1bb'}),60);
    this.clouds=batch(this.scene,G.puff,M.pinkCloud,200);
    this.cloudData=[];const random=rng(38512);
    for(let i=0;i<180;i++) { const s=1.5+random()*4.2;this.cloudData.push({x:(random()>.5?1:-1)*(7+random()*52),y:-2-random()*8,z:14-random()*165,s}); }
    this.templates={pipe:makePipe(),arch:makeArch(),wings:makeWingPickup()};
    this.active=new Map();this.pools={pipe:[],arch:[],wings:[]};
    this.quality='auto';this.pixelRatio=1;this.mobile=false;this.elapsed=0;
    this.resize();
  }
  setQuality(q) {
    this.quality=q;const d=Math.min(window.devicePixelRatio||1,2);
    this.pixelRatio=q==='low'?Math.min(1,d):q==='high'?d:Math.min(d,1.5);
    this.renderer.setPixelRatio(this.pixelRatio);this.resize();
  }
  reduceQuality() { if(this.quality==='auto'&&this.pixelRatio>1){this.pixelRatio=1;this.renderer.setPixelRatio(1);this.resize();return true;}return false; }
  resize() {
    this.width=window.innerWidth;this.height=window.innerHeight;this.mobile=this.width/this.height<.92;
    this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;
    this.camera.fov=this.mobile?61:51;this.camera.updateProjectionMatrix();
  }
  outfit(color) { this.baby.userData.suit.color.set(color); }
  clearObjects() { for(const [id,o] of this.active){o.visible=false;this.pools[o.userData.kind].push(o);}this.active.clear(); }
  update(model,t,dt,menu=false) {
    const d=menu?8:model.distance;
    const first=Math.floor((d-12)/4)*4;let tiles=0,puffs=0,rails=0,ends=0;
    const holes=menu?[]:model.objects.filter(o=>o.type==='hole');
    for(let s=first+2;s<d+156;s+=4) for(let lane=0;lane<3;lane++) {
      const hole=holes.some(h=>h.lane===lane&&Math.abs(h.s-s)<3.9);
      if(hole)continue;
      const x=(lane-1)*CFG.laneWidth,z=d-s;
      put(this.road,tiles++,x,-.28,z,2.5,.34,4.02);
      for(let a=-1;a<=1;a++)put(this.puffs,puffs++,x+a*.73,-.095,z,.72,.155,2.03,0,0);
      for(const side of [-1,1])put(this.rails,rails++,x+side*1.245,-.025,z,.08,.18,4.025);
    }
    for(const h of holes)for(const side of [-1,1])put(this.holeEnds,ends++,(h.lane-1)*CFG.laneWidth,-.045,d-h.s+side*4,2.5,.12,.15);
    endBatch(this.road,tiles);endBatch(this.puffs,puffs);endBatch(this.rails,rails);endBatch(this.holeEnds,ends);
    const count=this.quality==='low'?95:180;
    for(let i=0;i<count;i++) {const c=this.cloudData[i],z=((c.z+d*.29+170)%182)-166;put(this.clouds,i,c.x,c.y+Math.sin(t*.13+i)*.15,z,c.s*1.5,c.s*.65,c.s);}
    endBatch(this.clouds,count);
    let box=0,rib=0,feather=0,bow=0;
    const visibleIds=new Set();
    for(const o of model.objects) {
      const z=d-o.s;if(z>14||z< -154)continue;
      const x=(o.lane-1)*CFG.laneWidth;
      if(o.type==='gift'&&!o.done) {
        const y=1.13+Math.sin(t*2.5+o.id)*.12,rot=Math.sin(t+o.id)*.14;
        put(this.giftBoxes,box++,x,y,z,.45,.5,.44,rot);
        put(this.giftRibbons,rib++,x,y,z,.09,.525,.47,rot);
        put(this.giftRibbons,rib++,x,y,z,.47,.525,.065,rot);
        put(this.giftRibbons,rib++,x,y+.205,z,.49,.10,.49,rot);
        for(const side of [-1,1]) {
          put(this.giftBows,bow++,x+side*.10,y+.33,z,.13,.075,.07,rot,side*.3);
          for(let i=0;i<2;i++)put(this.giftFeathers,feather++,x+side*(.32+i*.10),y+.04+i*.13,z,.22,.09,.052,0,side*(.25+Math.sin(t*8+o.id)*.1));
        }
      }
      if(o.type==='pipe'||o.type==='arch'||(o.type==='wings'&&!o.done)) {
        visibleIds.add(o.id);let visual=this.active.get(o.id);
        if(!visual){visual=this.pools[o.type].pop()||this.templates[o.type].clone();visual.userData.kind=o.type;visual.visible=true;this.scene.add(visual);this.active.set(o.id,visual);}
        visual.position.set(x,o.type==='wings'?1.6+Math.sin(t*3)*.14:0,z);visual.rotation.y=o.type==='wings'?Math.sin(t*2)*.3:0;
      }
    }
    for(const [id,visual] of this.active) if(!visibleIds.has(id)){visual.visible=false;this.pools[visual.userData.kind].push(visual);this.active.delete(id);}
    endBatch(this.giftBoxes,box);endBatch(this.giftRibbons,rib);endBatch(this.giftFeathers,feather);endBatch(this.giftBows,bow);
    let sparks=0;
    if(model.wings>0&&!menu) for(let i=0;i<28;i++) {
      const z=(t*6+i*.27)%8,side=Math.sin(i*4.3);
      put(this.sparkles,sparks++,model.x+side*(.5+z*.12),3.6+Math.sin(i+t*4)*.38-z*.18,z,.036*(1-z/10));
    }
    endBatch(this.sparkles,sparks);
    if(menu) {
      this.baby.position.set(this.mobile?0:2.65,0,this.mobile?-.7:0);
      this.baby.scale.setScalar(this.mobile?1.35:1.62);this.baby.rotation.y=-.18;
      this.camera.position.set(this.mobile?0:1.3,this.mobile?4.3:4.65,this.mobile?10.2:10.6);
      this.camera.lookAt(this.mobile?0:.5,this.mobile?1.8:2.8,-5.5);
      this.postman.visible=false;
    } else {
      this.baby.position.set(model.x,0,0);this.baby.scale.setScalar(1);this.baby.rotation.y=Math.PI;
      const flying=model.wings>0, targetY=flying?7.5:(this.mobile?6.8:5.2);
      this.camera.position.set(model.x*.12,this.camera.position.y+(targetY-this.camera.position.y)*(1-Math.exp(-3*dt)),this.mobile?16.2:9.7);
      const shake=model.invulnerable>.95?Math.sin(t*70)*.06:0;
      this.camera.position.x+=shake;this.camera.lookAt(model.x*.12,1.5+(flying?1:0),this.mobile?-13:-19);
      this.postman.visible=model.state!=='falling'&&model.state!=='gameover';
      this.postman.position.set(model.x*.6+(1-model.danger)*1.3,.3+Math.sin(t*5)*.05,1.6-model.danger*1.15);
      this.postman.scale.setScalar(.62);this.postman.rotation.y=0;
    }
    animateBaby(this.baby,model,t,menu);
    this.renderer.render(this.scene,this.camera);
  }
  stats() { return { calls:this.renderer.info.render.calls, triangles:this.renderer.info.render.triangles, geometries:this.renderer.info.memory.geometries, pixelRatio:this.renderer.getPixelRatio(), width:this.width, height:this.height, webgl2:this.renderer.capabilities.isWebGL2 }; }
}
