import * as THREE from 'three';
import {CFG} from './core.js';

// Procedural, locally rendered characters. Shared geometry and materials keep memory flat.
const sph=new THREE.SphereGeometry(1,12,9), smooth=new THREE.SphereGeometry(1,20,14),
      small=new THREE.IcosahedronGeometry(1,1),
      cube=new THREE.BoxGeometry(1,1,1), cone=new THREE.ConeGeometry(1,1,12),
      ring=new THREE.TorusGeometry(1,.15,7,20);
const mat=(hex,extra={})=>new THREE.MeshLambertMaterial({color:hex,...extra});
const C={skin:mat('#f8bd9d'),hair:mat('#573526'),hairLight:mat('#68402d'),eye:mat('#30283a'),
  pupil:mat('#141322'),white:mat('#fff5e9'),cheek:mat('#f1a6ac'),gold:mat('#e7c178'),
  rose:mat('#f49cc2'),pink:mat('#d971aa'),blue:mat('#809fc9'),navy:mat('#566d99'),
  mouth:mat('#a95175'),snow:mat('#f8e9f5'),shoe:mat('#b97b9d')};
function group(parent,x=0,y=0,z=0) {
  const o=new THREE.Group();o.position.set(x,y,z);if(parent)parent.add(o);return o;
}
function mesh(parent,shape,material,x,y,z,a=1,b=a,c=a) {
  const o=new THREE.Mesh(shape,material);o.position.set(x,y,z);o.scale.set(a,b,c);parent.add(o);return o;
}
function ribbon(parent,side,material) {
  const knot=mesh(parent,sph,C.gold,0,0,0,.095,.095,.072);
  for(let i=0;i<2;i++){
    const l=mesh(parent,sph,material,side*(.18+i*.045),.04+(i-.5)*.08,.002,.18,.12,.065);
    l.rotation.z=side*(i===0?.33:-.24);
  }
  return knot;
}
// Dynamic pink outfit keeps its live colour material. Static accents are vertex-baked
// into one draw call per moving limb/head, without freezing the animation hierarchy.
const staticAccent=new THREE.MeshBasicMaterial({vertexColors:true});
function compactGroup(node,keep=new Set(),dynamicSuit=null){
  for(const child of [...node.children])if(child.isGroup)compactGroup(child,keep,dynamicSuit);
  const buckets=new Map();
  for(const obj of [...node.children]){
    if(!obj.isMesh||keep.has(obj))continue;
    obj.updateMatrix();
    const geometry=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();
    geometry.applyMatrix4(obj.matrix);
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    const dynamic=dynamicSuit&&obj.material===dynamicSuit;
    if(!dynamic){
      const count=geometry.attributes.position.count,n=geometry.attributes.normal;
      const data=new Float32Array(count*3),base=obj.material.color||new THREE.Color('white');
      for(let i=0;i<count;i++){
        const k=Math.max(.7,Math.min(1.08,.84+.22*(-n.getX(i)*.4+n.getY(i)*.75+n.getZ(i)*.5)));
        const j=i*3;data[j]=base.r*k;data[j+1]=base.g*k;data[j+2]=base.b*k;
      }
      geometry.setAttribute('color',new THREE.BufferAttribute(data,3));
    }
    const key=dynamic?'suit':'accent';
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(geometry);
    node.remove(obj);
  }
  for(const [key,list] of buckets){
    const joined=new THREE.BufferGeometry();
    for(const name of key==='suit'?['position','normal']:['position','normal','color']){
      const len=list.reduce((sum,geo)=>sum+geo.attributes[name].array.length,0);
      const data=new Float32Array(len);let offset=0;
      for(const geo of list){data.set(geo.attributes[name].array,offset);offset+=geo.attributes[name].array.length;}
      joined.setAttribute(name,new THREE.BufferAttribute(data,3));
    }
    joined.computeBoundingSphere();node.add(new THREE.Mesh(joined,key==='suit'?dynamicSuit:staticAccent));
    list.forEach(geo=>geo.dispose());
  }
}
function wings(parent) {
  const left=group(parent,-.33,1.2,-.29),right=group(parent,.33,1.2,-.29);
  for(const [wing,side] of [[left,-1],[right,1]]){
    for(let i=0;i<3;i++){
      const petal=mesh(wing,sph,C.white,side*(.17+i*.13),.07+i*.13,0,.19,.31-i*.04,.075);
      petal.rotation.z=side*(-.35-i*.16);
    }
    mesh(wing,small,C.gold,0,.02,.015,.11,.15,.08);
  }
  left.visible=right.visible=false;
  return [left,right];
}
export function createBaby() {
  const root=group(), rig=group(root),suit=mat('#ec8fb6');
  // Round infant body, stitched romper, little hood, striped shoes.
  mesh(rig,sph,suit,0,.85,0,.44,.53,.35);
  mesh(rig,sph,suit,0,.53,0,.39,.32,.34);
  mesh(rig,cube,C.white,0,.92,.349,.025,.39,.016);
  for(let i=0;i<3;i++)mesh(rig,sph,C.gold,.055,1.08-i*.17,.35,.035,.035,.02);
  const bib=mesh(rig,sph,C.white,0,.96,.352,.15,.17,.025);
  bib.rotation.z=.08;
  const heart=mesh(rig,sph,C.rose,.022,.99,.376,.075,.058,.018);
  heart.rotation.z=-.3;
  // The reference has a plump, uncovered face and SHORT, rounded chestnut hair.
  // Curved cap + nape sit behind the cheeks; no long hanging side locks.
  const head=group(rig,0,1.62,.08);
  mesh(head,smooth,C.skin,0,0,.04,.625,.61,.55);
  mesh(head,smooth,C.skin,-.44,-.20,.20,.20,.18,.25);
  mesh(head,smooth,C.skin,.44,-.20,.20,.20,.18,.25);
  mesh(head,smooth,C.hair,0,.27,-.22,.645,.47,.455); // smooth domed crown
  mesh(head,smooth,C.hair,0,-.055,-.40,.555,.365,.255); // softly rounded occiput
  for(const side of [-1,1]){
    mesh(head,smooth,C.skin,side*.59,-.07,.055,.13,.145,.12); // visible ears
    const temple=mesh(head,smooth,C.hair,side*.515,.25,-.18,.145,.19,.225);
    temple.rotation.z=side*.13; // above ears, not dangling past cheeks
    const sweep=mesh(head,smooth,C.hair,side*.395,.445,.075,.13,.080,.15);
    sweep.rotation.z=-.18+side*.12;
  }
  // Continuous rounded hairline with a few small, soft side-swept wisps.
  const fringeBase=mesh(head,smooth,C.hair,-.018,.495,.205,.495,.142,.183);
  fringeBase.rotation.z=-.055;
  for(let i=0;i<3;i++){
    const strand=mesh(head,smooth,i===1?C.hairLight:C.hair,
      -.29+i*.255,.439-i*.018,.276,.115,.058,.112);
    strand.rotation.z=-.22+i*.13;
  }
  const curl=mesh(head,smooth,C.hairLight,-.25,.58,.065,.102,.064,.095);
  curl.rotation.z=-.34;
  // One compact 3D satin bow reads from front and rear without double stacking.
  const bow=group(head,.15,.755,-.04);
  for(const side of [-1,1]){
    const loop=mesh(bow,smooth,C.rose,side*.14,.024,0,.15,.10,.087);
    loop.rotation.z=side*-.22;
    const tail=mesh(bow,smooth,C.pink,side*.09,-.100,-.02,.060,.115,.052);
    tail.rotation.z=side*.28;
  }
  mesh(bow,smooth,C.pink,0,.012,.040,.078,.075,.075);
  const cowlick=mesh(head,smooth,C.hair,.055,.69,-.19,.115,.185,.115);
  cowlick.rotation.z=-.36;
  const tuft=mesh(head,smooth,C.hairLight,.145,.78,-.18,.085,.13,.09);
  tuft.rotation.z=-.53; // little lock peeking from beneath the bow
  const smilingEye=(side)=>{
    const x=side*.235;
    const path=new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x-.125,-.006,.536),
      new THREE.Vector3(x,.088,.597),
      new THREE.Vector3(x+.125,-.006,.536));
    mesh(head,new THREE.TubeGeometry(path,8,.025,5,false),C.eye,0,0,0);
    mesh(head,sph,C.eye,x+side*.117,-.010,.540,.034,.030,.026);
    const brow=mesh(head,sph,C.hairLight,x,.20,.487,.118,.018,.020);
    brow.rotation.z=side*.08;
  };
  for(const side of [-1,1]){
    smilingEye(side);
    mesh(head,smooth,C.cheek,side*.386,-.183,.485,.155,.083,.034);
  }
  mesh(head,sph,C.skin,0,-.11,.594,.075,.067,.054); // little nose
  // Open joyful smile: pink inner mouth, bright upper teeth and little tongue.
  mesh(head,sph,C.mouth,0,-.295,.553,.212,.154,.038);
  mesh(head,sph,C.white,0,-.226,.593,.155,.042,.018);
  mesh(head,sph,C.pink,0,-.378,.585,.095,.039,.019);
  const arms=[], legs=[];
  for(const side of [-1,1]){
    const arm=group(rig,side*.39,1.14,0);
    mesh(arm,sph,suit,0,-.19,0,.155,.26,.18);
    mesh(arm,sph,C.skin,side*.028,-.42,.03,.134,.13,.13);
    arms.push(arm);
    const leg=group(rig,side*.20,.55,0);
    mesh(leg,sph,suit,0,-.18,.01,.205,.26,.19);
    mesh(leg,sph,C.shoe,0,-.37,.10,.20,.13,.27);
    mesh(leg,sph,C.white,0,-.43,.12,.19,.035,.25);
    legs.push(leg);
  }
  const feathers=wings(rig);
  const halo=mesh(rig,ring,C.gold,0,2.45,0,.34,.34,.34);
  halo.rotation.x=Math.PI/2;halo.visible=false;
  const shadow=mesh(root,new THREE.CircleGeometry(1,22),new THREE.MeshBasicMaterial({
    color:'#986885',transparent:true,opacity:.16,depthWrite:false
  }),0,.035,0,.49,.29,.49);
  shadow.rotation.x=-Math.PI/2;
  compactGroup(rig,new Set([halo]),suit);
  root.userData={rig,head,arms,legs,wings:feathers,halo,suit,shadow};
  return root;
}
export function animateBaby(baby,model,t,menu=false){
  const u=baby.userData; if(!u?.rig)return;
  const {rig,head,arms,legs,wings:feathers,halo,shadow}=u;
  const state=model.state,falling=state==='falling',moving=state==='running',flying=!menu&&model.wings>0,
    sliding=!menu&&model.slide>0&&model.y<.3,hit=!menu&&model.invulnerable>1.05;
  const phase=t*(menu?3:Math.min(19,model.speed*.95)),stride=Math.sin(phase);
  const bounce=menu?.025*Math.sin(t*2):moving&&!sliding&&model.y===0?.09*Math.abs(stride):0;
  // One small, damped squash -> overshoot after *actual* airborne-to-ground
  // transition. Keep the Stage-owned root scale untouched (menu uses it).
  if(!menu&&moving&&!sliding&&!flying&&model.y<=.03&&(u.prevY??0)>.09)
    u.landAt=t;
  if(menu||falling||!moving)u.landAt=-100;
  u.prevY=menu?0:model.y;
  const age=t-(u.landAt??-100);
  const compression=!sliding&&moving&&age>=0&&age<.48?
    .17*Math.exp(-age*10)*Math.cos(age*20):0;
  rig.scale.set(1+compression*.47,1-compression,1+compression*.40);
  rig.position.y=(menu?0:model.y)+bounce+(sliding?-.17:0)+Math.max(0,compression)*.025;
  rig.rotation.x=falling?Math.min(1.7,.25+(model.fallTime||0)*2.0):
    sliding?1.15:flying?-.07:hit?Math.sin(phase*2)*.17:0;
  // Lane-to-position lag is a stable signal: immediate lean, then soft recovery.
  const turn=menu?0:(model.lane-1-model.x/CFG.laneWidth);
  rig.rotation.y=falling?Math.sin(t*8)*.48:sliding?0:-turn*.07;
  rig.rotation.z=falling?Math.sin(t*12)*.25:hit?Math.sin(t*29)*.09:
    menu?Math.sin(t*1.4)*.018:-turn*.15;
  head.rotation.x=sliding?-.2:flying?-.12:hit?.14:Math.sin(phase)*.025;
  head.rotation.z=falling?Math.sin(t*13)*.18:menu?Math.sin(t*2)*.04:turn*.045;
  for(let i=0;i<2;i++){
    const sign=i===0?-1:1,walk=Math.sin(phase+i*Math.PI);
    legs[i].rotation.x=falling?sign*.6:sliding?-1.28:flying?-.19:menu?0:walk*.73;
    legs[i].rotation.z=sliding?sign*.32:flying?sign*.19:0;
    arms[i].rotation.x=falling?-2.0:sliding?-1.0:flying?-1.22:menu?Math.sin(t*1.8+i)*.10:-walk*.73;
    arms[i].rotation.z=falling?sign*-.8:flying?sign*(-.65):sliding?sign*-.14:sign*.14;
    feathers[i].visible=flying;
    feathers[i].rotation.y=sign*(.36+.26*Math.sin(t*14+i));
    feathers[i].rotation.z=sign*.15*Math.sin(t*12+i);
  }
  halo.visible=flying;
  halo.position.y=2.45+.07*Math.sin(t*5);
  shadow.visible=!falling;
  shadow.scale.setScalar(1/(1+Math.max(0,model.y)*.28));
  rig.visible=menu||model.invulnerable<=0||Math.sin(t*37)>-.55;
}
export function createPostman(){
  const root=group(),body=group(root),uniform=mat('#5d709a'),trim=mat('#a5b7d1');
  mesh(body,sph,uniform,0,1.13,0,.44,.55,.32);
  mesh(body,sph,C.skin,0,1.98,.015,.39,.4,.34);
  mesh(body,sph,C.navy,0,2.35,0,.43,.19,.38); // hat
  mesh(body,cube,C.gold,0,2.36,.34,.48,.055,.20);
  mesh(body,sph,C.gold,0,2.48,.30,.12,.11,.04);
  for(const side of [-1,1]){
    const arm=group(body,side*.40,1.40,0);
    mesh(arm,sph,uniform,side*.05,-.22,0,.15,.31,.17);
    mesh(arm,sph,C.white,side*.09,-.45,.02,.13,.14,.12);
    mesh(body,sph,C.eye,side*.16,1.99,.338,.047,.065,.021);
    mesh(body,sph,uniform,side*.19,.55,0,.17,.27,.17);
    mesh(body,sph,C.shoe,side*.19,.33,.14,.2,.1,.26);
  }
  mesh(body,sph,C.gold,0,1.18,.32,.18,.18,.06);
  mesh(body,cube,C.rose,-.43,1.1,-.25,.48,.39,.31); // mailbag
  mesh(body,cube,C.gold,-.43,1.30,.05,.42,.065,.05);
  const envelope=mesh(body,cube,C.white,-.48,1.20,.07,.31,.16,.025);
  envelope.rotation.z=-.16;
  const halo=mesh(body,ring,C.gold,0,2.79,0,.27,.27,.27);
  halo.rotation.x=Math.PI/2;
  compactGroup(body);
  root.userData={body,halo};
  return root;
}
export function animatePostman(postman,model,t,menu=false){
  const body=postman.userData?.body;
  if(!body)return;
  const close=Math.max(0,1-(model.postmanDistance??12)/12);
  body.rotation.z=Math.sin(t*8)*(.025+.05*close);
  body.position.y=Math.sin(t*8)*(.10+.035*close);
  body.rotation.y=Math.sin(t*2.5)*.12;
}
