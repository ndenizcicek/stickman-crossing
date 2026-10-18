// The endless street: row generation and traffic simulation.
import {
  CITIES, CityId, GRID_COLS, LANE_MARGIN, ObstacleKind, PEOPLE_COLORS, TUNING, VEHICLES, VehicleKind,
} from './config.js';

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(a: readonly T[]): T => a[randInt(a.length)];

export interface Vehicle {
  kind: VehicleKind;
  len: number;
  h: number;
  /** Centre position in grid cells. */
  x: number;
  color: string;
  baseSpeed: number;
  speed: number;
  /** Stopping vehicles (dolmuş, minibus): seconds until the next sudden stop, and seconds left in the current stop. */
  stopIn: number;
  stopLeft: number;
  /** Animation phase offset. */
  phase: number;
}

export interface WaitingPerson { col: number; color: string; phase: number }

export interface SidewalkRow {
  kind: 'side';
  blocked: Map<number, ObstacleKind>;
  people: WaitingPerson[];
}
export interface LaneRow {
  kind: 'road' | 'bike' | 'tram';
  dir: 1 | -1;
  vehicles: Vehicle[];
  /** Off-screen cells on each side where vehicles wrap. Tram lines use a bigger margin so the warning has time to show. */
  margin: number;
}
export const laneLoop = (r: LaneRow) => GRID_COLS + 2 * r.margin;
export type Row = SidewalkRow | LaneRow;

export const isLane = (r: Row | undefined): r is LaneRow => !!r && r.kind !== 'side';

export class World {
  rows: Row[] = [];
  private plan = { kind: 'side' as 'side' | 'road', left: 0, total: 0 };

  constructor(readonly cityId: CityId) {}

  get city() { return CITIES[this.cityId]; }

  ensure(upToRow: number) {
    while (this.rows.length <= upToRow) this.rows.push(this.generate(this.rows.length));
  }

  private generate(i: number): Row {
    if (i < 4) {
      const s = this.sidewalk(i);
      // A first friend waits right before the first road, to teach the chain.
      if (i === 3) s.people = [{ col: 6, color: PEOPLE_COLORS[0], phase: 0 }];
      return s;
    }
    const p = this.plan;
    if (p.left <= 0) {
      if (p.kind === 'side') {
        p.kind = 'road';
        p.total = 1 + randInt(Math.min(5, 1 + Math.floor(i / 18)));
        if (this.city.wideRoads && i > 6) p.total = Math.min(7, p.total + 2);
      }
      else { p.kind = 'side'; p.total = Math.random() < .25 ? 2 : 1; }
      p.left = p.total;
    }
    const idx = p.total - p.left;
    p.left--;
    if (p.kind === 'side') return this.sidewalk(i);
    if (i > 15 && Math.random() < this.city.bikeLaneChance) return this.lane(i, 'bike', randDir());
    if (i > 10 && Math.random() < (this.city.tramChance ?? 0)) return this.tramLine(i);
    return this.lane(i, this.pickVehicle(i), this.laneDir(idx, p.total));
  }

  private sidewalk(i: number): SidewalkRow {
    const row: SidewalkRow = { kind: 'side', blocked: new Map(), people: [] };
    if (i > 6) {
      const n = randInt(i > 30 ? 3 : 2);
      for (let k = 0; k < n; k++) row.blocked.set(randInt(GRID_COLS), pick(this.city.obstacles));
    }
    const count = i < 4 ? 0 : (Math.random() < .6 ? 1 : 0) + (i > 40 && Math.random() < .25 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      let c = randInt(GRID_COLS), guard = 0;
      while ((row.blocked.has(c) || row.people.some(p => p.col === c)) && guard++ < 20) c = randInt(GRID_COLS);
      if (!row.blocked.has(c)) row.people.push({ col: c, color: pick(PEOPLE_COLORS), phase: Math.random() * 6 });
    }
    return row;
  }

