import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { ECHO_ART_ID } from '../../shared/echo'
import { assertEchoPng, assertSameEchoArt, ECHO_ART_DIR, echoArtEntry, echoArtIds } from '../../shared/echoArtwork'
import { getDataPath } from '../paths'

export async function backupEchoArtwork(scratch: string): Promise<string[]> {
  const folder = join(getDataPath(), ECHO_ART_DIR)
  const entries = await readdir(folder, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const ids = entries.filter(entry => entry.isFile() && entry.name.endsWith('.png') && ECHO_ART_ID.test(entry.name.slice(0, -4))).map(entry => entry.name.slice(0, -4))
  echoArtIds(ids)
  if (ids.length) await mkdir(join(scratch, ECHO_ART_DIR), { recursive: true })
  for (const id of ids) {
    const bytes = await readFile(join(folder, `${id}.png`))
    assertEchoPng(bytes)
    await writeFile(join(scratch, echoArtEntry(id)), bytes)
  }
  return ids
}

/** Preflight every file and collision before settings or saves are restored. */
export async function prepareEchoArtworkRestore(scratch: string, value: unknown): Promise<() => Promise<void>> {
  const ids = echoArtIds(value)
  for (const id of ids) {
    const bytes = await readFile(join(scratch, echoArtEntry(id)))
    assertEchoPng(bytes)
    const existing = await readFile(join(getDataPath(), echoArtEntry(id))).catch(error => {
      if (error.code === 'ENOENT') return undefined
      throw error
    })
    assertSameEchoArt(existing, bytes)
  }
  return async () => {
    if (ids.length) await mkdir(join(getDataPath(), ECHO_ART_DIR), { recursive: true })
    for (const id of ids) {
      const bytes = await readFile(join(scratch, echoArtEntry(id)))
      try { await writeFile(join(getDataPath(), echoArtEntry(id)), bytes, { flag: 'wx' }) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        assertSameEchoArt(await readFile(join(getDataPath(), echoArtEntry(id))), bytes)
      }
    }
  }
}
