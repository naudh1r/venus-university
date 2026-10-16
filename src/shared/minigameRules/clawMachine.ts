/**
 * Claw Machine's rules: the pile of plush toys, where a go's two stops put the claw, what it
 * closes on, whether the toy is held to the chute, and how a game of it is told. Pure: the
 * component only draws and sequences what is settled here.
 *
 * The cabinet is measured in its own units: 100 across (`x`, from the left) and 60 deep (`z`,
 * from the glass back). The claw starts over the chute at the front left and runs one way on
 * each axis, once a go.
 */

export const WIDTH = 100
export const DEPTH = 60

/** Where the claw waits and where it lets go: over the chute. */
export const HOME = { x: 9, z: 0 } as const
/** How fast the claw runs along each axis, in units a second. */
export const SPEED = { x: 30, z: 24 } as const
/** The end of each run: held that long, the claw stops by itself. */
export const LIMIT = { x: 95, z: 56 } as const
/** The floor the toys lie on, clear of the chute. */
export const AREA = { left: 24, right: 92, near: 7, far: 53 } as const
/** How long a go may take from the first touch of the stick before the claw drops by itself. */
export const COUNTDOWN_MS = 8000
/** The share of the trip from the pile to the chute that is the lift straight up. */
export const LIFT_SHARE = 0.35

/** How far off a toy's middle the claw still closes on it, as a share of the toy's size. */
const CATCH = 0.8
/** How far beyond that a closing claw still knocks the toy, and how far it is knocked. */
const NUDGE = 4
const PUSH = 3.5
/** How much of a toy's grip a grab right on the edge of it loses. */
const CENTRE_COST = 0.7
/** Two toys closer than this share of their sizes together lie one on the other. */
const PIN_WITHIN = 0.7

/** How easily the claw holds a toy, in a word. */
export type Tier = 'easy' | 'fair' | 'hard'

/** A plush toy in the cabinet. */
export interface Toy {
  /** What it is: one of each, so the id is the kind and the drawing. */
  id: string
  name: string
  /** How big it lies, as a radius in cabinet units. */
  size: number
  /** How easily the claw holds it, from 0 to 1: the chance a dead-centre grab reaches the chute. */
  grip: number
  x: number
  z: number
  /** The toy lying across this one, where it started half-buried. */
  under?: string
}

/** The toys a cabinet is stocked with: small easy ones, middling ones, and two big prizes. */
export const KINDS: readonly Pick<Toy, 'id' | 'name' | 'size' | 'grip'>[] = [
  { id: 'duckling', name: 'duckling', size: 5, grip: 0.93 },
  { id: 'mushroom', name: 'mushroom', size: 5, grip: 0.92 },
  { id: 'strawberry', name: 'strawberry', size: 5, grip: 0.92 },
  { id: 'frog', name: 'frog', size: 5.2, grip: 0.9 },
  { id: 'star', name: 'star cushion', size: 5.5, grip: 0.88 },
  { id: 'penguin', name: 'penguin', size: 6.3, grip: 0.7 },
  { id: 'bunny', name: 'bunny', size: 6.3, grip: 0.68 },
  { id: 'cat', name: 'cat', size: 6.3, grip: 0.66 },
  { id: 'moon', name: 'moon pillow', size: 6.8, grip: 0.6 },
  { id: 'octopus', name: 'octopus', size: 6.8, grip: 0.52 },
  { id: 'bear', name: 'giant bear', size: 8.8, grip: 0.28 },
  { id: 'whale', name: 'big whale', size: 9.2, grip: 0.25 }
]

/** The toy that starts half-buried, and the one lying across it. */
const BURIED = { toy: 'cat', top: 'star' } as const

export function tierOf(toy: Pick<Toy, 'grip'>): Tier {
  return toy.grip >= 0.8 ? 'easy' : toy.grip <= 0.4 ? 'hard' : 'fair'
}

const apart = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z)

const onFloor = (at: { x: number; z: number }): { x: number; z: number } => ({
  x: Math.min(AREA.right, Math.max(AREA.left, at.x)),
  z: Math.min(AREA.far, Math.max(AREA.near, at.z))
})

