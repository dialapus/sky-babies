const KEY = 'sky-babies-run.v1';
const defaults = () => ({ best: 0, gifts: 0, sound: true, quality: 'auto', outfit: 'pink', owned: ['pink'], records: [] });
const natural = x => Number.isFinite(x) ? Math.max(0, Math.min(1e12, Math.floor(x))) : 0;
export const OUTFITS = [ { id: 'pink', name: 'Розовое облачко', price: 0, color: '#ec8fb6' }, { id: 'lilac', name: 'Лавандовый сон', price: 300, color: '#ad90e2' }, { id: 'blue', name: 'Голубая мечта', price: 500, color: '#83bddd' }, { id: 'gold', name: 'Солнечный лучик', price: 1000, color: '#f5c36b' } ];
export class SaveStore {
  constructor() {
    this.available = true; this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY), d = raw ? JSON.parse(raw) : {};
      if (d && typeof d === 'object') {
        this.data.best = natural(d.best); this.data.gifts = natural(d.gifts);
        this.data.sound = d.sound !== false;
        this.data.quality = ['auto','low','high'].includes(d.quality) ? d.quality : 'auto';
        this.data.owned = ['pink', ...(Array.isArray(d.owned) ? d.owned.filter(x => OUTFITS.some(o => o.id === x)) : [])].filter((v,i,a) => a.indexOf(v) === i);
        this.data.outfit = this.data.owned.includes(d.outfit) ? d.outfit : 'pink';
        this.data.records = (Array.isArray(d.records) ? d.records : []).filter(r => r && typeof r === 'object').map(r => ({ score: natural(r.score), gifts: natural(r.gifts), date: typeof r.date === 'string' ? r.date.slice(0,10) : '' })).sort((a,b) => b.score - a.score).slice(0,5);
      }
    } catch { this.available = false; }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.available = true; return true; } catch { this.available = false; return false; } }
  addRun(score, gifts) { this.data.best = Math.max(this.data.best, natural(score)); this.data.gifts += natural(gifts); this.data.records.push({ score: natural(score), gifts: natural(gifts), date: new Date().toISOString().slice(0,10) }); this.data.records.sort((a,b) => b.score - a.score); this.data.records = this.data.records.slice(0,5); this.save(); }
  choose(id) {
    const item = OUTFITS.find(o => o.id === id); if (!item) return false;
    if (!this.data.owned.includes(id)) { if (this.data.gifts < item.price) return false; this.data.gifts -= item.price; this.data.owned.push(id); }
    this.data.outfit = id; this.save(); return true;
  }
}
