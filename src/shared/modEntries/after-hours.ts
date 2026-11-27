import type { ModDef } from '@vx/modkit/shared'
import { AFTER_HOURS_MOD, afterHoursText } from '../afterHoursText'

const mod: ModDef = {
  id: AFTER_HOURS_MOD,
  name: afterHoursText.name,
  author: 'naudh1r',
  version: '0.7.8', game: '0.9.2',
  scope: 'anytime',
  defaultOn: true,
  requires: [],
  blurb: afterHoursText.blurb,
  offNote: afterHoursText.offNote,
  options: [
    { id: 'busy-status', label: afterHoursText.option, hint: afterHoursText.hint, default: true },
    { id: 'busy-texts', label: afterHoursText.busyTextsOption, hint: afterHoursText.busyTextsHint, default: true },
    { id: 'night', label: afterHoursText.nightOption, hint: afterHoursText.nightHint, default: true },
    { id: 'night-sleep', label: afterHoursText.nightSleepOption, hint: afterHoursText.nightSleepHint, default: true },
    { id: 'chat-lights', label: afterHoursText.chatLightsOption, hint: afterHoursText.chatLightsHint, default: true }
  ]
}

export default mod
