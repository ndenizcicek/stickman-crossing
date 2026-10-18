// Phone vibration through the Capacitor Haptics plugin (falls back to navigator.vibrate in browsers that support it).
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export class Vibration {
  enabled = true;
  private fire(style: ImpactStyle) {
    if (!this.enabled) return;
    Haptics.impact({ style }).catch(() => { /* not supported on this device */ });
  }
  pickup() { this.fire(ImpactStyle.Light); }
  friendLost() { this.fire(ImpactStyle.Medium); }
  hit() { this.fire(ImpactStyle.Heavy); }
}
