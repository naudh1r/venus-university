import { modOn, optionOn } from '@shared/mods'
import {
  assertStoryRecall,
  formatStoryRecall,
  withStoryRecall,
  STORY_MEMORY_LIGHT_OPTION,
  type StoryRecall,
  type StoryRecallRequest
} from '@shared/storyMemory'
import type { StructuredRequest } from '@shared/types'
import { readModSwitches } from './mods'

/** Browser saves already live in IndexedDB; the native SQLite cache is desktop-only. */
export function inspectStoryMemory(payload: StoryRecallRequest): StoryRecall {
  assertStoryRecall(payload)
  const switches = readModSwitches()
  return modOn(switches, 'story-memory')
    ? formatStoryRecall({ ...payload, mode: optionOn(switches, 'story-memory', STORY_MEMORY_LIGHT_OPTION) ? 'light' : 'standard' })
    : {
        text: '',
        included: [],
        indexed: 0,
        engine: 'Save snapshot',
        warning: 'Story Memory is off.'
      }
}
export async function prepareStoryRequest(request: StructuredRequest): Promise<StructuredRequest> {
  if (!request.storyMemory) return request
  try {
    return withStoryRecall(request, inspectStoryMemory(request.storyMemory))
  } catch {
    console.warn('[story-memory] Optional recall was unavailable; continuing without it.')
    return withStoryRecall(request)
  }
}