/**
 * A cabinet freshly stocked: every toy at a spot of its own off `rand`, the big ones set down
 * first, and one toy half-buried under another. The same pile for the same stream.
 */
export function layPile(rand: () => number): Toy[] {
  const pile: Toy[] = []
  const loose = KINDS.filter((kind) => kind.id !== BURIED.toy).sort((a, b) => b.size - a.size)
  for (const kind of loose) {
    let best: { x: number; z: number } = { x: AREA.left, z: AREA.near }
    let room = -Infinity
    for (let tries = 0; tries < 120; tries++) {
      const spot = {
        x: AREA.left + rand() * (AREA.right - AREA.left),
        z: AREA.near + rand() * (AREA.far - AREA.near)
      }
      // The room a spot has: how far it clears its nearest neighbour, their sizes allowed for.
      const clear = Math.min(...pile.map((toy) => apart(toy, spot) - (toy.size + kind.size) * 0.9), 99)
      if (clear > room) {
        room = clear
        best = spot
      }
      if (clear >= 0) break
    }
    pile.push({ ...kind, ...best })
  }
  const top = pile.find((toy) => toy.id === BURIED.top)
  const buried = KINDS.find((kind) => kind.id === BURIED.toy)
  if (top && buried) {
    // Behind the toy on top and to one side of it, whichever side has the floor for it.
    const side = top.x + top.size * 0.6 <= AREA.right ? 1 : -1
    pile.push({ ...buried, ...onFloor({ x: top.x + side * top.size * 0.6, z: top.z + 2 }), under: top.id })
  }
  return pile
}

/** The toy lying across this one and holding it down, if it is still there. */
export function pinnedBy(pile: readonly Toy[], toy: Toy): Toy | undefined {
  if (!toy.under) return undefined
  const top = pile.find((other) => other.id === toy.under)
  return top && apart(top, toy) < (top.size + toy.size) * PIN_WITHIN ? top : undefined
}

/** Where the claw stops. */
export interface Stop {
  x: number
  z: number
}

/** Where holding each way for so long puts the claw: each run ends at its limit. */
export function stopOf(msX: number, msZ: number): Stop {
  return {
    x: Math.min(LIMIT.x, HOME.x + (SPEED.x * Math.max(0, msX)) / 1000),
    z: Math.min(LIMIT.z, HOME.z + (SPEED.z * Math.max(0, msZ)) / 1000)
  }
}

/** How long each way has to be held to stop dead over a toy. */
export function holdFor(toy: { x: number; z: number }): { msX: number; msZ: number } {
  return { msX: ((toy.x - HOME.x) / SPEED.x) * 1000, msZ: ((toy.z - HOME.z) / SPEED.z) * 1000 }
}

/** How far off a toy's middle the claw may be and still close on it. */
export const reachOf = (toy: Pick<Toy, 'size'>): number => toy.size * CATCH

/**
 * The chance a toy grabbed reaches the chute: its grip, less for a grab off its middle. `off` is
 * how far off, from 0 (dead centre) to 1 (the very edge of what the claw closes on).
 */
export function holdChance(toy: Pick<Toy, 'grip'>, off: number): number {
  const wide = Math.min(1, Math.max(0, off))
  return toy.grip * (1 - CENTRE_COST * wide * wide)
}

/**
 * Where the claw is on its way back from a stop with whatever it holds, `along` from 0 (closed
 * on the pile) to 1 (over the chute): straight up first, then across. `up` is how far it has
 * lifted.
 */
export function carryPoint(stop: Stop, along: number): { x: number; z: number; up: number } {
  if (along <= LIFT_SHARE) return { x: stop.x, z: stop.z, up: Math.max(0, along) / LIFT_SHARE }
  const across = Math.min(1, (along - LIFT_SHARE) / (1 - LIFT_SHARE))
  return { x: stop.x + (HOME.x - stop.x) * across, z: stop.z + (HOME.z - stop.z) * across, up: 1 }
}

