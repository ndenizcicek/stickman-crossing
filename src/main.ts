// Entry point: wires the game, renderer, screens, sound, vibration, input and ads together.
//
// Screen flow:  Main menu ─ Play ─▶ City picker ─▶ Game ─▶ Game over ─▶ Play again / Change city / Menu
//                        └ Settings (also reachable from Pause)
import { AdPacing, AdProvider, FakeAdProvider } from './ads.js';
import { AdMobProvider, isNativeApp } from './ads-admob.js';
import { Sfx } from './audio.js';
import { CITIES, CityId } from './config.js';
import { Game, GameHooks } from './game.js';
import { Vibration } from './haptics.js';
import { Renderer } from './render.js';
import { progress } from './progress.js';
import { store } from './storage.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const ui = new UI();
const sfx = new Sfx();
const vibe = new Vibration();
const pacing = new AdPacing();
// iOS / Android app: real AdMob ads. Browser: placeholder countdown (portal SDKs plug in here later).
const ads: AdProvider = isNativeApp() ? new AdMobProvider() : new FakeAdProvider((label, s) => ui.countdown(label, s));

// Real values are read in boot(), after saved progress has loaded.
let city: CityId = 'istanbul';
let best = 0;
/** Game clock frozen: menus over a running round, pause, ads. */
let frozen = false;
let honkCooldown = 0;


const hooks: GameHooks = {
  hop: () => sfx.hop(),
  pickup: () => { sfx.pickup(); vibe.pickup(); },
  friendLost: () => { sfx.friendLost(); vibe.friendLost(); },
  hit: () => { sfx.hit(); vibe.hit(); },
  scoreChanged: () => ui.hud(game.score, game.friends.length, city, best),
  over: cause => onGameOver(cause),
};

let game = new Game(city, hooks);

function newGame() {
  best = progress.best(city);
  game = new Game(city, hooks);
  hooks.scoreChanged();
}

// ---------- screens ----------
function showMenu() {
  frozen = false;
  ui.showHud(false);
  newGame(); // the street keeps moving behind the menu as a live background
  ui.menu({ onPlay: showCities, onSettings: () => showSettings(showMenu) });
}

function showCities() {
  ui.showHud(false);
  ui.cities(city, {
    onPick: startCity,
    onLocked: showLock,
    onBack: showMenu,
  });
}

function startCity(c: CityId) {
  city = c;
  store.set('city', c);
  newGame();
  ui.hide();
  play();
}

function showLock(c: CityId) {
  ui.lockSheet(c, {
    onPlay: startCity,
    onWatchAd: () => void watchUnlockAd(c),
    onBack: showCities,
  });
}

async function watchUnlockAd(c: CityId) {
  const earned = await withAd(() => ads.rewarded());
  if (earned && progress.addAd(c)) ui.unlocked(c, { onPlay: () => startCity(c), onMap: showCities });
  else showLock(c);
}

function showSettings(back: () => void) {
  ui.settings({ sound: !sfx.muted, vibration: vibe.enabled, showAdChoices: !!ads.privacyOptions && isNativeApp() }, {
    onSound: on => { sfx.unlock(); sfx.muted = !on; store.set('sound', on ? 'on' : 'off'); if (on) sfx.pickup(); },
    onVibration: on => { vibe.enabled = on; store.set('vibration', on ? 'on' : 'off'); if (on) vibe.pickup(); },
    onPrivacy: () => ui.privacy(() => showSettings(back)),
    onAdChoices: () => void ads.privacyOptions?.(),
    onBack: back,
  });
}

function play() {
  frozen = false;
  ui.showHud(true);
  game.start();
  ads.gameplayStart();
}

function pause() {
  if (game.state !== 'play' || frozen) return;
  frozen = true;
  ads.gameplayStop();
  showPause();
}

function showPause() {
  ui.pause({
    onResume: () => { ui.hide(); frozen = false; ads.gameplayStart(); },
    onSettings: () => showSettings(showPause),
    onMenu: () => void afterBreak(showMenu),
  });
}

