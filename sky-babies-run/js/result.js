// Pure view model; the simulation's original reason remains visible in the subtitle.
export function resultPresentation(reason='') {
  if(/почтальон|догнал|канцеляри/i.test(reason))return {
    title:'Почтальон догнал!',eyebrow:'ВАС ВЕРНУЛИ В НЕБЕСНУЮ КАНЦЕЛЯРИЮ',icon:'#i-envelope',kind:'caught',tip:'Обходите препятствия: столкновения приближают почтальона.'
  };
  if(/дыр|пад|земл/i.test(reason))return {
    title:'Чуть не упала на Землю!',eyebrow:'ОСТОРОЖНО, В ОБЛАКАХ ЕСТЬ ПРОПАСТИ',icon:'#i-wing',kind:'fall',tip:'Перепрыгивайте дыры ↑ или уходите на соседнюю дорожку'
  };
  return {title:'Попробуем ещё раз!',eyebrow:'ОБЛАЧНОЕ ПРИКЛЮЧЕНИЕ ПРОДОЛЖАЕТСЯ',icon:'#i-star',kind:'other',tip:'Заранее выбирайте свободную дорожку и собирайте крылышки.'};
}

// Pure timing helper shared by runtime and tests; never combines multiple mobile instructions.
export function mobileOnboardingHint(time) {
  if(time<4)return 'Свайп ← → — смена дорожки';
  if(time<8)return 'Свайп ↑ — прыжок';
  if(time<12)return 'Свайп ↓ — подкат';
  return '';
}