/**
 * How a go came out.
 *
 * - `catch`: held all the way to the chute, and his.
 * - `slip`: closed on and lifted, and dropped part-way; it lies somewhere new.
 * - `nudge`: a near miss that knocked the toy aside.
 * - `pinned`: closed on a toy held down by the one across it.
 * - `miss`: closed on nothing.
 */
export type GoKind = 'catch' | 'slip' | 'nudge' | 'pinned' | 'miss'

export interface Go {
  stop: Stop
  kind: GoKind
  /** The toy the go is taken to have been after: the one it touched, or the nearest. As it lay. */
  aimed: Toy | null
  /** The toy lying across a pinned one. */
  top: Toy | null
  /**
   * For a grab: the pinned toy the stop was nearer the middle of than of the toy the claw closed
   * on. He went for that one, and the claw took what lay over it. `top` is then what pins it.
   */
  meant: Toy | null
  /** How far off the aimed toy's middle the claw stopped, as a share of what it closes on. */
  off: number
  /** For a grab: the chance it had of holding, and the machine's roll against it. */
  chance: number
  roll: number
  /** For a slip: how far along the trip back the toy fell, from 0 to 1. */
  slipAt: number
  /** Where a toy that slipped or was knocked now lies. */
  landed: { x: number; z: number } | null
  /** The pile after the go. */
  pile: Toy[]
}

/** A spot near `at` for a toy to come to rest, clear of the others where one can be found. */
function settle(others: readonly Toy[], toy: Toy, at: { x: number; z: number }, rand: () => number): { x: number; z: number } {
  let spot = onFloor(at)
  for (let tries = 0; tries < 8; tries++) {
    const here = spot
    if (others.every((other) => apart(other, here) >= (other.size + toy.size) * 0.75)) break
    const turn = rand() * Math.PI * 2
    const out = 3 + tries * 1.5
    spot = onFloor({ x: at.x + Math.cos(turn) * out, z: at.z + Math.sin(turn) * out })
  }
  return spot
}

/**
 * One go: the claw drops at `stop` on `pile`. It closes on the free toy whose middle it is
 * nearest, if it is within that toy's reach, and a stop nearer still to a toy pinned under
 * another is kept as the toy he `meant`; the toy then holds to the chute if the machine's
 * roll comes under its chance, and otherwise slips out along the way, sooner the worse the roll.
 * Just outside a toy's reach it knocks the toy aside. The same go for the same pile, stop and
 * stream.
 */
export function takeGo(pile: readonly Toy[], stop: Stop, rand: () => number): Go {
  const offOf = (toy: Toy): number => apart(toy, stop) / reachOf(toy)
  const nearest = (toys: readonly Toy[]): Toy | undefined =>
    toys.reduce<Toy | undefined>((best, toy) => (!best || offOf(toy) < offOf(best) ? toy : best), undefined)
  const free = pile.filter((toy) => !pinnedBy(pile, toy))
  const base = { stop, top: null, meant: null, chance: 0, roll: 0, slipAt: 0, landed: null }

  const grabbed = nearest(free.filter((toy) => offOf(toy) <= 1))
  if (grabbed) {
    const off = offOf(grabbed)
    const chance = holdChance(grabbed, off)
    const roll = rand()
    const others = pile.filter((toy) => toy.id !== grabbed.id)
    // A stop nearer the middle of a toy held down was a go at that toy, whatever the claw took.
    const meant =
      pile
        .filter((toy) => pinnedBy(pile, toy) && offOf(toy) <= 1 && apart(toy, stop) < apart(grabbed, stop))
        .sort((a, b) => apart(a, stop) - apart(b, stop))[0] ?? null
    const top = meant ? (pinnedBy(pile, meant) ?? null) : null
    if (roll < chance) return { ...base, kind: 'catch', aimed: grabbed, top, meant, off, chance, roll, pile: others }
    // The nearer the roll came to holding, the further the toy rides before it goes.
    const slipAt = 0.9 - 0.75 * ((roll - chance) / (1 - chance))
    const landed = settle(others, grabbed, carryPoint(stop, slipAt), rand)
    return {
      ...base,
      kind: 'slip',
      aimed: grabbed,
      top,
      meant,
      off,
      chance,
      roll,
      slipAt,
      landed,
      pile: pile.map((toy) => (toy.id === grabbed.id ? { ...toy, ...landed } : toy))
    }
  }

  const held = nearest(pile.filter((toy) => pinnedBy(pile, toy) && offOf(toy) <= 1))
  if (held) {
    return { ...base, kind: 'pinned', aimed: held, top: pinnedBy(pile, held) ?? null, off: offOf(held), pile: [...pile] }
  }

  const knocked = nearest(free.filter((toy) => apart(toy, stop) <= reachOf(toy) + NUDGE))
  if (knocked) {
    const gap = Math.max(0.01, apart(knocked, stop))
    const landed = onFloor({
      x: knocked.x + ((knocked.x - stop.x) / gap) * PUSH,
      z: knocked.z + ((knocked.z - stop.z) / gap) * PUSH
    })
    return {
      ...base,
      kind: 'nudge',
      aimed: knocked,
      off: offOf(knocked),
      landed,
      pile: pile.map((toy) => (toy.id === knocked.id ? { ...toy, ...landed } : toy))
    }
  }

  const aimed = nearest(pile) ?? null
  return { ...base, kind: 'miss', aimed, off: aimed ? offOf(aimed) : 0, pile: [...pile] }
}

