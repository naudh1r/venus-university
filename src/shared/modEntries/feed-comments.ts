import type { ModDef } from '../mods'
import { FEED_COMMENTS } from '../feedComments'

const mod: ModDef = {
  id: FEED_COMMENTS,
  name: 'Feed Comments',
  author: 'naudh1r',
  version: '1.0.0',
  scope: 'anytime',
  defaultOn: false,
  blurb:
    "Comment on your contacts' posts, reply to comments under them and tag your other contacts with @. The poster answers you in her own voice, her friends and other students chime in, and she remembers what you said. Roster girls also comment on each other's posts. Works on its own; with Photo Feature on too, photo posts get comments the same way.",
  offNote:
    'Off, you cannot comment and posts show only Photo Feature\'s plain comments, if it is on. Threads and what she remembered are kept, and come back when it is on again.'
}
export default mod
