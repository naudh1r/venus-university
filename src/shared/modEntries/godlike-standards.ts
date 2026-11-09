import type { ModDef } from '@vx/modkit/shared'

const mod: ModDef = {
  id: 'godlike-standards', name: 'Godlike Standards', author: 'Maestro Leeds',
  version: '0.1.1', scope: 'anytime', defaultOn: false,
  blurb: 'Add the gold Godlike trait in Manage Characters → Edit → Traits. Tagged characters require Godly Brain, Body and Heart before romance can begin. Friendship can grow normally.',
  offNote: 'Keeps the character’s tag but stops its extra requirement. Does not change stat gains, semester decay or established relationships.'
}
export default mod