  private pickVehicle(i: number): VehicleKind {
    // Keep the very first roads gentle: no couriers or fire trucks.
    let mix = this.city.mix;
    if (i < 12) mix = mix.filter(([k]) => k !== 'moto' && k !== 'fire');
    if (!mix.length) mix = this.city.mix;
    const total = mix.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of mix) { r -= w; if (r <= 0) return k; }
    return mix[0][0];
  }

  /**
   * Right-hand traffic: the lower half of a road flows right, the upper half left.
   * Left-hand traffic (Tokyo) is the mirror image.
   */
  private laneDir(idx: number, total: number): 1 | -1 {
    if (total < 2) return randDir();
    const mid = (total - 1) / 2;
    if (idx === mid) return randDir();
    const lowerHalf = idx < mid;
    return lowerHalf === (this.city.traffic === 'right') ? 1 : -1;
  }

  private paint(kind: VehicleKind) {
    return pick(this.city.paint?.[kind] ?? VEHICLES[kind].colors);
  }

  private vehicle(kind: VehicleKind, x: number, speed: number): Vehicle {
    const s = VEHICLES[kind];
    return {
      kind, len: s.len, h: s.h, x, color: this.paint(kind),
      baseSpeed: speed, speed, stopIn: rnd(2, 6), stopLeft: 0, phase: Math.random() * 6,
    };
  }

  private lane(i: number, kind: VehicleKind, dir: 1 | -1): LaneRow {
    const d = Math.min(1, i / TUNING.difficultyRows);
    const spec = VEHICLES[kind];
    const base = rnd(spec.speed[0], spec.speed[1]) * (1 + .55 * d);
    const minGap = Math.max(1.5, 2.0 - .6 * d);
    const maxGap = Math.max(minGap + 1, 4.6 - 1.6 * d);
    const margin = LANE_MARGIN, loop = GRID_COLS + 2 * margin;
    const vehicles: Vehicle[] = [];
    let pos = -margin + rnd(0, 2);
    for (;;) {
      // Stopping vehicles share their lane with cars, so you see traffic pile up behind a stop.
      const k: VehicleKind = spec.stops && Math.random() < .5 ? 'car' : kind;
      const len = VEHICLES[k].len;
      if (pos + len > -margin + loop) break;
      vehicles.push(this.vehicle(k, pos + len / 2, base));
      pos += len + rnd(minGap, maxGap);
    }
    // Make sure the gap across the wrap-around point is also fair.
    if (vehicles.length > 1) {
      const a = vehicles[0], z = vehicles[vehicles.length - 1];
      const wrapGap = (a.x - a.len / 2) + loop - (z.x + z.len / 2);
      if (wrapGap < minGap) vehicles.pop();
    }
    return { kind: kind === 'bike' ? 'bike' : 'road', dir, vehicles, margin };
  }

  /** A tram line: one long, fast tram with a long quiet gap, announced by a flashing warning. */
  private tramLine(i: number): LaneRow {
    const d = Math.min(1, i / TUNING.difficultyRows);
    const spec = VEHICLES.tram;
    const speed = rnd(spec.speed[0], spec.speed[1]) * (1 + .3 * d);
    const margin = 10;
    const tram = this.vehicle('tram', rnd(-margin, GRID_COLS + margin), speed);
    return { kind: 'tram', dir: randDir(), vehicles: [tram], margin };
  }

  /** True when this lane's tram is about to enter the screen (used for the warning light). */
  tramIncoming(row: LaneRow) {
    if (row.kind !== 'tram') return false;
    const v = row.vehicles[0];
    const front = row.dir > 0 ? v.x + v.len / 2 : GRID_COLS - (v.x - v.len / 2);
    return front > -6 && front < .5;
  }

  /** Move traffic in rows [lo, hi]. Vehicles queue behind slower or stopped ones. */
  updateTraffic(dt: number, lo: number, hi: number) {
    for (let r = Math.max(0, lo); r <= hi; r++) {
      const row = this.rows[r];
      if (!isLane(row)) continue;
      const { vehicles: vs, dir } = row;
      const loop = laneLoop(row);
      vs.sort((a, b) => (b.x - a.x) * dir); // front of the queue first
      for (let i = 0; i < vs.length; i++) {
        const v = vs[i];
        if (VEHICLES[v.kind].stops) {
          if (v.stopLeft > 0) v.stopLeft -= dt;
          else if ((v.stopIn -= dt) <= 0) { v.stopLeft = rnd(.9, 1.6); v.stopIn = rnd(3, 7); }
        }
        let target = v.stopLeft > 0 ? 0 : v.baseSpeed;
        if (vs.length > 1) {
          const ahead = vs[(i - 1 + vs.length) % vs.length];
          let dist = (ahead.x - v.x) * dir;
          if (dist <= 0) dist += loop;
          const gap = dist - (ahead.len + v.len) / 2;
          if (gap < .45) target = Math.min(target, ahead.speed * .9);
        }
        v.speed += (target - v.speed) * Math.min(1, dt * (target < v.speed ? 10 : 3));
        v.x += dir * v.speed * dt;
        if (v.x > GRID_COLS + row.margin) v.x -= loop;
        if (v.x < -row.margin) v.x += loop;
      }
    }
  }

  /** The vehicle overlapping cell (col,row), if any. */
  vehicleAt(col: number, row: number): { v: Vehicle; dir: 1 | -1 } | null {
    const r = this.rows[row];
    if (!isLane(r)) return null;
    const cx = col + .5;
    for (const v of r.vehicles) if (Math.abs(v.x - cx) < v.len / 2 + .26) return { v, dir: r.dir };
    return null;
  }

  isBlocked(col: number, row: number) {
    const r = this.rows[row];
    return !!r && r.kind === 'side' && r.blocked.has(col);
  }
}

const randDir = (): 1 | -1 => (Math.random() < .5 ? 1 : -1);
