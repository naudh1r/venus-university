import type { CustomCgSlot, Position, StockPosition } from './types'

/**
 * The eight stock CG positions, in a stable order: the stock CG grid's, the job counts' and the
 * scene schema's. Disjoint from `EMOTIONS`.
 */
export const STOCK_POSITIONS: readonly StockPosition[] = [
  'nude_foreplay',
  'nude_foreplay_after',
  'sex',
  'sex_after',
  'handjob',
  'handjob_after',
  'fellatio',
  'fellatio_after'
] as const

/** The four slots a player-authored CG pair can occupy, in slot order. */
export const CUSTOM_CG_SLOTS: readonly CustomCgSlot[] = [
  'customcg1',
  'customcg2',
  'customcg3',
  'customcg4'
] as const

/** The id of the aftermath image that goes with one custom slot's main CG. */
export function afterOf(slot: CustomCgSlot): `${CustomCgSlot}_after` {
  return `${slot}_after`
}

/**
 * Every CG id, the custom pairs appended after the stock eight: what every gate, file and stage
 * path takes. Disjoint from `EMOTIONS`.
 */
export const POSITIONS: readonly Position[] = [
  ...STOCK_POSITIONS,
  ...CUSTOM_CG_SLOTS.flatMap((slot) => [slot, afterOf(slot)])
] as const

/** Type guard narrowing an arbitrary string to {@link Position}: any CG id, stock or custom. */
export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value)
}

/** Type guard narrowing an arbitrary string to {@link StockPosition}. */
export function isStockPosition(value: string): value is StockPosition {
  return (STOCK_POSITIONS as readonly string[]).includes(value)
}

/** Type guard narrowing an arbitrary string to {@link CustomCgSlot}. */
export function isCustomCgSlot(value: string): value is CustomCgSlot {
  return (CUSTOM_CG_SLOTS as readonly string[]).includes(value)
}

/** The slot a custom CG's main or its `_after` belongs to, or `null` for anything else. */
export function customCgSlotOf(value: string): CustomCgSlot | null {
  return CUSTOM_CG_SLOTS.find((slot) => value === slot || value === afterOf(slot)) ?? null
}

/**
 * Whether a CG is the aftermath of another. A stock act and its climax, or a custom main and its
 * after, are told apart by the `_after` suffix alone.
 */
export function isAfterPosition(position: Position): boolean {
  return position.endsWith('_after')
}

/**
 * The stock CGs in the gallery's order: the four acts, then their four `_after`s in the same
 * order, so each `_after` sits under its own act in a four-wide grid.
 */
export const STOCK_CG_DISPLAY_ORDER: readonly StockPosition[] = [
  ...STOCK_POSITIONS.filter((position) => !isAfterPosition(position)),
  ...STOCK_POSITIONS.filter((position) => isAfterPosition(position))
] as const

/** Prefixes every CG's positive prompt, after the quality tags. */
export const CG_BASE_PROMPT = 'sweat, breath, blush, looking_at_viewer'

/** Booru tags describing each stock position; the middle of the CG positive prompt. */
export const POSITION_TAGS: Record<StockPosition, string> = {
  nude_foreplay: 'nude, solo, nipples, pussy, on_back',
  nude_foreplay_after: 'nude, solo, nipples, pussy, on_back, after_sex',
  sex: 'nude, solo_focus, nipples, penis, pussy, on_back, vaginal',
  sex_after: 'nude, solo_focus, nipples, pussy, on_back, vaginal, after_sex, cum_on_body',
  handjob: 'nude, pov, handjob, penis',
  handjob_after: 'nude, pov, handjob, penis, after_sex, facial',
  fellatio: 'nude, pov, fellatio, penis',
  fellatio_after: 'nude, pov, handjob, after_fellatio, facial, cum_in_mouth, open_mouth, penis'
}
