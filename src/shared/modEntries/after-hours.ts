import type { ModDef } from '@vx/modkit/shared'
import { AFTER_HOURS_MOD } from '../afterHours'
import { afterHoursText } from '../../renderer/mods/afterHoursText'

const mod: ModDef = {
  id: AFTER_HOURS_MOD,
  name: afterHoursText.name,
  author: 'Naudh1r',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  requires: [],
  blurb: afterHoursText.blurb,
  offNote: afterHoursText.offNote,
  options: [{ id: 'busy-status', label: afterHoursText.option, hint: afterHoursText.hint, default: true }]
}

export default mod
