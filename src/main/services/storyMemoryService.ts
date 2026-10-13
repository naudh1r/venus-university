import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
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
import { getPlaythroughPath } from '../paths'
import { getModSwitches } from './modsService'
import { recallFromSqlite } from './storyMemoryIndex'

/** Lazy native import keeps unsupported desktop runtimes on deterministic save-based recall. */
export async function inspectStoryMemory(payload: StoryRecallRequest): Promise<StoryRecall> {
  assertStoryRecall(payload)
  const switches = await getModSwitches()
  if (!modOn(switches, 'story-memory'))
    return {
      text: '',
      included: [],
      indexed: 0,
      engine: 'Save snapshot',
      warning: 'Story Memory is off.'
    }
  payload = { ...payload, mode: optionOn(switches, 'story-memory', STORY_MEMORY_LIGHT_OPTION) ? 'light' : 'standard' }
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const folder = getPlaythroughPath(payload.playthroughId)
    // Never resurrect a deleted playthrough just to write an optional cache.
    if (!existsSync(folder) || !statSync(folder).isDirectory())
      throw Error('Playthrough is not on disk.')
    const db = new DatabaseSync(join(folder, 'story-memory.sqlite'), {
      allowExtension: false,
      timeout: 1000
    })
    try {
      return recallFromSqlite(db, payload)
    } finally {
      db.close()
    }
  } catch {
    // No transcript, private paths, or raw SQLite diagnostics go to the application's log.
    return {
      ...formatStoryRecall(payload),
      warning: 'SQLite is unavailable. Recall is using this save directly.'
    }
  }
}
export async function prepareStoryRequest(request: StructuredRequest): Promise<StructuredRequest> {
  if (!request.storyMemory) return request
  try {
    return withStoryRecall(request, await inspectStoryMemory(request.storyMemory))
  } catch {
    console.warn('[story-memory] Optional recall was unavailable; continuing without it.')
    return withStoryRecall(request)
  }
}
