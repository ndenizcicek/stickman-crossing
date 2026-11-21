// Controller support (Xbox / PlayStation / Steam Deck), read with the browser Gamepad API.
// Uses the "standard" button layout every modern controller reports, which Steam Input also provides.
export type PadAction = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start';

const BUTTONS: [number, PadAction][] = [
  [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'],
  [0, 'a'], [1, 'b'], [9, 'start'], [8, 'start'],
];
/** Directions repeat while held: first repeat after this delay, then at this interval (seconds). */
const REPEAT_DELAY = .32, REPEAT_EVERY = .14;
const STICK = .55;

export class Gamepads {
  private held = new Map<PadAction, number>();
  /** True once any controller has been used, so the UI can show controller hints. */
  used = false;

  /** Returns the actions that fired this frame: new presses, plus repeats for held directions. */
  poll(dt: number): PadAction[] {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const down = new Set<PadAction>();
    for (const p of pads) {
      if (!p || !p.connected) continue;
      for (const [i, a] of BUTTONS) if (p.buttons[i]?.pressed) down.add(a);
      const [x = 0, y = 0] = p.axes;
      if (y < -STICK) down.add('up');
      if (y > STICK) down.add('down');
      if (x < -STICK) down.add('left');
      if (x > STICK) down.add('right');
    }
    const fired: PadAction[] = [];
    for (const a of down) {
      const t = this.held.get(a);
      if (t === undefined) { fired.push(a); this.held.set(a, -REPEAT_DELAY); continue; }
      const isDir = a === 'up' || a === 'down' || a === 'left' || a === 'right';
      const next = t + dt;
      if (isDir && next >= REPEAT_EVERY) { fired.push(a); this.held.set(a, 0); } else this.held.set(a, next);
    }
    for (const a of [...this.held.keys()]) if (!down.has(a)) this.held.delete(a);
    if (fired.length) this.used = true;
    return fired;
  }
}
