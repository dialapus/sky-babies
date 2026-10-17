import * as THREE from 'three';
/** Lightweight additive particle bursts; no textures, external assets or per-frame allocations. */
export class FX {
  constructor(scene) {
    this.scene=scene;this.max=72;this.now=0;this.next=0;this.particles=new Array(this.max);
    this.geo=new THREE.IcosahedronGeometry(1,0);
    this.mat=[
      new THREE.MeshBasicMaterial({color:'#ffe6a0',transparent:true,opacity:.9,depthWrite:false}),
      new THREE.MeshBasicMaterial({color:'#f47cbd',transparent:true,opacity:.93,depthWrite:false}),
      new THREE.MeshBasicMaterial({color:'#bce3ff',transparent:true,opacity:.85,depthWrite:false})
    ];
    this.meshes=this.mat.map(m=>{
      const obj=new THREE.InstancedMesh(this.geo,m,this.max);
      obj.instanceMatrix.setUsage(THREE.DynamicDrawUsage);obj.frustumCulled=false;
      obj.count=0;scene.add(obj);return obj;
    });
    // One extra draw call regardless of the number of simultaneous gift bursts.
    // A thin, additive, expanding ring provides an instant readable pickup flash.
    this.flashGeo=new THREE.RingGeometry(.80,1,24);
    this.flashMat=new THREE.MeshBasicMaterial({
      color:'#fff0b6',transparent:true,opacity:.56,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide
    });
    this.flashMesh=new THREE.InstancedMesh(this.flashGeo,this.flashMat,6);
    this.flashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flashMesh.frustumCulled=false;this.flashMesh.count=0;
    scene.add(this.flashMesh);
    this.flashes=new Array(6);this.flashNext=0;
    this.flashColor=new THREE.Color();
    this.dummy=new THREE.Object3D();this.seed=17849;
  }
  rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  emit(type,position={x:0,y:1,z:0}){
    const kind=type==='bump'?1:type==='wings'?2:0;
    const gift=type==='gift';
    const count=type==='bump'?24:type==='wings'?28:gift?22:12;
    if(gift){
      const f=this.flashes[this.flashNext]||(this.flashes[this.flashNext]={});
      f.x=position.x;f.y=position.y;f.z=position.z+.10;
      f.ttl=.34;f.life=f.ttl;
      this.flashNext=(this.flashNext+1)%this.flashes.length;
    }
    for(let i=0;i<count;i++){
      const p=this.particles[this.next]||(this.particles[this.next]={});
      const a=this.rnd()*Math.PI*2,s=(gift?.6:.8)+this.rnd()*(gift?1.8:2.3);
      p.x=position.x+(this.rnd()-.5)*(gift?.2:.32);
      p.y=position.y+(this.rnd()-.5)*(gift?.17:.23);
      p.z=position.z+(this.rnd()-.5)*.28;
      p.vx=Math.sin(a)*s;p.vz=Math.cos(a)*s*.65;
      p.vy=(gift?1.3:type==='wings'?1.7:2.5)+this.rnd()*(gift?2.0:2.7);
      p.ttl=gift?.46+this.rnd()*.24:type==='wings'?.82:.54;
      p.life=p.ttl;
      p.type=gift&&i%5===0?1:kind; // warm gold confetti with a few pink flecks
      p.size=(gift?.045:.055)+this.rnd()*(gift?.10:.08);
      p.stretch=gift&&i%3===0?1.6:.77;
      this.next=(this.next+1)%this.max;
    }
  }
  update(dt,t) {
    const counts=[0,0,0],d=this.dummy;
    dt=Math.min(.05,Math.max(0,dt));
    for(const p of this.particles){
      if(!p||p.life<=0)continue;
      p.life=Math.max(0,p.life-dt);
      if(!p.life)continue;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      p.vy-=6*dt;
      const sz=p.size*p.life/p.ttl;
      d.position.set(p.x,p.y,p.z);d.scale.set(sz,sz*p.stretch,sz);
      d.rotation.set(0,t*1.3,0);d.updateMatrix();
      const m=this.meshes[p.type],index=counts[p.type]++;
      m.setMatrixAt(index,d.matrix);
    }
    for(let i=0;i<this.meshes.length;i++){
      const m=this.meshes[i];m.count=counts[i];m.instanceMatrix.needsUpdate=true;
    }
    let flashes=0;
    for(const f of this.flashes){
      if(!f||f.life<=0)continue;
      f.life=Math.max(0,f.life-dt);
      if(!f.life)continue;
      const progress=1-f.life/f.ttl,rad=.15+.92*progress;
      d.position.set(f.x,f.y,f.z);d.scale.set(rad,rad,1);
      d.rotation.set(0,0,0);d.updateMatrix();
      this.flashMesh.setMatrixAt(flashes,d.matrix);
      const brightness=(1-progress)*(1-progress);
      this.flashColor.setRGB(brightness,brightness,brightness);
      this.flashMesh.setColorAt(flashes,this.flashColor);
      flashes++;
    }
    this.flashMesh.count=flashes;
    this.flashMesh.instanceMatrix.needsUpdate=true;
    if(this.flashMesh.instanceColor)this.flashMesh.instanceColor.needsUpdate=true;
  }
  dispose(){
    for(const m of this.meshes)this.scene.remove(m);
    this.scene.remove(this.flashMesh);
    this.geo.dispose();for(const mat of this.mat)mat.dispose();
    this.flashGeo.dispose();this.flashMat.dispose();
  }
}
