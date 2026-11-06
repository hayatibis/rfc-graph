// The sky: a force layout drawn on a canvas. Each RFC is a star coloured by its year;
// light runs along each line from an RFC to the ones that build on it.
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { KIND_RANK, type EdgeKind } from './rfc';
import { eraRgb, rgba, SURFACES, type Theme } from './palette';

export interface Star extends SimulationNodeDatum {
  id: number;
  title: string;
  year: number | null;
  pages: number;
  obsolete: boolean;
  read: boolean;
  expanded: boolean;
  born: number;
  seed: number;
}

export interface Line extends SimulationLinkDatum<Star> {
  key: string;
  kind: EdgeKind;
  born: number;
  seed: number;
  source: Star;
  target: Star;
}

interface Events {
  select(id: number): void;
  hover(id: number | null, x: number, y: number): void;
}

const LINK_LENGTH: Record<EdgeKind, number> = { obs: 70, upd: 80, norm: 95, info: 125, ref: 130, mention: 160 };
const LINE_ALPHA: Record<EdgeKind, number> = { obs: 0.75, upd: 0.6, norm: 0.55, info: 0.32, ref: 0.28, mention: 0.16 };

interface Cam {
  x: number;
  y: number;
  k: number;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const now = () => performance.now();

export class Sky {
  readonly stars = new Map<number, Star>();
  readonly lines = new Map<string, Line>();
  private sim: Simulation<Star, Line>;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private cam: Cam = { x: 0, y: 0, k: 1 };
  private camAnim: { from: Cam; to: Cam; t0: number; ms: number } | null = null;
  private texture: HTMLCanvasElement | null = null;
  private selected: number | null = null;
  private hovered: number | null = null;
  private theme: Theme = 'dark';
  private calm = false;
  private frame = 0;
  private dirty = true;
  /** Pixels on the right covered by a panel; the sky centres itself in what's left. */
  private inset = 0;

  setInset(px: number) {
    this.inset = px;
    this.dirty = true;
  }

  private cx() {
    return (this.w - this.inset) / 2;
  }

  constructor(private canvas: HTMLCanvasElement, private on: Events) {
    this.ctx = canvas.getContext('2d')!;
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sim = forceSimulation<Star, Line>([])
      .force('charge', forceManyBody<Star>().strength((s) => -180 - this.radius(s) * 14))
      .force('link', forceLink<Star, Line>([]).id((s) => s.id).distance((l) => LINK_LENGTH[l.kind]).strength(0.5))
      .force('collide', forceCollide<Star>((s) => this.radius(s) + 14))
      .force('x', forceX(0).strength(0.025))
      .force('y', forceY(0).strength(0.025))
      .alphaDecay(0.028)
      .on('tick', () => (this.dirty = true));
    this.listen();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      this.draw();
    };
    loop();
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.texture = null;
    this.dirty = true;
  }

  radius(s: Star) {
    return 5 + Math.min(14, Math.sqrt(s.pages || 4) * 1.4);
  }

  /** Adds a star, born next to `near` if given, and returns it. */
  add(id: number, near?: number): Star {
    let s = this.stars.get(id);
    if (s) return s;
    const parent = near !== undefined ? this.stars.get(near) : undefined;
    const a = Math.random() * Math.PI * 2;
    s = {
      id,
      title: '',
      year: null,
      pages: 0,
      obsolete: false,
      read: false,
      expanded: false,
      born: now(),
      seed: Math.random(),
      x: (parent?.x ?? 0) + Math.cos(a) * 30,
      y: (parent?.y ?? 0) + Math.sin(a) * 30,
    };
    this.stars.set(id, s);
    this.rebuild();
    return s;
  }

