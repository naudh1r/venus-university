import { createHash } from 'crypto'
import { lstat, readFile, rm } from 'fs/promises'
import { basename, join } from 'path'
import { writeAtomicBytes } from '@vx/modkit/main'
import { appError } from '@vx/modkit/shared'
import { isPhotoFile, photoSidecarOf, pngPhotoOf } from '../shared/photoFiles'
import { dropPhotoTwins, findPhotoImage, getPhotosPath, readPhotoSidecar } from './photoFiles'

const writes = new Map<string, Promise<void>>()
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const write = (path: string, bytes: Uint8Array): Promise<void> => writeAtomicBytes(path, bytes, {
  code: 'PHOTO_WRITE_FAILED', message: 'Could not replace the photo.'
})
const journalPath = (folder: string, file: string): string => join(folder, `.redraw-${photoSidecarOf(file)}`)

/** Serializes recovery and swaps for one image and sidecar identity. */
async function serial(key: string, work: () => Promise<void>): Promise<void> {
  const previous = writes.get(key)
  const running = (async () => { await previous?.catch(() => {}); await work() })()
  writes.set(key, running)
  try { await running }
  finally { if (writes.get(key) === running) writes.delete(key) }
}

/** Reads regular files only, refusing links rather than following them outside Photo's folder. */
async function bytesIfPresent(path: string): Promise<Buffer | undefined> {
  try {
    if (!(await lstat(path)).isFile()) throw appError('PHOTO_FILE_INVALID', 'The photo file is not a regular file.')
    return await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/** Completes an interrupted image-first swap before an image or its prompt is read. */
export async function recoverPhotoSwap(folder: string, file: string): Promise<void> {
  const journal = journalPath(folder, file)
  await serial(journal, () => recover(folder, file))
}

async function recover(folder: string, file: string): Promise<void> {
  const journal = journalPath(folder, file)
  const bytes = await bytesIfPresent(journal)
  if (!bytes) return
  const plan = JSON.parse(bytes.toString()) as { schemaVersion: number; image: string; temporary: string; digest: string; sidecar: string; oldSidecar: string | null }
  if (!plan || plan.schemaVersion !== 1 ||
      (!isPhotoFile(plan.image) && !(plan.image.endsWith('.webp') && isPhotoFile(pngPhotoOf(plan.image))))) {
    throw appError('PHOTO_FILE_INVALID', 'The interrupted redraw is unreadable.')
  }
  if (photoSidecarOf(plan.image) !== photoSidecarOf(file) || !isPhotoFile(plan.temporary) ||
      photoSidecarOf(plan.temporary) === photoSidecarOf(file) || typeof plan.sidecar !== 'string' ||
      !/^[a-f0-9]{64}$/.test(plan.digest)) {
    throw appError('PHOTO_FILE_INVALID', 'The interrupted redraw is unreadable.')
  }
  const image = await bytesIfPresent(join(folder, plan.image))
  if (image && hash(image) === plan.digest) {
    await write(join(folder, photoSidecarOf(file)), Buffer.from(plan.sidecar))
    await dropPhotoTwins(join(folder, plan.image))
  } else if (plan.oldSidecar !== null) {
    await write(join(folder, photoSidecarOf(file)), Buffer.from(plan.oldSidecar, 'base64'))
  } else {
    await rm(join(folder, photoSidecarOf(file)), { force: true })
  }
  for (const name of [pngPhotoOf(plan.temporary), plan.temporary.replace(/\.(png|webp)$/, '.webp'), photoSidecarOf(plan.temporary)]) {
    await rm(join(folder, name), { force: true })
  }
  await rm(journal, { force: true })
}

/** Saves a recovery plan, then the whole image, then its prompt, rolling back a refused write. */
export async function replacePhotoFiles(pid: string, charId: string, file: string, temporary: string, signal?: AbortSignal): Promise<void> {
  const folder = getPhotosPath(pid, charId)
  const journal = journalPath(folder, file)
  await serial(journal, async () => {
    await recover(folder, file)
    const source = await findPhotoImage(pid, charId, temporary)
    const sidecarPath = join(folder, photoSidecarOf(temporary))
    if (!source || !await readPhotoSidecar(sidecarPath)) {
      throw appError('PHOTO_MISSING', 'The redraw did not finish writing its picture and prompt.')
    }
    const image = await readFile(source)
    const sidecar = await readFile(sidecarPath)
    const dest = join(folder, file.replace(/\.(png|webp)$/, source.endsWith('.webp') ? '.webp' : '.png'))
    const names = [pngPhotoOf(file), file.replace(/\.(png|webp)$/, '.webp'), photoSidecarOf(file)]
    const previous = await Promise.all(names.map(name => bytesIfPresent(join(folder, name))))
    const check = (): void => { if (signal?.aborted) throw appError('CANCELLED', 'Generation was cancelled.') }
    check()
    await write(journal, Buffer.from(JSON.stringify({ schemaVersion: 1, image: basename(dest), temporary, digest: hash(image), sidecar: sidecar.toString(), oldSidecar: previous[2]?.toString('base64') ?? null })))
    let touched = false
    try {
      check()
      touched = true
      await write(dest, image)
      check()
      await write(join(folder, photoSidecarOf(file)), sidecar)
      check()
      await dropPhotoTwins(dest)
      check()
    } catch (error) {
      if (touched) {
        for (let index = 0; index < names.length; index++) {
          const path = join(folder, names[index])
          const old = previous[index]
          if (old) await write(path, old)
        }
        // Restore an old image before removing a newly introduced format, even during rollback.
        for (let index = 0; index < names.length; index++) {
          if (!previous[index]) await rm(join(folder, names[index]), { force: true })
        }
      }
      await rm(journal, { force: true })
      throw error
    }
    // The pair has committed. Cleanup can retry on the next read without reporting a failed redraw.
    try {
      for (const name of [pngPhotoOf(temporary), temporary.replace(/\.(png|webp)$/, '.webp'), photoSidecarOf(temporary)]) {
        await rm(join(folder, name), { force: true })
      }
      await rm(journal, { force: true })
    } catch (error) { console.warn('[photo] redraw cleanup will retry:', error) }
  })
}
