// Steam achievements. The API names here must match the ones created in Steamworks
// (App Admin > Stats & Achievements); docs/STEAM_RELEASE.md lists them with names and descriptions to copy.
import { CITY_ORDER, CityId } from './config.js';
import { steam } from './platform.js';

export const ACHIEVEMENTS = {
  FIRST_CROSSING: { name: 'First Steps', description: 'Score 10 points in any city.' },
  HAND_IN_HAND: { name: 'Hand in Hand', description: 'Have 3 friends in your chain at once.' },
  HUMAN_TRAIN: { name: 'Human Train', description: 'Have 8 friends in your chain at once.' },
  CENTURY: { name: 'Century', description: 'Score 100 points in one run.' },
  MARATHON: { name: 'Marathon', description: 'Score 250 points in one run.' },
  GLOBETROTTER: { name: 'Globetrotter', description: 'Unlock every city.' },
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;

const unlocked = new Set<AchievementId>();

function unlock(id: AchievementId) {
  if (unlocked.has(id)) return;
  unlocked.add(id);
  steam()?.unlockAchievement(id);
}

/** Called whenever the score or chain changes during a run. */
export function checkRun(score: number, chain: number) {
  if (score >= 10) unlock('FIRST_CROSSING');
  if (score >= 100) unlock('CENTURY');
  if (score >= 250) unlock('MARATHON');
  if (chain >= 3) unlock('HAND_IN_HAND');
  if (chain >= 8) unlock('HUMAN_TRAIN');
}

/** Called after unlocks change. */
export function checkCities(isOpen: (c: CityId) => boolean) {
  if (CITY_ORDER.every(isOpen)) unlock('GLOBETROTTER');
}
