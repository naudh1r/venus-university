import type { ModDef } from '../mods'
import '../storyMemoryCarry'

const mod: ModDef = {
  id: 'story-memory', name: 'Story Memory', author: 'Maestro Leeds', version: '1.1.0',
  scope: 'anytime', defaultOn: true,
  blurb: 'Remember lasting story developments and find relevant past encounters with a local SQLite index.',
  offNote: 'Keeps facts and corrections in saves. Stops extraction and extra recall. Native character notes stay available.',
  options: [{
    id: 'light-memory', label: 'Light memory', default: false,
    hint: 'Send a smaller selection of relevant memories and use shorter memory updates to reduce token use. Full saved history stays intact. Older or less relevant details may be recalled less often. Off restores standard memory.'
  }]
}
export default mod
