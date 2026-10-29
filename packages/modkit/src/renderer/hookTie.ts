import type { ModHooks, PromptSpot, RequestSpots } from './hooks'
import type { HOOKS } from '../shared/hookTable'

/**
 * Ties `ModHooks` to the dispatcher table: every key of `ModHooks` (with `prompts`, `requests` and `promptState`
 * spelt out per spot) must be a renderer row of `HOOKS`, and every renderer row a key. A hook
 * added without a row, or a row without a hook, fails the typecheck here, and the error names it.
 */
export type HookLeaf =
  | Exclude<keyof ModHooks, 'prompts' | 'requests' | 'promptState'>
  | `promptState.${keyof NonNullable<ModHooks['promptState']>}`
  | `prompts.${PromptSpot}`
  | `requests.${keyof RequestSpots}`

type Listed = Extract<(typeof HOOKS)[number], { side: 'renderer' }>['name']

type Never<T> = [T] extends [never] ? true : T

/** A hook of `ModHooks` with no row in the table. */
export const everyHookListed: Never<Exclude<HookLeaf, Listed>> = true

/** A row of the table that is not a hook of `ModHooks`. */
export const everyRowAHook: Never<Exclude<Listed, HookLeaf>> = true
