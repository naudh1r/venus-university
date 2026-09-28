import type { BodyField } from '@shared/characterBody'
import '../vu_styles/BodyFields.css'

/**
 * Her body, one field per region a photograph can frame or cover on its own. Shown in the same
 * order a prompt reads them, top down.
 *
 * Its own file rather than a block in `characterFields.ts`, on the same rule the rest of the
 * feature follows: what the feature adds, the feature keeps.
 */
export const BODY_FIELD_LABELS: Readonly<Record<BodyField, string>> = {
  bodyType: 'Build',
  bust: 'Chest',
  nipples: 'Nipples',
  stomach: 'Stomach',
  hipsThighs: 'Hips and thighs',
  buttocks: 'Backside'
}
