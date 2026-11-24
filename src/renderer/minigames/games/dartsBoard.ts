import type { Point, Dart, Ellipse, Flight, Impact, PanelBand } from '../../../shared/minigameRules/darts';

interface Sprite {
  x: number;
  y: number;
  width: number;
  height: number;
  hubX: number;
  hubY: number;
  wings: number;
}
interface SpriteView {
  key?: 'side' | 'diagonal';
  angle?: number;
  flipX?: boolean;
  flipY?: boolean;
}
export interface BoardFrame {
  darts?: Dart[];
  silhouettes?: Dart[];
  aim?: Point | null;
  ellipse?: Ellipse | null;
  dot?: Point | null;
  flight?: Flight | null;
  impact?: Impact | null;
  reduced?: boolean;
}
import { NUMBERS, RINGS, scoreHit, PANEL_BANDS, panelLights } from '../../../shared/minigameRules/darts';

const C = 350,
  R = 245,
  TAU = Math.PI * 2;
const COLOR = {
  coral: '#ee2948',
  teal: '#9391cc',
  cream: '#dfd2db',
  dark: '#37313b',
  wire: '#76847d',
  gold: '#efd099'
};
const DART_SPRITES = {
  you: {
    landed: {
      x: 205,
      y: 85,
      width: 425,
      height: 425,
      hubX: 214,
      hubY: 215,
      wings: 400
    },
    throw: {
      x: 215,
      y: 600,
      width: 400,
      height: 430,
      hubX: 205,
      hubY: 181,
      wings: 378
    }
  },
  partner: {
    landed: {
      x: 740,
      y: 85,
      width: 425,
      height: 425,
      hubX: 209,
      hubY: 215,
      wings: 390
    },
    throw: {
      x: 745,
      y: 600,
      width: 400,
      height: 430,
      hubX: 203,
      hubY: 182,
      wings: 370
    }
  }
};
const MODEL_SPRITES = {
  side: {
    x: 80,
    y: 30,
    width: 580,
    height: 585,
    hubX: 293,
    hubY: 300,
    wings: 554
  },
  diagonal: {
    x: 675,
    y: 40,
    width: 575,
    height: 580,
    hubX: 272,
    hubY: 291,
    wings: 543
  },
  near: {
    x: 70,
    y: 640,
    width: 580,
    height: 550,
    hubX: 286,
    hubY: 262,
    wings: 554
  },
  early: {
    x: 670,
    y: 630,
    width: 590,
    height: 560,
    hubX: 277,
    hubY: 258,
    wings: 558
  }
};
// Fixed-size artwork is shared across visits. Two 1400px RGBA layers use about 15 MiB
// before browser overhead; reopening a game never grows this cache.
let artwork: { base: HTMLCanvasElement; dividers: HTMLCanvasElement; dartArt: HTMLImageElement; modelArt: HTMLImageElement } | undefined;

