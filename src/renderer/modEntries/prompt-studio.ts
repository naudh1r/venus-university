import { registerHooks } from '@vx/modkit/renderer'
import { presetRequestOf } from '../../shared/presets/request'
import { PROMPT_STUDIO_MOD } from '../../shared/presets/types'
import { usePromptStudioStore } from '../stores/promptStudioStore'
import { commitPresetVars, cutPresetVars, presetVars } from '../stores/promptStudioVars'
import { PromptStudioAdvancedEntry } from '../views/PromptStudioEntry'

registerHooks(PROMPT_STUDIO_MOD, {
  promptText: {
    // The active preset's scene text and the studio's own global text.
    edits: () => ({
      scene: usePromptStudioStore.getState().active?.overrides,
      global: usePromptStudioStore.getState().prompts.blocks
    }),
    // The player's pool sizes; a size left unchanged stays undefined for the builder's own.
    classCatalog: () => usePromptStudioStore.getState().prompts.classCatalog ?? {}
  },
  // Keeps the request for the preview, and tags the call with what main applies the preset by.
  sceneCall: (ctx) => {
    usePromptStudioStore.getState().noteSceneRequest(ctx.request)
    return presetRequestOf(ctx.spot, ctx.playthroughId, presetVars.read(), ctx.readerName)
  },
  // Keeps the variables the reply left, which main handed back.
  sceneReplyLanded: (ctx) => commitPresetVars(ctx.modReply[PROMPT_STUDIO_MOD], ctx.at),
  // Takes back the variables the cut replies changed.
  sceneCut: (ctx) => cutPresetVars(ctx.length),
  advancedSettingsEntry: PromptStudioAdvancedEntry,
  // Reads the presets and the studio's prompts as the mod comes on, before any request reads them.
  switchedOn: () => usePromptStudioStore.getState().load()
})