function onGameOver(cause: string) {
  ads.gameplayStop();
  pacing.roundFinished();
  const newBest = progress.submitScore(city, game.score);
  if (newBest) { best = game.score; hooks.scoreChanged(); }
  const opened = progress.checkScoreUnlocks();
  showGameOver(cause, newBest, !game.revived, opened);
}

function showGameOver(cause: string, newBest: boolean, canRevive: boolean, opened: CityId[] = []) {
  ui.gameOver({
    cause, score: game.score, best, newBest, city, canRevive, opened,
    onRevive: () => void watchRewarded(cause, newBest),
    onAgain: () => void afterBreak(() => { newGame(); play(); }),
    onCities: () => void afterBreak(showCities),
    onMenu: () => void afterBreak(showMenu),
  });
}

// ---------- ads ----------
/** Silence and freeze the game while any ad is on screen. */
async function withAd<T>(run: () => Promise<T>): Promise<T> {
  frozen = true; sfx.suspended = true;
  try { return await run(); } finally { frozen = false; sfx.suspended = false; pacing.adShown(); }
}

async function watchRewarded(cause: string, newBest: boolean) {
  const earned = await withAd(() => ads.rewarded());
  if (earned) { ui.hide(); game.revive(); ads.gameplayStart(); }
  // No ad available or closed early: back to the game-over card, without the continue button.
  else showGameOver(cause, newBest, false);
}

async function afterBreak(next: () => void) {
  if (pacing.breakDue()) await withAd(() => ads.interstitial());
  ui.hide();
  next();
}

// ---------- input ----------
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1], w: [0, 1], W: [0, 1], ' ': [0, 1],
  ArrowDown: [0, -1], s: [0, -1], S: [0, -1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};
window.addEventListener('keydown', e => {
  sfx.unlock();
  if (ui.open) {
    if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); ui.primary(); }
    return;
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { pause(); return; }
  const m = KEYS[e.key];
  if (m && !frozen) { e.preventDefault(); game.move(m[0], m[1]); }
});

let downX = 0, downY = 0, down = false;
canvas.addEventListener('pointerdown', e => { sfx.unlock(); down = true; downX = e.clientX; downY = e.clientY; });
canvas.addEventListener('pointercancel', () => { down = false; });
canvas.addEventListener('pointerup', e => {
  if (!down || frozen) { down = false; return; }
  down = false;
  const dx = e.clientX - downX, dy = e.clientY - downY;
  if (Math.hypot(dx, dy) < 24) game.move(0, 1);
  else if (Math.abs(dx) > Math.abs(dy)) game.move(dx > 0 ? 1 : -1, 0);
  else game.move(0, dy < 0 ? 1 : -1);
});
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
ui.pauseBtn.addEventListener('click', pause);

// Leaving the app or switching tabs mid-round pauses the game.
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden) pause();
});

// ---------- loop ----------
window.addEventListener('resize', () => renderer.resize());
renderer.resize();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (!frozen && !document.hidden) {
    game.update(dt, renderer.viewRows);
    if (game.state === 'play') {
      pacing.addPlayTime(dt);
      // Honk when the street is about to leave you behind.
      honkCooldown -= dt;
      if (game.player.row - game.camRow < .9 && honkCooldown <= 0) { sfx.honk(); honkCooldown = 1.4; }
    }
  }
  renderer.draw(game);
  requestAnimationFrame(frame);
}

async function boot() {
  await store.load();
  sfx.muted = store.get('sound') === 'off';
  vibe.enabled = store.get('vibration') !== 'off';
  const saved = store.get('city');
  city = saved && saved in CITIES && progress.isOpen(saved as CityId) ? saved as CityId : 'istanbul';
  progress.checkScoreUnlocks();
  showMenu();
  requestAnimationFrame(frame);
  // The game must start even if ads fail to initialise (offline, ad blocker, consent error).
  ads.init().catch(() => { /* play without ads */ });
}
void boot();
