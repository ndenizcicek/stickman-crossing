// AdMob for the iOS and Android apps, through the @capacitor-community/admob plugin.
import { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import type { AdProvider } from './ads.js';

/**
 * Ad unit IDs. These are Google's official TEST units, safe to use during development.
 * Before release, create the app and two ad units (Interstitial, Rewarded) in the AdMob console
 * and paste the real IDs here. Never click your own real ads: AdMob can suspend the account.
 */
const AD_UNITS = {
  ios: {
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
  android: {
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
};
/** Keep true until the real IDs are in and the app is going to the store. */
const TESTING = true;

type Platform = keyof typeof AD_UNITS;

export class AdMobProvider implements AdProvider {
  readonly name = 'admob';
  private units = AD_UNITS[(Capacitor.getPlatform() === 'android' ? 'android' : 'ios') as Platform];
  private interstitialReady = false;
  private rewardedReady = false;

  async init() {
    await AdMob.initialize({ initializeForTesting: TESTING });
    // EU/UK players must be asked for consent before personalised ads (Google UMP form).
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
    } catch { /* consent form unavailable: AdMob falls back to non-personalised ads */ }
    // iOS App Tracking Transparency prompt. Declining is fine, ads still show (non-personalised).
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch { /* older iOS or not available */ }
    }
    void this.loadInterstitial();
    void this.loadRewarded();
  }

  gameplayStart() {}
  gameplayStop() {}

  async privacyOptions() {
    try { await AdMob.showPrivacyOptionsForm(); } catch { /* not required in this region */ }
  }

  private async loadInterstitial() {
    try { await AdMob.prepareInterstitial({ adId: this.units.interstitial, isTesting: TESTING }); this.interstitialReady = true; }
    catch { this.interstitialReady = false; }
  }

  private async loadRewarded() {
    try { await AdMob.prepareRewardVideoAd({ adId: this.units.rewarded, isTesting: TESTING }); this.rewardedReady = true; }
    catch { this.rewardedReady = false; }
  }

  async interstitial() {
    // No ad loaded (offline, no fill): just carry on, never block the player.
    if (!this.interstitialReady) { void this.loadInterstitial(); return; }
    this.interstitialReady = false;
    const closed = waitFor([InterstitialAdPluginEvents.Dismissed, InterstitialAdPluginEvents.FailedToShow]);
    try { await AdMob.showInterstitial(); await closed.promise; }
    catch { /* failed to show */ }
    finally { closed.cancel(); void this.loadInterstitial(); }
  }

  async rewarded(): Promise<boolean> {
    if (!this.rewardedReady) { void this.loadRewarded(); return false; }
    this.rewardedReady = false;
    let earned = false;
    const rewardSub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; });
    const closed = waitFor([RewardAdPluginEvents.Dismissed, RewardAdPluginEvents.FailedToShow]);
    try {
      const item = await AdMob.showRewardVideoAd();
      if (item && typeof item.amount === 'number') earned = true;
      await closed.promise;
    } catch { /* failed to show */ }
    finally { closed.cancel(); await rewardSub.remove(); void this.loadRewarded(); }
    return earned;
  }

  /** True when a rewarded ad is loaded, so the game can hide the "continue" button when there is none. */
  get hasRewarded() { return this.rewardedReady; }
}

/** Resolves on the first of the given plugin events, or after a safety timeout. */
function waitFor(events: string[], timeoutMs = 90_000) {
  const subs: { remove: () => Promise<void> }[] = [];
  let timer = 0;
  const promise = new Promise<void>(resolve => {
    timer = window.setTimeout(resolve, timeoutMs);
    for (const e of events) {
      void AdMob.addListener(e as never, () => resolve()).then(s => subs.push(s));
    }
  });
  return { promise, cancel: () => { clearTimeout(timer); subs.forEach(s => void s.remove()); } };
}

export const isNativeApp = () => Capacitor.isNativePlatform();