/** What the goes so far have won, in the order they came out of the chute. */
export function wonIn(goes: readonly Go[]): Toy[] {
  return goes.flatMap((go) => (go.kind === 'catch' && go.aimed ? [go.aimed] : []))
}

/**
 * How the game came out for the reader. With a girl watching it is her toy that counts: `won`
 * with it, `draw` with some other toy, `lost` with nothing. Alone there is nobody to please.
 */
export function outcomeOf(goes: readonly Go[], wanted: string | null): 'won' | 'draw' | 'lost' | 'played' {
  if (wanted === null) return 'played'
  const won = wonIn(goes)
  return won.some((toy) => toy.id === wanted) ? 'won' : won.length > 0 ? 'draw' : 'lost'
}

/** The fewest goes in which a toy that starts pinned is still worth wanting: two to get at it, one to spare. */
const PINNED_FROM = 3

/**
 * The toys she may say she wants in a game of `tries` goes: all of them, less any held down by
 * another where the goes are too few to free it and still have a fair go at it.
 */
export function choicesOf(pile: readonly Toy[], tries: number): Toy[] {
  return tries >= PINNED_FROM ? [...pile] : pile.filter((toy) => !pinnedBy(pile, toy))
}

/** The toy she is taken to want where she could not be asked: any she may choose, off `rand`. */
export function pickToy(pile: readonly Toy[], rand: () => number, tries = PINNED_FROM): Toy {
  const from = choicesOf(pile, tries)
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))]
}

/**
 * What she is asked before the first go: the toys she may name, and the round's brief, which
 * says of any toy among them that is held down what lies on top of it.
 */
export function pickAsk(her: string, pile: readonly Toy[], tries: number): { names: string[]; brief: string } {
  const choices = choicesOf(pile, tries)
  const names = choices.map((toy) => toy.name)
  const held = choices.flatMap((toy) => {
    const top = pinnedBy(pile, toy)
    return top
      ? [` The ${toy.name} lies pinned under the ${top.name}: it cannot be taken until the ${top.name} has been won first, so it takes at least two catches.`]
      : []
  })
  return {
    names,
    brief: `${her} is watching the reader play a claw machine and does not play herself. He has paid for ${tries} ${tries === 1 ? 'go' : 'goes'}. Before his first go she says which one of the plush toys in the cabinet she has her eye on. "toy" is that toy, one of: ${names.join(', ')}. The small ones are easy for the claw to hold; the giant bear and the big whale are very hard.${held.join('')} "line" is what she says out loud to him about it, in one short sentence that names the toy.`
  }
}

