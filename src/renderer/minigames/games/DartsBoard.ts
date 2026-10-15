import { NUMBERS, RINGS, scoreHit, type Dart, type Ellipse, type Point } from '@shared/minigameRules/darts'

/** A dart on its way to the board: it lands at `time + duration`. */
export interface Flight {
  dart: Dart
  time: number
  duration: number
}

/** The dart that has just landed, and when, for the board's lights. */
export interface Impact {
  dart: Dart
  time: number
}

/** Everything one frame shows. */
export interface BoardFrame {
  darts: readonly Dart[]
  aim: Point | null
  ellipse: Ellipse | null
  dot: Point | null
  flight: Flight | null
  impact: Impact | null
  reduced: boolean
}

/** The board is drawn on a square of 700 units: its centre, and the double ring's outer radius. */
export const SIZE = 700
export const C = 350
export const R = 245
const TAU = Math.PI * 2

/** The board's own paint: a board is an object with colours of its own, whatever the theme. */
const COLOR = {
  coral: '#ee2948',
  teal: '#9391cc',
  cream: '#dfd2db',
  dark: '#37313b',
  frame: '#09070b',
  gold: '#efd099'
}

/** The colours a scored panel lights up in, by the kind of hit. */
const LIGHT = {
  single: '#fff1d4',
  double: '#6edfff',
  triple: '#ff7ebc',
  outerBull: '#75f6ef',
  bull: '#ffd96a'
} as const

type PanelBand = 'innerSingle' | 'outerSingle' | 'triple' | 'double' | 'outerBull' | 'bull'

const PANEL_BANDS: Record<PanelBand, readonly [number, number]> = {
  innerSingle: [RINGS.outerBull, RINGS.tripleIn],
  triple: [RINGS.tripleIn, RINGS.tripleOut],
  outerSingle: [RINGS.tripleOut, RINGS.doubleIn],
  double: [RINGS.doubleIn, 1],
  outerBull: [RINGS.bull, RINGS.outerBull],
  bull: [0, RINGS.bull]
}

interface PanelLight {
  band: PanelBand
  sector: number
  brightness: number
  color: string
}

/** One pose cut from a sheet: its rectangle, the rear hub every pose lines up on, and the fin span. */
interface Sprite {
  x: number
  y: number
  width: number
  height: number
  hubX: number
  hubY: number
  wings: number
}

/** How a pose is turned and mirrored to face the way the dart leans. */
interface SpriteView {
  key?: 'side' | 'diagonal'
  angle?: number
  flipX?: boolean
  flipY?: boolean
}

/** The poses on the two art sheets: each side's own dart seen head-on, and the model's angled renders. */
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
  her: {
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
}
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
}

/** One smooth swell of light between `start` and `start + duration`. */
function pulse(time: number, start: number, duration: number): number {
  const phase = (time - start) / duration
  return phase <= 0 || phase >= 1 ? 0 : Math.sin(Math.PI * phase) ** 2
}

/**
 * Which panels light up after a dart lands, and how brightly: the piece hit flashes, a single
 * warms its neighbours, a double or treble flashes twice or three times and sends waves both ways
 * round its ring, a bull sends one wave out through the rings. Less motion is one fading flash.
 */
