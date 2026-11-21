// Which build is running: the Steam desktop app (Electron), the iOS/Android app (Capacitor) or a browser.
// The Steam app exposes `window.steam` from desktop/preload.cjs; everything Steam-specific goes through it.
import { Capacitor } from '@capacitor/core';

export interface SteamBridge {
  /** Unlock a Steam achievement by its API name (see src/achievements.ts). Safe to call repeatedly. */
  unlockAchievement(id: string): void;
  setFullscreen(on: boolean): void;
  isFullscreen(): Promise<boolean>;
  quit(): void;
}

declare global {
  interface Window { steam?: SteamBridge }
}

export type Platform = 'steam' | 'mobile' | 'web';

export const platform: Platform =
  typeof window !== 'undefined' && window.steam ? 'steam'
    : Capacitor.isNativePlatform() ? 'mobile'
      : 'web';

export const steam = (): SteamBridge | undefined => window.steam;
