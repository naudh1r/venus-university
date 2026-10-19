import {
  COLD_BODY_CATCH,
  COLD_BODY_MILD,
  COLD_CONTACT_CHANCE,
  COLD_CONTAGION,
  COLD_INCUBATION_SLOTS,
  COLD_MILD_CHANCE,
  COLD_SEED_CHANCE,
  COLD_SEED_COOLDOWN_DAYS
} from './odds'
import type { ColdCase, ColdPass } from './types'

/**
 * Colds: the stage a case stands at in any slot, worked out from the case alone, and the pass a
 * finished slot rolls — who caught a cold off whom, and whether a new strain reached campus.
 */

/** A cold's stages in the order it runs through them, incubating unseen first. */
export const COLD_STAGES = ['incubating', 'comingDown', 'worst', 'gettingBetter', 'cough'] as const

/** One of {@link COLD_STAGES}. */
export type ColdStage = (typeof COLD_STAGES)[number]

/** How many slots each stage after incubating lasts when no dose cuts it short. */
const STAGE_SLOTS: Readonly<Record<Exclude<ColdStage, 'incubating'>, number>> = {
  comingDown: 2,
  worst: 4,
  gettingBetter: 4,
  cough: 4
}

/**
 * The stage `cold` stands at in global slot `slot`, or null before it was caught and once it is
 * over. A dose ends the stage its slot falls in, so the next one starts the slot after; a dose
 * while it incubates does nothing. Only doses before `slot` can move it.
 */
export function coldStageAt(cold: ColdCase | undefined, slot: number): ColdStage | null {
  if (!cold || slot <= cold.since) return null
  const doses = cold.doseSlots ?? []
  let start = cold.since + 1
  for (const stage of COLD_STAGES) {
    if (stage === 'worst' && cold.mild) continue
    let end = start + (stage === 'incubating' ? cold.incubation : STAGE_SLOTS[stage])
    if (stage !== 'incubating') {
      const dose = doses.find((at) => at >= start && at < end)
      if (dose !== undefined) end = dose + 1
    }
    if (slot < end) return stage
    start = end
  }
  return null
}

/** What the landing says of the reader's cold at each stage that shows. */
export const COLD_STAGE_LABELS: Readonly<Record<Exclude<ColdStage, 'incubating'>, string>> = {
  comingDown: 'Sick',
  worst: 'Sick',
  gettingBetter: 'Recovering',
  cough: 'Recovering'
}

/** Whether a stage shows: anything past incubating, the lingering cough included. */
export function isSymptomatic(stage: ColdStage | null): boolean {
  return stage !== null && stage !== 'incubating'
}

/** Whether a stage keeps the reader from gaining stats and from work: the cough does not. */
export function isSickWindow(stage: ColdStage | null): boolean {
  return stage === 'comingDown' || stage === 'worst' || stage === 'gettingBetter'
}

/** Whether `cold` is at its worst in `slot`: its holder is in bed, off class, work and haunts. */
export function worstInSlot(cold: ColdCase | undefined, slot: number): boolean {
  return coldStageAt(cold, slot) === 'worst'
}

/** Whether `cold` keeps the reader off work and stats in `slot`. */
export function sickInSlot(cold: ColdCase | undefined, slot: number): boolean {
  return isSickWindow(coldStageAt(cold, slot))
}

/** What the holder's stage in `slot` multiplies every contact's odds by; 0 passes nothing on. */
export function contagionAt(cold: ColdCase | undefined, slot: number): number {
  const stage = coldStageAt(cold, slot)
  if (stage === null || !cold) return 0
  if (stage === 'incubating') {
    return slot === cold.since + cold.incubation ? COLD_CONTAGION.lastIncubating : 0
  }
  return stage === 'cough' ? 0 : COLD_CONTAGION[stage]
}

/** `cold` with a dose taken in `slot`; the same case when one is already recorded there. */
export function withDose(cold: ColdCase, slot: number): ColdCase {
  const doses = cold.doseSlots ?? []
  if (doses.includes(slot)) return cold
  return { ...cold, doseSlots: [...doses, slot].sort((a, b) => a - b) }
}

/** Whether a dose may be taken in `slot`: the cold shows, and none has been taken this slot. */
export function canDose(cold: ColdCase | undefined, slot: number): boolean {
  return isSymptomatic(coldStageAt(cold, slot)) && !(cold?.doseSlots ?? []).includes(slot)
}

/** What somebody holds of colds: the last one caught, and every strain caught this semester. */
export interface ColdHolder {
  cold?: ColdCase
  coldsHad?: readonly number[]
}

/** The holding after catching `cold`: the case replaced, its strain added to those had. */
export function withColdCaught<T extends ColdHolder>(holder: T, cold: ColdCase): T {
  const had = holder.coldsHad ?? []
  const coldsHad = had.includes(cold.strain) ? [...had] : [...had, cold.strain].sort((a, b) => a - b)
  return { ...holder, cold, coldsHad }
}

/**
 * `charInfo` with the dose each of `gifts` gave filed at `slot`, as the boundary files them; the
 * same record when none did.
 */
export function withGiftDoses<T extends ColdHolder>(
  charInfo: Readonly<Record<string, T>>,
  gifts: readonly { charId: string; dose?: true }[],
  slot: number
): Readonly<Record<string, T>> {
  let next = charInfo
  for (const gift of gifts) {
    const holder = next[gift.charId]
    if (!gift.dose || !holder?.cold) continue
    next = { ...next, [gift.charId]: { ...holder, cold: withDose(holder.cold, slot) } }
  }
  return next
}

