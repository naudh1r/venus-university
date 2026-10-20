/** Darts rules and visual geometry shared by the game and board. */

export type Actor = 'you' | 'partner';
export type Level = 'casual' | 'club' | 'expert';
export type HitKind = 'miss' | 'bull' | 'outerBull' | 'single' | 'double' | 'triple';
export interface Point {
  x: number;
  y: number;
}
export interface Dart extends Point {
  actor: Actor;
  turn?: number;
}
export interface Hit {
  points: number;
  number: number;
  kind: HitKind;
  label: string;
}
export interface Traits {
  version: number;
  accuracy: number;
  consistency: number;
  composure: number;
}

export interface Ellipse extends Point {
  rx: number;
  ry: number;
  speed: number;
}
export interface Flight {
  dart: Dart;
  time: number;
  duration: number;
}
export interface Impact {
  dart: Dart;
  time: number;
}

export const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RINGS = Object.freeze({
  bull: 6.35 / 170,
  outerBull: 15.9 / 170,
  tripleIn: 99 / 170,
  tripleOut: 107 / 170,
  doubleIn: 162 / 170,
  edge: 1
});

export function scoreHit(x: number, y: number): Hit {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Invalid landing');
  const r = Math.hypot(x, y);
  if (r > 1) return {
    points: 0,
    number: 0,
    kind: 'miss',
    label: 'MISS'
  };
  if (r <= RINGS.bull) return {
    points: 50,
    number: 50,
    kind: 'bull',
    label: 'BULLSEYE'
  };
  if (r <= RINGS.outerBull) return {
    points: 25,
    number: 25,
    kind: 'outerBull',
    label: 'OUTER BULL'
  };
  const angle = (Math.atan2(x, -y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
  const number = NUMBERS[Math.floor(angle / (Math.PI / 10)) % 20];
  const multiplier = r >= RINGS.doubleIn ? 2 : r >= RINGS.tripleIn && r <= RINGS.tripleOut ? 3 : 1;
  return {
    points: number * multiplier,
    number,
    kind: multiplier === 3 ? 'triple' : multiplier === 2 ? 'double' : 'single',
    label: `${multiplier === 3 ? 'TRIPLE' : multiplier === 2 ? 'DOUBLE' : 'SINGLE'} ${number}`
  };
}
/** A seed advances only when a dart is committed. */
export function random(seed: number): [number, number] {
  const next = Math.imul(seed, 1664525) + 1013904223 >>> 0;
  return [next / 4294967296, next];
}
/** Uniform disk scatter, shared by the accuracy preview and landing resolver. */
export function scatter(seed: number, target: Point, radius: number) {
  let a, b;
  [a, seed] = random(seed);
  [b, seed] = random(seed);
  const r = Math.sqrt(a) * radius,
    angle = b * Math.PI * 2;
  return {
    x: target.x + Math.cos(angle) * r,
    y: target.y + Math.sin(angle) * r,
    seed
  };
}
export const AIM_LEVELS = Object.freeze({
  casual: {
    rx: 0.12,
    ry: 0.19,
    speed: 2.6
  },
  club: {
    rx: 0.17,
    ry: 0.25,
    speed: 3.4
  },
  expert: {
    rx: 0.22,
    ry: 0.31,
    speed: 4.3
  }
});
/** Keep the entire locked ellipse inside the engine's accepted coordinate range. */
export function aimEllipse(target: Point, level: Level): Ellipse {
  const {
    rx,
    ry,
    speed
  } = AIM_LEVELS[level];
  return {
    x: Math.max(-1.35 + rx, Math.min(1.35 - rx, target.x)),
    y: Math.max(-1.35 + ry, Math.min(1.35 - ry, target.y)),
    rx,
    ry,
    speed
  };
}
/** A smooth per-dart trajectory stays inside the ellipse without consuming match randomness. */
export function movingDot(ellipse: Ellipse, seed: number, count: number, seconds: number): Point {
  const [a, next] = random((seed ^ Math.imul(count + 1, 2654435761)) >>> 0);
  const [b] = random(next);
  const time = Math.max(0, seconds) * ellipse.speed;
  const radius = Math.sin(a * Math.PI * 2 + time);
  const angle = b * Math.PI * 2 + time * 1.73;
  return {
    x: ellipse.x + ellipse.rx * radius * Math.cos(angle),
    y: ellipse.y + ellipse.ry * radius * Math.sin(angle)
  };
}

export function targetRegion(number: number, kind: HitKind = 'single'): Point {
  if (kind === 'bull') return {
    x: 0,
    y: 0
  };
  if (kind === 'outerBull') return {
    x: 0,
    y: -(RINGS.bull + RINGS.outerBull) / 2
  };
  const index = NUMBERS.indexOf(number);
  if (index < 0) throw Error('Unknown sector');
  const radius = kind === 'triple' ? (RINGS.tripleIn + RINGS.tripleOut) / 2 : kind === 'double' ? (RINGS.doubleIn + 1) / 2 : 0.79;
  const angle = index * Math.PI / 10;
  return {
    x: Math.sin(angle) * radius,
    y: -Math.cos(angle) * radius
  };
}

export type PanelBand = 'innerSingle' | 'outerSingle' | 'triple' | 'double' | 'outerBull' | 'bull';
export interface PanelLight {
  band: PanelBand;
  sector: number;
  brightness: number;
  color: string;
}
export const PANEL_BANDS = Object.freeze({
  innerSingle: [RINGS.outerBull, RINGS.tripleIn],
  triple: [RINGS.tripleIn, RINGS.tripleOut],
  outerSingle: [RINGS.tripleOut, RINGS.doubleIn],
  double: [RINGS.doubleIn, 1],
  outerBull: [RINGS.bull, RINGS.outerBull],
  bull: [0, RINGS.bull]
});

/** One smooth light envelope, independent of gameplay randomness. */
function pulse(time: number, start: number, duration: number) {
  const phase = (time - start) / duration;
  return phase <= 0 || phase >= 1 ? 0 : Math.sin(Math.PI * phase) ** 2;
}

/** Author distinct timed panel sequences from the actual scored region. */
export function panelLights(dart: Point, elapsed: number, reduced = false): PanelLight[] {
  const hit = scoreHit(dart.x, dart.y);
  if (elapsed < 0 || elapsed >= 650 || hit.kind === 'miss') return [];
  const sector = NUMBERS.indexOf(hit.number);
  const band = hit.kind === 'single' ? Math.hypot(dart.x, dart.y) < RINGS.tripleIn ? 'innerSingle' : 'outerSingle' : hit.kind;
  const colors = {
    single: '#fff1d4',
    double: '#6edfff',
    triple: '#ff7ebc',
    outerBull: '#75f6ef',
    bull: '#ffd96a'
  };
  const color = colors[hit.kind],
    cells = new Map<string, PanelLight>();
  /** Combine overlapping cues without repeatedly painting the same panel. */
  function add(piece: PanelBand, index: number, brightness: number) {
    if (brightness < 0.001) return;
    const key = `${piece}:${index}`,
      previous = cells.get(key);
    if (!previous || brightness > previous.brightness) cells.set(key, {
      band: piece,
      sector: index,
      brightness,
      color
    });
  }
  if (reduced) {
    add(band, sector, 0.65 * Math.max(0, 1 - elapsed / 450));
    return [...cells.values()];
  }
  // The scored piece responds on the first impact frame, before secondary waves.
  add(band, sector, 0.9 * Math.exp(-elapsed / 80));
  if (hit.kind === 'single') {
    add(band, sector, 0.85 * pulse(elapsed, 0, 240));
    for (const direction of [-1, 1]) add(band, (sector + direction + 20) % 20, 0.35 * pulse(elapsed, 50, 180));
    add(band, sector, 0.3 * pulse(elapsed, 200, 200));
  } else if (hit.kind === 'double' || hit.kind === 'triple') {
    const flashes = hit.kind === 'double' ? 2 : 3;
    for (let beat = 1; beat < flashes; beat++) add(band, sector, 0.9 * pulse(elapsed, beat * 170, 160));
    // Continuous opposing wave fronts crossfade across neighbouring pieces.
    const progress = Math.max(0, Math.min(1, elapsed / 440));
    const travel = 10 * progress * progress * (3 - 2 * progress);
    const envelope = 0.65 * pulse(elapsed, 0, 620);
    for (let index = 0; index < 20; index++) {
      let strength = 0;
      for (const direction of [-1, 1]) {
        const head = sector + direction * travel;
        const delta = (index - head + 30) % 20 - 10;
        strength = Math.max(strength, Math.exp(-0.5 * (delta / 1.15) ** 2));
      }
      add(band, index, envelope * strength);
    }
    if (hit.kind === 'triple') {
      add('innerSingle', sector, 0.48 * pulse(elapsed, 40, 240));
      add('outerSingle', sector, 0.48 * pulse(elapsed, 120, 240));
      add('double', sector, 0.4 * pulse(elapsed, 200, 240));
    }
  } else {
    // A bull sends one outward wave through the actual panel rings.
    add(band, -1, 0.92 * pulse(elapsed, 0, 230));
    add('bull', -1, 0.7 * pulse(elapsed, 280, 220));
    add('outerBull', -1, 0.65 * pulse(elapsed, 0, 230));
    for (const [ring, start] of [['innerSingle', 20], ['triple', 70], ['outerSingle', 120], ['double', 170]] as [PanelBand, number][]) for (let index = 0; index < 20; index++) add(ring, index, (hit.kind === 'bull' ? 0.5 : 0.3) * pulse(elapsed, start, 260));
  }
  return [...cells.values()];
}
/** Fixed, independent traits derived from the framework's cached skill and character identity. */
export function traitsFor(skill: number, charId: string, biases: Partial<Record<'accuracy' | 'consistency' | 'composure', number>> = {}): Traits {
  let seed = 2166136261;
  for (const letter of charId) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619) >>> 0;
  const level = Math.max(1, Math.min(5, Math.round(skill)));
  const axes = ['accuracy', 'consistency', 'composure'] as const;
  const values = [25 + (level - 1) * 15, 30 + (level - 1) * 15, 35 + (level - 1) * 10].map((base, index) => {
    let draw: number;
    [draw, seed] = random(seed);
    const bias = Math.max(-2, Math.min(2, Math.round(biases[axes[index]] ?? 0)));
    return Math.max(0, Math.min(100, base + bias * 6 + Math.floor(draw * 5) - 2));
  });
  return { version: 1, accuracy: values[0], consistency: values[1], composure: values[2] };
}

export type DartsMode = 'house' | 'rival'
export type SessionOutcome = 'won' | 'lost' | 'draw'

export interface DartsSeat {
  id: string
  name: string
  kind: 'reader' | 'npc'
  traits?: Traits
}

export interface SessionDart extends Point {
  actor: 'you' | 'partner'
  seatId: string
  visit: number
}

export interface DartsSession {
  version: 1
  id: string
  mode: DartsMode
  target: number
  seed: number
  seats: DartsSeat[]
  throws: SessionDart[]
}

export interface SessionVisit {
  index: number
  seatId: string
  start: number
  balance: number
  darts: SessionDart[]
  points: number
  rawPoints: number
  bust: boolean
  closed: boolean
}

export interface SessionSummary {
  done: boolean
  outcome: SessionOutcome | null
  winnerIds: string[]
  visit: number
  completedVisits: number
  currentSeatId: string
  dart: number
  balances: Record<string, number>
  teamBalance: number
  visits: SessionVisit[]
}

export interface SessionPlanItem {
  throwId: number
  beforeSeed: number
  seed: number
  seatId: string
  target: Point
  dart: SessionDart
  hit: Hit
  balanceBefore: number
  balanceAfter: number
  bust: boolean
  outcome: SessionOutcome | null
}

const RIVAL_ROUNDS = 3

export function newSession(input: Omit<DartsSession, 'version' | 'throws'>): DartsSession {
  if (!input.id || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw Error('Invalid darts session')
  if (!['house', 'rival'].includes(input.mode) || ![301, 501, 701].includes(input.target)) throw Error('Invalid darts rules')
  if (input.seats.length < 1 || input.seats.length > 3 || input.seats[0]?.kind !== 'reader' || input.seats.slice(1).some((seat) => seat.kind !== 'npc') || input.mode === 'rival' && input.seats.length < 2) throw Error('Invalid darts seats')
  if (new Set(input.seats.map((seat) => seat.id)).size !== input.seats.length) throw Error('Duplicate darts seat')
  return { ...input, version: 1, throws: [], seats: input.seats.map((seat) => ({ ...seat, traits: seat.traits && { ...seat.traits } })) }
}

function maxVisits(session: DartsSession): number {
  if (session.seats.length === 1) return 5
  return session.mode === 'house' ? 3 + (session.seats.length - 1) * 2 : session.seats.length * RIVAL_ROUNDS
}

/** Rebuild every score and turn from the immutable dart ledger. */
export function sessionSummary(session: DartsSession): SessionSummary {
  const balances = Object.fromEntries(session.seats.map((seat) => [seat.id, session.target]))
  let teamBalance = session.target
  const visits: SessionVisit[] = []
  let current: SessionVisit | null = null
  let checkout: string | null = null

  for (const dart of session.throws) {
    const expectedSeat = session.seats[dart.visit % session.seats.length]?.id
    if (expectedSeat !== dart.seatId) throw Error('Invalid darts ledger order')
    if (!current || current.index !== dart.visit) {
      const start = session.mode === 'house' ? teamBalance : balances[dart.seatId]
      current = { index: dart.visit, seatId: dart.seatId, start, balance: start, darts: [], points: 0, rawPoints: 0, bust: false, closed: false }
      visits.push(current)
    }
    if (current.closed) throw Error('Dart after closed visit')
    const hit = scoreHit(dart.x, dart.y)
    current.darts.push(dart)
    current.rawPoints += hit.points
    const before = session.mode === 'house' ? teamBalance : balances[dart.seatId]
    if (hit.points > before) {
      current.bust = current.closed = true
      current.points = 0
      current.balance = current.start
      if (session.mode === 'house') teamBalance = current.start
      else balances[dart.seatId] = current.start
    } else {
      const after = before - hit.points
      if (session.mode === 'house') teamBalance = after
      else balances[dart.seatId] = after
      current.balance = after
      current.points = current.start - after
      checkout = after === 0 ? dart.seatId : checkout
      current.closed = after === 0 || current.darts.length === 3
    }
  }

  const completedVisits = visits.filter((visit) => visit.closed).length
  const visit = current && !current.closed ? current.index : completedVisits
  const limitReached = completedVisits >= maxVisits(session)
  const done = checkout !== null || limitReached
  let winnerIds: string[] = []
  if (checkout) winnerIds = session.mode === 'house' ? session.seats.map((seat) => seat.id) : [checkout]
  else if (done && session.mode === 'rival') {
    const best = Math.min(...Object.values(balances))
    winnerIds = session.seats.filter((seat) => balances[seat.id] === best).map((seat) => seat.id)
  }
  const readerWon = winnerIds.includes(session.seats[0].id)
  const outcome: SessionOutcome | null = !done ? null : session.mode === 'house'
    ? checkout ? 'won' : 'lost'
    : winnerIds.length !== 1 ? 'draw' : readerWon ? 'won' : 'lost'
  const currentSeatId = session.seats[Math.min(visit, maxVisits(session) - 1) % session.seats.length].id
  const open = current && !current.closed ? current : null
  return { done, outcome, winnerIds, visit, completedVisits, currentSeatId, dart: (open?.darts.length ?? 0) + 1, balances, teamBalance, visits }
}

/** Add one player or simulated dart, with all randomness committed to the returned ledger. */
export function sessionThrow(session: DartsSession, target: Point, spread = 0): DartsSession {
  const state = sessionSummary(session)
  if (state.done) throw Error('Match is complete')
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || Math.abs(target.x) > 1.35 || Math.abs(target.y) > 1.35 || spread < 0 || spread > 0.5) throw Error('Invalid aim')
  const landing = scatter(session.seed, target, spread)
  const seat = session.seats.find((candidate) => candidate.id === state.currentSeatId)!
  const dart: SessionDart = { actor: seat.kind === 'reader' ? 'you' : 'partner', seatId: seat.id, visit: state.visit, x: landing.x, y: landing.y }
  return { ...session, seed: landing.seed, throws: [...session.throws, dart] }
}

function valueOf(session: DartsSession, seatId: string, state = sessionSummary(session)): number {
  return session.mode === 'house' ? state.teamBalance : state.balances[seatId]
}

const HIGH_TARGETS = [
  targetRegion(20, 'triple'), targetRegion(19, 'triple'), targetRegion(18, 'triple'),
  targetRegion(20, 'double'), targetRegion(17, 'triple'), targetRegion(16, 'triple')
]

function exactTarget(balance: number, darts: number): Point | null {
  const regions: { points: number; point: Point }[] = []
  for (let number = 1; number <= 20; number++) for (const kind of ['single', 'double', 'triple'] as const) {
    const point = targetRegion(number, kind)
    regions.push({ points: scoreHit(point.x, point.y).points, point })
  }
  regions.push({ points: 25, point: targetRegion(25, 'outerBull') }, { points: 50, point: targetRegion(50, 'bull') })
  regions.sort((a, b) => b.points - a.points)
  const find = (left: number, count: number): Point[] | null => {
    if (left === 0) return []
    if (!count || left < 0 || left > count * 60) return null
    for (const region of regions) {
      if (region.points > left) continue
      const tail = find(left - region.points, count - 1)
      if (tail) return [region.point, ...tail]
    }
    return null
  }
  return find(balance, darts)?.[0] ?? null
}

function npcTarget(session: DartsSession, seatId: string): Point {
  const state = sessionSummary(session)
  const left = valueOf(session, seatId, state)
  const finish = exactTarget(left, 4 - state.dart)
  if (finish) return finish
  const [pick] = random((session.seed ^ Math.imul(session.throws.length + 1, 2246822519)) >>> 0)
  return HIGH_TARGETS[Math.min(HIGH_TARGETS.length - 1, Math.floor(pick * HIGH_TARGETS.length))]
}

function npcSpread(session: DartsSession, traits: Traits): { radius: number; seed: number } {
  const state = sessionSummary(session)
  const left = valueOf(session, state.currentSeatId, state)
  const underPressure = left <= 60 || state.completedVisits >= Math.max(2, maxVisits(session) - session.seats.length)
  // Radius is relative to the board, not a score percentage. A triple band is only
  // 0.047 board radii wide: strong precision needs a tight group to show up on it.
  const imprecision = 1 - traits.accuracy / 100
  const inconsistency = 1 - traits.consistency / 100
  const nerves = 1 - traits.composure / 100
  const base = 0.024 + 0.30 * imprecision ** 2
  const variation = 0.06 * inconsistency ** 2
  const pressure = underPressure ? 0.06 * nerves ** 2 : 0
  const [roll, seed] = random(session.seed)
  return { radius: Math.max(0.015, Math.min(0.5, base + (roll * 2 - 1) * variation + pressure)), seed }
}

/** Fix one NPC visit before dialogue is requested; applying words cannot alter these darts. */
export function planNpcVisit(session: DartsSession, seatId: string): SessionPlanItem[] {
  const opening = sessionSummary(session)
  if (opening.done || opening.currentSeatId !== seatId) return []
  const seat = session.seats.find((candidate) => candidate.id === seatId)
  if (!seat?.traits) throw Error('NPC traits missing')
  const visit = opening.visit
  let preview = session
  const items: SessionPlanItem[] = []
  while (!sessionSummary(preview).done && sessionSummary(preview).visit === visit) {
    const before = sessionSummary(preview)
    const target = npcTarget(preview, seatId)
    const drift = npcSpread(preview, seat.traits)
    const next = sessionThrow({ ...preview, seed: drift.seed }, target, drift.radius)
    const after = sessionSummary(next)
    const dart = next.throws.at(-1)!
    // Keep the existing NPC script vocabulary while sharing the scoring geometry.
    const hit = scoreHit(dart.x, dart.y)
    if (hit.kind === 'miss') hit.label = 'OUT'
    items.push({ throwId: next.throws.length, beforeSeed: preview.seed, seed: next.seed, seatId, target, dart, hit, balanceBefore: valueOf(preview, seatId, before), balanceAfter: valueOf(next, seatId, after), bust: !!after.visits.at(-1)?.bust, outcome: after.outcome })
    preview = next
  }
  return items
}

export function applySessionPlan(session: DartsSession, item: SessionPlanItem): DartsSession {
  const state = sessionSummary(session)
  if (state.done || state.currentSeatId !== item.seatId || item.throwId !== session.throws.length + 1 || item.beforeSeed !== session.seed) throw Error('Stale planned dart')
  return { ...session, seed: item.seed, throws: [...session.throws, { ...item.dart }] }
}
