export type Actor = 'you' | 'partner';
export type PartnerId = 'ren' | 'jules' | 'sage';
export type Level = 'casual' | 'club' | 'expert';
export type Strategy = 'safe' | 'triples';
export type Expression = 'neutral' | 'focused' | 'happy' | 'sad' | 'surprised' | 'embarrassed' | 'confident';
export type Outcome = 'win' | 'draw' | 'loss';
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
export interface SpokenLine {
  dialogue: string;
  expression: Expression;
}
export interface TurnScript {
  intro: SpokenLine;
  outro: SpokenLine;
  outroShown: boolean;
}
export interface PlannedThrow {
  throwId: number;
  beforeSeed: number;
  seed: number;
  dart: Dart;
  target: Point;
  drift: {
    base: number;
    offset: number;
    pressure: number;
    radius: number;
  };
  hit: Hit;
  balanceBefore?: number;
  balanceAfter?: number;
  bust: boolean;
  outcome: Outcome | null;
}
export interface PartnerPlan {
  start: number;
  seed: number;
  strategy: Strategy;
  items: PlannedThrow[];
}
export interface Match {
  version: number;
  id: string;
  partner: PartnerId;
  level: Level;
  mode?: number;
  target: number;
  seed: number;
  throws: Dart[];
  strategy: Strategy;
  dialogue: Record<string, string>;
  reactions: Record<string, SpokenLine>;
  turnScripts: Record<string, TurnScript>;
  partnerTraits: Traits;
  acknowledged: number;
  requested: string[];
  partnerPlan?: PartnerPlan;
}
export interface Visit {
  turn: number;
  actor: Actor;
  start: number;
  balance: number;
  darts: Dart[];
  points: number;
  rawPoints: number;
  bust: boolean;
  closed: boolean;
  end: number;
}
export interface Summary {
  count: number;
  done: boolean;
  round: number;
  actor: Actor;
  dart: number;
  you: number;
  partner: number;
  total: number;
  remaining: number;
  outcome: Outcome | null;
  turn?: number;
  balance?: number;
  visits?: Visit[];
  completedTurns?: number;
}
export interface TurnRecap {
  actor: Actor;
  points: number;
  hits: Hit[];
  rawPoints?: number;
  bust?: boolean;
  start?: number;
  balance?: number;
}
export interface MatchSetup {
  partner?: PartnerId;
  level?: Level;
  mode?: number;
  version?: number;
  seed: number;
  id: string;
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
export interface Settings {
  volume: number;
  reduced: boolean;
  model: string;
  ai: boolean;
}
export interface AiOptions {
  key: string;
  model: string;
  signal?: AbortSignal;
  fetcher?: (url: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
}
export interface TurnResponse {
  intro: SpokenLine;
  reactions: Record<string, SpokenLine>;
  outro: SpokenLine;
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
export const MODES = Object.freeze([301, 501, 701]);
export const LEVELS = Object.freeze({
  casual: 360,
  club: 480,
  expert: 600
});
export const PARTNERS = Object.freeze({
  ren: {
    name: 'Ren',
    style: 'The steady hand',
    description: 'Calm, dry wit. Celebrates teamwork without making a fuss.',
    spread: 0.115,
    traits: Object.freeze({
      version: 1,
      accuracy: 50,
      consistency: 65,
      composure: 35
    })
  },
  jules: {
    name: 'Jules',
    style: 'The risk taker',
    description: 'Playful and competitive. Loves a bold shot, laughs off a miss.',
    spread: 0.19,
    traits: Object.freeze({
      version: 1,
      accuracy: 45,
      consistency: 35,
      composure: 70
    })
  },
  sage: {
    name: 'Sage',
    style: 'The quiet ace',
    description: 'Observant and warm. Gives concise, practical encouragement.',
    spread: 0.075,
    traits: Object.freeze({
      version: 1,
      accuracy: 70,
      consistency: 50,
      composure: 30
    })
  }
});
/** Score normalized coordinates: board centre (0,0), double outer edge radius 1, y down. */
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
/** Derive turns and scores from the throw ledger, never from mutable totals. */
function legacySummary(match: Match): Summary {
  const count = match.throws.length,
    done = count === 30;
  const you = match.throws.filter(t => t.actor === 'you').reduce((n, t) => n + scoreHit(t.x, t.y).points, 0);
  const partner = match.throws.filter(t => t.actor === 'partner').reduce((n, t) => n + scoreHit(t.x, t.y).points, 0);
  return {
    count,
    done,
    round: Math.min(5, Math.floor(count / 6) + 1),
    actor: count % 6 < 3 ? 'you' : 'partner',
    dart: count % 3 + 1,
    you,
    partner,
    total: you + partner,
    remaining: 30 - count,
    outcome: done ? you + partner > match.target ? 'win' : you + partner === match.target ? 'draw' : 'loss' : null
  };
}
/** Replay countdown visits; a bust restores that visit's opening score and ends it early. */
export function summary(match: Match): Summary {
  if (match.version === 1) return legacySummary(match);
  let balance = match.target,
    turn = 0,
    current: Visit | null = null,
    won = false;
  const visits: Visit[] = [];
  for (const dart of match.throws) {
    if (!current || current.closed) {
      current = {
        turn,
        actor: turn % 2 ? 'partner' : 'you',
        start: balance,
        balance,
        darts: [],
        points: 0,
        rawPoints: 0,
        bust: false,
        closed: false,
        end: 0
      };
      visits.push(current);
    }
    const hit = scoreHit(dart.x, dart.y);
    current.darts.push(dart);
    current.rawPoints += hit.points;
    if (hit.points > balance) {
      balance = current.start;
      current.bust = current.closed = true;
      current.points = 0;
    } else {
      balance -= hit.points;
      current.points = current.start - balance;
      won = balance === 0;
      current.closed = won || current.darts.length === 3;
    }
    current.balance = balance;
    if (current.closed) turn++;
  }
  let end = 0;
  for (const visit of visits) {
    end += visit.darts.length;
    visit.end = end;
  }
  const done = won || turn >= 5;
  const used = current && !current.closed ? current.darts.length : 0;
  return {
    count: match.throws.length,
    done,
    round: Math.min(5, turn + 1),
    turn,
    actor: turn % 2 ? 'partner' : 'you',
    dart: used + 1,
    you: visits.filter(v => v.actor === 'you').reduce((n, v) => n + v.points, 0),
    partner: visits.filter(v => v.actor === 'partner').reduce((n, v) => n + v.points, 0),
    total: match.target - balance,
    balance,
    visits,
    remaining: done ? 0 : (5 - turn) * 3 - used,
    completedTurns: visits.filter(v => v.closed).length,
    outcome: done ? won ? 'win' : 'loss' : null
  };
}
/** Freeze the rules at creation; legacy count-up matches retain their original rules. */
export function newMatch({
  partner = 'ren',
  level = 'club',
  mode = 501,
  version = 2,
  seed,
  id
}: MatchSetup): Match {
  if (!Object.hasOwn(PARTNERS, partner) || !Object.hasOwn(LEVELS, level) || ![1, 2].includes(version) || version === 2 && !MODES.includes(mode) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || typeof id !== 'string' || !id) throw Error('Invalid match setup');
  return {
    version,
    id,
    partner,
    level,
    ...(version === 2 ? {
      mode
    } : {}),
    target: version === 1 ? LEVELS[level] : mode,
    seed,
    throws: [],
    strategy: 'safe',
    dialogue: {},
    reactions: {},
    turnScripts: {},
    partnerTraits: {
      ...PARTNERS[partner].traits
    },
    acknowledged: 0,
    requested: []
  };
}
/** Convert a named scoring region into its geometric centre. */
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
interface Candidate {
  kind: HitKind;
  number: number;
  aim: Point;
  points: number;
  label: string;
  outcomes: number[];
  chance: number;
}
interface Route {
  chance: number;
  route: Candidate[];
}
const candidateCache = new Map<number, Candidate[]>();
/** Estimate ordinary skill scatter for each region without advancing the saved PRNG. */
function candidates(spread: number): Candidate[] {
  if (candidateCache.has(spread)) return candidateCache.get(spread)!;
  const regions: {
    kind: HitKind;
    number: number;
  }[] = [];
  for (const kind of ['single', 'double', 'triple'] as const) for (let number = 1; number <= 20; number++) regions.push({
    kind,
    number
  });
  regions.push({
    kind: 'bull',
    number: 50
  }, {
    kind: 'outerBull',
    number: 25
  });
  const result = regions.map(region => {
    const aim = targetRegion(region.number, region.kind),
      hit = scoreHit(aim.x, aim.y);
    const outcomes = [];
    for (let i = 0; i < 96; i++) {
      const radius = Math.sqrt((i + 0.5) / 96) * spread,
        angle = i * 2.399963229728653;
      outcomes.push(scoreHit(aim.x + Math.cos(angle) * radius, aim.y + Math.sin(angle) * radius).points);
    }
    return {
      ...region,
      aim,
      points: hit.points,
      label: hit.label,
      outcomes,
      chance: outcomes.filter(n => n === hit.points).length / 96
    };
  });
  candidateCache.set(spread, result);
  return result;
}
/** Find a feasible exact-zero route within the darts left in this visit. */
function routeToZero(balance: number, darts: number, regions: Candidate[], memo = new Map<string, Route | null>()): Route | null {
  if (balance === 0) return {
    chance: 1,
    route: []
  };
  if (!darts || balance > darts * 60) return null;
  const key = `${balance}:${darts}`;
  if (memo.has(key)) return memo.get(key)!;
  let best: Route | null = null;
  for (const region of regions) {
    if (!region.chance || region.points > balance) continue;
    const next = routeToZero(balance - region.points, darts - 1, regions, memo);
    if (!next) continue;
    const chance = region.chance * next.chance;
    if (!best || chance > best.chance + 1e-9 || Math.abs(chance - best.chance) < 1e-9 && next.route.length + 1 < best.route.length) best = {
      chance,
      route: [region, ...next.route]
    };
  }
  memo.set(key, best);
  return best;
}
/** A displayed checkout is a possible route, not a promised result. */
export function checkoutHint(match: Match): string[] {
  if (match.version === 1 || summary(match).done) return [];
  const s = summary(match),
    plan = routeToZero(s.balance!, 4 - s.dart, candidates(0.06));
  return plan?.route.map(r => r.label) || [];
}
/** Target exact finishes first, otherwise balance progress, bust risk and the next leave. */
export function companionAim(match: Match): Point {
  if (match.version === 1) return match.strategy === 'triples' ? targetRegion(20, 'triple') : targetRegion(20);
  const s = summary(match),
    regions = candidates(partnerDrift(match).base + partnerDrift(match).pressure);
  const finish = routeToZero(s.balance!, 4 - s.dart, regions);
  if (finish?.route.length) return finish.route[0].aim;
  const visit = s.visits!.at(-1),
    lost = visit && !visit.closed ? visit.points : 0;
  const choices = regions.filter(r => r.points <= s.balance! && (match.strategy === 'triples' || !['triple', 'double'].includes(r.kind)));
  const scored = choices.map(r => ({
    ...r,
    utility: r.outcomes.reduce((sum, n) => sum + (n > s.balance! ? -lost - 25 : n), 0) / r.outcomes.length + (s.balance! - r.points <= 60 ? 3 : 0)
  }));
  const best = Math.max(...scored.map(r => r.utility));
  const shortlist = scored.filter(r => r.utility >= best - 2);
  const [pick] = random((match.seed ^ Math.imul(s.count + 1, 2246822519)) >>> 0);
  return shortlist[Math.floor(pick * shortlist.length)]?.aim || targetRegion(1);
}
export const EXPRESSIONS: readonly Expression[] = Object.freeze(['neutral', 'focused', 'happy', 'sad', 'surprised', 'embarrassed', 'confident']);
/** Fixed ability with bounded signed variation; pressure matters only near a finish or late turn. */
export function partnerDrift(match: Match) {
  const traits = match.partnerTraits || PARTNERS[match.partner].traits;
  const s = summary(match);
  const underPressure = match.version === 2 && (s.balance! <= 60 || s.turn! >= 3);
  const base = 0.26 - traits.accuracy * 0.0024;
  const variation = 0.08 * (1 - traits.consistency / 100);
  const pressure = underPressure ? 0.08 * (1 - traits.composure / 100) : 0;
  const [roll, seed] = random(match.seed);
  const offset = (roll * 2 - 1) * variation;
  return {
    base,
    variation,
    pressure,
    offset,
    radius: Math.max(0.015, Math.min(0.5, base + offset + pressure)),
    seed
  };
}
/** Preview a full partner visit without committing it or consuming the live match's seed. */
export function planPartnerTurn(match: Match): PlannedThrow[] {
  const actor = summary(match).actor;
  if (actor !== 'partner' || summary(match).done) return [];
  let preview = match;
  const turn = summary(match).turn,
    plan: PlannedThrow[] = [];
  while (!summary(preview).done && summary(preview).actor === actor && (match.version === 1 ? plan.length === 0 || preview.throws.length % 3 !== 0 : summary(preview).turn === turn)) {
    const target = companionAim(preview),
      drift = partnerDrift(preview);
    const next = throwDart({
      ...preview,
      seed: drift.seed
    }, target, drift.radius);
    const state = summary(next),
      dart = next.throws.at(-1)!;
    plan.push({
      throwId: next.throws.length,
      beforeSeed: preview.seed,
      seed: next.seed,
      dart,
      target,
      drift: {
        base: drift.base,
        offset: drift.offset,
        pressure: drift.pressure,
        radius: drift.radius
      },
      hit: scoreHit(dart.x, dart.y),
      balanceBefore: summary(preview).balance,
      balanceAfter: state.balance,
      bust: !!state.visits?.at(-1)?.bust,
      outcome: state.outcome
    });
    preview = next;
  }
  return plan;
}
/** Commit only the next landing from an already saved turn plan. */
export function applyPlannedThrow(match: Match, item: PlannedThrow): Match {
  const expected = match.partnerPlan?.items.find(p => p.throwId === item.throwId);
  if (!expected || JSON.stringify(expected) !== JSON.stringify(item)) throw Error('Unknown planned dart');
  if (item.throwId !== match.throws.length + 1 || item.beforeSeed !== match.seed || summary(match).done || summary(match).actor !== 'partner') throw Error('Stale partner plan');
  return {
    ...match,
    seed: item.seed,
    throws: [...match.throws, item.dart]
  };
}
/** Resolve one immutable throw; persisting the returned ledger commits its randomness. */
export function throwDart(match: Match, target: Point, spread: number): Match {
  const s = summary(match);
  if (s.done) throw Error('Match is complete');
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || Math.abs(target.x) > 1.35 || Math.abs(target.y) > 1.35 || !Number.isFinite(spread) || spread < 0 || spread > 0.5) throw Error('Invalid aim');
  const landing = scatter(match.seed, target, spread);
  const dart = {
    actor: s.actor,
    ...(match.version === 2 ? {
      turn: s.turn
    } : {}),
    x: landing.x,
    y: landing.y
  };
  const {
    partnerPlan,
    ...rest
  } = match;
  return {
    ...rest,
    seed: landing.seed,
    throws: [...match.throws, dart]
  };
}
/** Refuse malformed saves and reconstruct only known fields; keys never belong in a match. */
export function validateMatch(input: unknown): Match | null {
  const value = input as Match;
  try {
    if (!value || ![1, 2].includes(value.version) || typeof value.id !== 'string' || value.id.length > 100 || !Object.hasOwn(LEVELS, value.level) || value.target !== (value.version === 1 ? LEVELS[value.level] : value.mode) || value.version === 2 && !MODES.includes(value.mode!)) return null;
    const base = newMatch(value);
    if (!['safe', 'triples'].includes(value.strategy) || !Array.isArray(value.throws) || value.throws.length > (value.version === 1 ? 30 : 15)) return null;
    let replay = base;
    const throws = value.throws.map((t, i) => {
      const state = summary(replay);
      if (!t || (value.version === 1 ? t.actor !== (i % 6 < 3 ? 'you' : 'partner') : state.done || t.actor !== state.actor || t.turn !== state.turn) || !Number.isFinite(t.x) || !Number.isFinite(t.y) || Math.abs(t.x) > 1.85 || Math.abs(t.y) > 1.85) throw Error('Bad throw');
      const dart = {
        actor: t.actor,
        ...(value.version === 2 ? {
          turn: t.turn
        } : {}),
        x: t.x,
        y: t.y
      };
      replay = {
        ...replay,
        throws: [...replay.throws, dart]
      };
      return dart;
    });
    const dialogue: Record<string, string> = {};
    for (const [key, line] of Object.entries(value.dialogue || {})) {
      if (!/^(opening|turn[1-9]|round[1-5]|result)$/.test(key) || typeof line !== 'string' || line.length > 400) throw Error('Bad dialogue');
      dialogue[key] = line;
    }
    if (!Array.isArray(value.requested) || value.requested.length > 16 || value.requested.some(k => !/^(opening|turn[1-9]|round[1-5]|partner(?:[1-9]|10)|result)$/.test(k)) || new Set(value.requested).size !== value.requested.length) return null;
    const partnerTraits = value.partnerTraits ?? base.partnerTraits;
    if (partnerTraits.version !== 1 || (['accuracy', 'consistency', 'composure'] as const).some(k => !Number.isInteger(partnerTraits[k]) || partnerTraits[k] < 0 || partnerTraits[k] > 100)) return null;
    const reactions: Record<string, SpokenLine> = {};
    for (const [key, reaction] of Object.entries(value.reactions || {})) {
      if (!/^[1-9][0-9]?$/.test(key) || Number(key) > (value.version === 1 ? 30 : 15) || !reaction || typeof reaction.dialogue !== 'string' || reaction.dialogue.length > 200 || !EXPRESSIONS.includes(reaction.expression)) return null;
      reactions[key] = {
        dialogue: reaction.dialogue,
        expression: reaction.expression
      };
    }
    const turnScripts: Record<string, TurnScript> = {};
    for (const [key, script] of Object.entries(value.turnScripts || {})) {
      if (!/^(0|[1-9][0-9]?)$/.test(key) || Number(key) > 29 || !script || typeof script.outroShown !== 'boolean') return null;
      for (const phase of ['intro', 'outro'] as const) {
        const line = script[phase];
        if (!line || typeof line.dialogue !== 'string' || line.dialogue.length > 200 || !EXPRESSIONS.includes(line.expression)) return null;
      }
      turnScripts[key] = {
        intro: {
          dialogue: script.intro.dialogue,
          expression: script.intro.expression
        },
        outro: {
          dialogue: script.outro.dialogue,
          expression: script.outro.expression
        },
        outroShown: script.outroShown
      };
    }
    let partnerPlan: PartnerPlan | null = null;
    if (value.partnerPlan != null) {
      const plan = value.partnerPlan;
      if (!Number.isInteger(plan.start) || plan.start < 0 || plan.start > throws.length || !Number.isInteger(plan.seed) || plan.seed < 0 || plan.seed > 0xffffffff || !['safe', 'triples'].includes(plan.strategy)) return null;
      const start = {
        ...base,
        partnerTraits,
        strategy: plan.strategy,
        seed: plan.seed,
        throws: throws.slice(0, plan.start)
      };
      const items = planPartnerTurn(start);
      if (!items.length || JSON.stringify(items) !== JSON.stringify(plan.items)) return null;
      const played = throws.length - plan.start;
      if (played > items.length || played < items.length && value.strategy !== plan.strategy) return null;
      for (let i = 0; i < played; i++) if (JSON.stringify(throws[plan.start + i]) !== JSON.stringify(items[i].dart)) return null;
      if (value.seed !== (played ? items[played - 1].seed : plan.seed)) return null;
      partnerPlan = {
        start: plan.start,
        seed: plan.seed,
        strategy: plan.strategy,
        items
      };
    }
    const acknowledged = value.acknowledged ?? 0;
    if (!Number.isInteger(acknowledged) || acknowledged < 0 || acknowledged > throws.length || (value.version === 1 ? acknowledged % 3 !== 0 : acknowledged !== 0 && !summary(replay).visits!.some(v => v.closed && v.end === acknowledged))) return null;
    return {
      ...base,
      strategy: value.strategy,
      throws,
      partnerTraits: {
        version: 1,
        accuracy: partnerTraits.accuracy,
        consistency: partnerTraits.consistency,
        composure: partnerTraits.composure
      },
      reactions,
      turnScripts,
      ...(partnerPlan ? {
        partnerPlan
      } : {}),
      dialogue,
      acknowledged,
      requested: [...value.requested]
    };
  } catch {
    return null;
  }
}

/** Identify the latest completed turn, retaining its comment while the next turn is played. */
export function dialogueEvent(match: Match): string {
  if (match.version === 2) {
    const s = summary(match);
    return s.done ? 'result' : s.completedTurns ? `turn${s.completedTurns}` : 'opening';
  }
  const count = match.throws.length;
  return count === 30 ? 'result' : count < 3 ? 'opening' : `turn${Math.floor(count / 3)}`;
}
/** Each completed visit pauses for a score recap until explicitly continued. */
export function turnBreak(match: Match): boolean {
  if (match.version === 2) {
    const s = summary(match),
      visit = s.visits!.at(-1);
    return !s.done && !!visit?.closed && (match.acknowledged ?? 0) < visit.end;
  }
  const count = match.throws.length;
  return count > 0 && count < 30 && count % 3 === 0 && (match.acknowledged ?? 0) < count;
}
/** Return the latest completed visit, including shortened bust and checkout visits. */
export function lastTurn(match: Match): TurnRecap | null {
  if (match.version === 2) {
    const visit = summary(match).visits!.filter(v => v.closed).at(-1);
    return visit ? {
      actor: visit.actor,
      points: visit.points,
      rawPoints: visit.rawPoints,
      bust: visit.bust,
      start: visit.start,
      balance: visit.balance,
      hits: visit.darts.map(t => scoreHit(t.x, t.y))
    } : null;
  }
  const end = Math.floor(match.throws.length / 3) * 3;
  if (!end) return null;
  const darts = match.throws.slice(end - 3, end);
  return {
    actor: darts[0].actor,
    points: darts.reduce((sum, t) => sum + scoreHit(t.x, t.y).points, 0),
    hits: darts.map(t => scoreHit(t.x, t.y))
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
