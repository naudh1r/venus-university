import type { ModDef } from '../mods'

export const INCOMING_TEXTS = 'incoming-texts'

const mod: ModDef = {
  id: INCOMING_TEXTS,
  name: 'Incoming Texts',
  author: 'sav',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'Describe a text you want a character to send. Your direction stays outside the conversation.',
  offNote: 'Texts already received stay in the conversation.'
}

export default mod