  /** `from` refers to `to`. A stronger kind replaces a weaker one on the same pair. */
  link(from: number, to: number, kind: EdgeKind) {
    if (from === to) return;
    const [a, b] = [this.add(from), this.add(to, from)];
    const key = `${from}>${to}`;
    const old = this.lines.get(key);
    if (old) {
      if (KIND_RANK[kind] > KIND_RANK[old.kind]) old.kind = kind;
      return;
    }
    this.lines.set(key, { key, kind, born: now(), seed: Math.random(), source: a, target: b });
    this.rebuild();
  }

  update(id: number, patch: Partial<Star>) {
    const s = this.stars.get(id);
    if (!s) return;
    Object.assign(s, patch);
    this.dirty = true;
    if ('pages' in patch) this.sim.force('collide', forceCollide<Star>((x) => this.radius(x) + 14));
  }

  select(id: number | null) {
    this.selected = id;
    this.dirty = true;
  }

  /** Glides the camera to a star. */
  focus(id: number, zoom?: number) {
    const s = this.stars.get(id);
    if (!s) return;
    const to = { x: s.x ?? 0, y: s.y ?? 0, k: zoom ?? Math.max(this.cam.k, 1) };
    if (this.calm) {
      this.cam = to;
      this.dirty = true;
      return;
    }
    this.camAnim = { from: { ...this.cam }, to, t0: now(), ms: 900 };
  }

  zoomBy(f: number) {
    this.cam.k = Math.min(4, Math.max(0.25, this.cam.k * f));
    this.dirty = true;
  }