// How a game is told: the narration, her cues, the summary and the account.

const the = (toy: Toy): string => `the ${toy.name}`

/** A list in words: "the frog, the bunny and the cat". */
function all(toys: readonly Toy[]): string {
  const names = toys.map(the)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const TIER_TOLD: Record<Tier, string> = {
  easy: 'one of the small ones the claw holds easily',
  fair: 'a middling one the claw may or may not hold',
  hard: 'one of the two big ones the claw can hardly hold'
}

/**
 * Which way a stop was off the toy it was after: "short and too deep", or "dead on". The toy he
 * meant, where the claw took another lying over it.
 */
export function strayOf(go: Go): string {
  const after = go.meant ?? go.aimed
  if (!after) return 'over bare floor'
  const slack = reachOf(after) * 0.3
  const dx = go.stop.x - after.x
  const dz = go.stop.z - after.z
  const ways = [
    ...(Math.abs(dx) > slack ? [dx < 0 ? 'short' : 'too far across'] : []),
    ...(Math.abs(dz) > slack ? [dz < 0 ? 'not deep enough' : 'too deep'] : [])
  ]
  return ways.length > 0 ? ways.join(' and ') : 'dead on'
}

const perHundred = (chance: number): string => `about ${Math.round(chance * 100)} times in 100`

/** What a grab owed to the reader and what to the machine, for a catch or a slip. */
export function luckOf(go: Go): string {
  if (go.kind === 'catch') {
    if (go.chance >= 0.65) return 'skill: a well-centred grab on a toy the claw holds'
    if (go.chance < 0.4) return `the machine being kind: a grab like that holds ${perHundred(go.chance)}`
    return `a decent grab and some luck: it holds ${perHundred(go.chance)}`
  }
  if (go.kind !== 'slip') return ''
  // His centring is to blame only where it cost the grab more than the toy's own grip did.
  const grip = go.aimed?.grip ?? go.chance
  const wide = go.off > 0.6
  if (wide && grip - go.chance > 1 - grip) {
    return go.meant
      ? 'a grab well off its middle, because he was aiming at the toy under it'
      : 'a poorly centred grab, his own doing'
  }
  if (go.chance >= 0.65) return 'plain bad luck: a good grab the claw let go of'
  if (wide) {
    return `the machine more than his aim: dead centre the claw holds that toy ${perHundred(grip)}, and that grab holds ${perHundred(go.chance)}`
  }
  return `a toy the claw hardly holds: even a grab that good holds ${perHundred(go.chance)}`
}

/** A go, as the scene's narration tells it. */
export function goTold(go: Go, wanted: string | null): string {
  const toy = go.aimed
  if (!toy) return 'The claw comes down on bare floor and comes up empty.'
  const stray = strayOf(go)
  // He went for a toy held down, and the claw took what lies over it.
  const over = go.meant
    ? `The claw comes down over ${the(go.meant)}, but ${the(toy)} ${go.meant.under === toy.id ? 'lies across it' : 'is in the way'}, and it is ${the(toy)} the claw closes on`
    : null
  switch (go.kind) {
    case 'catch':
      if (over) return `${over} and holds all the way to the chute. ${toy.id === wanted ? `You have ${the(toy)}: the one she wanted.` : `You have ${the(toy)}.`}`
      return `The claw drops ${stray === 'dead on' ? 'square onto' : 'onto'} ${the(toy)}, closes, and holds it all the way to the chute. ${toy.id === wanted ? `You have ${the(toy)}: the one she wanted.` : `You have ${the(toy)}.`}`
    case 'slip':
      return go.slipAt <= LIFT_SHARE
        ? `${over ?? `The claw closes on ${the(toy)}${stray === 'dead on' ? '' : `, ${stray}`}`}, and lifts it, but it slides out before it is clear of the pile.`
        : `${over ?? `The claw closes on ${the(toy)}${stray === 'dead on' ? '' : `, ${stray}`}`}, and carries it part of the way back before it slips free and drops into the pile again.`
    case 'nudge':
      return `The claw comes down just wide of ${the(toy)}, ${stray}, closes on air and knocks it aside.`
    case 'pinned':
      return `The claw closes on ${the(toy)}, but ${go.top ? the(go.top) : 'the toy'} lying across it holds it down, and the claw comes up empty.`
    default:
      return `The claw comes down wide of ${the(toy)}, ${stray}, and comes up empty.`
  }
}

/**
 * How a go came out, in a few words: what the machine's front shows until the next go, the
 * dialogue box keeping to what people say. `wanted` is the id of the toy she wants.
 */
export function goShown(go: Go, wanted: string | null): string {
  const toy = go.aimed
  if (!toy) return 'Missed: bare floor'
  switch (go.kind) {
    case 'catch':
      return toy.id === wanted ? `Won the ${toy.name} she wanted!` : `Won the ${toy.name}!`
    case 'slip':
      return `The ${toy.name} slipped free`
    case 'nudge':
      return `Knocked the ${toy.name} aside`
    case 'pinned':
      return `The ${toy.name} is held down`
    default:
      return `Missed the ${toy.name}`
  }
}

/**
 * What a girl watching is told of a go, and whether it is a moment worth a word from her: a
 * catch, a slip part-way or a near miss. `left` is how many goes he still has.
 */
export function cueOf(
  go: Go,
  her: string,
  wanted: Toy | null,
  goes: readonly Go[],
  left: number
): { notable: boolean; text: string } {
  const toy = go.aimed
  const hers = toy !== null && toy.id === wanted?.id
  const which = toy ? `${the(toy)}${hers ? `, the toy ${her} said she wanted` : ''}` : 'nothing'
  const what =
    go.kind === 'catch'
      ? `The reader's claw caught ${which} and carried it to the chute: he has won it. It was ${luckOf(go)}.`
      : go.kind === 'slip'
        ? `The reader's claw picked up ${which}, and it slipped out ${go.slipAt <= LIFT_SHARE ? 'on the lift' : 'part-way back to the chute'}: ${luckOf(go)}.`
        : go.kind === 'nudge'
          ? `A near miss: the reader's claw came down just wide of ${which}, ${strayOf(go)}, and only knocked it aside.`
          : go.kind === 'pinned'
            ? `The reader's claw closed on ${which}, which is pinned under ${go.top ? the(go.top) : 'another toy'} and did not come.`
            : `The reader's claw came down wide of ${which}, ${strayOf(go)}, and came up empty.`
  const meant = go.meant
    ? ` He was going for ${the(go.meant)}${go.meant.id === wanted?.id ? `, the toy ${her} said she wanted` : ''}, which is pinned under ${go.top ? the(go.top) : 'another toy'}: his stop was right for it, and the claw took ${toy ? the(toy) : 'the toy'} lying over it instead.`
    : ''
  const won = wonIn(goes)
  const last =
    left === 1 ? ` He has one go left${won.length === 0 ? ' and nothing won yet' : ''}.` : ''
  return { notable: go.kind === 'catch' || go.kind === 'slip' || go.kind === 'nudge', text: `${what}${meant}${last}` }
}

/** How the game stands, for anything said at the glass. */
export function standingTold(her: string | null, wanted: Toy | null, goes: readonly Go[], tries: number): string {
  const won = wonIn(goes)
  const left = tries - goes.length
  return [
    `The reader is playing a claw machine full of plush toys, ${tries} ${tries === 1 ? 'go' : 'goes'} paid for.`,
    ...(her ? [`${her} is beside him at the glass, watching: she does not play.`] : []),
    ...(her && wanted ? [`She has her eye on ${the(wanted)}, ${TIER_TOLD[tierOf(wanted)]}.`] : []),
    goes.length === 0
      ? 'He has not had a go yet.'
      : `He has had ${goes.length} of them and won ${won.length > 0 ? all(won) : 'nothing so far'}; ${left === 0 ? 'that was the last' : `${left} left`}.`
  ].join(' ')
}

/** The result as the scene narrates it: what he holds now, and that it is his to give. */
export function summaryOf(her: string | null, wanted: Toy | null, goes: readonly Go[], tries: number): string {
  const won = wonIn(goes)
  const paid = `${tries} ${tries === 1 ? 'go' : 'goes'}`
  const holds = won.length === 1 ? 'It is in your hands now' : 'They are in your hands now'
  if (!her || !wanted) {
    return won.length > 0
      ? `You play the claw machine, ${paid}, and win ${all(won)}. ${holds}, yours to keep or to give away.`
      : `You play the claw machine, ${paid}, and come away with nothing.`
  }
  if (won.length === 0) {
    return `You play the claw machine with ${her} watching, ${paid}, and come away with nothing: ${the(wanted)} she had her eye on stays behind the glass.`
  }
  if (won.some((toy) => toy.id === wanted.id)) {
    const more = won.filter((toy) => toy.id !== wanted.id)
    return `You play the claw machine with ${her} watching, ${paid}, and win ${the(wanted)} she had her eye on${more.length > 0 ? `, and ${all(more)} besides` : ''}. ${holds}, yours to give.`
  }
  return `You play the claw machine with ${her} watching, ${paid}. ${her} had her eye on ${the(wanted)}; you win ${all(won)} instead. ${holds}, yours to keep or to give.`
}

/**
 * The game for the scene's writer: the toy she wanted, each go and what it owed to skill or to
 * the machine, and what the reader now holds. Said again after every go, so `tries` may be more
 * than the goes had.
 */
export function accountOf(her: string | null, wanted: Toy | null, goes: readonly Go[], tries: number): string[] {
  const won = wonIn(goes)
  const over = goes.length >= tries
  const lines = [
    `A claw machine full of plush toys, ${tries} ${tries === 1 ? 'go' : 'goes'} paid for, worked by the reader${her ? `; ${her} watched at the glass and did not play` : ' alone'}.`,
    ...(her && wanted ? [`${her} said she had her eye on ${the(wanted)}: ${TIER_TOLD[tierOf(wanted)]}.`] : []),
    ...goes.map((go, index) => {
      const toy = go.aimed
      if (!toy) return `Go ${index + 1}: the claw came down on bare floor.`
      const where = go.meant
        ? `he went for ${the(go.meant)}, which is under ${go.top ? the(go.top) : 'another toy'}, and stopped ${strayOf(go)}; the claw took ${the(toy)} instead`
        : `he went for ${the(toy)} and stopped ${strayOf(go)}`
      const result =
        go.kind === 'catch'
          ? `grabbed and held to the chute: ${luckOf(go)}`
          : go.kind === 'slip'
            ? `grabbed, and ${go.meant ? the(toy) : 'it'} slipped out ${go.slipAt <= LIFT_SHARE ? 'on the lift' : 'part-way back'}: ${luckOf(go)}`
            : go.kind === 'nudge'
              ? 'a near miss that knocked it aside'
              : go.kind === 'pinned'
                ? `it is pinned under ${go.top ? the(go.top) : 'another toy'} and did not come`
                : 'missed outright'
      return `Go ${index + 1}: ${where}; ${result}.`
    })
  ]
  if (!over) {
    return [...lines, `So far he has won ${won.length > 0 ? all(won) : 'nothing'}, with ${tries - goes.length} to go.`]
  }
  if (won.length === 0) {
    return [...lines, `He won nothing${her && wanted ? `: ${the(wanted)} is still in the machine` : ''}.`]
  }
  const hers = wanted !== null && won.some((toy) => toy.id === wanted.id)
  return [
    ...lines,
    `He won ${all(won)}${her && wanted ? (hers ? `: the toy ${her} wanted` : `, not ${the(wanted)} ${her} wanted`) : ''}.`,
    `The reader is holding ${won.length === 1 ? 'that plush toy' : 'those plush toys'} now. Nothing has been handed to anyone: whether he gives ${won.length === 1 ? 'it' : 'any'} away${her ? `, to ${her} or otherwise,` : ''} and how that goes is for the scene.`
  ]
}
