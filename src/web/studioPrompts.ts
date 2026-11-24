import {
  EMPTY_STUDIO_PROMPTS,
  readStudioPrompts as checkedStudioPrompts,
  studioPromptsToKeep,
  type StudioPrompts
} from '@shared/presets/studioPrompts'
import { database, storage } from './db/open'

/** What Prompt Studio keeps for the game's own prompts on the browser build: one row of the database. */

const KEY = 'studioPrompts'

/** `studioPrompts.get` — the record, or an empty one where nothing has been kept; a wrong schema version is refused. */
export async function readStudioPrompts(): Promise<StudioPrompts> {
  const stored = await storage('read the studio prompts', async () => (await database()).get('studioPrompts', KEY))
  return stored === undefined ? EMPTY_STUDIO_PROMPTS : checkedStudioPrompts(stored, KEY)
}

/** `studioPrompts.set` — replaces the record; the record kept is answered. */
export async function writeStudioPrompts(record: StudioPrompts): Promise<StudioPrompts> {
  const kept = studioPromptsToKeep(record)
  await storage('save the studio prompts', async () => (await database()).put('studioPrompts', kept, KEY))
  return kept
}