function panelLights(dart: Point, elapsed: number, reduced: boolean): PanelLight[] {
  const hit = scoreHit(dart.x, dart.y)
  if (elapsed < 0 || elapsed >= 650 || hit.kind === 'miss') return []
  const sector = NUMBERS.indexOf(hit.number)
  const band: PanelBand =
    hit.kind === 'single'
      ? Math.hypot(dart.x, dart.y) < RINGS.tripleIn
        ? 'innerSingle'
        : 'outerSingle'
      : hit.kind
  const color = LIGHT[hit.kind]
  const cells = new Map<string, PanelLight>()
  const add = (piece: PanelBand, index: number, brightness: number): void => {
    if (brightness < 0.001) return
    const key = `${piece}:${index}`
    const previous = cells.get(key)
    if (!previous || brightness > previous.brightness) cells.set(key, { band: piece, sector: index, brightness, color })
  }
  if (reduced) {
    add(band, sector, 0.65 * Math.max(0, 1 - elapsed / 450))
    return [...cells.values()]
  }
  add(band, sector, 0.9 * Math.exp(-elapsed / 80))
  if (hit.kind === 'single') {
    add(band, sector, 0.85 * pulse(elapsed, 0, 240))
    for (const direction of [-1, 1]) add(band, (sector + direction + 20) % 20, 0.35 * pulse(elapsed, 50, 180))
    add(band, sector, 0.3 * pulse(elapsed, 200, 200))
  } else if (hit.kind === 'double' || hit.kind === 'triple') {
    const flashes = hit.kind === 'double' ? 2 : 3
    for (let beat = 1; beat < flashes; beat++) add(band, sector, 0.9 * pulse(elapsed, beat * 170, 160))
    const progress = Math.max(0, Math.min(1, elapsed / 440))
    const travel = 10 * progress * progress * (3 - 2 * progress)
    const envelope = 0.65 * pulse(elapsed, 0, 620)
    for (let index = 0; index < 20; index++) {
      let strength = 0
      for (const direction of [-1, 1]) {
        const head = sector + direction * travel
        const delta = ((index - head + 30) % 20) - 10
        strength = Math.max(strength, Math.exp(-0.5 * (delta / 1.15) ** 2))
      }
      add(band, index, envelope * strength)
    }
    if (hit.kind === 'triple') {
      add('innerSingle', sector, 0.48 * pulse(elapsed, 40, 240))
      add('outerSingle', sector, 0.48 * pulse(elapsed, 120, 240))
      add('double', sector, 0.4 * pulse(elapsed, 200, 240))
    }
  } else {
    add(band, -1, 0.92 * pulse(elapsed, 0, 230))
    add('bull', -1, 0.7 * pulse(elapsed, 280, 220))
    add('outerBull', -1, 0.65 * pulse(elapsed, 0, 230))
    const rings: [PanelBand, number][] = [
      ['innerSingle', 20],
      ['triple', 70],
      ['outerSingle', 120],
      ['double', 170]
    ]
    for (const [ring, start] of rings)
      for (let index = 0; index < 20; index++)
        add(ring, index, (hit.kind === 'bull' ? 0.5 : 0.3) * pulse(elapsed, start, 260))
  }
  return [...cells.values()]
}

/**
 * The dartboard on a canvas, its rings painted from the same radii the rules score with. The
 * board itself is painted once and kept, and each frame lays the darts, the lights, the flight and
 * the aim over it. The reader's darts take `mine`, hers the board's lavender.
 */
/** Whether an art sheet has loaded and can be drawn. */
function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0
}

export class DartsBoard {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly base: HTMLCanvasElement
  private readonly dividers: HTMLCanvasElement
  private readonly panelPaths = new Map<string, Path2D>()
  private readonly resize: ResizeObserver
  private readonly mine: string
  private readonly dartArt: HTMLImageElement
  private readonly modelArt: HTMLImageElement
  private ghost: HTMLCanvasElement | null = null

