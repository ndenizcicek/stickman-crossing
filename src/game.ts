// Game rules: the player, the chain of friends, scoring, camera and death.
import { CityId, GRID_COLS, TUNING, VEHICLES } from './config.js';
import { pick, rnd, Vehicle, World } from './world.js';

export interface Walker {
  col: number; row: number;
  /** Where the current hop started, and hop progress 0..1. */
  fromCol: number; fromRow: number; hop: number;
  color: string;
}
/** Someone flung by a vehicle (purely visual). */
export interface Flyer { x: number; y: number; vx: number; vy: number; rot: number; spin: number; t: number; color: string; isPlayer: boolean }
/** Friends running off after the chain broke (purely visual). */
export interface Scatter { x: number; y: number; dx: number; t: number; color: string }
export interface FloatText { x: number; y: number; text: string; t: number; red: boolean }

export type GameState = 'ready' | 'play' | 'dying' | 'over';

export interface GameHooks {
  hop(): void;
  pickup(): void;
  friendLost(): void;
  hit(): void;
  over(cause: string): void;
  scoreChanged(): void;
}

export class Game {
  world: World;
  state: GameState = 'ready';
  player: Walker = walker(4, 1, '#fff');
  friends: Walker[] = [];
  flyers: Flyer[] = [];
  scatters: Scatter[] = [];
  floats: FloatText[] = [];
  /** Bottom visible row (fractional). */
  camRow = -1;
  maxRow = 1;
  score = 0;
  revived = false;
  shield = 0;
  time = 0;
  private started = false;
  private queued: [number, number] | null = null;
  private dyingLeft = 0;
  private cause = '';

  constructor(cityId: CityId, private hooks: GameHooks) {
    this.world = new World(cityId);
    this.world.ensure(40);
  }

  /** Chain multiplier: every friend adds one. */
  get multiplier() { return 1 + this.friends.length; }

  start() { this.state = 'play'; }

  move(dx: number, dy: number) {
    if (this.state !== 'play') return;
    const p = this.player;
    if (p.hop < 1) { this.queued = [dx, dy]; return; }
    const nc = p.col + dx, nr = p.row + dy;
    if (nc < 0 || nc >= GRID_COLS || nr < 0) return;
    this.world.ensure(nr + 30);
    if (this.world.isBlocked(nc, nr)) return;
    this.started = true;

    // Player hops; each friend steps into the spot of the one ahead (snake-style).
    let prev = { col: p.col, row: p.row };
    hopTo(p, nc, nr);
    for (const f of this.friends) { const o = { col: f.col, row: f.row }; hopTo(f, prev.col, prev.row); prev = o; }
    this.hooks.hop();

    const row = this.world.rows[nr];
    if (row.kind === 'side') {
      const k = row.people.findIndex(q => q.col === nc);
      if (k >= 0) {
        const person = row.people.splice(k, 1)[0];
        const f = walker(nc, nr, person.color);
        this.friends.push(f);
        this.floats.push({ x: nc + .5, y: nr + 1, text: '+1 friend!', t: 0, red: true });
        this.hooks.pickup();
      }
    }
    if (nr > this.maxRow) {
      const gain = this.multiplier;
      this.score += gain;
      this.maxRow = nr;
      if (gain > 1) this.floats.push({ x: nc + .5, y: nr + .8, text: '+' + gain, t: 0, red: false });
    }
    this.hooks.scoreChanged();
  }

