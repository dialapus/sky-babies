import { Runner, CFG } from './core.js';
import { SaveStore, OUTFITS } from './storage.js';
import { Sound } from './audio.js';
import { resultPresentation, mobileOnboardingHint } from './result.js';

const $=id=>document.getElementById(id), save=new SaveStore(), sound=new Sound(save.data.sound);
const mode=new URLSearchParams(location.search).get('autotest')||'';
const model=new Runner(mode), number=new Intl.NumberFormat('ru-RU');
let stage, sheet='', committed=false, last=0, anim=0, hudClock=0, toastUntil=0, avgMs=16.7, qualityClock=0;
let previousState='menu', isNewRecord=false, swipe=null;
const touchInput=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0||('ontouchstart' in window);
document.documentElement.classList.toggle('touch-input',touchInput);

function showError(message) { $('loading').hidden=true;$('error-message').textContent=message;$('error').hidden=false;document.body.dataset.state='error'; }
function toast(message,seconds=2.3) { $('toast').textContent=message;$('toast').hidden=false;toastUntil=performance.now()+seconds*1000; }
function updateWallet() { document.querySelectorAll('.wallet-value').forEach(el=>el.textContent=number.format(save.data.gifts));$('best').textContent=number.format(save.data.best);$('save-warning').hidden=save.available; }
function commitRun() {
  if(committed||mode==='run'||mode==='fall')return;
  isNewRecord=model.score>save.data.best;save.addRun(model.score,model.gifts);committed=true;updateWallet();
}
function closeSheets() { for(const id of ['records','settings','shop'])$(id).hidden=true;sheet=''; }
function renderRecords() {
  const list=$('record-list');list.replaceChildren();
  if(!save.data.records.length){const p=document.createElement('p');p.textContent='Здесь появится Ваш первый небесный рекорд. Пора в путь!';list.append(p);return;}
  save.data.records.forEach((r,i)=>{
    const row=document.createElement('div');row.className='record-row';
    const place=document.createElement('b');place.textContent=String(i+1).padStart(2,'0');
    const value=document.createElement('strong');value.textContent=number.format(r.score);
    const detail=document.createElement('small');detail.textContent=`${r.gifts} подарков · ${r.date}`;
    row.append(place,value,detail);list.append(row);
  });
}
function renderOutfits() {
  const list=$('outfit-list');list.replaceChildren();
  OUTFITS.forEach(item=>{
    const owned=save.data.owned.includes(item.id), selected=save.data.outfit===item.id;
    const b=document.createElement('button');b.type='button';b.className=`outfit${selected?' selected':''}`;b.dataset.outfit=item.id;
    b.disabled=!owned&&save.data.gifts<item.price;b.setAttribute('aria-label',`${item.name}, ${selected?'выбран':owned?'надеть':`${item.price} подарков`}`);
    const shape=document.createElement('span');shape.className='suit';shape.style.setProperty('--suit',item.color);
    const name=document.createElement('b');name.textContent=item.name;const price=document.createElement('em');price.textContent=selected?'На Вас':owned?'Надеть':`${number.format(item.price)} подарков`;
    b.append(shape,name,price);b.addEventListener('click',()=>{sound.unlock();if(save.choose(item.id)){stage.outfit(item.color);sound.play('gift');updateWallet();renderOutfits();}});list.append(b);
  });
}
function openSheet(id) {
  if(model.state!=='menu')return;
  closeSheets();sheet=id;$(id).hidden=false;sound.unlock();
  if(id==='records')renderRecords();if(id==='shop')renderOutfits();
  if(id==='settings'){$('sound').checked=save.data.sound;$('quality').value=save.data.quality;updateWallet();}
  $(id).querySelector('button')?.focus({preventScroll:true});
}
function menu() {
  closeSheets();if(model.state!=='menu')commitRun();model.reset();stage.clearObjects();
  $('menu').hidden=false;$('hud').hidden=true;$('paused').hidden=true;$('gameover').hidden=true;$('toast').hidden=true;
  document.body.dataset.state='menu';previousState='menu';updateWallet();
}
function start(withAudio=true) {
  if(withAudio)sound.unlock();closeSheets();committed=false;isNewRecord=false;
  if(!mode)model.seed=Date.now();model.start();stage.clearObjects();
  $('menu').hidden=true;$('gameover').hidden=true;$('paused').hidden=true;$('hud').hidden=false;
  $('hint').style.opacity='1';$('hint').textContent=touchInput?mobileOnboardingHint(0):'← → Дорожки · ↑ Прыжок · ↓ Подкат';$('toast').hidden=true;previousState='running';
  $('autotest-label').hidden=!['run','fall'].includes(mode);
  $('autotest-label').textContent=mode==='fall'?'АВТОТЕСТ · ПАДЕНИЕ':mode==='run'?'АВТОТЕСТ · БЕГ БЕЗ ПОРАЖЕНИЯ':'';
  updateHUD();document.activeElement?.blur();last=performance.now();document.body.dataset.state=model.state;
}
function pause() { if(model.state==='running'){model.pause();$('paused').hidden=false;$('resume').focus({preventScroll:true});document.body.dataset.state='paused';} }
function resume() { if(model.state==='paused'){sound.unlock();model.resume();$('paused').hidden=true;document.activeElement?.blur();last=performance.now();document.body.dataset.state='running';} }
function gameover() {
  commitRun();$('paused').hidden=true;$('gameover').hidden=false;$('hint').style.opacity='0';
  $('toast').hidden=true;toastUntil=0;
  const result=resultPresentation(model.reason);
  $('result-title').textContent=result.title;$('result-eyebrow').textContent=result.eyebrow;
  $('result-icon').setAttribute('href',result.icon);
  $('gameover').dataset.reason=result.kind;
  $('final-score').textContent=number.format(model.score);$('final-gifts').textContent=`+${number.format(model.gifts)}`;
  $('final-best').textContent=number.format(Math.max(model.score,save.data.best));$('result-reason').textContent=model.reason;$('result-tip').textContent=result.tip;
  $('new-record').hidden=!isNewRecord;$('retry').focus({preventScroll:true});
}
function updateHUD() {
  $('score').textContent=number.format(model.score);$('gifts').textContent=number.format(model.gifts);$('speed').textContent=model.speed.toFixed(1).replace('.',',');
  $('wings-meter').hidden=model.wings<=0;$('wings-time').textContent=String(Math.ceil(model.wings));$('wings-fill').style.width=`${model.wings/CFG.wingsTime*100}%`;
  $('chase-fill').style.width=`${Math.min(100,model.danger*100)}%`;
  const postman=model.postmanDistance??12;
  $('chase-text').textContent=postman<3.8?'Почтальон совсем рядом!':postman<8?'Почтальон приближается':'Почтальон далеко';
  if(touchInput){
    const hint=mobileOnboardingHint(model.time);
    if(hint)$('hint').textContent=hint;
    else $('hint').style.opacity='0';
  } else if(model.time<4)$('hint').textContent='← → Дорожки · ↑ Прыжок · ↓ Подкат';
  else if(model.time<8)$('hint').textContent='↑ Прыжок через трубы';
  else if(model.time<12)$('hint').textContent='↓ Подкат под аркой';
  else if(model.time<16)$('hint').textContent='Крылышки помогают летать';
  else $('hint').style.opacity='0';
}
function events() {
  for(const e of model.events) {
    sound.play(e.type);stage?.handleEvent?.(e,model);
    if(e.type==='bump'){$('flash').classList.remove('active');void $('flash').offsetWidth;$('flash').classList.add('active');toast('Ой! Почтальон стал ближе');}
    if(e.type==='wings')toast('Крылышки! Выше всех препятствий',3);
    if(e.type==='land')toast('Крылышки исчезли — выбирайте дорожку');
    if(e.type==='fall'){$('hint').style.opacity='0';$('toast').hidden=true;}
  }
  model.events.length=0;
}
function frame(now) {
  const raw=last?(now-last)/1000:1/60,dt=Math.min(.25,Math.max(0,raw));last=now;
  if(model.state!=='paused'&&model.state!=='gameover')anim+=dt;
  model.step(dt);events();
  if(previousState!==model.state){if(model.state==='gameover')gameover();previousState=model.state;document.body.dataset.state=model.state;}
  if(model.state==='gameover'||(!$('toast').hidden&&performance.now()>toastUntil))$('toast').hidden=true;
  hudClock+=dt;if(hudClock>.08){updateHUD();hudClock=0;}
  const isMenu=model.state==='menu';stage.update(model,anim,dt,isMenu);
  avgMs=avgMs*.98+Math.min(1000,raw*1000)*.02;qualityClock+=dt;
  if(qualityClock>2.5){if(avgMs>24)stage.reduceQuality();qualityClock=0;}
  requestAnimationFrame(frame);
}
function bind() {
  $('play').addEventListener('click',start);$('retry').addEventListener('click',start);
  $('result-menu').addEventListener('click',menu);$('pause-menu').addEventListener('click',menu);
  $('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSheet(b.dataset.open)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{const old=sheet;closeSheets();document.querySelector(`[data-open="${old}"]`)?.focus({preventScroll:true});}));
  $('sound').checked=save.data.sound;$('quality').value=save.data.quality;
  $('sound').addEventListener('change',()=>{save.data.sound=$('sound').checked;sound.enabled=save.data.sound;save.save();sound.unlock();if(sound.enabled)sound.play('gift');});
  $('quality').addEventListener('change',()=>{save.data.quality=$('quality').value;save.save();stage.setQuality(save.data.quality);});
  document.addEventListener('keydown',e=>{
    if(sheet){if(e.code==='Escape'){e.preventDefault();closeSheets();}return;}
    if(e.code==='Escape'||e.code==='KeyP'){if(['running','paused'].includes(model.state)){e.preventDefault();model.state==='paused'?resume():pause();}return;}
    const a={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ArrowDown:'slide',KeyS:'slide'}[e.code];
    if(a&&model.state==='running'){e.preventDefault();if(!e.repeat){sound.unlock();model.input(a);}}
  });
  const canvas=stage.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{
    if(model.state!=='running'||swipe||e.isPrimary===false)return;
    sound.unlock();swipe={id:e.pointerId,x:e.clientX,y:e.clientY};
    try{canvas.setPointerCapture(e.pointerId);}catch{}
  },{passive:true});
  canvas.addEventListener('pointerup',e=>{
    if(!swipe||e.pointerId!==swipe.id)return;
    const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;
    const action=Math.abs(dx)>Math.abs(dy)*1.1?(dx>0?'right':'left'):(dy>0?'slide':'jump');
    sound.unlock();model.input(action);
  },{passive:true});
  canvas.addEventListener('pointercancel',()=>swipe=null);
  canvas.addEventListener('lostpointercapture',()=>swipe=null);
  document.querySelectorAll('#touch-controls button[data-action]').forEach(button=>{
    const action=button.dataset.action;
    button.addEventListener('pointerdown',e=>e.stopPropagation());
    button.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      if(model.state!=='running')return;
      sound.unlock();model.input(action);
    });
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('resize',()=>stage.resize());
  window.addEventListener('blur',()=>{swipe=null;pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){swipe=null;pause();}last=performance.now();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();showError('Браузер освободил память 3D. Закройте лишние вкладки и перезагрузите игру. Рекорд уже завершённых забегов сохранён.');});
}
$('reload').addEventListener('click',()=>location.reload());

try {
  const {Stage}=await import('./art.js');stage=new Stage($('world'));stage.setQuality(save.data.quality);
  stage.outfit(OUTFITS.find(o=>o.id===save.data.outfit).color);bind();updateWallet();menu();
  if(mode==='fall'||mode==='run')start(false);
  // Read-only diagnostics: no cheats exposed on a normal game page.
  window.__SKY_BABIES__=Object.freeze({version:'1.0.0',snapshot:()=>({...model.snapshot(),...stage.stats(),fps:Math.round(1000/avgMs),saveAvailable:save.available,best:save.data.best,wallet:save.data.gifts,quality:save.data.quality}),ready:true});
  document.body.classList.add('ready');$('loading').hidden=true;requestAnimationFrame(frame);
} catch(e) {
  showError(`Не удалось запустить 3D. Откройте игру через HTTP, а не двойным щелчком по файлу. Проверьте поддержку WebGL и наличие папки vendor. ${e instanceof Error?e.message:''}`);
}
