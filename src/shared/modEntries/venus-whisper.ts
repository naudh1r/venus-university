import type { ModDef } from '@vx/modkit/shared'
import { VENUS_WHISPER_MOD, WHISPER_TITLE } from '../venusWhisper'

const mod: ModDef = {
    id: VENUS_WHISPER_MOD, name: WHISPER_TITLE, author: 'Maestro Leeds', version: '1.0.1',
    scope: 'anytime', defaultOn: true,
    blurb: 'An anonymous Wednesday gossip column, delivered weekly with unread alerts, public comments, replies and mentions.',
    offNote: 'Keeps the secret columnist and archive, including across continued semesters. Stops new issues, comments and gossip context.'
  }
export default mod
