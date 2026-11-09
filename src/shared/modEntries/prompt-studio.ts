import type { ModDef } from '@vx/modkit/shared'

const mod: ModDef = {
  id: 'prompt-studio', name: 'Prompt Studio', author: 'Sharp', version: '1.0.0',
  scope: 'anytime', defaultOn: false,
  blurb: 'Shape scenes with SillyTavern or Marinara presets, and rewrite the game\'s own prompts.',
  offNote: 'Presets and prompt edits stay saved. The game sends its own prompts.'
}
export default mod
