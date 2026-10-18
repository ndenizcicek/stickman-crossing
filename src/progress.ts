// Best scores and the city unlock chain. All rules come from CITIES / CITY_ORDER in config.ts.
import { CITIES, CITY_ORDER, CityId } from './config.js';
import { store } from './storage.js';

export type CityStatus =
  | { kind: 'open' }
  /** Locked, and the city before it is open, so the player can work on unlocking it now. */
  | { kind: 'unlockable'; prev: CityId; prevBest: number; score: number; adsWatched: number; ads: number }
  /** Locked behind another locked city. */
  | { kind: 'blocked'; waitingFor: CityId };

const bestKey = (c: CityId) => 'best:' + c;
const unlockedKey = (c: CityId) => 'unlocked:' + c;
const adsKey = (c: CityId) => 'ads:' + c;

export const progress = {
  best(c: CityId) { return store.getNumber(bestKey(c)); },

  /** Records a finished round. Returns true if it is a new best. */
  submitScore(c: CityId, score: number) {
    if (score <= this.best(c)) return false;
    store.set(bestKey(c), score);
    return true;
  },

  isOpen(c: CityId): boolean {
    return !CITIES[c].unlock || store.get(unlockedKey(c)) === '1';
  },

  previous(c: CityId): CityId | null {
    const i = CITY_ORDER.indexOf(c);
    return i > 0 ? CITY_ORDER[i - 1] : null;
  },

  status(c: CityId): CityStatus {
    if (this.isOpen(c)) return { kind: 'open' };
    const prev = this.previous(c);
    const rule = CITIES[c].unlock!;
    if (prev && !this.isOpen(prev)) return { kind: 'blocked', waitingFor: prev };
    return {
      kind: 'unlockable', prev: prev ?? c, prevBest: prev ? this.best(prev) : 0,
      score: rule.score, adsWatched: store.getNumber(adsKey(c)), ads: rule.ads,
    };
  },

  /** Counts one finished rewarded ad towards a city. Returns true if that unlocked it. */
  addAd(c: CityId): boolean {
    const st = this.status(c);
    if (st.kind !== 'unlockable') return false;
    const n = st.adsWatched + 1;
    store.set(adsKey(c), n);
    if (n >= st.ads) { store.set(unlockedKey(c), '1'); return true; }
    return false;
  },

  /**
   * Opens every city whose score requirement is now met. Cascades down the chain, so one great run can
   * open several cities if the player already had high scores further along. Returns the newly opened cities.
   */
  checkScoreUnlocks(): CityId[] {
    const opened: CityId[] = [];
    for (const c of CITY_ORDER) {
      const st = this.status(c);
      if (st.kind === 'unlockable' && st.prevBest >= st.score) {
        store.set(unlockedKey(c), '1');
        opened.push(c);
      }
    }
    return opened;
  },
};
