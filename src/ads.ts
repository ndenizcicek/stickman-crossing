// Ad layer. The game only talks to the AdProvider interface, so swapping the placeholder for
// a portal SDK (CrazyGames, Poki) or AdMob on mobile does not touch game code.
import { TUNING } from './config.js';

export interface AdProvider {
  readonly name: string;
  init(): Promise<void>;
  /** Tell the portal when real gameplay starts and stops (used for their analytics and ad timing). */
  gameplayStart(): void;
  gameplayStop(): void;
  /** Unskippable break between rounds. Resolves when the game may continue. */
  interstitial(): Promise<void>;
  /** Opt-in video. Resolves true only if the player earned the reward. */
  rewarded(): Promise<boolean>;
  /** Lets players change their ad consent later (required in the EU). Only some providers have it. */
  privacyOptions?(): Promise<void>;
}

/** Placeholder used during development: shows a 3-second countdown instead of a real ad. */
export class FakeAdProvider implements AdProvider {
  readonly name = 'fake';
  constructor(private showCountdown: (label: string, seconds: number) => Promise<void>) {}
  async init() {}
  gameplayStart() {}
  gameplayStop() {}
  interstitial() { return this.showCountdown('Ad break (placeholder)', 3); }
  async rewarded() { await this.showCountdown('Rewarded ad (placeholder)', 3); return true; }
}

/**
 * Decides when an interstitial is allowed, so players are not hit with an ad after every death:
 * at least TUNING.adBreakSeconds of actual play and TUNING.adBreakRounds finished rounds since the last ad.
 * Portals also enforce their own minimum spacing on top of this.
 */
export class AdPacing {
  private playSeconds = 0;
  private rounds = 0;

  addPlayTime(dt: number) { this.playSeconds += dt; }
  roundFinished() { this.rounds++; }
  /** Any ad (including a rewarded one) resets the clock. */
  adShown() { this.playSeconds = 0; this.rounds = 0; }
  breakDue() { return this.playSeconds >= TUNING.adBreakSeconds && this.rounds >= TUNING.adBreakRounds; }
}
