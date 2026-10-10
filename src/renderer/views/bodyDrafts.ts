import { gateBody, withBodyTags } from '@shared/characterBody'
import {
  cgDraft as cgDraftOf,
  cgSetDraft as cgSetDraftOf,
  spriteDraft as spriteDraftOf
} from '@shared/imagePrompt'
import { withRegenTags as withRegenTagsOf } from '@shared/regenTags'
import type { PromptEdit } from '@shared/imagePrompt'
import type { Character, OutfitSet, Position } from '@shared/types'
import { bodyDetailsOn } from '../prompts/bodyBrief'

/**
 * The editor's prompt drafts, as the body switch has her.
 *
 * A regenerate sends the draft it opened with, and the render draws that draft as written — so a
 * body the switch has turned off has to be kept out of it here, where it is written, and not only
 * where she is drawn. The editor imports these in place of `imagePrompt`'s, which is its one
 * change for them.
 */
export { expressionDraft, type PromptEdit } from '@shared/imagePrompt'

export function spriteDraft(
  character: Character,
  poseTags: readonly string[],
  set: OutfitSet | null
): ReturnType<typeof spriteDraftOf> {
  return spriteDraftOf(gateBody(character, bodyDetailsOn()), poseTags, set)
}

export function cgSetDraft(character: Character): ReturnType<typeof cgSetDraftOf> {
  return cgSetDraftOf(gateBody(character, bodyDetailsOn()))
}

export function cgDraft(character: Character, position: Position): ReturnType<typeof cgDraftOf> {
  return cgDraftOf(gateBody(character, bodyDetailsOn()), position)
}

/**
 * What a regenerate reopens on: the tags its button last sent, with her body in them as it is
 * now. Without this, a set regenerated before she had a body goes on being drawn without one.
 */
export function withRegenTags(draft: PromptEdit, stored: unknown): PromptEdit {
  return withBodyTags(withRegenTagsOf(draft, stored), draft, bodyDetailsOn())
}
