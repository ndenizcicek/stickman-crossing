// DOM screens layered over the canvas: main menu, city picker, settings, pause, game over, ad countdown.
import { APP_VERSION, CITIES, CITY_ORDER, CityId } from './config.js';
import { progress } from './progress.js';
import { Renderer } from './render.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Map geometry, in px: vertical distance between circles, circle size, top padding. */
const MAP_ROW = 118, DISC = 76, MAP_TOP = 12;
/** Circle i sits left (28%) or right (72%) alternately, starting on the left. */
const mapPos = (i: number) => ({ x: i % 2 === 0 ? 28 : 72, y: MAP_TOP + i * MAP_ROW });

const LOCK_OPEN_SVG = `<svg class="lock-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 9.6-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="currentColor"/></svg>`;
const LOCK_SVG = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="currentColor"/><circle cx="12" cy="16" r="1.8" fill="#f5f8fa"/></svg>`;

export interface SettingsState {
  sound: boolean;
  vibration: boolean;
  /** Only shown in the app, where AdMob's privacy options form exists. */
  showAdChoices: boolean;
}

export class UI {
  private overlay = $<HTMLDivElement>('overlay');
  private hudEl = $<HTMLDivElement>('hud');
  private scoreEl = $<HTMLDivElement>('score');
  private chainEl = $<HTMLDivElement>('chain');
  private bestEl = $<HTMLSpanElement>('best');
  private cityEl = $<HTMLSpanElement>('cityname');
  readonly pauseBtn = $<HTMLButtonElement>('pause');

  get open() { return !this.overlay.hidden; }

  hud(score: number, friends: number, city: CityId, best: number) {
    this.scoreEl.textContent = String(score);
    this.chainEl.textContent = friends ? `Chain: ${friends} · every step ×${friends + 1}` : '';
    this.cityEl.textContent = CITIES[city].name;
    this.bestEl.textContent = String(best);
  }

  /** The score bar and pause button only show while a round is on screen. */
  showHud(on: boolean) { this.hudEl.hidden = !on; }

  private show(html: string, wide = false) {
    this.overlay.innerHTML = `<div class="card${wide ? ' wide' : ''}">${html}</div>`;
    this.overlay.hidden = false;
    this.overlay.querySelector<HTMLButtonElement>('[data-primary]')?.focus();
  }
  hide() { this.overlay.hidden = true; this.overlay.innerHTML = ''; }

  private on(id: string, fn: () => void) { document.getElementById(id)?.addEventListener('click', fn); }

  /** Pressing Enter while a screen is open triggers its main button. */
  primary() { this.overlay.querySelector<HTMLButtonElement>('[data-primary]')?.click(); }

  menu(o: { onPlay: () => void; onSettings: () => void }) {
    this.show(`
      <h1>Stickman <span>Crossing</span></h1>
      <p class="lead">Cross the street. Grab your friends. Don’t get flattened.</p>
      <div class="btns">
        <button data-primary id="m-play" class="big-btn">Play</button>
        <button id="m-settings" class="ghost">Settings</button>
      </div>`);
    this.on('m-play', o.onPlay);
    this.on('m-settings', o.onSettings);
  }

  /**
   * City map: one circle per city, zigzagging left and right down the screen, joined by a dashed trail.
   * Built entirely from CITY_ORDER, so adding a city to config.ts adds a circle here.
   */
  cities(current: CityId, o: { onPick: (c: CityId) => void; onLocked: (c: CityId) => void; onBack: () => void }) {
    const nodes = CITY_ORDER.map((k, i) => {
      const st = progress.status(k);
      const cls = st.kind === 'open' ? 'open' : st.kind;
      const sub = st.kind === 'open' ? `Best ${progress.best(k)}`
        : st.kind === 'unlockable' ? `Score ${st.score} in ${CITIES[st.prev].name}` : 'Locked';
      const { x, y } = mapPos(i);
      return `
        <button class="node ${cls}${k === current ? ' here' : ''}" data-city="${k}" style="left:${x}%;top:${y}px"
          aria-label="${CITIES[k].name}, ${st.kind === 'open' ? 'best score ' + progress.best(k) : 'locked'}">
          <span class="disc"><canvas></canvas>${st.kind === 'open' ? '' : LOCK_SVG}</span>
          <span class="label"><b>${CITIES[k].name}</b><small>${sub}</small></span>
        </button>`;
    }).join('');
    const height = mapPos(CITY_ORDER.length - 1).y + MAP_ROW;
    this.show(`
      <h2 class="ink">Pick a city</h2>
      <p class="hint">Tap to hop · Swipe to dodge · Grab people who wave</p>
      <div class="map-scroll" id="map-scroll">
        <div class="map" id="map" style="height:${height}px"><svg class="trail" id="trail" aria-hidden="true"></svg>${nodes}</div>
      </div>
      <button id="c-back" class="ghost">Back</button>`, true);

    const map = $<HTMLDivElement>('map');
    map.querySelectorAll<HTMLButtonElement>('.node').forEach(b => {
      const k = b.dataset.city as CityId;
      const city = CITIES[k];
      new Renderer(b.querySelector('canvas')!).badge(city.badge, 62, city.paint?.[city.badge]?.[0]);
      b.addEventListener('click', () => (progress.isOpen(k) ? o.onPick(k) : o.onLocked(k)));
    });
    this.drawTrail();
    map.querySelector<HTMLButtonElement>('.here')?.scrollIntoView({ block: 'center' });
    this.on('c-back', o.onBack);
  }

  /** Dashed trail between the circles. Solid ink up to the last open city, faint after it. */
  private drawTrail() {
    const map = document.getElementById('map'), svg = document.getElementById('trail');
    if (!map || !svg) return;
    const w = map.clientWidth, h = map.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w)); svg.setAttribute('height', String(h));
    let paths = '';
    for (let i = 0; i < CITY_ORDER.length - 1; i++) {
      const a = mapPos(i), b = mapPos(i + 1);
      const ax = a.x / 100 * w, ay = a.y + DISC / 2, bx = b.x / 100 * w, by = b.y + DISC / 2;
      const open = progress.isOpen(CITY_ORDER[i + 1]);
      paths += `<path class="${open ? 'on' : 'off'}" d="M${ax} ${ay} C ${ax} ${ay + MAP_ROW * .55}, ${bx} ${by - MAP_ROW * .55}, ${bx} ${by}"/>`;
    }
    svg.innerHTML = paths;
  }

  /** What it takes to open a locked city: a score in the previous city, or a number of ads. */
  lockSheet(c: CityId, o: { onPlay: (c: CityId) => void; onWatchAd: () => void; onBack: () => void }) {
    const st = progress.status(c);
    const city = CITIES[c];
    let body: string;
    if (st.kind === 'unlockable') {
      const pct = Math.min(100, Math.round(st.prevBest / st.score * 100));
      const dots = Array.from({ length: st.ads }, (_, i) => `<i class="${i < st.adsWatched ? 'on' : ''}"></i>`).join('');
      body = `
        <div class="way">
          <p><b>Score ${st.score} in ${CITIES[st.prev].name}</b></p>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${st.score}" aria-valuenow="${st.prevBest}"><span style="width:${pct}%"></span></div>
          <p class="small">Your best: ${st.prevBest} / ${st.score}</p>
          <button id="l-play" data-primary>Play ${CITIES[st.prev].name}</button>
        </div>
        <p class="or">or</p>
        <div class="way">
          <p><b>Watch ${st.ads} ads</b></p>
          <div class="dots" aria-label="${st.adsWatched} of ${st.ads} watched">${dots}</div>
          <p class="small">${st.adsWatched} of ${st.ads} watched</p>
          <button id="l-ad" class="alt">Watch an ad</button>
        </div>`;
    } else if (st.kind === 'blocked') {
      body = `<p>Unlock <b>${CITIES[st.waitingFor].name}</b> first.</p>`;
    } else {
      body = '';
    }
    this.show(`
      <div class="lock-head"><span class="disc locked"><canvas id="l-badge"></canvas>${LOCK_SVG}</span></div>
      <h2 class="ink">${city.name}</h2>
      <p class="lead">${city.tagline}</p>
      ${body}
      <button id="l-back" class="ghost">Back to map</button>`);
    new Renderer($<HTMLCanvasElement>('l-badge')).badge(city.badge, 62, city.paint?.[city.badge]?.[0]);
    if (st.kind === 'unlockable') this.on('l-play', () => o.onPlay(st.prev));
    this.on('l-ad', o.onWatchAd);
    this.on('l-back', o.onBack);
  }

  unlocked(c: CityId, o: { onPlay: () => void; onMap: () => void }) {
    const city = CITIES[c];
    this.show(`
      <div class="lock-head"><span class="disc open pop"><canvas id="u-badge"></canvas></span></div>
      <h2>${city.name} unlocked!</h2>
      <p class="lead">${city.tagline}</p>
      <div class="btns">
        <button data-primary id="u-play">Play ${city.name}</button>
        <button class="ghost" id="u-map">Back to map</button>
      </div>`);
    new Renderer($<HTMLCanvasElement>('u-badge')).badge(city.badge, 62, city.paint?.[city.badge]?.[0]);
    this.on('u-play', o.onPlay);
    this.on('u-map', o.onMap);
  }

  settings(s: SettingsState, o: {
    onSound: (on: boolean) => void; onVibration: (on: boolean) => void;
    onPrivacy: () => void; onAdChoices: () => void; onBack: () => void;
  }) {
    const toggle = (id: string, label: string, on: boolean) => `
      <button class="toggle" id="${id}" role="switch" aria-checked="${on}">
        <span>${label}</span><span class="knob">${on ? 'On' : 'Off'}</span>
      </button>`;
    this.show(`
      <h2 class="ink">Settings</h2>
      <div class="rows">
        ${toggle('s-sound', 'Sound effects', s.sound)}
        ${toggle('s-vib', 'Vibration', s.vibration)}
        <button class="row-link" id="s-privacy">Privacy policy</button>
        ${s.showAdChoices ? '<button class="row-link" id="s-ads">Ad privacy choices</button>' : ''}
      </div>
      <button data-primary id="s-back">Done</button>
      <p class="version">Version ${APP_VERSION}</p>`);
    const flip = (id: string, cb: (on: boolean) => void) => this.on(id, () => {
      const b = $<HTMLButtonElement>(id);
      const on = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(on));
      b.querySelector('.knob')!.textContent = on ? 'On' : 'Off';
      cb(on);
    });
    flip('s-sound', o.onSound);
    flip('s-vib', o.onVibration);
    this.on('s-privacy', o.onPrivacy);
    this.on('s-ads', o.onAdChoices);
    this.on('s-back', o.onBack);
  }

  privacy(onBack: () => void) {
    this.show(`
      <iframe class="doc" src="./privacy.html" title="Privacy policy"></iframe>
      <button data-primary id="p-back">Back</button>`, true);
    this.on('p-back', onBack);
  }

  pause(o: { onResume: () => void; onSettings: () => void; onMenu: () => void }) {
    this.show(`
      <h2 class="ink">Paused</h2>
      <div class="btns">
        <button data-primary id="p-resume">Resume</button>
        <button id="p-settings" class="ghost">Settings</button>
        <button id="p-menu" class="ghost">Main menu</button>
      </div>`);
    this.on('p-resume', o.onResume);
    this.on('p-settings', o.onSettings);
    this.on('p-menu', o.onMenu);
  }

  gameOver(o: {
    cause: string; score: number; best: number; newBest: boolean; city: CityId; canRevive: boolean;
    /** Cities this round just opened. */
    opened: CityId[];
    onRevive: () => void; onAgain: () => void; onCities: () => void; onMenu: () => void;
  }) {
    this.show(`
      <h2>${o.cause}</h2>
      <div class="big">${o.score}</div>
      <p>${CITIES[o.city].name} · ${o.newBest ? '<span class="hl">New best!</span>' : 'Best: ' + o.best}</p>
      ${o.opened.map(c => `<p class="unlock-note">${LOCK_OPEN_SVG}<span class="hl">${CITIES[c].name} unlocked!</span></p>`).join('')}
      <div class="btns">
        ${o.canRevive ? '<button class="alt" id="g-revive">Watch an ad to continue</button>' : ''}
        <button data-primary id="g-again">Play again</button>
        <div class="pair">
          <button class="ghost" id="g-cities">Change city</button>
          <button class="ghost" id="g-menu">Menu</button>
        </div>
      </div>`);
    this.on('g-revive', o.onRevive);
    this.on('g-again', o.onAgain);
    this.on('g-cities', o.onCities);
    this.on('g-menu', o.onMenu);
  }

  /** Placeholder ad: a countdown card. Resolves when it finishes. */
  countdown(label: string, seconds: number): Promise<void> {
    return new Promise(resolve => {
      let left = seconds;
      this.show(`<p>${label}</p><div class="adcount" id="adcount">${left}</div><p>The real portal ad plays here.</p>`);
      const iv = setInterval(() => {
        left--;
        const el = document.getElementById('adcount');
        if (el) el.textContent = String(left);
        if (left <= 0) { clearInterval(iv); this.hide(); resolve(); }
      }, 1000);
    });
  }
}
