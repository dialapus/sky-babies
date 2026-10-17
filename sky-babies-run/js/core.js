/** Deterministic, render-independent endless-runner simulation (metres, seconds). */
export const CFG = Object.freeze({
  laneWidth: 2.65, startSpeed: 12, maxSpeed: 25, gravity: 26, jumpVelocity: 12,
  slideTime: .85, wingsTime: 9, rowGap: 24, horizon: 156,
  jumpBuffer: .14, coyoteTime: .105
});
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function rng(seed=987123) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
}
const obstacles = ['pipe','arch','hole'];
export class Runner {
  constructor(mode='',seed=Date.now()) {
    this.mode = ['run','fall'].includes(mode) ? mode : '';
    this.seed=seed; this.reset();
  }
  reset() {
    this.random=rng(this.seed);this.state='menu';this.time=0;this.distance=0;
    this.speed=CFG.startSpeed;this.lane=1;this.x=0;this.y=0;this.vy=0;
    this.slide=0;this.wings=0;this.invulnerable=0;this.danger=0;this.postmanDistance=12;
    this.gifts=0;this.score=0;this.events=[];this.objects=[];this.serial=0;
    this.nextRow=48;this.row=0;this.lastSafe=1;this.fallTime=0;this.gapTime=0;
    this.jumpBuffer=0;this.coyote=CFG.coyoteTime;
    this.reason='';this.resumeState='running';this.generate();
  }
  start() {this.reset();this.state='running';this.events.push({type:'start'});}
  add(type,lane,s,extra={}) {
    const o={id:++this.serial,type,lane,s,done:false,...extra};
    this.objects.push(o);return o;
  }
  generate() {
    if(this.mode==='fall') {
      if(this.objects.length===0 && this.distance<1) {
        this.add('hole',1,44);
        for(let s=10;s<36;s+=5)this.add('gift',1,s);
      }
      return;
    }
    if(this.row===0&&this.objects.length===0)for(let s=12;s<40;s+=5)this.add('gift',1,s);
    while(this.nextRow<this.distance+CFG.horizon) {
      const row=this.row++,s=this.nextRow;
      const easy=row<16; // approximately first 30 s: sparse, readable, one obstacle per row
      let safe;
      if(row<3) safe=1;
      else {
        const choices=[this.lastSafe];
        if(this.lastSafe>0)choices.push(this.lastSafe-1);
        if(this.lastSafe<2)choices.push(this.lastSafe+1);
        safe=choices[Math.floor(this.random()*choices.length)];
      }
      this.lastSafe=safe;
      const available=[0,1,2].filter(l=>l!==safe);
      // During the tutorial block the previously safe lane is kept free whenever possible.
      if(easy) {
        let blocked=available[Math.floor(this.random()*available.length)];
        if(row<4)blocked=row%2===0?0:2;
        this.add(obstacles[row%3],blocked,s);
      } else {
        this.add(obstacles[row%3],available[0],s);
        if(row%5!==0)this.add(obstacles[(row+1)%3],available[1],s);
      }
      for(let d=-8;d<=8;d+=4)this.add('gift',safe,s+d);
      if(row===2||(row>2&&row%9===0))this.add('wings',safe,s+10);
      this.nextRow+=CFG.rowGap;
    }
  }
  input(action) {
    if(this.state!=='running'||this.mode==='fall')return false;
    if(action==='left'||action==='right') {
      const next=clamp(this.lane+(action==='left'?-1:1),0,2);
      if(next===this.lane)return false;
      this.lane=next;this.events.push({type:'lane'});return true;
    }
    if(action==='jump'&&this.wings<=0) {
      if(this.y<=.03||this.coyote>0) {
        this.vy=CFG.jumpVelocity;this.slide=0;this.y=Math.max(this.y,.04);
        this.coyote=0;this.gapTime=0;this.events.push({type:'jump'});return true;
      }
      // A late tap close to landing is buffered; a midair double jump is not.
      if(this.vy<0&&this.y<.9) {this.jumpBuffer=CFG.jumpBuffer;return true;}
      return false;
    }
    if(action==='slide'&&this.wings<=0) {
      if(this.y>.05)this.vy=Math.min(this.vy,-14);
      this.slide=CFG.slideTime;this.jumpBuffer=0;this.events.push({type:'slide'});return true;
    }
    return false;
  }
  pause(){if(this.state==='running'){this.state='paused';this.events.push({type:'pause'});}}
  resume(){if(this.state==='paused'){this.state='running';this.events.push({type:'resume'});}}
  finish(reason) {
    if(this.state==='gameover')return;
    this.reason=reason;this.state='gameover';this.events.push({type:'gameover',reason});
  }
  stumble(){
    if(this.invulnerable>0||this.mode==='run')return;
    this.danger=Math.min(1,this.danger+.64);this.invulnerable=1.55;
    this.events.push({type:'bump'});
    if(this.danger>=1)this.finish('Почтальон догнал и вернул в облачную канцелярию.');
    this.postmanDistance=this.danger>=1?.8:12-this.danger*10.9;
  }
  step(dt){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.25);
    while(dt>.000001){const h=Math.min(dt,1/120);this.tick(h);dt-=h;}
    // One compaction / generation per rendered frame, not 120 array allocations per second.
    if(this.state==='running'||this.state==='falling'){
      let n=0;
      for(let i=0;i<this.objects.length;i++){
        const object=this.objects[i];
        if(object.s>this.distance-18)this.objects[n++]=object;
      }
      this.objects.length=n;
      this.generate();
    }
  }
  tick(dt){
    if(this.state==='falling'){
      this.fallTime+=dt;this.vy-=CFG.gravity*dt;this.y+=this.vy*dt;
      if(this.fallTime>=1.1)this.finish('Осторожнее: в облаках бывают дыры. Их нужно перепрыгивать.');
      return;
    }
    if(this.state!=='running')return;
    this.time+=dt;
    this.speed=Math.min(CFG.maxSpeed,CFG.startSpeed+this.distance*.006);
    this.distance+=this.speed*dt;
    this.x+=((this.lane-1)*CFG.laneWidth-this.x)*(1-Math.exp(-17*dt));
    this.slide=Math.max(0,this.slide-dt);
    this.invulnerable=Math.max(0,this.invulnerable-dt);
    // Faster natural recovery grants the player a fair chance between mistakes.
    this.danger=Math.max(0,this.danger-.095*dt);
    this.postmanDistance+=((12-10.9*this.danger)-this.postmanDistance)*(1-Math.exp(-6*dt));
    this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    const flying=this.wings>0;
    this.wings=Math.max(0,this.wings-dt);
    const grounded=this.y<=.03;
    this.coyote=grounded?CFG.coyoteTime:Math.max(0,this.coyote-dt);
    if(this.wings>0){
      this.y+=(3.5-this.y)*(1-Math.exp(-7*dt));this.vy=0;this.slide=0;this.gapTime=0;
    }else{
      if(flying)this.events.push({type:'land'});
      this.vy-=CFG.gravity*dt;
      this.y=Math.max(0,this.y+this.vy*dt);
      if(this.y===0) {
        this.vy=0;
        if(this.jumpBuffer>0){this.jumpBuffer=0;this.vy=CFG.jumpVelocity;this.slide=0;this.events.push({type:'jump'});this.y=.04;}
      }
    }
    let inGap=false;
    for(const o of this.objects){
      if(o.done)continue;
      const dz=o.s-this.distance,same=Math.abs(this.x-(o.lane-1)*CFG.laneWidth);
      if(Math.abs(dz)>5||same>1.01)continue;
      if(o.type==='gift'||o.type==='wings'){
        if(Math.abs(dz)<1.1&&same<.95&&(this.y<2.4||this.wings>0)){
          o.done=true;
          if(o.type==='gift'){this.gifts++;this.events.push({type:'gift',lane:o.lane});}
          else{this.wings=CFG.wingsTime;this.events.push({type:'wings'});}
        }
      }else if(o.type==='hole'){
        if(Math.abs(dz)<3.55&&this.y<.12&&this.wings<=0&&this.mode!=='run')inGap=true;
      }else if(Math.abs(dz)<1.05){
        o.done=true;
        const safe=this.wings>0||(o.type==='pipe'?this.y>1.09:this.slide>0&&this.y<.17);
        if(!safe)this.stumble();
        if(this.state!=='running')break;
      }
    }
    if(inGap){
      this.gapTime+=dt;
      if(this.gapTime>=CFG.coyoteTime){
        this.state='falling';this.fallTime=0;this.vy=-1.8;this.events.push({type:'fall'});
      }
    }else this.gapTime=0;
    this.score=Math.floor(this.distance*10)+this.gifts*50;
    // Object pruning and horizon extension happen once in step().
  }
  snapshot(){return {
    state:this.state,mode:this.mode,distance:Math.round(this.distance*10)/10,
    speed:this.speed,score:this.score,gifts:this.gifts,lane:this.lane,x:this.x,y:this.y,
    vy:this.vy,slide:this.slide,wings:this.wings,danger:this.danger,
    postmanDistance:this.postmanDistance,objects:this.objects.length,reason:this.reason
  };}
}
