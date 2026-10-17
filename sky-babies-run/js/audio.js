/** Procedural stereo-friendly WebAudio cues. Fully offline; AudioContext starts only on gesture. */
export class Sound {
  constructor(enabled){
    this.enabled=!!enabled;this.ctx=null;this.master=null;this.lastGift=-1;
  }
  unlock(){
    if(!this.enabled)return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      if(!this.ctx){
        this.ctx=new Audio();
        const c=this.ctx, master=c.createGain(),comp=c.createDynamicsCompressor();
        comp.threshold.value=-20;comp.knee.value=20;comp.ratio.value=4;
        master.gain.value=.52;master.connect(comp);comp.connect(c.destination);
        this.master=master;
      }
      if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    }catch {/* Audio is optional. */}
  }
  tone(f,duration=.12,delay=0,type='sine',gain=.075,endF=null){
    const c=this.ctx;
    if(!this.enabled||!c||c.state!=='running'||!this.master)return;
    const t=c.currentTime+delay,osc=c.createOscillator(),env=c.createGain();
    osc.type=type;osc.frequency.setValueAtTime(Math.max(20,f),t);
    if(endF)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endF),t+duration);
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.012);
    env.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(env);env.connect(this.master);osc.start(t);osc.stop(t+duration+.03);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  play(type){
    if(!this.enabled)return;
    const c=this.ctx,now=c?.currentTime??-1;
    if(type==='gift'){
      if(now>=0&&now-this.lastGift<.085)return;
      this.lastGift=now;
      this.tone(740,.085,0,'sine',.042,930);
      this.tone(1110,.14,.045,'sine',.052);
      this.tone(1480,.18,.1,'sine',.032);
    }else if(type==='start'){
      [523,659,784,1047].forEach((f,i)=>this.tone(f,.20,i*.085,'sine',.038));
    }else if(type==='jump'){
      this.tone(380,.18,0,'triangle',.04,760);
      this.tone(780,.11,.12,'sine',.025);
    }else if(type==='slide'){
      this.tone(360,.18,0,'triangle',.045,155);
      this.tone(165,.12,.08,'sine',.023);
    }else if(type==='lane'){
      this.tone(480,.075,0,'sine',.012,570);
    }else if(type==='bump'){
      this.tone(220,.27,0,'triangle',.10,68);
      this.tone(95,.19,.06,'sawtooth',.036,65);
    }else if(type==='wings'){
      [392,523,659,784,1047].forEach((f,i)=>this.tone(f,.26,i*.082,'sine',.04));
      this.tone(1300,.55,.36,'sine',.02,1700);
    }else if(type==='fall'){
      this.tone(580,.62,0,'sine',.052,160);
      this.tone(238,.52,.22,'triangle',.06,88);
    }else if(type==='gameover'){
      [392,330,294,220].forEach((f,i)=>this.tone(f,.25,i*.15,'triangle',.048));
    }else if(type==='land'){
      this.tone(360,.11,0,'sine',.033,270);
    }else if(type==='pause'||type==='resume'){
      this.tone(type==='pause'?360:520,.09,0,'sine',.022);
    }
  }
}
