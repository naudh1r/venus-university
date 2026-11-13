import type { ModDef } from '@vx/modkit/shared'
import { AFTER_HOURS_MOD, afterHoursText } from '../afterHoursText'

const mod: ModDef = {
  id: AFTER_HOURS_MOD,
  name: afterHoursText.name,
  author: 'Naudh1r',
  version: '0.6.1',
  scope: 'anytime',
  defaultOn: true,
  requires: [],
  blurb: afterHoursText.blurb,
  offNote: afterHoursText.offNote,
  options: [
    { id: 'busy-status', label: afterHoursText.option, hint: afterHoursText.hint, default: true },
    { id: 'busy-texts', label: afterHoursText.busyTextsOption, hint: afterHoursText.busyTextsHint, default: true },
    { id: 'night', label: afterHoursText.nightOption, hint: afterHoursText.nightHint, default: true }
  ]
}

export default mod