  constructor(canvas: HTMLCanvasElement, mine: string) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.mine = mine || COLOR.coral
    this.dartArt = new Image()
    this.dartArt.src = new URL('./darts/darts-eye-level.png', import.meta.url).href
    this.modelArt = new Image()
    this.modelArt.src = new URL('./darts/darts-meshy-views.png', import.meta.url).href
    this.base = document.createElement('canvas')
    this.base.width = this.base.height = SIZE * 2
    const c = this.base.getContext('2d')
    if (c) {
      c.scale(2, 2)
      this.paintBoard(c)
    }
    this.dividers = document.createElement('canvas')
    this.dividers.width = this.dividers.height = SIZE * 2
    const d = this.dividers.getContext('2d')
    if (d) {
      d.scale(2, 2)
      this.paintDividers(d)
    }
    // Drawn at the size it is laid out, twice over on a sharp screen and no more.
    this.resize = new ResizeObserver(() => {
      const size = Math.max(1, canvas.clientWidth)
      const ratio = Math.min(2, Math.max(1, devicePixelRatio || 1))
      canvas.width = canvas.height = Math.round(size * ratio)
    })
    this.resize.observe(canvas)
  }

  dispose(): void {
    this.resize.disconnect()
    this.dartArt.src = ''
    this.modelArt.src = ''
  }

  private wedge(c: CanvasRenderingContext2D, inner: number, outer: number, a: number, b: number, fill: string): void {
    c.beginPath()
    c.arc(C, C, outer * R, a, b)
    c.arc(C, C, inner * R, b, a, true)
    c.closePath()
    c.fillStyle = fill
    c.fill()
    c.save()
    c.clip()
    this.paintPerforations(c, fill === COLOR.cream ? 'light' : fill === COLOR.dark ? 'dark' : 'band', inner, outer, a, b)
    c.restore()
  }

  /** Rows of small holes across one piece, inset from its borders, as on a soft-tip board. */
  private paintPerforations(
    c: CanvasRenderingContext2D,
    tone: 'light' | 'dark' | 'band',
    inner: number,
    outer: number,
    a = 0,
    b = TAU
  ): void {
    const inside = inner * R
    const outside = outer * R
    const margin = 1.65
    const spacing = 3.6
    const rows = Math.max(1, Math.floor((outside - inside - margin * 2) / spacing) + 1)
    const fullCircle = b - a >= TAU - 0.001
    const holes: Point[] = []
    for (let row = 0; row < rows; row++) {
      const radius = inside + ((row + 0.5) * (outside - inside)) / rows
      const inset = fullCircle ? 0 : margin / radius
      const sweep = b - a - inset * 2
      if (sweep <= 0) continue
      const count = Math.max(1, Math.floor((radius * sweep) / spacing))
      for (let column = 0; column < count; column++) {
        const angle = a + inset + ((column + 0.5) * sweep) / count
        holes.push({ x: C + Math.cos(angle) * radius, y: C + Math.sin(angle) * radius })
      }
    }
    if (inner === 0) holes.push({ x: C, y: C })
    c.beginPath()
    for (const { x, y } of holes) {
      c.moveTo(x + 0.8, y + 0.22)
      c.arc(x, y + 0.22, 0.8, 0, TAU)
    }
    c.fillStyle = tone === 'light' ? '#ffffff65' : '#ffffff35'
    c.fill()
    c.beginPath()
    for (const { x, y } of holes) {
      c.moveTo(x + 0.66, y - 0.06)
      c.arc(x, y - 0.06, 0.66, 0, TAU)
    }
    c.fillStyle = tone === 'light' ? '#21132165' : tone === 'band' ? '#120d205f' : '#09070ca0'
    c.fill()
  }

  private paintBoard(c: CanvasRenderingContext2D): void {
    c.save()
    c.shadowColor = '#000'
    c.shadowBlur = 28
    c.shadowOffsetY = 12
    c.beginPath()
    c.arc(C, C, R * 1.23, 0, TAU)
    c.fillStyle = '#0b1112'
    c.fill()
    c.restore()
    const rims: [number, string, number][] = [
      [1.23, '#334542', 2],
      [1.19, '#766b50', 1],
      [1.01, '#b5bba6', 3]
    ]
    for (const [r, color, width] of rims) {
      c.beginPath()
      c.arc(C, C, R * r, 0, TAU)
      c.strokeStyle = color
      c.lineWidth = width
      c.stroke()
    }
    // The number rim is perforated too, and the metal edge outside it stays smooth.
    c.save()
    c.beginPath()
    c.arc(C, C, R * 1.19, 0, TAU)
    c.arc(C, C, R * 1.025, TAU, 0, true)
    c.clip()
    this.paintPerforations(c, 'dark', 1.025, 1.19)
    c.restore()
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + ((i - 0.5) * Math.PI) / 10
      const b = a + Math.PI / 10
      const single = i % 2 ? COLOR.cream : COLOR.dark
      const band = i % 2 ? COLOR.teal : COLOR.coral
      this.wedge(c, RINGS.outerBull, RINGS.tripleIn, a, b, single)
      this.wedge(c, RINGS.tripleIn, RINGS.tripleOut, a, b, band)
      this.wedge(c, RINGS.tripleOut, RINGS.doubleIn, a, b, single)
      this.wedge(c, RINGS.doubleIn, 1, a, b, band)
      const angle = (a + b) / 2
      c.font = '500 23px Georgia, serif'
      c.fillStyle = '#dcd9c9'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(NUMBERS[i]), C + Math.cos(angle) * R * 1.105, C + Math.sin(angle) * R * 1.105)
    }
    const bulls: [number, number, string][] = [
      [RINGS.bull, RINGS.outerBull, COLOR.teal],
      [0, RINGS.bull, COLOR.coral]
    ]
    for (const [inner, r, fill] of bulls) {
      c.beginPath()
      c.arc(C, C, r * R, 0, TAU)
      c.fillStyle = fill
      c.fill()
      c.save()
      c.clip()
      this.paintPerforations(c, 'band', inner, r)
      c.restore()
    }
    this.paintDividers(c)
  }

  /** The black frame between every scoring piece. */
  private paintDividers(c: CanvasRenderingContext2D): void {
    c.save()
    c.strokeStyle = COLOR.frame
    c.lineWidth = 2.4
    c.beginPath()
    for (const radius of [RINGS.bull, RINGS.outerBull, RINGS.tripleIn, RINGS.tripleOut, RINGS.doubleIn, 1]) {
      c.moveTo(C + radius * R, C)
      c.arc(C, C, radius * R, 0, TAU)
    }
    for (let index = 0; index < 20; index++) {
      const angle = -Math.PI / 2 + ((index - 0.5) * Math.PI) / 10
      c.moveTo(C + Math.cos(angle) * RINGS.outerBull * R, C + Math.sin(angle) * RINGS.outerBull * R)
      c.lineTo(C + Math.cos(angle) * R, C + Math.sin(angle) * R)
    }
    c.stroke()
    c.restore()
  }

  private panelPath(band: PanelBand, sector: number): Path2D {
    const key = `${band}:${sector}`
    let path = this.panelPaths.get(key)
    if (!path) {
      const [inner, outer] = PANEL_BANDS[band]
      const circle = sector < 0
      const a = circle ? 0 : -Math.PI / 2 + ((sector - 0.5) * Math.PI) / 10
      const b = circle ? TAU : a + Math.PI / 10
      path = new Path2D()
      path.arc(C, C, outer * R, a, b)
      path.arc(C, C, inner * R, b, a, true)
      path.closePath()
      this.panelPaths.set(key, path)
    }
    return path
  }

  private paintLights(c: CanvasRenderingContext2D, dart: Dart, elapsed: number, reduced: boolean): void {
    const panels = panelLights(dart, elapsed, reduced)
    if (!panels.length) return
    c.save()
    for (const panel of panels) {
      c.globalAlpha = panel.brightness * 0.76
      c.fillStyle = panel.color
      c.fill(this.panelPath(panel.band, panel.sector))
    }
    c.restore()
    c.drawImage(this.dividers, 0, 0, SIZE, SIZE)
  }

  /**
   * A drawn dart, shown until the art sheets have loaded: its point at (x, y), the barrel and
   * the flights leaning back towards the line, the side's colour on the flights.
   */
  private drawnDart(c: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1, wobble = 0, lean = 0): void {
    c.save()
    c.translate(x, y)
    c.rotate(lean + wobble)
    c.scale(scale, scale)
    c.lineCap = 'round'
    // The shadow it casts on the board, falling a little below.
    c.globalAlpha = 0.35
    c.strokeStyle = '#000'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(1, 2)
    c.lineTo(5, 26)
    c.stroke()
    c.globalAlpha = 1
    // The barrel, dark metal with a light edge.
    c.strokeStyle = '#1b1820'
    c.lineWidth = 4.5
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(0, 14)
    c.stroke()
    c.strokeStyle = '#c9c4cf'
    c.lineWidth = 1.4
    c.beginPath()
    c.moveTo(-0.8, 2)
    c.lineTo(-0.8, 13)
    c.stroke()
    // The shaft and the flights, crossed, in the side's colour.
    c.strokeStyle = '#1b1820'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(0, 14)
    c.lineTo(0, 22)
    c.stroke()
    c.fillStyle = color
    c.strokeStyle = COLOR.frame
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(0, 18)
    c.lineTo(-8, 30)
    c.lineTo(0, 27)
    c.lineTo(8, 30)
    c.closePath()
    c.fill()
    c.stroke()
    c.beginPath()
    c.moveTo(0, 18)
    c.lineTo(0, 32)
    c.stroke()
    c.restore()
  }

  /** Reuses the two angled renders across eight directions around the board. */
  private landedView(point: Point): SpriteView & { key: 'side' | 'diagonal'; weight: number } {
    const direction = (Math.round(Math.atan2(point.y, point.x) / (Math.PI / 4)) + 8) % 8
    const views: (SpriteView & { key: 'side' | 'diagonal' })[] = [
      { key: 'side' },
      { key: 'diagonal', flipY: true },
      { key: 'side', angle: Math.PI / 2 },
      { key: 'diagonal', flipX: true, flipY: true },
      { key: 'side', flipX: true },
      { key: 'diagonal', flipX: true },
      { key: 'side', angle: -Math.PI / 2 },
      { key: 'diagonal' }
    ]
    return { ...views[direction], weight: Math.max(0, Math.min(1, (Math.hypot(point.x, point.y) - 0.16) / 0.34)) }
  }

  /** Draws a pose at one rear hub and an equal fin span, so the scoring point never moves. */
  private stamp(c: CanvasRenderingContext2D, image: HTMLImageElement, sprite: Sprite, opacity: number, view: SpriteView = {}): void {
    if (!opacity || !ready(image)) return
    c.save()
    c.globalAlpha = opacity
    c.rotate(view.angle || 0)
    c.scale(view.flipX ? -1 : 1, view.flipY ? -1 : 1)
    const unit = 38 / sprite.wings
    c.drawImage(
      image,
      sprite.x,
      sprite.y,
      sprite.width,
      sprite.height,
      -sprite.hubX * unit,
      -sprite.hubY * unit,
      sprite.width * unit,
      sprite.height * unit
    )
    c.restore()
  }

  /**
   * A dart at (x, y): in flight (`progress` from 0 to 1) it blends the early throw into the near
   * pose and then into the landed view for where it hits; stuck in the board (`progress` null) it
   * shows the landed view. Until the art has loaded it is drawn instead.
   */
  private dart(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    dart: Dart,
    scale = 1,
    wobble = 0,
    progress: number | null = null,
    flightAngle: number | null = null
  ): void {
    const modelReady = ready(this.modelArt)
    const centreReady = ready(this.dartArt)
    if (!modelReady && !centreReady) {
      this.drawnDart(c, x, y, this.colorOf(dart), scale, wobble, -dart.x * 0.25)
      return
    }
    c.save()
    c.translate(x, y)
    c.rotate(wobble)
    c.scale(scale, scale)
    const original = DART_SPRITES[dart.side].landed
    const centre = { ...original, wings: original.wings * Math.SQRT2 }
    const near = progress === null ? 1 : Math.max(0, Math.min(1, (progress - 0.2) / 0.4))
    const landed = progress === null || !modelReady ? 1 : Math.max(0, Math.min(1, (progress - 0.72) / 0.28))
    if (modelReady) {
      const throwView = {
        angle: flightAngle ?? (Math.hypot(dart.x, dart.y) > 0.001 ? Math.atan2(dart.y, dart.x) + Math.PI / 2 : 0),
        flipX: dart.x < 0
      }
      this.stamp(c, this.modelArt, MODEL_SPRITES.early, (1 - near) * (1 - landed), throwView)
      this.stamp(c, this.modelArt, MODEL_SPRITES.near, near * (1 - landed), throwView)
    }
    const view = this.landedView(dart)
    const weight = modelReady ? (centreReady ? view.weight : 1) : 0
    this.stamp(c, this.dartArt, centre, landed * (1 - weight), { angle: Math.PI / 4 })
    if (modelReady) this.stamp(c, this.modelArt, MODEL_SPRITES[view.key], landed * weight, view)
    c.restore()
  }

  /** Draws the earlier darts on a layer of their own, fills each side's in its colour, and lays the layer on the board. */
  private silhouettes(c: CanvasRenderingContext2D, darts: readonly Dart[]): void {
    if (!this.ghost) {
      this.ghost = document.createElement('canvas')
      this.ghost.width = this.ghost.height = SIZE
    }
    const layer = this.ghost
    const g = layer.getContext('2d')
    if (!g) return
    for (const side of ['you', 'her'] as const) {
      const theirs = darts.filter((d) => d.side === side)
      if (theirs.length === 0) continue
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, SIZE, SIZE)
      for (const d of theirs) this.dart(g, C + d.x * R, C + d.y * R, d)
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = this.colorOf(theirs[0])
      g.fillRect(0, 0, SIZE, SIZE)
      c.save()
      c.globalAlpha = 0.6
      c.drawImage(layer, 0, 0, SIZE, SIZE)
      c.restore()
    }
  }

  private colorOf(dart: Dart): string {
    return dart.side === 'you' ? this.mine : COLOR.teal
  }

  draw({ darts, aim, ellipse, dot, flight, impact, reduced }: BoardFrame, now: number): void {
    const c = this.ctx
    if (!c) return
    c.setTransform(this.canvas.width / SIZE, 0, 0, this.canvas.height / SIZE, 0, 0)
    c.clearRect(0, 0, SIZE, SIZE)
    c.drawImage(this.base, 0, 0, SIZE, SIZE)
    if (impact) this.paintLights(c, impact.dart, now - impact.time, reduced)
    // Every dart before the newest is a flat silhouette, so a dart landing on the same spot shows on top.
    const latest = darts.length - 1
    if (latest > 0) this.silhouettes(c, darts.slice(0, latest))
    for (const d of darts.slice(Math.max(0, latest))) {
      const age = impact && d === impact.dart ? now - impact.time : 10000
      const wobble = reduced ? 0 : Math.sin(age / 25) * 0.18 * Math.exp(-age / 130)
      this.dart(c, C + d.x * R, C + d.y * R, d, 1, wobble)
    }
    if (impact) this.paintImpact(c, impact, now, reduced)
    if (flight && !reduced) this.paintFlight(c, flight, now)
    if (aim) this.paintAim(c, aim, ellipse, dot)
  }

  /** The points scored, rising off the dart, with a ring and a burst for anything worth it. */
  private paintImpact(c: CanvasRenderingContext2D, impact: Impact, now: number, reduced: boolean): void {
    const t = Math.min(1, (now - impact.time) / 650)
    if (t >= 1) return
    const { x, y } = impact.dart
    const hit = scoreHit(x, y)
    const color =
      hit.kind === 'miss' ? '#9da7a2' : hit.kind === 'bull' ? COLOR.gold : hit.kind === 'single' ? '#e8e2cb' : LIGHT[hit.kind]
    c.save()
    c.globalAlpha = 1 - t
    if (!reduced) {
      const n = hit.kind === 'bull' || hit.kind === 'triple' ? 24 : 10
      c.fillStyle = color
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU
        const dist = 10 + t * (40 + (i % 4) * 15)
        c.fillRect(C + x * R + Math.cos(a) * dist, C + y * R + Math.sin(a) * dist + 30 * t * t, 3, 3)
      }
      c.strokeStyle = color
      c.lineWidth = 2
      c.beginPath()
      c.arc(C + x * R, C + y * R, 8 + t * 70, 0, TAU)
      c.stroke()
    }
    c.fillStyle = color
    c.font = 'bold 28px system-ui, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.shadowColor = '#000'
    c.shadowBlur = 5
    c.fillText(hit.points ? `+${hit.points}` : 'MISS', C + x * R, C + y * R - 28 - (reduced ? 0 : t * 36))
    c.restore()
  }

  /** A dart on its way: let go near the eye below the board, shrinking as it travels to it. */
  private paintFlight(c: CanvasRenderingContext2D, flight: Flight, now: number): void {
    const t = Math.max(0, Math.min(1, (now - flight.time) / flight.duration))
    const x = C + flight.dart.x * R
    const y = C + flight.dart.y * R
    const releaseX = C
    const releaseY = 730
    const nearDepth = 0.45
    const boardDepth = 2
    const project = (time: number): { x: number; y: number; scale: number } => {
      const depth = nearDepth + (boardDepth - nearDepth) * time
      const p = (boardDepth * time) / depth
      return { x: releaseX + (x - releaseX) * p, y: releaseY + (y - releaseY) * p, scale: boardDepth / depth }
    }
    const position = project(t)
    const tail = project(Math.max(0, t - 0.06))
    c.save()
    c.strokeStyle = '#ffffff55'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(position.x, position.y)
    c.lineTo(tail.x, tail.y)
    c.stroke()
    c.restore()
    this.dart(c, position.x, position.y, flight.dart, position.scale, 0, t, Math.atan2(y - releaseY, x - releaseX) + Math.PI / 2)
  }

  /** The aim: a cross where the pointer is, and once held, the ellipse and the dot moving in it. */
  private paintAim(c: CanvasRenderingContext2D, aim: Point, ellipse: Ellipse | null, dot: Point | null): void {
    const x = C + aim.x * R
    const y = C + aim.y * R
    c.save()
    c.strokeStyle = '#fff'
    c.fillStyle = '#ffffff15'
    c.lineWidth = 1.5
    if (ellipse) {
      c.beginPath()
      c.ellipse(x, y, ellipse.rx * R, ellipse.ry * R, 0, 0, TAU)
      c.fill()
      c.stroke()
    }
    c.strokeStyle = dot ? '#ffffff50' : COLOR.gold
    c.beginPath()
    c.moveTo(x - 12, y)
    c.lineTo(x - 4, y)
    c.moveTo(x + 4, y)
    c.lineTo(x + 12, y)
    c.moveTo(x, y - 12)
    c.lineTo(x, y - 4)
    c.moveTo(x, y + 4)
    c.lineTo(x, y + 12)
    c.stroke()
    if (dot) {
      c.beginPath()
      c.arc(C + dot.x * R, C + dot.y * R, 4, 0, TAU)
      c.fillStyle = COLOR.gold
      c.fill()
      c.strokeStyle = '#161018'
      c.lineWidth = 1.5
      c.stroke()
    }
    c.restore()
  }
}
