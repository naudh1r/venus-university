import { useGameStore } from '../stores/gameStore'
import type { Interlude, InterludeCtx } from './hooks'

/** The held boundary's public facts, stable until the hold changes. */
export type InterludeNow = InterludeCtx & { owner: string; clock?: 'late-night' }

/** The narration and continuation owned by one entry into the slot opening. */
export interface HeldInterlude {
  now: InterludeNow
  interlude: Interlude
  pick: (index: number) => void
}

/** The boundary currently held before its slot opens. */
export function interludeNow(): InterludeNow | null {
  return useGameStore.getState().interlude?.now ?? null
}
