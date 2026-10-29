import type { ModDef } from '@vx/modkit/shared'
import { bodyAppearance, bodyNegative, gateBody, withBodyTags } from '../characterBody'
import { registerImagePromptDraft } from '../imagePromptDrafts'
import { PHOTO_FEATURE_MOD, photoSwitches } from '../photoSwitches'

const mod: ModDef = { ...PHOTO_FEATURE_MOD, id: 'photo-feature', version: '1.6.0' }
export default mod

// Her body in her sprite and CG prompts, in the editor's drafts and in main's renders alike, while
// body details are on; a regenerate's remembered edit takes it in, or back out, as it stands now.
registerImagePromptDraft(mod.id, {
  draft: (parts, { character, kind }) => {
    const her = gateBody({ ...character, baseAppearance: parts.appearance }, photoSwitches().body)
    return { appearance: bodyAppearance(her, kind), negative: [...parts.negative, ...bodyNegative(her)] }
  },
  regen: (kept, draft, on) => withBodyTags(kept, draft, on && photoSwitches().body)
})
