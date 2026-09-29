import { BODY_POOLS, drawBody, type CharacterBody } from '@shared/characterBody'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * What the character call is asked about her body, and what is made of the answer.
 *
 * One question, her build, since that is the one her personality decides: an athlete is toned,
 * somebody who never leaves her desk might not be. Her chest is already asked for under
 * APPEARANCE, and the rest is drawn by `drawBody` — a model asked to vary hips and hair across a
 * cast gives every girl the same answer, and a draw does not.
 *
 * All of it only while the body switch is on. Off, the call is asked what the build asks.
 */

/** The body switch, as the settings store holds it. */
export function bodyDetailsOn(): boolean {
  return useSettingsStore.getState().settings?.bodyDetails === true
}

/** The BODY section of the character call, in the shape APPEARANCE asks its picks in. */
export function bodyBriefLines(on: boolean = bodyDetailsOn()): string[] {
  if (!on) return []
  return [
    'BODY',
    `build (pick 0-1, omit for an average build): ${BODY_POOLS.build.join(', ')}`,
    'Pick it from who she is and how she lives, not from her outfit.',
    ''
  ]
}

/** The schema's `body` key, required while it is asked for and absent while it is not. */
export function bodySchemaRequired(on: boolean = bodyDetailsOn()): string[] {
  return on ? ['body'] : []
}

/** The schema's `body` property: her build, 0–1 from the pool, as APPEARANCE's picks are. */
export function bodySchemaFields(on: boolean = bodyDetailsOn()): Record<string, unknown> {
  if (!on) return {}
  return {
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['build'],
      properties: {
        // An array because the pick is 0–1 and the strict subset has no optional key.
        build: { type: 'array', items: { type: 'string', enum: [...BODY_POOLS.build] } }
      }
    }
  }
}

/** What the call answers under `body`. */
export interface DraftBody {
  build?: string[]
}

/**
 * Her body from the call's answer: the build it picked, and the rest drawn to agree with it and
 * with her appearance. Nothing where the call was not asked, so a character written with the
 * switch off carries no body at all.
 */
export function bodyOfDraft(
  draft: DraftBody | undefined,
  baseAppearance: readonly string[],
  rand?: () => number
): CharacterBody | undefined {
  if (!draft) return undefined
  return drawBody(draft.build?.[0], baseAppearance, rand)
}
