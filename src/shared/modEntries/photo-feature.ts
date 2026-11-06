import type { ModDef, registerImagePromptDraft } from '@vx/modkit/shared'
import { bodyAppearance, bodyNegative, gateBody, withBodyTags } from '../characterBody'
import { PHOTO_FEATURE_ID, PHOTO_FEATURE_MOD, photoSwitches } from '../photoSwitches'

const mod: ModDef = { ...PHOTO_FEATURE_MOD, id: PHOTO_FEATURE_ID, version: '1.7.1', hooks: ['invoke', 'renderer:invoke'] }
export default mod

/** Registers her body details for sprite, CG and editor prompts after the catalogue loads. */
export function registerPhotoDraft(register: typeof registerImagePromptDraft): void {
  register(mod.id, {
    draft: (parts, { character, kind }) => {
      const her = gateBody({ ...character, baseAppearance: parts.appearance }, photoSwitches().body)
      return { appearance: bodyAppearance(her, kind), negative: [...parts.negative, ...bodyNegative(her)] }
    },
    regen: (kept, draft, on) => withBodyTags(kept, draft, on && photoSwitches().body)
  })
}
