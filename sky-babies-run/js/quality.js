// Pure resolution policy: auto/high never render below one CSS pixel per device pixel.
export function chooseDPR({quality='auto',devicePixelRatio=1,mobile=false,softwareRenderer=false}={}) {
  const physical=Math.max(1,Math.min(Number.isFinite(devicePixelRatio)?devicePixelRatio:1,mobile?1.5:1.75));
  if(quality==='low')return .85;
  if(quality==='high')return physical;
  return Math.max(1,Math.min(physical,softwareRenderer?1:(mobile?1.15:1.25)));
}
export function reduceDPR(current,quality='auto') {
  if(quality!=='auto'||!Number.isFinite(current)||current<=1)return current;
  return Math.max(1,Math.round((current-.12)*100)/100);
}
