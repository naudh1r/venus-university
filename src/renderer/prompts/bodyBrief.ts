import { type PhotoGender } from '../../shared/photoGender'
import { photoFeatureOn, photoSwitches } from '../../shared/photoSwitches'
import {
  BODY_POOLS,
  MALE_BODY_POOLS,
  drawBody,
  type CharacterBody
} from '../../shared/characterBody'

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

/** The body switch: Photo Feature's "Body details" option, while the mod is on. */
export function bodyDetailsOn(): boolean {
  return photoFeatureOn() && photoSwitches().body
}

/** The BODY section of the character call, in the shape APPEARANCE asks its picks in. */
export function bodyBriefLines(on: boolean = bodyDetailsOn()): string[] {
  if (!on) return []
  return [
    'BODY',
    `build (pick 0-1, omit for an average build): female — ${BODY_POOLS.build.join(', ')}; male — ${MALE_BODY_POOLS.build.join(', ')}`,
    'Use the pool for this character’s gender. Pick from their personality and habits, not their outfit.',
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
        build: {
          type: 'array',
          items: {
            type: 'string',
            enum: [...new Set([...BODY_POOLS.build, ...MALE_BODY_POOLS.build])]
          }
        }
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
  rand?: () => number,
  gender: PhotoGender = baseAppearance.includes('1boy') || baseAppearance.includes('male_focus')
    ? 'male'
    : 'female'
): CharacterBody | undefined {
  if (!draft) return undefined
  return drawBody(draft.build?.[0], baseAppearance, rand, undefined, gender)
}

/** The host supplies subject tags; the generated appearance shape also identifies a custom male subject. */
export function bodyDraftGender(
  draft: Readonly<Record<string, unknown>>,
  baseAppearance: readonly string[]
): PhotoGender {
  if (baseAppearance.includes('1boy') || baseAppearance.includes('male_focus')) return 'male'
  if (baseAppearance.includes('1girl')) return 'female'
  const appearance = draft.appearance
  return appearance && typeof appearance === 'object' && Object.hasOwn(appearance, 'facialHair')
    ? 'male'
    : 'female'
}
