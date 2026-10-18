// Saved data: best scores, unlocked cities, ad progress, settings.
//
// In the iOS / Android app this uses Capacitor Preferences (UserDefaults on iOS, SharedPreferences on Android).
// That data stays until the app is deleted from the phone, which is exactly the lifetime we want: high scores
// and unlocks survive app updates and restarts, and a fresh install starts from zero.
// (Plain localStorage inside the app's web view can be cleared by iOS when the phone is low on space.)
//
// In a browser it falls back to localStorage. Every access is guarded: losing a score is acceptable,
// crashing the game is not.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREFIX = 'stickman-crossing:';
const native = () => Capacitor.isNativePlatform();
const cache = new Map<string, string>();

export const store = {
  /** Load everything into memory once at startup, so reads stay synchronous during play. */
  async load() {
    try {
      if (native()) {
        const { keys } = await Preferences.keys();
        for (const k of keys) {
          if (!k.startsWith(PREFIX)) continue;
          const { value } = await Preferences.get({ key: k });
          if (value !== null) cache.set(k.slice(PREFIX.length), value);
        }
      } else {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(PREFIX)) cache.set(k.slice(PREFIX.length), localStorage.getItem(k) ?? '');
        }
      }
    } catch { /* start with empty progress */ }
  },
  get(key: string): string | null {
    return cache.get(key) ?? null;
  },
  set(key: string, value: string | number) {
    const v = String(value);
    cache.set(key, v);
    try {
      if (native()) void Preferences.set({ key: PREFIX + key, value: v });
      else localStorage.setItem(PREFIX + key, v);
    } catch { /* keep it in memory for this session */ }
  },
  getNumber(key: string): number {
    const n = Number(this.get(key));
    return Number.isFinite(n) ? n : 0;
  },
};
