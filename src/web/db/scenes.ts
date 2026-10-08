import { appError, toAppError } from '@shared/errors'
import {
  assertSceneId,
  SCENE_NOT_FOUND,
  summaryOfScene,
  validateSavedScene,
  type SavedScene,
  type SavedSceneSummary
} from '@shared/sceneCreator'
import { database, storage } from './open'

/** The scenes the player saved from the Scene Creator: one row each, under the scene's own id. */

/** Every readable saved scene as its summary, newest first; a row that fails its check is skipped. */
export async function listScenes(): Promise<SavedSceneSummary[]> {
  const rows = await storage('list the saved scenes', async () => {
    const db = await database()
    const keys = await db.getAllKeys('scenes')
    return Promise.all(keys.map(async (key) => ({ key, row: await db.get('scenes', key) })))
  })
  const listed: SavedSceneSummary[] = []
  for (const { key, row } of rows) {
    try {
      const scene = validateSavedScene(row, key)
      if (scene.id !== key) throw appError('SCENE_MALFORMED', 'A saved scene is damaged.', key)
      listed.push(summaryOfScene(scene))
    } catch (err) {
      console.warn(`[scenes] ${key} could not be read — skipping it:`, toAppError(err).message)
    }
  }
  return listed.sort((a, b) => b.savedAt - a.savedAt)
}

/** One saved scene whole; an id nothing is kept under is `SCENE_NOT_FOUND`. */
export async function readScene(id: string): Promise<SavedScene> {
  assertSceneId(id)
  const row = await storage('read the saved scene', async () => (await database()).get('scenes', id))
  if (row === undefined) throw appError(SCENE_NOT_FOUND.code, SCENE_NOT_FOUND.message, id)
  const scene = validateSavedScene(row, id)
  if (scene.id !== id) throw appError('SCENE_MALFORMED', 'A saved scene is damaged.', id)
  return scene
}

/** Keeps a scene under its own id, replacing one already there. */
export async function writeScene(scene: SavedScene): Promise<void> {
  const checked = validateSavedScene(scene, 'scene')
  assertSceneId(checked.id)
  await storage('save the scene', async () => (await database()).put('scenes', checked, checked.id))
}

/** Removes one saved scene; an id nothing is kept under is success. */
export async function deleteScene(id: string): Promise<void> {
  assertSceneId(id)
  await storage('delete the saved scene', async () => (await database()).delete('scenes', id))
}