  /** Fits every star in view. */
  fit() {
    const xs = [...this.stars.values()];
    if (!xs.length) return;
    const minX = Math.min(...xs.map((s) => s.x ?? 0)), maxX = Math.max(...xs.map((s) => s.x ?? 0));
    const minY = Math.min(...xs.map((s) => s.y ?? 0)), maxY = Math.max(...xs.map((s) => s.y ?? 0));
    const k = Math.min(1.6, Math.max(0.3, Math.min((this.w - this.inset) / (maxX - minX + 240), this.h / (maxY - minY + 240))));
    this.camAnim = { from: { ...this.cam }, to: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, k }, t0: now(), ms: 900 };
  }

  neighbours(id: number) {
    const out = new Set<number>([id]);
    for (const l of this.lines.values()) {
      if (l.source.id === id) out.add(l.target.id);
      if (l.target.id === id) out.add(l.source.id);
    }
    return out;
  }

  private rebuild() {
    this.sim.nodes([...this.stars.values()]);
    (this.sim.force('link') as ReturnType<typeof forceLink<Star, Line>>).links([...this.lines.values()]);
    this.sim.alpha(Math.max(this.sim.alpha(), 0.55)).restart();
    if (this.calm) {
      this.sim.stop();
      this.sim.tick(120);
    }
    this.dirty = true;
  }

  private resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.texture = null;
    this.dirty = true;
  }

  // ---- input -------------------------------------------------------------

  private toWorld(px: number, py: number) {
    return { x: (px - this.cx()) / this.cam.k + this.cam.x, y: (py - this.h / 2) / this.cam.k + this.cam.y };
  }

  private hit(px: number, py: number): Star | null {
    const p = this.toWorld(px, py);
    let best: Star | null = null;
    let bestD = Infinity;
    for (const s of this.stars.values()) {
      const d = Math.hypot((s.x ?? 0) - p.x, (s.y ?? 0) - p.y);
      const reach = this.radius(s) + 8 / this.cam.k;
      if (d < reach && d < bestD) [best, bestD] = [s, d];
    }
    return best;
  }

  private listen() {
    const c = this.canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { star: Star | null; x: number; y: number; moved: number; cx: number; cy: number } | null = null;
    let pinch: { d: number; k: number } | null = null;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.cam.k };
        drag = null;
        return;
      }
      this.camAnim = null;
      drag = { star: this.hit(p.x, p.y), x: p.x, y: p.y, moved: 0, cx: this.cam.x, cy: this.cam.y };
    });

    c.addEventListener('pointermove', (e) => {
      const p = local(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        this.cam.k = Math.min(4, Math.max(0.25, pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)));
        this.dirty = true;
        return;
      }
      if (drag) {
        drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.x, p.y - drag.y));
        if (drag.star && drag.moved > 4) {
          const w = this.toWorld(p.x, p.y);
          drag.star.fx = w.x;
          drag.star.fy = w.y;
          this.sim.alphaTarget(0.25).restart();
        } else if (!drag.star) {
          this.cam.x = drag.cx - (p.x - drag.x) / this.cam.k;
          this.cam.y = drag.cy - (p.y - drag.y) / this.cam.k;
          this.dirty = true;
        }
        return;
      }
      const s = this.hit(p.x, p.y);
      const id = s?.id ?? null;
      c.style.cursor = s ? 'pointer' : 'grab';
      if (id !== this.hovered) {
        this.hovered = id;
        this.dirty = true;
      }
      this.on.hover(id, p.x, p.y);
    });

    const end = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!drag) return;
      if (drag.star) {
        drag.star.fx = null;
        drag.star.fy = null;
        this.sim.alphaTarget(0);
        if (drag.moved <= 4) this.on.select(drag.star.id);
      }
      drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => {
      if (this.hovered !== null) {
        this.hovered = null;
        this.dirty = true;
        this.on.hover(null, 0, 0);
      }
    });

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = local(e);
        const before = this.toWorld(p.x, p.y);
        this.camAnim = null;
        this.cam.k = Math.min(4, Math.max(0.25, this.cam.k * Math.exp(-e.deltaY * 0.0015)));
        const after = this.toWorld(p.x, p.y);
        this.cam.x += before.x - after.x;
        this.cam.y += before.y - after.y;
        this.dirty = true;
      },
      { passive: false },
    );
  }

  // ---- drawing -----------------------------------------------------------

  /** A sky of faint fixed stars, or the grain of old paper. Drawn once per size. */
  private paintTexture() {
    const t = document.createElement('canvas');
    t.width = this.canvas.width;
    t.height = this.canvas.height;
    const g = t.getContext('2d')!;
    const { bg } = SURFACES[this.theme];
    g.fillStyle = bg;
    g.fillRect(0, 0, t.width, t.height);
    const cx = t.width / 2, cy = t.height / 2, R = Math.hypot(cx, cy);
    if (this.theme === 'dark') {
      const glow = g.createRadialGradient(cx * 0.7, cy * 0.6, 0, cx, cy, R);
      glow.addColorStop(0, 'rgba(60,70,140,0.35)');
      glow.addColorStop(0.5, 'rgba(30,25,70,0.18)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, t.width, t.height);
      const n = Math.round((t.width * t.height) / 2600);
      for (let i = 0; i < n; i++) {
        const a = Math.random() ** 3 * 0.7;
        g.fillStyle = `rgba(210,220,255,${a})`;
        g.fillRect(Math.random() * t.width, Math.random() * t.height, this.dpr, this.dpr);
      }
    } else {
      const n = Math.round((t.width * t.height) / 90);
      for (let i = 0; i < n; i++) {
        g.fillStyle = `rgba(90,70,40,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * t.width, Math.random() * t.height, this.dpr, this.dpr * (1 + Math.random() * 2));
      }
    }
    const vignette = g.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, this.theme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(120,90,40,0.16)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, t.width, t.height);
    this.texture = t;
  }

  /** Control point of the gentle arc between two stars. */
  private bend(l: Line) {
    const ax = l.source.x ?? 0, ay = l.source.y ?? 0, bx = l.target.x ?? 0, by = l.target.y ?? 0;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const bow = 0.18 * (l.seed > 0.5 ? 1 : -1);
    return { ax, ay, bx, by, cx: mx - dy * bow, cy: my + dx * bow };
  }

  private draw() {
    const t = now();
    const moving = !this.calm;
    if (this.camAnim) {
      const { from, to, t0, ms } = this.camAnim;
      const e = ease((t - t0) / ms);
      this.cam = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e };
      if (e >= 1) this.camAnim = null;
      this.dirty = true;
    }
    if (!moving && !this.dirty) return;
    this.dirty = false;

    const g = this.ctx;
    const surface = SURFACES[this.theme];
    const dark = this.theme === 'dark';
    if (!this.texture) this.paintTexture();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.texture!, 0, 0);

    const k = this.cam.k;
    g.setTransform(this.dpr * k, 0, 0, this.dpr * k, this.dpr * (this.cx() - this.cam.x * k), this.dpr * (this.h / 2 - this.cam.y * k));

    const focus = this.hovered ?? this.selected;
    const near = focus !== null ? this.neighbours(focus) : null;
    const dim = (a: number, ...ids: number[]) => (near && !ids.some((id) => near.has(id)) ? a * 0.18 : a);
    const lit = (l: Line) => !near || (near.has(l.source.id) && near.has(l.target.id) && (l.source.id === focus || l.target.id === focus));

    // Lines: drawn as they grow, from the citing star to the cited one.
    g.globalCompositeOperation = surface.blend;
    g.lineCap = 'round';
    for (const l of this.lines.values()) {
      const { ax, ay, bx, by, cx, cy } = this.bend(l);
      const grow = moving ? ease((t - l.born) / 900) : 1;
      const len = Math.hypot(bx - ax, by - ay) * 1.08;
      const ca = eraRgb(l.source.year, this.theme);
      const cb = eraRgb(l.target.year, this.theme);
      const a = lit(l) ? LINE_ALPHA[l.kind] * (near ? 1.6 : 1) : dim(LINE_ALPHA[l.kind], -1);
      const grad = g.createLinearGradient(ax, ay, bx, by);
      grad.addColorStop(0, rgba(ca, Math.min(1, a)));
      grad.addColorStop(1, rgba(cb, Math.min(1, a)));
      g.strokeStyle = l.kind === 'obs' ? rgba(surface.obsolete, Math.min(1, a)) : grad;
      g.lineWidth = (l.kind === 'norm' || l.kind === 'obs' ? 1.6 : 1.05) / Math.sqrt(k);
      const pattern = l.kind === 'obs' ? [5, 5] : l.kind === 'upd' ? [1.5, 4.5] : l.kind === 'mention' ? [2, 6] : [];
      g.setLineDash(grow < 1 ? [len * grow, len] : pattern);
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo(cx, cy, bx, by);
      g.stroke();
    }
    g.setLineDash([]);

    // Light running along each line, from the older RFC to the one that builds on it.
    if (moving) {
      for (const l of this.lines.values()) {
        if (l.kind === 'mention' && !lit(l)) continue;
        if (near && !lit(l)) continue;
        const { ax, ay, bx, by, cx, cy } = this.bend(l);
        const speed = l.kind === 'norm' ? 4200 : 6500;
        const p = 1 - (((t + l.seed * speed) % speed) / speed);
        const q = 1 - p;
        const x = q * q * ax + 2 * q * p * cx + p * p * bx;
        const y = q * q * ay + 2 * q * p * cy + p * p * by;
        const c = eraRgb(l.target.year, this.theme);
        const r = (dark ? 9 : 5) / Math.sqrt(k);
        const halo = g.createRadialGradient(x, y, 0, x, y, r);
        halo.addColorStop(0, rgba(c, dark ? 0.9 : 0.35));
        halo.addColorStop(1, rgba(c, 0));
        g.fillStyle = halo;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Stars.
    for (const s of this.stars.values()) {
      const x = s.x ?? 0, y = s.y ?? 0;
      const r = this.radius(s);
      const age = (t - s.born) / 1000;
      const birth = moving ? ease(age / 0.8) : 1;
      const c = s.obsolete ? mix(eraRgb(s.year, this.theme), dark ? [120, 120, 130] : [150, 145, 135], 0.65) : eraRgb(s.year, this.theme);
      const twinkle = moving ? 0.85 + 0.15 * Math.sin(t / 900 + s.seed * 40) : 1;
      const a = dim(1, s.id);

      // Bloom ring when a star is born.
      if (moving && age < 1.4) {
        const e = ease(age / 1.4);
        g.strokeStyle = rgba(c, (1 - e) * 0.7);
        g.lineWidth = 1.5 / k;
        g.beginPath();
        g.arc(x, y, r + e * 46, 0, Math.PI * 2);
        g.stroke();
      }

      // Glow.
      g.globalCompositeOperation = surface.blend;
      const gr = r * (dark ? 4.2 : 2.6) * birth;
      const glow = g.createRadialGradient(x, y, r * 0.3, x, y, gr);
      glow.addColorStop(0, rgba(c, (dark ? 0.55 : 0.22) * a * twinkle));
      glow.addColorStop(1, rgba(c, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, gr, 0, Math.PI * 2);
      g.fill();

      // Body: a full star when read, a ring when not yet.
      g.globalCompositeOperation = 'source-over';
      const rb = r * birth;
      g.beginPath();
      g.arc(x, y, rb, 0, Math.PI * 2);
      if (s.read) {
        const body = g.createRadialGradient(x - rb * 0.35, y - rb * 0.35, rb * 0.1, x, y, rb);
        body.addColorStop(0, rgba(mix(c, dark ? [255, 255, 255] : [255, 250, 240], 0.7), a));
        body.addColorStop(1, rgba(c, a));
        g.fillStyle = body;
        g.fill();
      } else {
        g.fillStyle = dark ? rgba([10, 13, 26], 0.85 * a) : rgba([246, 241, 230], 0.9 * a);
        g.fill();
        g.strokeStyle = rgba(c, 0.95 * a);
        g.lineWidth = 1.6 / Math.sqrt(k);
        g.stroke();
      }
      if (s.obsolete) {
        g.strokeStyle = rgba(surface.obsolete, 0.7 * a);
        g.lineWidth = 1.2 / Math.sqrt(k);
        g.beginPath();
        g.moveTo(x - rb * 0.8, y + rb * 0.8);
        g.lineTo(x + rb * 0.8, y - rb * 0.8);
        g.stroke();
      }

      // The open RFC: two slow orbits.
      if (s.id === this.selected) {
        const spin = moving ? t / 4000 : 0;
        g.strokeStyle = rgba(c, 0.8);
        g.lineWidth = 1.2 / Math.sqrt(k);
        for (const [rr, dir, dash] of [[r + 9, 1, [3, 6]], [r + 16, -1, [12, 10]]] as const) {
          g.setLineDash(dash.map((d) => d / Math.sqrt(k)));
          g.beginPath();
          g.arc(x, y, rr, spin * dir, spin * dir + Math.PI * 2);
          g.stroke();
        }
        g.setLineDash([]);
      }
    }

    // Labels: only where they help.
    g.globalCompositeOperation = 'source-over';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (const s of this.stars.values()) {
      const show = (k > 1.15 || (k > 0.85 && this.stars.size < 30)) || s.id === this.selected || s.id === this.hovered || (this.hovered !== null && (near?.has(s.id) ?? false));
      if (!show) continue;
      const a = dim(s.id === focus ? 1 : 0.75, s.id);
      g.font = `${s.id === this.selected ? 600 : 500} ${11 / Math.sqrt(k)}px "IBM Plex Mono", ui-monospace, monospace`;
      g.fillStyle = rgba(surface.ink, a);
      const below = this.radius(s) + (s.id === this.selected ? 20 : 6 / Math.sqrt(k));
      g.fillText(`RFC ${s.id}`, s.x ?? 0, (s.y ?? 0) + below);
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.sim.stop();
  }
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as [number, number, number];
}