/** A board whose painted boundaries come from the same radii as its scoring engine. */
export class Board {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dartArt: HTMLImageElement;
  modelArt: HTMLImageElement;
  base: HTMLCanvasElement;
  dividers: HTMLCanvasElement;
  panelPaths: Map<string, Path2D>;
  resize: ResizeObserver;
  revision = 0;
  private invalidate = (): void => { this.revision++; };
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.panelPaths = new Map();
    if (!artwork) {
      const dartArt = new Image();
      dartArt.src = new URL('../../../assets/darts/darts-eye-level.png', import.meta.url).href;
      const modelArt = new Image();
      modelArt.src = new URL('../../../assets/darts/darts-meshy-views.png', import.meta.url).href;
      const base = document.createElement('canvas');
      base.width = base.height = 1400;
      // Rasterize dense static perforations on CPU once. GPU-backed path replay can
      // stall the first visible frame for seconds; the live board stays accelerated.
      const c = base.getContext('2d', { willReadFrequently: true })!;
      c.scale(2, 2);
      this.paintBoard(c);
      const dividers = document.createElement('canvas');
      dividers.width = dividers.height = 1400;
      const dividerContext = dividers.getContext('2d', { willReadFrequently: true })!;
      dividerContext.scale(2, 2);
      this.paintDividers(dividerContext);
      artwork = { base, dividers, dartArt, modelArt };
    }
    ({ base: this.base, dividers: this.dividers, dartArt: this.dartArt, modelArt: this.modelArt } = artwork);
    this.dartArt.addEventListener('load', this.invalidate);
    this.modelArt.addEventListener('load', this.invalidate);
    this.resize = new ResizeObserver(() => {
      const size = Math.max(1, canvas.getBoundingClientRect().width),
        ratio = Math.min(2, devicePixelRatio || 1);
      const pixels = Math.round(size * ratio);
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = canvas.height = pixels;
        this.invalidate();
      }
    });
    this.resize.observe(canvas);
  }
  dispose() {
    this.resize.disconnect();
    this.dartArt.removeEventListener('load', this.invalidate);
    this.modelArt.removeEventListener('load', this.invalidate);
  }
  /** Annotate the same scoring radii used by the playable board. */
  paintScoreGuide(c: CanvasRenderingContext2D) {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 700, 700);
    c.drawImage(this.base, 0, 0, 700, 700);
    c.fillStyle = '#170b1c88';
    c.beginPath();
    c.arc(C, C, 300, 0, TAU);
    c.fill();
    const a = -Math.PI / 2 - Math.PI / 20,
      b = -Math.PI / 2 + Math.PI / 20;
    for (const [inner, outer] of [[RINGS.outerBull, RINGS.tripleIn], [RINGS.tripleIn, RINGS.tripleOut], [RINGS.tripleOut, RINGS.doubleIn], [RINGS.doubleIn, 1]]) {
      this.wedge(c, inner, outer, a, b, '#e78aaa');
      c.strokeStyle = '#9b2e52';
      c.lineWidth = 3;
      c.stroke();
    }
    c.beginPath();
    c.arc(C, C, RINGS.outerBull * R, 0, TAU);
    c.fillStyle = '#b84770';
    c.fill();
    c.beginPath();
    c.arc(C, C, RINGS.bull * R, 0, TAU);
    c.fillStyle = '#ee2948';
    c.fill();
    const leader = (points: [number, number][], bothEnds = false) => {
      c.beginPath();
      c.moveTo(...points[0]);
      for (const point of points.slice(1)) c.lineTo(...point);
      c.strokeStyle = '#fff8ef';
      c.lineWidth = 2;
      c.stroke();
      for (const point of bothEnds ? [points[0], points.at(-1)!] : [points[0]]) {
        c.beginPath();
        c.arc(...point, 4, 0, TAU);
        c.fillStyle = '#fff8ef';
        c.fill();
      }
    };
    const label = (x: number, y: number, title: string, value: string, note: string) => {
      c.font = '32px "Young Serif", serif';
      const width = Math.max(172, c.measureText(value).width + 22);
      c.fillStyle = '#fff8ef';
      c.fillRect(x - 10, y - 24, width, 83);
      c.fillStyle = '#9b2e52';
      c.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
      c.fillText(title, x, y);
      c.font = '32px "Young Serif", serif';
      c.fillText(value, x, y + 33);
      c.font = '12px "Plus Jakarta Sans", sans-serif';
      c.fillText(note, x, y + 50);
    };
    leader([[350, 111], [445, 111]]);
    label(450, 105, 'DOUBLE', '40 pts', '20 × 2 · outer ring');
    leader([[350, 201], [445, 201]]);
    label(450, 216, 'TRIPLE', '60 pts', '20 × 3 · middle ring');
    leader([[350, 151], [239, 151], [239, 262], [350, 262]], true);
    label(60, 199, 'SINGLE', '20 pts', 'Both wide areas · 20 × 1');
    leader([[350, 350], [350, 433]]);
    label(290, 462, 'BULL', '25 / 50 pts', 'Outer 25 · inner 50');
  }
  point(event: {
    clientX: number;
    clientY: number;
  }) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(-1.35, Math.min(1.35, ((event.clientX - rect.left) / rect.width * 700 - C) / R)),
      y: Math.max(-1.35, Math.min(1.35, ((event.clientY - rect.top) / rect.height * 700 - C) / R))
    };
  }
  wedge(c: CanvasRenderingContext2D, inner: number, outer: number, a: number, b: number, fill: string) {
    c.beginPath();
    c.arc(C, C, outer * R, a, b);
    c.arc(C, C, inner * R, b, a, true);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = '#09070b';
    c.lineWidth = 2.4;
    c.stroke();
    c.save();
    c.clip();
    this.paintPerforations(c, fill === COLOR.cream ? 'light' : fill === COLOR.dark ? 'dark' : 'band', inner, outer, a, b);
    c.restore();
  }
  /** Lay out concentric hole rows inside one section, inset from its radial and circular borders. */
  paintPerforations(c: CanvasRenderingContext2D, tone: string, inner: number, outer: number, a = 0, b = TAU) {
    const inside = inner * R,
      outside = outer * R,
      margin = 1.65,
      spacing = 3.6;
    const rows = Math.max(1, Math.floor((outside - inside - margin * 2) / spacing) + 1);
    const fullCircle = b - a >= TAU - 0.001;
    const holes = [];
    for (let row = 0; row < rows; row++) {
      const radius = inside + (row + 0.5) * (outside - inside) / rows;
      const inset = fullCircle ? 0 : margin / radius;
      const sweep = b - a - inset * 2;
      if (sweep <= 0) continue;
      const count = Math.max(1, Math.floor(radius * sweep / spacing));
      for (let column = 0; column < count; column++) {
        const angle = a + inset + (column + 0.5) * sweep / count;
        holes.push({
          x: C + Math.cos(angle) * radius,
          y: C + Math.sin(angle) * radius
        });
      }
    }
    if (inner === 0) holes.push({
      x: C,
      y: C
    });
    // Batch the lower lips and inset centres; this is painted once into the cached board.
    c.beginPath();
    for (const {
      x,
      y
    } of holes) {
      c.moveTo(x + 0.8, y + 0.22);
      c.arc(x, y + 0.22, 0.8, 0, TAU);
    }
    c.fillStyle = tone === 'light' ? '#ffffff65' : '#ffffff35';
    c.fill();
    c.beginPath();
    for (const {
      x,
      y
    } of holes) {
      c.moveTo(x + 0.66, y - 0.06);
      c.arc(x, y - 0.06, 0.66, 0, TAU);
    }
    c.fillStyle = tone === 'light' ? '#21132165' : tone === 'band' ? '#120d205f' : '#09070ca0';
    c.fill();
  }
  paintBoard(c: CanvasRenderingContext2D) {
    const glow = c.createRadialGradient(C, C, R * 0.8, C, C, 347);
    glow.addColorStop(0, '#2d5b5240');
    glow.addColorStop(1, '#0b151600');
    c.fillStyle = glow;
    c.fillRect(0, 0, 700, 700);
    c.save();
    c.shadowColor = '#000';
    c.shadowBlur = 28;
    c.shadowOffsetY = 12;
    c.beginPath();
    c.arc(C, C, R * 1.23, 0, TAU);
    c.fillStyle = '#0b1112';
    c.fill();
    c.restore();
    for (const [r, color, width] of [[1.23, '#334542', 2], [1.19, '#766b50', 1], [1.01, '#b5bba6', 3]] as const) {
      c.beginPath();
      c.arc(C, C, R * r, 0, TAU);
      c.strokeStyle = color;
      c.lineWidth = width;
      c.stroke();
    }
    // The number rim shares the perforated surface, leaving the metal edge smooth.
    c.save();
    c.beginPath();
    c.arc(C, C, R * 1.19, 0, TAU);
    c.arc(C, C, R * 1.025, TAU, 0, true);
    c.clip();
    this.paintPerforations(c, 'dark', 1.025, 1.19);
    c.restore();
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i - 0.5) * Math.PI / 10,
        b = a + Math.PI / 10;
      const single = i % 2 ? COLOR.cream : COLOR.dark,
        band = i % 2 ? COLOR.teal : COLOR.coral;
      this.wedge(c, RINGS.outerBull, RINGS.tripleIn, a, b, single);
      this.wedge(c, RINGS.tripleIn, RINGS.tripleOut, a, b, band);
      this.wedge(c, RINGS.tripleOut, RINGS.doubleIn, a, b, single);
      this.wedge(c, RINGS.doubleIn, 1, a, b, band);
      const angle = (a + b) / 2;
      c.font = '500 23px Georgia, serif';
      c.fillStyle = '#dcd9c9';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(NUMBERS[i]), C + Math.cos(angle) * R * 1.105, C + Math.sin(angle) * R * 1.105);
    }
    for (const [inner, r, fill] of [[RINGS.bull, RINGS.outerBull, COLOR.teal], [0, RINGS.bull, COLOR.coral]] as const) {
      c.beginPath();
      c.arc(C, C, r * R, 0, TAU);
      c.fillStyle = fill;
      c.fill();
      c.strokeStyle = '#09070b';
      c.lineWidth = 2.4;
      c.stroke();
      c.save();
      c.clip();
      this.paintPerforations(c, 'band', inner, r);
      c.restore();
    }
    this.paintDividers(c);
  }
  /** Separate every scoring piece with a continuous black frame. */
  paintDividers(c: CanvasRenderingContext2D) {
    c.save();
    c.strokeStyle = '#09070b';
    c.lineWidth = 2.4;
    c.beginPath();
    for (const radius of [RINGS.bull, RINGS.outerBull, RINGS.tripleIn, RINGS.tripleOut, RINGS.doubleIn, 1]) {
      c.moveTo(C + radius * R, C);
      c.arc(C, C, radius * R, 0, TAU);
    }
    for (let index = 0; index < 20; index++) {
      const angle = -Math.PI / 2 + (index - 0.5) * Math.PI / 10;
      c.moveTo(C + Math.cos(angle) * RINGS.outerBull * R, C + Math.sin(angle) * RINGS.outerBull * R);
      c.lineTo(C + Math.cos(angle) * R, C + Math.sin(angle) * R);
    }
    c.stroke();
    c.restore();
  }
  /** Cache each panel's geometry so lighting frames only blend its colour. */
  panelPath(band: PanelBand, sector: number) {
    const key = `${band}:${sector}`;
    if (!this.panelPaths.has(key)) {
      const [inner, outer] = PANEL_BANDS[band];
      const circle = sector < 0;
      const a = circle ? 0 : -Math.PI / 2 + (sector - 0.5) * Math.PI / 10;
      const b = circle ? TAU : a + Math.PI / 10;
      const path = new Path2D();
      path.arc(C, C, outer * R, a, b);
      path.arc(C, C, inner * R, b, a, true);
      path.closePath();
      this.panelPaths.set(key, path);
    }
    return this.panelPaths.get(key)!;
  }
  /** Blend panel light without per-piece shadow filters; preserve the cached black frame. */
  paintLED(c: CanvasRenderingContext2D, dart: Dart, elapsed: number, reduced: boolean) {
    const panels = panelLights(dart, elapsed, reduced);
    if (!panels.length) return;
    c.save();
    for (const panel of panels) {
      c.globalAlpha = panel.brightness * 0.76;
      c.fillStyle = panel.color;
      c.fill(this.panelPath(panel.band, panel.sector));
    }
    c.restore();
    c.drawImage(this.dividers, 0, 0, 700, 700);
  }
  /** Reuse the two angled renders across eight directions around the board. */
  landedView(point: Point) {
    const direction = (Math.round(Math.atan2(point.y, point.x) / (Math.PI / 4)) + 8) % 8;
    const views: (SpriteView & {
      key: 'side' | 'diagonal';
    })[] = [{
      key: 'side'
    }, {
      key: 'diagonal',
      flipY: true
    }, {
      key: 'side',
      angle: Math.PI / 2
    }, {
      key: 'diagonal',
      flipX: true,
      flipY: true
    }, {
      key: 'side',
      flipX: true
    }, {
      key: 'diagonal',
      flipX: true
    }, {
      key: 'side',
      angle: -Math.PI / 2
    }, {
      key: 'diagonal'
    }];
    return {
      ...views[direction],
      weight: Math.max(0, Math.min(1, (Math.hypot(point.x, point.y) - 0.16) / 0.34))
    };
  }
  /** Draw all poses at one rear hub and equal fin span, without moving the scoring position. */
  stamp(c: CanvasRenderingContext2D, image: HTMLImageElement, sprite: Sprite, opacity: number, view: SpriteView = {}) {
    if (!opacity || !image.complete || !image.naturalWidth) return;
    c.save();
    c.globalAlpha = opacity;
    c.rotate(view.angle || 0);
    c.scale(view.flipX ? -1 : 1, view.flipY ? -1 : 1);
    const unit = 38 / sprite.wings;
    c.drawImage(image, sprite.x, sprite.y, sprite.width, sprite.height, -sprite.hubX * unit, -sprite.hubY * unit, sprite.width * unit, sprite.height * unit);
    c.restore();
  }
  /** Blend early throw to near impact, then to the landed view chosen for the actual hit. */
  dart(c: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1, wobble = 0, progress: number | null = null, point: Point = {
    x: 0,
    y: 0
  }, flightAngle: number | null = null) {
    c.save();
    c.translate(x, y);
    c.rotate(wobble);
    c.scale(scale, scale);
    const original = color === COLOR.coral ? DART_SPRITES.you.landed : DART_SPRITES.partner.landed;
    const centre = {
      ...original,
      wings: original.wings * Math.SQRT2
    };
    const modelReady = this.modelArt.complete && this.modelArt.naturalWidth;
    const centreReady = this.dartArt.complete && this.dartArt.naturalWidth;
    const near = progress === null ? 1 : Math.max(0, Math.min(1, (progress - 0.2) / 0.4));
    const landed = progress === null || !modelReady ? 1 : Math.max(0, Math.min(1, (progress - 0.72) / 0.28));
    if (modelReady) {
      const throwView = {
        angle: flightAngle ?? (Math.hypot(point.x, point.y) > .001 ? Math.atan2(point.y, point.x) + Math.PI / 2 : 0),
        flipX: point.x < 0
      };
      this.stamp(c, this.modelArt, MODEL_SPRITES.early, (1 - near) * (1 - landed), throwView);
      this.stamp(c, this.modelArt, MODEL_SPRITES.near, near * (1 - landed), throwView);
    }
    const view = this.landedView(point),
      weight = modelReady ? centreReady ? view.weight : 1 : 0;
    this.stamp(c, this.dartArt, centre, landed * (1 - weight), {
      angle: Math.PI / 4
    });
    if (modelReady) this.stamp(c, this.modelArt, MODEL_SPRITES[view.key!], landed * weight, view);
    if (!modelReady && !centreReady) {
      c.fillStyle = color;
      c.beginPath();
      c.arc(0, 0, 3, 0, TAU);
      c.fill();
    }
    c.restore();
  }
  draw({
    darts = [],
    silhouettes = [],
    aim,
    ellipse,
    dot,
    flight,
    impact,
    reduced = false
  }: BoardFrame, now: number) {
    const c = this.ctx;
    c.setTransform(this.canvas.width / 700, 0, 0, this.canvas.height / 700, 0, 0);
    c.clearRect(0, 0, 700, 700);
    c.drawImage(this.base, 0, 0, 700, 700);
    if (impact) this.paintLED(c, impact.dart, now - impact.time, reduced);
    // Keep the approved dart shape/perspective, with no old-hit wobble or effects.
    c.save();
    c.filter = 'brightness(0) opacity(0.24)';
    for (const d of silhouettes) {
      this.dart(c, C + d.x * R, C + d.y * R, d.actor === 'you' ? COLOR.coral : COLOR.teal, 1, 0, null, d);
    }
    c.restore();
    for (const d of darts) {
      const age = impact && d === impact.dart ? now - impact.time : 10000;
      const wobble = reduced ? 0 : Math.sin(age / 25) * 0.18 * Math.exp(-age / 130);
      this.dart(c, C + d.x * R, C + d.y * R, d.actor === 'you' ? COLOR.coral : COLOR.teal, 1, wobble, null, d);
    }
    if (impact) {
      const t = Math.min(1, (now - impact.time) / 650),
        {
          x,
          y
        } = impact.dart,
        hit = scoreHit(x, y);
      const color = hit.kind === 'miss' ? '#9da7a2' : hit.kind === 'bull' ? COLOR.gold : hit.kind === 'single' ? '#e8e2cb' : COLOR.teal;
      if (t < 1) {
        c.save();
        c.globalAlpha = 1 - t;
        if (!reduced) {
          const n = ['bull', 'triple'].includes(hit.kind) ? 24 : 10;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU,
              dist = 10 + t * (40 + i % 4 * 15);
            c.fillStyle = color;
            c.fillRect(C + x * R + Math.cos(a) * dist, C + y * R + Math.sin(a) * dist + 30 * t * t, 3, 3);
          }
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(C + x * R, C + y * R, 8 + t * 70, 0, TAU);
          c.stroke();
          if (['bull', 'outerBull'].includes(hit.kind)) {
            c.beginPath();
            c.arc(C, C, RINGS.outerBull * R + t * 100, 0, TAU);
            c.stroke();
          }
        }
        c.fillStyle = color;
        c.font = 'bold 28px system-ui';
        c.textAlign = 'center';
        c.shadowColor = '#000';
        c.shadowBlur = 5;
        c.fillText(hit.points ? `+${hit.points}` : 'MISS', C + x * R, C + y * R - 28 - (reduced ? 0 : t * 36));
        c.restore();
      }
    }
    if (flight) {
      const t = Math.max(0, Math.min(1, (now - flight.time) / flight.duration));
      const x = C + flight.dart.x * R,
        y = C + flight.dart.y * R;
      // Perspective depth: release near the camera, then travel towards the board plane.
      const releaseX = C,
        releaseY = 730,
        nearDepth = .45,
        boardDepth = 2;
      const project = (time: number) => {
        const depth = nearDepth + (boardDepth - nearDepth) * time;
        const p = boardDepth * time / depth;
        return {
          x: releaseX + (x - releaseX) * p,
          y: releaseY + (y - releaseY) * p,
          scale: boardDepth / depth
        };
      };
      if (!reduced) {
        const position = project(t),
          tail = project(Math.max(0, t - .06));
        c.save();
        c.strokeStyle = '#fff5';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(position.x, position.y);
        c.lineTo(tail.x, tail.y);
        c.stroke();
        c.restore();
        this.dart(c, position.x, position.y, flight.dart.actor === 'you' ? COLOR.coral : COLOR.teal, position.scale, 0, t, flight.dart, Math.atan2(y - releaseY, x - releaseX) + Math.PI / 2);
      }
    }
    if (aim) {
      const x = C + aim.x * R,
        y = C + aim.y * R;
      c.save();
      c.strokeStyle = '#fff';
      c.fillStyle = '#ffffff15';
      c.lineWidth = 1.5;
      if (ellipse) {
        c.beginPath();
        c.ellipse(x, y, ellipse.rx * R, ellipse.ry * R, 0, 0, TAU);
        c.fill();
        c.stroke();
      }
      c.strokeStyle = dot ? '#ffffff50' : COLOR.gold;
      c.beginPath();
      c.moveTo(x - 12, y);
      c.lineTo(x - 4, y);
      c.moveTo(x + 4, y);
      c.lineTo(x + 12, y);
      c.moveTo(x, y - 12);
      c.lineTo(x, y - 4);
      c.moveTo(x, y + 4);
      c.lineTo(x, y + 12);
      c.stroke();
      c.fillStyle = '#fff';
      c.fillRect(x - 1, y - 1, 2, 2);
      if (dot) {
        c.beginPath();
        c.arc(C + dot.x * R, C + dot.y * R, 4, 0, TAU);
        c.fillStyle = COLOR.gold;
        c.fill();
        c.strokeStyle = '#161018';
        c.lineWidth = 1.5;
        c.stroke();
      }
      c.restore();
    }
  }
}
