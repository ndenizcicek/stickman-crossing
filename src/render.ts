// Ballpoint-pen-on-squared-paper renderer. Everything is drawn with canvas paths, no image assets.
import { CITIES, COLORS, GRID_COLS, ObstacleKind, VEHICLES, VehicleKind } from './config.js';
import { Game, Walker } from './game.js';
import { isLane, LaneRow, Vehicle } from './world.js';

const FONT = '"Patrick Hand", "Comic Sans MS", "Chalkboard SE", sans-serif';

interface StickOpts { fill: string; player?: boolean; walk?: boolean; wave?: boolean; panic?: boolean; phase?: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  cell = 40;
  width = 360;
  height = 640;
  private t = 0;
  private cam = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
  }

  private dpr = 0;

  /**
   * Matches the canvas's pixel buffer to its on-screen size. Called every frame and cheap when nothing changed.
   * On iPhone the web view can still be settling its size (safe areas, launch) when the game starts, and no
   * resize event follows; sizing only once left the drawing stretched and blurry.
   */
  fit() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    if (w < 2 || h < 2) return; // not laid out yet
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cell = w / GRID_COLS;
  }

  /** @deprecated kept for callers; same as fit(). */
  resize() { this.fit(); }

  get viewRows() { return this.height / this.cell; }

  /** Draws one vehicle centred on this canvas, sized to fit (used for the city circles on the map). */
  badge(kind: VehicleKind, size: number, color?: string) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(size * dpr); this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = this.height = size; this.t = 0;
    const spec = VEHICLES[kind];
    this.cell = size * .78 / Math.max(spec.len, 1.6);
    this.ctx.clearRect(0, 0, size, size);
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    this.vehicle({
      kind, len: spec.len, h: spec.h, x: size / 2 / this.cell, color: color ?? spec.colors[0],
      baseSpeed: 0, speed: 0, stopIn: 9, stopLeft: 0, phase: 0,
    }, 1, size / 2);
  }

  /** Screen y of the top edge of a row. */
  private sy(row: number) { return this.height - (row - this.cam + 1) * this.cell; }

  draw(g: Game) {
    this.fit();
    const { ctx, cell } = this;
    this.t = g.time; this.cam = g.camRow;
    const city = CITIES[g.world.cityId];
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const lo = Math.max(0, Math.floor(g.camRow) - 1), hi = Math.ceil(g.camRow + this.viewRows) + 1;
    const rows = g.world.rows;

    // Ground
    for (let r = lo; r <= hi; r++) {
      const row = rows[r]; if (!row) continue;
      const y = this.sy(r);
      if (row.kind === 'side') { this.sidewalk(city.sidewalk, r, y); continue; }
      ctx.fillStyle = row.kind === 'bike' ? COLORS.bike : city.roadColor;
      ctx.fillRect(0, y, this.width, cell + .5);
      if (row.kind === 'tram') this.rails(y);
      const above = rows[r + 1], below = rows[r - 1];
      ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2;
      if (!isLane(above)) this.hline(y);
      if (!isLane(below)) this.hline(y + cell);
      if (isLane(above)) {
        ctx.strokeStyle = COLORS.roadLine; ctx.lineWidth = 3; ctx.setLineDash([cell * .45, cell * .35]);
        this.hline(y); ctx.setLineDash([]);
      }
      // Faint arrow showing which way this lane flows.
      ctx.fillStyle = 'rgba(35,54,107,.18)';
      ctx.font = `${cell * .4}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const arrow = row.dir > 0 ? '→' : '←';
      const label = row.kind === 'bike' ? (row.dir > 0 ? 'bike →' : '← bike') : row.kind === 'tram' ? (row.dir > 0 ? 'tram →' : '← tram') : arrow;
      ctx.fillText(label, row.dir > 0 ? cell * .6 : this.width - cell * .6, y + cell / 2);
      if (row.kind === 'tram' && g.world.tramIncoming(row)) this.tramWarning(row, y);
    }

    // Sidewalk furniture and people waiting
    for (let r = lo; r <= hi; r++) {
      const row = rows[r]; if (!row || row.kind !== 'side') continue;
      const cy = this.sy(r) + cell / 2;
      for (const [c, kind] of row.blocked) this.obstacle(kind, c * cell + cell / 2, cy);
      for (const p of row.people) this.stick(p.col * cell + cell / 2, cy, { fill: p.color, wave: true, phase: p.phase });
    }

    // Chain and player
    for (let k = g.friends.length - 1; k >= 0; k--) {
      const f = g.friends[k]; const [x, y, lift] = this.hopPos(f);
      this.stick(x, y - lift, { fill: f.color, walk: f.hop < 1 });
    }
    if (g.state === 'play' || g.state === 'ready') {
      const [x, y, lift] = this.hopPos(g.player);
      const blink = g.shield > 0 && Math.floor(g.time * 10) % 2 === 1;
      if (!blink) this.stick(x, y - lift, { fill: '#fff', player: true, walk: g.player.hop < 1 });
    }

    // Traffic
    for (let r = lo; r <= hi; r++) {
      const row = rows[r]; if (!isLane(row)) continue;
      const cy = this.sy(r) + cell / 2;
      for (const v of row.vehicles) this.vehicle(v, row.dir, cy);
    }

    // Effects
    for (const s of g.scatters) {
      ctx.globalAlpha = 1 - s.t / .8;
      this.stick(s.x * cell, this.sy(s.y - .5) + cell / 2, { fill: s.color, walk: true, panic: true });
      ctx.globalAlpha = 1;
    }
    for (const f of g.flyers) {
      const k = f.t / 1.1, sc = 1 + Math.sin(Math.PI * Math.min(1, k * 1.2)) * .7;
      ctx.save();
      ctx.translate(f.x * cell, this.sy(f.y - .5) + cell / 2); ctx.rotate(f.rot); ctx.scale(sc, sc);
      ctx.globalAlpha = k > .8 ? (1 - k) / .2 : 1;
      this.stick(0, 0, { fill: f.isPlayer ? '#fff' : f.color, player: f.isPlayer, panic: true });
      ctx.restore(); ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of g.floats) {
      ctx.globalAlpha = 1 - f.t / .9;
      ctx.font = `${cell * .55}px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = COLORS.paper;
      const y = this.sy(f.y) + cell / 2 - f.t * cell * 1.2;
      ctx.strokeText(f.text, f.x * cell, y);
      ctx.fillStyle = f.red ? COLORS.red : COLORS.ink; ctx.fillText(f.text, f.x * cell, y);
      ctx.globalAlpha = 1;
    }
    if (city.snowfall) this.snow();
  }

  /** Sidewalk surface: notebook grid, fresh snow, or Rio's black-and-white wave promenade. */
  private sidewalk(style: string, r: number, y: number) {
    const { ctx, cell } = this;
    if (style === 'snow') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, y, this.width, cell + .5);
      ctx.fillStyle = '#c9d8e6';
      for (let k = 0; k < 7; k++) {
        const h = Math.sin(r * 12.9898 + k * 78.233) * 43758.5453, f = h - Math.floor(h);
        ctx.beginPath(); ctx.arc(f * this.width, y + ((k * 37 + r * 13) % 10) / 10 * cell, cell * .045, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    if (style === 'waves') {
      ctx.save(); ctx.beginPath(); ctx.rect(0, y, this.width, cell); ctx.clip();
      ctx.strokeStyle = 'rgba(35,35,40,.28)'; ctx.lineWidth = cell * .11;
      for (const off of [.3, .78]) {
        ctx.beginPath();
        for (let x = -cell; x <= this.width + cell; x += cell / 8) {
          const yy = y + cell * off + Math.sin((x / cell) * Math.PI * 1.4) * cell * .13;
          if (x === -cell) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = 0; k <= GRID_COLS * 2; k++) { ctx.moveTo(k * cell / 2, y); ctx.lineTo(k * cell / 2, y + cell); }
    ctx.moveTo(0, y + cell / 2); ctx.lineTo(this.width, y + cell / 2); ctx.stroke();
  }

  private rails(y: number) {
    const { ctx, cell } = this;
    ctx.strokeStyle = 'rgba(35,54,107,.35)'; ctx.lineWidth = cell * .1;
    ctx.beginPath();
    for (let x = cell * .25; x < this.width; x += cell * .5) { ctx.moveTo(x, y + cell * .22); ctx.lineTo(x, y + cell * .78); }
    ctx.stroke();
    ctx.strokeStyle = '#8a92a0'; ctx.lineWidth = 3;
    for (const f of [.3, .7]) { ctx.beginPath(); ctx.moveTo(0, y + cell * f); ctx.lineTo(this.width, y + cell * f); ctx.stroke(); }
  }

  /** Flashing warning at the edge the tram is coming from. */
  private tramWarning(row: LaneRow, y: number) {
    const { ctx, cell } = this;
    if (Math.floor(this.t * 6) % 2) return;
    const x = row.dir > 0 ? cell * .5 : this.width - cell * .5;
    ctx.fillStyle = 'rgba(210,60,60,.22)'; ctx.fillRect(0, y, this.width, cell);
    ctx.fillStyle = COLORS.red; ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + cell / 2, cell * .34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `${cell * .5}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y + cell / 2 + 1);
  }

  /** Gentle snowfall drawn over everything (Moscow). */
  private snow() {
    const { ctx, cell } = this;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = 'rgba(35,54,107,.25)'; ctx.lineWidth = 1;
    for (let k = 0; k < 46; k++) {
      const sx = ((k * 97.3) % 100) / 100, speed = .25 + (k % 5) * .06;
      const yy = ((this.t * speed + k * .137) % 1) * (this.height + 20) - 10;
      const xx = sx * this.width + Math.sin(this.t * 1.3 + k) * cell * .3;
      ctx.beginPath(); ctx.arc(xx, yy, cell * (.04 + (k % 3) * .02), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  private hline(y: number) { const c = this.ctx; c.beginPath(); c.moveTo(0, y); c.lineTo(this.width, y); c.stroke(); }

  private hopPos(w: Walker): [number, number, number] {
    const t = w.hop;
    const c = w.fromCol + (w.col - w.fromCol) * t, r = w.fromRow + (w.row - w.fromRow) * t;
    return [c * this.cell + this.cell / 2, this.sy(r) + this.cell / 2, Math.sin(Math.PI * t) * this.cell * .22];
  }

  private stick(x: number, y: number, o: StickOpts) {
    const { ctx } = this;
    const s = this.cell * .86, lw = Math.max(2, s * .07);
    ctx.save(); ctx.translate(x, y);
    const sw = o.walk ? Math.sin(this.t * 28) * .12 : 0;
    ctx.strokeStyle = o.player ? COLORS.red : COLORS.ink; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, -.2 * s); ctx.lineTo(0, .1 * s); // body
    ctx.moveTo(0, .1 * s); ctx.lineTo(-.13 * s, (.36 + sw) * s);
    ctx.moveTo(0, .1 * s); ctx.lineTo(.13 * s, (.36 - sw) * s); // legs
    if (o.wave) {
      const w = Math.sin(this.t * 8 + (o.phase ?? 0)) * .08;
      ctx.moveTo(0, -.12 * s); ctx.lineTo(-.2 * s, .02 * s);
      ctx.moveTo(0, -.12 * s); ctx.lineTo(.18 * s, (-.34 + w) * s);
    } else if (o.panic) {
      ctx.moveTo(0, -.12 * s); ctx.lineTo(-.22 * s, -.32 * s);
      ctx.moveTo(0, -.12 * s); ctx.lineTo(.22 * s, -.32 * s);
    } else {
      ctx.moveTo(0, -.12 * s); ctx.lineTo(-.2 * s, (.04 - sw) * s);
      ctx.moveTo(0, -.12 * s); ctx.lineTo(.2 * s, (.04 + sw) * s);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -.32 * s, .12 * s, 0, Math.PI * 2);
    ctx.fillStyle = o.fill; ctx.fill(); ctx.stroke();
    if (o.player) { // red beanie
      ctx.beginPath(); ctx.arc(0, -.34 * s, .12 * s, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fillStyle = COLORS.red; ctx.fill();
    }
    if (o.wave) {
      ctx.fillStyle = COLORS.red; ctx.font = `${s * .32}px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('!', .24 * s, -.42 * s);
    }
    ctx.restore();
  }

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  private obstacle(kind: ObstacleKind, x: number, y: number) {
    const { ctx } = this, u = this.cell;
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2;
    switch (kind) {
      case 'tree': {
        const r = u * .36;
        ctx.fillStyle = '#a9d6a1'; ctx.beginPath();
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, rr = r * (k % 2 ? .82 : 1); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * .15, 0, Math.PI * 2); ctx.fillStyle = '#8a6a4a'; ctx.fill();
        break;
      }
      case 'cat': { // a street cat curled up asleep
        ctx.fillStyle = '#f0b46a';
        ctx.beginPath(); ctx.ellipse(0, u * .06, u * .26, u * .18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(u * .2, -u * .1, u * .13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(u * .12, -u * .2); ctx.lineTo(u * .14, -u * .32); ctx.lineTo(u * .21, -u * .22);
        ctx.moveTo(u * .24, -u * .22); ctx.lineTo(u * .3, -u * .31); ctx.lineTo(u * .31, -u * .17);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-u * .24, u * .1); ctx.quadraticCurveTo(-u * .38, u * .3, -u * .12, u * .26); ctx.stroke();
        ctx.fillStyle = COLORS.ink; ctx.font = `${u * .3}px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText('z', u * .36, -u * .3 + Math.sin(this.t * 2) * 3);
        break;
      }
      case 'simit': { // simit seller's stand
        this.rr(-u * .38, -u * .24, u * .76, u * .48, 4); ctx.fillStyle = '#fff6e0'; ctx.fill(); ctx.stroke();
        for (const [a, b] of [[-.2, -.06], [0, -.06], [.2, -.06], [-.1, .1], [.1, .1]]) {
          ctx.fillStyle = '#c98a3a'; ctx.beginPath(); ctx.arc(a * u, b * u, u * .085, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(a * u, b * u, u * .03, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'hydrant': {
        ctx.fillStyle = '#d83a2e';
        ctx.beginPath(); ctx.arc(0, 0, u * .2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillRect(-u * .3, -u * .06, u * .6, u * .12); ctx.strokeRect(-u * .3, -u * .06, u * .6, u * .12);
        ctx.beginPath(); ctx.arc(0, 0, u * .08, 0, Math.PI * 2); ctx.fillStyle = COLORS.marker; ctx.fill(); ctx.stroke();
        break;
      }
      case 'manhole': { // steaming manhole
        ctx.fillStyle = '#9aa1ab';
        ctx.beginPath(); ctx.arc(0, u * .08, u * .26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) { ctx.moveTo(k * u * .14, u * .08 - u * .2); ctx.lineTo(k * u * .14, u * .08 + u * .2); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(35,54,107,.45)'; ctx.lineWidth = 2.5;
        for (let k = 0; k < 3; k++) {
          const t = (this.t * .7 + k / 3) % 1;
          ctx.globalAlpha = 1 - t; ctx.beginPath();
          ctx.arc((k - 1) * u * .12 + Math.sin(t * 6) * 3, -u * .05 - t * u * .45, u * (.08 + t * .1), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'vending': {
        this.rr(-u * .32, -u * .36, u * .64, u * .72, 4); ctx.fillStyle = '#e9f1ff'; ctx.fill(); ctx.stroke();
        const cans = ['#e86a5c', '#5b8def', '#6cc08b', COLORS.marker];
        cans.forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(-u * .24 + k * u * .12, -u * .26, u * .08, u * .14); ctx.strokeRect(-u * .24 + k * u * .12, -u * .26, u * .08, u * .14); });
        ctx.beginPath(); ctx.moveTo(-u * .24, u * .02); ctx.lineTo(u * .24, u * .02); ctx.stroke();
        ctx.fillStyle = COLORS.ink; ctx.fillRect(-u * .18, u * .14, u * .36, u * .1);
        break;
      }
      case 'snowbank': {
        ctx.fillStyle = '#ffffff'; ctx.beginPath();
        ctx.moveTo(-u * .42, u * .2);
        ctx.quadraticCurveTo(-u * .38, -u * .18, -u * .12, -u * .12);
        ctx.quadraticCurveTo(0, -u * .34, u * .16, -u * .14);
        ctx.quadraticCurveTo(u * .42, -u * .12, u * .42, u * .2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#9fb8cf'; ctx.beginPath(); ctx.moveTo(-u * .2, u * .06); ctx.lineTo(u * .08, u * .04); ctx.stroke();
        break;
      }
      case 'litfass': { // Berlin's round advertising column, seen from above
        ctx.fillStyle = '#2f6b4f'; ctx.beginPath(); ctx.arc(0, 0, u * .32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5f8fa'; ctx.beginPath(); ctx.arc(0, 0, u * .24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const posters = ['#e86a5c', '#f2c14e', '#5b8def', '#6cc08b'];
        posters.forEach((c, k) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.arc(0, 0, u * .24, k * Math.PI / 2 + .15, (k + 1) * Math.PI / 2 - .15); ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle = '#2f6b4f'; ctx.beginPath(); ctx.arc(0, 0, u * .1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'busstop': {
        this.rr(-u * .42, -u * .26, u * .84, u * .38, 3); ctx.fillStyle = 'rgba(159,216,255,.7)'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9aa1ab'; ctx.fillRect(-u * .34, u * .14, u * .68, u * .1); ctx.strokeRect(-u * .34, u * .14, u * .68, u * .1);
        ctx.fillStyle = '#3aa655'; ctx.beginPath(); ctx.arc(u * .3, -u * .3, u * .1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'palm': {
        ctx.fillStyle = '#7cc46d';
        for (let k = 0; k < 6; k++) {
          ctx.save(); ctx.rotate(k * Math.PI / 3 + .2);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(u * .2, -u * .14, u * .44, 0); ctx.quadraticCurveTo(u * .2, u * .06, 0, 0);
          ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.arc(0, 0, u * .08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'jacaranda': { // purple blossom tree
        const r = u * .38;
        ctx.fillStyle = '#b48be0'; ctx.beginPath();
        for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rr = r * (k % 2 ? .8 : 1); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d9c2ff';
        for (const [a, b] of [[-.14, -.1], [.12, -.16], [.04, .14], [-.18, .12], [.2, .08]]) { ctx.beginPath(); ctx.arc(a * u, b * u, u * .05, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'coconut': { // coconut-water cart with an umbrella
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, 0, u * .38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * u * .38, Math.sin(a) * u * .38); } ctx.stroke();
        ctx.fillStyle = '#6cc08b';
        for (const [a, b] of [[-.1, .02], [.08, -.06], [.06, .12]]) { ctx.beginPath(); ctx.arc(a * u, b * u, u * .08, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        break;
      }
    }
    ctx.restore();
  }

  private vehicle(v: Vehicle, dir: 1 | -1, cy: number) {
    const { ctx } = this;
    const L = v.len * this.cell, H = v.h * this.cell, x = v.x * this.cell;
    if (x + L / 2 < -10 || x - L / 2 > this.width + 10) return;
    const wobble = v.kind === 'moto' ? Math.sin(this.t * 6 + v.phase) * this.cell * .14 : 0;
    ctx.save(); ctx.translate(x, cy + wobble); ctx.scale(dir, 1);
    ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2.2;

    if (v.kind === 'moto' || v.kind === 'bike') {
      ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke();
      ctx.fillStyle = COLORS.ink; ctx.beginPath();
      ctx.arc(-L / 2 + 3, 0, 2.5, 0, Math.PI * 2); ctx.arc(L / 2 - 3, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(L / 2 - 5, -H * .7); ctx.lineTo(L / 2 - 5, H * .7); ctx.stroke(); // handlebar
      ctx.beginPath(); ctx.arc(-L * .05, 0, H * .55, 0, Math.PI * 2); ctx.fillStyle = v.color; ctx.fill(); ctx.stroke(); // rider
      if (v.kind === 'moto') { ctx.fillStyle = v.color; this.rr(-L / 2 - 2, -H * .6, L * .32, H * 1.2, 2); ctx.fill(); ctx.stroke(); } // delivery box
      ctx.restore(); return;
    }

    // Wheels
    ctx.fillStyle = COLORS.ink;
    const wl = Math.min(10, L * .16);
    const axles = v.len > 2.5 ? [-.4, -.32, .32] : [-.32, .32];
    for (const fx of axles) { ctx.fillRect(L * fx - wl / 2, -H / 2 - 3, wl, 4); ctx.fillRect(L * fx - wl / 2, H / 2 - 1, wl, 4); }

    if (v.kind === 'truck') {
      ctx.fillStyle = '#e7d3a8'; this.rr(-L / 2, -H / 2, L * .72, H, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      for (let k = 1; k < 4; k++) { const xx = -L / 2 + L * .72 * k / 4; ctx.moveTo(xx, -H / 2 + 3); ctx.lineTo(xx, H / 2 - 3); }
      ctx.stroke();
      ctx.fillStyle = v.color; this.rr(L * .25, -H * .45, L * .25, H * .9, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L * .42, -H * .35); ctx.lineTo(L * .42, H * .35); ctx.stroke();
      ctx.restore(); return;
    }

    if (v.kind === 'plow') { // snowplow: angled blade in front, flashing amber light
      ctx.fillStyle = '#c9ccd1';
      ctx.beginPath(); ctx.moveTo(L * .38, -H * .62); ctx.lineTo(L * .56, -H * .4); ctx.lineTo(L * .56, H * .4); ctx.lineTo(L * .38, H * .62); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = v.color; this.rr(-L / 2, -H / 2, L * .86, H, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; this.rr(L * .12, -H * .36, L * .16, H * .72, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Math.floor(this.t * 4) % 2 ? '#ffd23f' : '#fff4c2';
      ctx.beginPath(); ctx.arc(-L * .05, 0, H * .14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore(); return;
    }
    if (v.kind === 'tram') { // two articulated sections with a pantograph on the roof
      const seg = L / 2 - 3;
      for (const sx of [-L / 2, 3]) {
        ctx.fillStyle = v.color; this.rr(sx, -H / 2, seg, H, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        for (let k = 0; k < 3; k++) { this.rr(sx + 6 + k * (seg - 12) / 3, -H * .3, (seg - 12) / 3 - 4, H * .6, 2); ctx.fill(); ctx.stroke(); }
      }
      ctx.fillStyle = '#9aa1ab'; ctx.fillRect(-3, -H * .35, 6, H * .7); ctx.strokeRect(-3, -H * .35, 6, H * .7);
      ctx.beginPath(); ctx.moveTo(-L * .25, -H * .2); ctx.lineTo(-L * .18, 0); ctx.lineTo(-L * .25, H * .2); ctx.stroke();
      ctx.restore(); return;
    }

    const long = v.kind === 'bus' || v.kind === 'fire' || v.kind === 'decker' || v.kind === 'colectivo';
    ctx.fillStyle = v.color; this.rr(-L / 2, -H / 2, L, H, long ? 5 : H * .3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    if (v.kind === 'decker') { // roof of a double-decker: inner deck outline and stair hatch
      this.rr(-L / 2 + 5, -H * .36, L - 10, H * .72, 4); ctx.stroke();
      for (let k = 0; k < 4; k++) { this.rr(-L / 2 + 10 + k * (L - 24) / 4, -H * .22, (L - 24) / 4 - 5, H * .44, 2); ctx.fill(); ctx.stroke(); }
      this.rr(L / 2 - 12, -H * .3, 6, H * .6, 2); ctx.fill(); ctx.stroke();
    } else if (v.kind === 'colectivo') { // colourful city bus with a white stripe
      ctx.fillStyle = '#fff'; ctx.fillRect(-L / 2 + 3, -H * .08, L - 6, H * .16);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let k = 0; k < 4; k++) { this.rr(-L / 2 + 6 + k * (L - 18) / 4, -H * .36, (L - 18) / 4 - 4, H * .2, 2); ctx.fill(); ctx.stroke(); }
      this.rr(L / 2 - 10, -H * .38, 6, H * .76, 2); ctx.fill(); ctx.stroke();
    } else if (v.kind === 'minibus') {
      this.rr(L * .2, -H * .36, L * .14, H * .72, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (const f of [-.25, 0]) { ctx.moveTo(L * f, -H * .5); ctx.lineTo(L * f, H * .5); } ctx.stroke(); // roof ribs
      ctx.fillStyle = '#e5484d'; ctx.fillRect(-L / 2 + 2, -H * .5 + 2, L - 4, 3); // red side stripe
    } else if (v.kind === 'fire') {
      this.rr(L * .22, -H * .36, L * .12, H * .72, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#e7e7e7'; ctx.lineWidth = 2; ctx.beginPath(); // ladder
      ctx.moveTo(-L * .42, -H * .16); ctx.lineTo(L * .12, -H * .16); ctx.moveTo(-L * .42, H * .16); ctx.lineTo(L * .12, H * .16);
      for (let k = 0; k < 7; k++) { const xx = -L * .42 + k * L * .54 / 6; ctx.moveTo(xx, -H * .16); ctx.lineTo(xx, H * .16); }
      ctx.stroke(); ctx.strokeStyle = COLORS.ink;
      const on = Math.floor(this.t * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff4d4d' : '#4d8dff'; ctx.beginPath(); ctx.arc(L * .4, -H * .22, H * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? '#4d8dff' : '#ff4d4d'; ctx.beginPath(); ctx.arc(L * .4, H * .22, H * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (v.kind === 'bus') {
      for (let k = 0; k < 5; k++) { this.rr(-L / 2 + 6 + k * (L - 18) / 5, -H * .32, (L - 18) / 5 - 4, H * .64, 2); ctx.fill(); ctx.stroke(); }
      this.rr(L / 2 - 10, -H * .38, 6, H * .76, 2); ctx.fill(); ctx.stroke();
    } else {
      this.rr(L * .12, -H * .36, L * .16, H * .72, 3); ctx.fill(); ctx.stroke(); // windscreen
      this.rr(-L * .36, -H * .32, L * .12, H * .64, 3); ctx.fill(); ctx.stroke(); // rear window
    }
    if (v.kind === 'taxi') {
      // Roof light: yellow on dark cabs (Buenos Aires), white elsewhere.
      ctx.fillStyle = isDark(v.color) ? '#f7c600' : '#fff'; this.rr(-L * .08, -H * .18, L * .16, H * .36, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.ink; ctx.beginPath();
      for (let k = 0; k < 4; k++) ctx.rect(-L * .5 + 4 + k * 7, -H * .5 + 3, 3, 3); // checker stripe
      ctx.fill();
    }
    if (v.kind === 'kei') { ctx.beginPath(); ctx.moveTo(-L * .42, -H * .5); ctx.lineTo(-L * .42, H * .5); ctx.stroke(); }
    if (v.kind === 'dolmus' || v.kind === 'minibus') { // dolmuş shows "D"; both show "!" while stopped
      const sign = v.stopLeft > 0 ? '!' : v.kind === 'dolmus' ? 'D' : '';
      if (sign) {
        ctx.scale(dir, 1);
        ctx.fillStyle = COLORS.ink; ctx.font = `${H * .5}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(sign, 0, 1);
      }
    }
    ctx.restore();
  }
}

/** Rough brightness test for a #rrggbb colour. */
function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) < 90;
}
