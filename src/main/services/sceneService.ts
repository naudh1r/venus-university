import { mkdir, readdir, rm } from 'fs/promises'
import { appError, messageOf, toAppError } from '@shared/errors'
import {
  assertSceneId,
  SCENE_NOT_FOUND,
  summaryOfScene,
  validateSavedScene,
  type SavedScene,
  type SavedSceneSummary
} from '@shared/sceneCreator'
import { getSceneFilePath, getScenesPath } from '../paths'
import { readJsonFile, writeAtomicJson } from './jsonFile'

/** The scenes the player saved from the Scene Creator, one `{id}.json` each under `data/scenes`. */

/** What a scene read raises when the disk refuses it. */
const UNREADABLE = { code: 'SCENE_UNREADABLE', message: 'Could not read the saved scenes.' }

/** What a scene write or delete raises when the disk refuses it. */
const UNWRITABLE = { code: 'SCENE_UNWRITABLE', message: 'Could not save the scene.' }

/** Reads and checks the scene kept under `id`; a file that is not there is `SCENE_NOT_FOUND`. */
async function sceneFile(id: string): Promise<SavedScene> {
  const path = getSceneFilePath(id)
  const read = await readJsonFile<null>(path, {
    malformed: { code: 'SCENE_MALFORMED', message: 'A saved scene is damaged.' },
    unreadable: UNREADABLE,
    onMissing: () => null
  })
  if (read.kind === 'missing') throw appError(SCENE_NOT_FOUND.code, SCENE_NOT_FOUND.message, path)
  const scene = validateSavedScene(read.parsed, path)
  // A file holding another scene's id would be written back over the wrong name.
  if (scene.id !== id) {
    throw appError('SCENE_MALFORMED', 'A saved scene is damaged.', `${path} holds ${scene.id}`)
  }
  return scene
}

/** `scenes:list` — every readable saved scene as its summary, newest first; a bad file is skipped. */
export async function listScenes(): Promise<SavedSceneSummary[]> {
  let names: string[]
  try {
    names = await readdir(getScenesPath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError(UNREADABLE.code, UNREADABLE.message, messageOf(err))
  }
  const listed: SavedSceneSummary[] = []
  for (const name of names.sort()) {
    if (!name.endsWith('.json')) continue
    try {
      listed.push(summaryOfScene(await sceneFile(name.slice(0, -'.json'.length))))
    } catch (err) {
      console.warn(`[scenes] ${name} could not be read — skipping it:`, toAppError(err).message)
    }
  }
  return listed.sort((a, b) => b.savedAt - a.savedAt)
}

/** `scenes:read` — one saved scene whole. */
export async function readScene(id: string): Promise<SavedScene> {
  assertSceneId(id)
  return sceneFile(id)
}

/** `scenes:write` — keeps a scene under its own id, replacing one already there. */
export async function writeScene(scene: SavedScene): Promise<void> {
  const checked = validateSavedScene(scene, 'scene')
  assertSceneId(checked.id)
  try {
    await mkdir(getScenesPath(), { recursive: true })
  } catch (err) {
    throw appError(UNWRITABLE.code, UNWRITABLE.message, messageOf(err))
  }
  await writeAtomicJson(getSceneFilePath(checked.id), checked, UNWRITABLE)
}

/** `scenes:delete` — removes one saved scene; an id nothing is kept under is success. */
export async function deleteScene(id: string): Promise<void> {
  assertSceneId(id)
  try {
    await rm(getSceneFilePath(id), { force: true })
  } catch (err) {
    throw appError(UNWRITABLE.code, UNWRITABLE.message, messageOf(err))
  }
}
