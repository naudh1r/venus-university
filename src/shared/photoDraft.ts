import type { registerImagePromptDraft } from '@vx/modkit/shared'
import { bodyAppearance, bodyNegative, gateBody, withBodyTags } from './characterBody'
import { photoSwitches } from './photoSwitches'
import { PHOTO_FEATURE_ID } from './photoDefinition'

/** Registers her body details for sprite, CG and editor prompts after the catalogue loads. */
export function registerPhotoDraft(register: typeof registerImagePromptDraft): void {
  register(PHOTO_FEATURE_ID, {
    draft: (parts, { character, kind }) => {
      const her = gateBody({ ...character, baseAppearance: parts.appearance }, photoSwitches().body)
      return { appearance: bodyAppearance(her, kind), negative: [...parts.negative, ...bodyNegative(her)] }
    },
    regen: (kept, draft, on) => withBodyTags(kept, draft, on && photoSwitches().body)
  })
}
