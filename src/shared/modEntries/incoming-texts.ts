import type { ModDef } from '../mods'

export const INCOMING_TEXTS = 'incoming-texts'
export const OUTGOING_IMAGE_STORAGE_MOD = 'photo-feature'

const mod: ModDef = {
  id: INCOMING_TEXTS,
  name: 'Incoming Texts',
  author: 'sav',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'Describe an incoming text or send a photo description in Bunnyboard. With Photo Feature on in the desktop app, you can also attach or paste an image for the texting model to read.',
  offNote: 'Texts already received stay in the conversation.'
}

export default mod