/** The id the reader goes by in a pass's contacts, which no charId can be. */
export const COLD_READER = 'reader'

/** What brought two people together in the finished slot, as the odds name it. */
export type ColdContactKind = keyof typeof COLD_CONTACT_CHANCE

/** One set of people who were together: every member with every other. */
export interface ColdContact {
  kind: ColdContactKind
  members: readonly string[]
}

/** Everything {@link coldPassOf} folds over. Pure in, pure out. */
export interface ColdPassInput {
  /** The finished slot: what every case it passes on is dated from. */
  slot: number
  /** Whether a new strain may reach campus at this ending. */
  seedable: boolean
  /** The roster girls on campus: everybody but the reader who can catch a cold or pass one on. */
  present: readonly string[]
  /** Every roster girl's holding, those away included, which the last strain is read off. */
  girls: Readonly<Record<string, ColdHolder | undefined>>
  reader: ColdHolder
  /** The reader's Body tier, 0 to 5. */
  bodyTier: number
  /** Who was together in the slot; {@link COLD_READER} stands for the reader. */
  contacts: readonly ColdContact[]
}

/** The newest strain anybody has caught, which is the last to reach campus, or null. */
export function lastStrainOf(
  girls: Readonly<Record<string, ColdHolder | undefined>>,
  reader: ColdHolder
): number | null {
  let last: number | null = null
  for (const holder of [reader, ...Object.values(girls)]) {
    for (const strain of holder?.coldsHad ?? []) if (last === null || strain > last) last = strain
  }
  return last
}

/** Each pair's combined odds from every contact they shared, keyed both ways round. */
function pairOdds(contacts: readonly ColdContact[]): Map<string, Map<string, number>> {
  const misses = new Map<string, Map<string, number>>()
  const miss = (a: string, b: string, chance: number): void => {
    const row = misses.get(a) ?? new Map<string, number>()
    row.set(b, (row.get(b) ?? 1) * (1 - chance))
    misses.set(a, row)
  }
  for (const { kind, members } of contacts) {
    const unique = [...new Set(members)]
    for (const a of unique) {
      for (const b of unique) if (a !== b) miss(a, b, COLD_CONTACT_CHANCE[kind])
    }
  }
  const odds = new Map<string, Map<string, number>>()
  for (const [a, row] of misses) {
    odds.set(a, new Map([...row].map(([b, missed]) => [b, 1 - missed])))
  }
  return odds
}

/**
 * Who caught a cold in the finished slot. Everybody who can catch one is tried against every
 * contagious person they were with, the reader first and then in roster order, and catches the
 * first that lands; then, past the cooldown, a new strain may reach campus through one of those
 * still well. Nobody catches a strain they have had, or a second cold while one still runs.
 */
export function coldPassOf(input: ColdPassInput, rand: () => number = Math.random): ColdPass {
  const { slot } = input
  const people = [COLD_READER, ...input.present]
  const holderOf = (id: string): ColdHolder =>
    (id === COLD_READER ? input.reader : input.girls[id]) ?? {}
  const catchFactor = (id: string): number =>
    id === COLD_READER ? (COLD_BODY_CATCH[input.bodyTier] ?? 1) : 1
  const mildChance = (id: string): number =>
    COLD_MILD_CHANCE + (id === COLD_READER ? (COLD_BODY_MILD[input.bodyTier] ?? 0) : 0)

  const caught = new Map<string, ColdCase>()
  const catches = (id: string, strain: number, fromReader: boolean): void => {
    const incubation =
      COLD_INCUBATION_SLOTS[Math.min(COLD_INCUBATION_SLOTS.length - 1, Math.floor(rand() * COLD_INCUBATION_SLOTS.length))]
    caught.set(id, {
      strain,
      since: slot,
      incubation,
      ...(rand() < mildChance(id) ? { mild: true as const } : {}),
      ...(fromReader ? { fromReader: true as const } : {})
    })
  }
  // Free of a cold this slot: never caught one, or the last is over.
  const free = (id: string): boolean => coldStageAt(holderOf(id).cold, slot) === null

  const odds = pairOdds(input.contacts)
  const readerSick = sickInSlot(input.reader.cold, slot)
  for (const target of people) {
    if (!free(target)) continue
    const had = holderOf(target).coldsHad ?? []
    for (const source of people) {
      const pair = odds.get(target)?.get(source)
      if (pair === undefined) continue
      const cold = holderOf(source).cold
      const strength = contagionAt(cold, slot)
      if (!cold || strength === 0 || had.includes(cold.strain)) continue
      if (rand() < Math.min(1, pair * strength * catchFactor(target))) {
        // She knows where it came from only if he was visibly sick with it.
        catches(target, cold.strain, source === COLD_READER && readerSick)
        break
      }
    }
  }

  const last = lastStrainOf(input.girls, input.reader)
  const cooled = last === null || slot - last >= COLD_SEED_COOLDOWN_DAYS * 2
  if (input.seedable && cooled && rand() < COLD_SEED_CHANCE) {
    const pool = people.filter((id) => free(id) && !caught.has(id))
    const total = pool.reduce((sum, id) => sum + catchFactor(id), 0)
    let at = rand() * total
    const first = pool.find((id) => (at -= catchFactor(id)) < 0) ?? pool[pool.length - 1]
    if (first !== undefined) catches(first, slot, false)
  }

  const pass: ColdPass = { caught: {} }
  for (const [id, cold] of caught) {
    if (id === COLD_READER) pass.reader = cold
    else pass.caught[id] = cold
  }
  return pass
}
