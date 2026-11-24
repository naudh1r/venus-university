import { hasTrait, registerCharacterTrait, registerRomanceRequirement, MAX_TIER, pointsForTier } from '@vx/modkit/shared'

// Renderer boot runs after the shared catalogue. Keep registrations here: importing
// the whole shared kit while the catalogue loads would create a circular dependency.
registerCharacterTrait('godlike-standards', {
  value: 'Godlike',
  description: 'requires Godly Brain, Body and Heart before beginning a romance',
  editor: true,
  generated: false,
  tone: 'gold',
  hint: 'Godlike requires Brain, Body and Heart all at Godly before romance can begin. Applies while Godlike Standards is on.'
})
registerRomanceRequirement('godlike-standards', character => {
  if (!hasTrait(character, 'Godlike')) return null
  const godly = pointsForTier(MAX_TIER)
  return { brain: godly, body: godly, heart: godly }
})
