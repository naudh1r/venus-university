import { mkdir } from 'fs/promises'
import { readJsonFile, writeAtomicJson } from '@vx/modkit/main'
import {
  EMPTY_STUDIO_PROMPTS,
  readStudioPrompts,
  studioPromptsToKeep,
  type StudioPrompts
} from '../../shared/presets/studioPrompts'
import { getPromptStudioPath, getStudioPromptsPath } from '../paths'

/** What Prompt Studio keeps for the game's own prompts: `data/prompt-studio/prompts.json`. */

/** `studioPrompts:get` — the record, or an empty one where nothing has been kept; a wrong schema version is refused. */
export async function getStudioPrompts(): Promise<StudioPrompts> {
  const read = await readJsonFile<StudioPrompts>(getStudioPromptsPath(), {
    malformed: { code: 'STUDIO_PROMPTS_MALFORMED', message: 'The studio prompts are damaged.' },
    unreadable: { code: 'STUDIO_PROMPTS_UNREADABLE', message: 'Could not read the studio prompts.' },
    onMissing: () => EMPTY_STUDIO_PROMPTS
  })
  if (read.kind === 'missing') return read.value
  return readStudioPrompts(read.parsed, getStudioPromptsPath())
}

/** `studioPrompts:set` — replaces the record, as it is kept, atomically; the record kept is answered. */
export async function setStudioPrompts(record: StudioPrompts): Promise<StudioPrompts> {
  const kept = studioPromptsToKeep(record)
  await mkdir(getPromptStudioPath(), { recursive: true })
  await writeAtomicJson(getStudioPromptsPath(), kept, {
    code: 'STUDIO_PROMPTS_UNWRITABLE',
    message: 'Could not save the studio prompts.'
  })
  return kept
}