  update(dt: number, viewRows: number) {
    this.time += dt;
    if (this.state === 'over') return;
    this.world.ensure(Math.ceil(this.camRow + viewRows) + 6);
    this.world.updateTraffic(dt, Math.floor(this.camRow) - 3, Math.ceil(this.camRow + viewRows) + 3);

    const step = dt / TUNING.hopSeconds;
    const p = this.player;
    if (p.hop < 1) {
      p.hop = Math.min(1, p.hop + step);
      if (p.hop >= 1 && this.queued) { const q = this.queued; this.queued = null; this.move(q[0], q[1]); }
    }
    for (const f of this.friends) f.hop = Math.min(1, f.hop + step);

    if (this.state === 'play') {
      if (this.shield > 0) this.shield -= dt;
      // Camera follows the player up, and creeps on its own once you've moved.
      const target = p.row - 3;
      if (target > this.camRow) this.camRow += (target - this.camRow) * Math.min(1, dt * 5);
      if (this.started) this.camRow += (TUNING.scrollBase + Math.min(TUNING.scrollMaxExtra, this.maxRow / TUNING.scrollRampRows)) * dt;
      if (p.row < this.camRow - .4) this.die('Too slow!');
      else if (this.shield <= 0) this.checkHits();
    }
    if (this.state === 'dying' && (this.dyingLeft -= dt) <= 0) {
      this.state = 'over';
      this.hooks.over(this.cause);
    }

    for (const f of this.flyers) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt; }
    this.flyers = this.flyers.filter(f => f.t < 1.1);
    for (const s of this.scatters) { s.t += dt; s.x += s.dx * 3 * dt; }
    this.scatters = this.scatters.filter(s => s.t < .8);
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter(f => f.t < .9);
  }

  private checkHits() {
    const p = this.player;
    const hit = this.world.vehicleAt(p.col, p.row);
    if (hit) { this.fling(p, hit.v, hit.dir, true); this.die(VEHICLES[hit.v.kind].deathText); return; }
    for (let k = 0; k < this.friends.length; k++) {
      const f = this.friends[k];
      const h = this.world.vehicleAt(f.col, f.row);
      if (!h) continue;
      this.fling(f, h.v, h.dir, false);
      // Everyone behind the hit friend lets go and runs off.
      for (let j = k + 1; j < this.friends.length; j++) this.scatter(this.friends[j]);
      this.floats.push({ x: f.col + .5, y: f.row + 1, text: 'Ouch!', t: 0, red: true });
      this.friends.length = k;
      this.hooks.friendLost();
      this.hooks.scoreChanged();
      break;
    }
  }

  private fling(w: Walker, v: Vehicle, dir: 1 | -1, isPlayer: boolean) {
    this.flyers.push({ x: w.col + .5, y: w.row + .5, vx: dir * (v.speed + 2.5), vy: rnd(-.6, .6), rot: 0, spin: dir * rnd(8, 13), t: 0, color: w.color, isPlayer });
    this.hooks.hit();
  }

  private scatter(w: Walker) {
    this.scatters.push({ x: w.col + .5, y: w.row + .5, dx: pick([-1, 1]), t: 0, color: w.color });
  }

  private die(cause: string) {
    this.state = 'dying';
    this.dyingLeft = .9;
    this.cause = cause;
    for (const f of this.friends) this.scatter(f);
    this.friends = [];
    this.hooks.scoreChanged();
  }

  /** Continue after a rewarded ad: back to the nearest sidewalk, briefly invulnerable. */
  revive() {
    this.revived = true;
    let r = this.player.row;
    while (r > 0 && this.world.rows[r].kind !== 'side') r--;
    let c = this.player.col;
    if (this.world.isBlocked(c, r)) for (let k = 0; k < GRID_COLS; k++) if (!this.world.isBlocked(k, r)) { c = k; break; }
    this.player = walker(c, r, '#fff');
    this.camRow = Math.min(this.camRow, r - 2);
    this.shield = TUNING.reviveShield;
    this.flyers = [];
    this.queued = null;
    this.state = 'play';
  }
}

function walker(col: number, row: number, color: string): Walker {
  return { col, row, fromCol: col, fromRow: row, hop: 1, color };
}
function hopTo(w: Walker, col: number, row: number) {
  w.fromCol = w.col; w.fromRow = w.row; w.col = col; w.row = row; w.hop = 0;
}
