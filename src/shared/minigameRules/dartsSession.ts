/** Self-contained rules: pack isolation forbids one game's rules importing another file. */
export interface Point { x: number; y: number }
export interface Traits { version: number; accuracy: number; consistency: number; composure: number }
export type HitKind = 'miss' | 'bull' | 'outerBull' | 'single' | 'double' | 'triple'
export interface Hit { points: number; number: number; kind: HitKind; label: string }

const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const RINGS = { bull: 6.35 / 170, outerBull: 15.9 / 170, tripleIn: 99 / 170, tripleOut: 107 / 170, doubleIn: 162 / 170, edge: 1 }

function scoreHit(x: number, y: number): Hit {
  const radius = Math.hypot(x, y)
  if (radius > RINGS.edge) return { points: 0, number: 0, kind: 'miss', label: 'OUT' }
  if (radius <= RINGS.bull) return { points: 50, number: 50, kind: 'bull', label: 'BULLSEYE' }
  if (radius <= RINGS.outerBull) return { points: 25, number: 25, kind: 'outerBull', label: 'OUTER BULL' }
  const angle = (Math.atan2(x, -y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2)
  const number = NUMBERS[Math.floor(angle / (Math.PI / 10)) % 20]
  const multiplier = radius >= RINGS.doubleIn ? 2 : radius >= RINGS.tripleIn && radius <= RINGS.tripleOut ? 3 : 1
  return { points: number * multiplier, number, kind: multiplier === 3 ? 'triple' : multiplier === 2 ? 'double' : 'single', label: `${multiplier === 3 ? 'TRIPLE' : multiplier === 2 ? 'DOUBLE' : 'SINGLE'} ${number}` }
}

function random(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return [next / 4294967296, next]
}

function scatter(seed: number, target: Point, radius: number): Point & { seed: number } {
  let a: number, b: number
  ;[a, seed] = random(seed); [b, seed] = random(seed)
  const distance = Math.sqrt(a) * radius, angle = b * Math.PI * 2
  return { x: target.x + Math.cos(angle) * distance, y: target.y + Math.sin(angle) * distance, seed }
}

function targetRegion(number: number, kind: HitKind = 'single'): Point {
  if (kind === 'bull') return { x: 0, y: 0 }
  if (kind === 'outerBull') return { x: 0, y: -(RINGS.bull + RINGS.outerBull) / 2 }
  const index = NUMBERS.indexOf(number)
  if (index < 0) throw Error('Unknown sector')
  const radius = kind === 'triple' ? (RINGS.tripleIn + RINGS.tripleOut) / 2 : kind === 'double' ? (RINGS.doubleIn + 1) / 2 : 0.79
  const angle = index * Math.PI / 10
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius }
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
    items.push({ throwId: next.throws.length, beforeSeed: preview.seed, seed: next.seed, seatId, target, dart, hit: scoreHit(dart.x, dart.y), balanceBefore: valueOf(preview, seatId, before), balanceAfter: valueOf(next, seatId, after), bust: !!after.visits.at(-1)?.bust, outcome: after.outcome })
    preview = next
  }
  return items
}

export function applySessionPlan(session: DartsSession, item: SessionPlanItem): DartsSession {
  const state = sessionSummary(session)
  if (state.done || state.currentSeatId !== item.seatId || item.throwId !== session.throws.length + 1 || item.beforeSeed !== session.seed) throw Error('Stale planned dart')
  return { ...session, seed: item.seed, throws: [...session.throws, { ...item.dart }] }
}
