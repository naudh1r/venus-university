import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { CHARACTER_FILE_NAME, isCharFileRel, STAGING_DIR } from '@shared/characterFiles'
import { messageOf } from '@shared/errors'
import type { FileStamp } from '@shared/types'
import {
  castInPlace,
  getCharactersPath,
  getDataPath,
  getInstallPath,
  getParkedPath,
  getPregenCharactersPath,
  getTempPath,
  hasShippedCopy,
  listPregenCharIds,
  markCopied
} from '../paths'
import { renameWithPatience } from './jsonFile'
import { MANIFEST_REL, readManifest } from './updateService'

/**
 * Finds the shipped characters a player edited in place, back when the build's own folder
 * could be written to, and gives each the copy that edited cast now lives in. Without it,
 * those edits would sit under the install's assets, where the next update overwrites them.
 */

/** The file in `/data` that says the pass has run to the end once. */
const MARKER_NAME = 'cast-checked'

/** Where the build's shipped cast sits in a manifest, relative to the install. */
const CAST_REL = 'resources/assets/characters'

/** One file of a character's folder as the comparison sees it: its size, and its hash once taken. */
export interface CastFile {
  size: number
  sha256: string | null
}

/** True for a path in a character's folder that is part of her, not scratch or a stray file. */
function isCastRel(rel: string): boolean {
  if (rel === STAGING_DIR || rel.startsWith(`${STAGING_DIR}/`) || rel.endsWith('.tmp')) return false
  return rel === CHARACTER_FILE_NAME || isCharFileRel(rel)
}

/**
 * The player's tree of one character as it was before the last update: the files her shipped
 * folder holds now, replaced by what the update parked (those were the player's), and without
 * the files the update itself added — in the new manifest, not the old, and nothing parked.
 */
export function castTree<T>(
  assets: ReadonlyMap<string, T>,
  parked: ReadonlyMap<string, T>,
  cur: ReadonlySet<string>,
  prev: ReadonlySet<string>
): Map<string, T> {
  const tree = new Map<string, T>()
  for (const [rel, file] of assets) {
    if (!isCastRel(rel)) continue
    if (cur.has(rel) && !prev.has(rel) && !parked.has(rel)) continue
    tree.set(rel, file)
  }
  for (const [rel, file] of parked) if (isCastRel(rel)) tree.set(rel, file)
  return tree
}

/**
 * Whether the tree is not what `prev` shipped: a listed file is gone or another size, or —
 * where a hash was taken — another hash, or the tree holds a file the build never listed. A
 * hash that was not taken counts as equal.
 */
export function treeDiffersFrom(
  prev: ReadonlyMap<string, FileStamp>,
  tree: ReadonlyMap<string, CastFile>
): boolean {
  for (const [rel, stamp] of prev) {
    const file = tree.get(rel)
    if (!file || file.size !== stamp.size) return true
    if (file.sha256 !== null && file.sha256 !== stamp.sha256.toLowerCase()) return true
  }
  for (const rel of tree.keys()) if (!prev.has(rel)) return true
  return false
}

/**
 * Whether the player edited one shipped character: the files her folder holds now and the
 * ones the last update parked, against what the previous and the current build list for her.
 */
export function isEditedCast(
  assets: ReadonlyMap<string, CastFile>,
  parked: ReadonlyMap<string, CastFile>,
  cur: readonly FileStamp[],
  prev: readonly FileStamp[]
): boolean {
  const before = new Map(prev.filter((stamp) => isCastRel(stamp.rel)).map((s) => [s.rel, s]))
  const now = new Set(cur.map((stamp) => stamp.rel))
  return treeDiffersFrom(before, castTree(assets, parked, now, new Set(before.keys())))
}

/** One character's stamps in a manifest, by their path in her folder. */
function stampsFor(files: readonly FileStamp[], charId: string): FileStamp[] {
  const prefix = `${CAST_REL}/${charId}/`
  const stamps: FileStamp[] = []
  for (const file of files) {
    const rel = file.rel.replace(/\\/g, '/')
    if (!rel.startsWith(prefix)) continue
    const inFolder = rel.slice(prefix.length)
    if (isCastRel(inFolder)) stamps.push({ ...file, rel: inFolder })
  }
  return stamps
}

/** A folder's files by their forward-slash path under it, each with where it lives and its size. */
async function listTree(dir: string): Promise<Map<string, CastFile & { path: string }>> {
  const files = new Map<string, CastFile & { path: string }>()
  async function walk(sub: string): Promise<void> {
    let entries
    try {
      entries = await readdir(join(dir, sub), { withFileTypes: true })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
      throw err
    }
    for (const entry of entries) {
      const rel = sub === '' ? entry.name : `${sub}/${entry.name}`
      if (entry.isDirectory()) {
        if (rel !== STAGING_DIR) await walk(rel)
      } else if (entry.isFile()) {
        const path = join(dir, rel)
        files.set(rel, { path, size: (await stat(path)).size, sha256: null })
      }
    }
  }
  await walk('')
  return files
}

/** The SHA-256 of one file, as lowercase hex. */
function hashOf(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}

/** Moves a tree into `/data/characters/{charId}` as her copy, through a scratch folder. */
async function copyTree(
  charId: string,
  tree: ReadonlyMap<string, CastFile & { path: string }>
): Promise<void> {
  await mkdir(getTempPath(), { recursive: true })
  await mkdir(getCharactersPath(), { recursive: true })
  const temp = await mkdtemp(join(getTempPath(), 'cast-'))
  try {
    for (const [rel, file] of tree) {
      const target = join(temp, charId, rel)
      await mkdir(dirname(target), { recursive: true })
      await copyFile(file.path, target)
    }
    await renameWithPatience(join(temp, charId), join(getCharactersPath(), charId))
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => {})
  }
}

/** Rescues one shipped character if she was edited in place; true when she was. */
async function rescue(
  charId: string,
  cur: readonly FileStamp[],
  prev: readonly FileStamp[]
): Promise<boolean> {
  const before = new Map(stampsFor(prev, charId).map((stamp) => [stamp.rel, stamp]))
  const now = new Set(stampsFor(cur, charId).map((stamp) => stamp.rel))
  const assets = await listTree(join(getPregenCharactersPath(), charId))
  const parked = await listTree(join(getParkedPath(), ...CAST_REL.split('/'), charId))
  const tree = castTree(assets, parked, now, new Set(before.keys()))

  // Sizes alone settle most of it; only a tree that still matches is worth reading through.
  if (treeDiffersFrom(before, tree)) return await copyAndSay(charId, tree)
  for (const [rel, file] of tree) {
    const stamp = before.get(rel)
    if (stamp && file.size === stamp.size) file.sha256 = await hashOf(file.path)
  }
  return treeDiffersFrom(before, tree) ? await copyAndSay(charId, tree) : false
}

/** Copies the tree out as her edited copy and says so. */
async function copyAndSay(
  charId: string,
  tree: ReadonlyMap<string, CastFile & { path: string }>
): Promise<boolean> {
  await copyTree(charId, tree)
  markCopied(charId)
  console.log(`[cast] kept the edits made to ${charId} in place`)
  return true
}

/**
 * Gives every shipped character the player edited in place her own copy. It runs once: the
 * marker is written only after the whole pass finished, so a failure is tried again next
 * launch. It never throws, and it reads no setting — the switch may have been turned off since.
 */
export async function migrateEditedCast(): Promise<void> {
  if (castInPlace()) return
  const marker = join(getDataPath(), MARKER_NAME)
  try {
    if (await stat(marker).then(() => true, () => false)) return

    const cur = await readManifest(join(getInstallPath(), MANIFEST_REL))
    if (cur === null) {
      console.warn('[cast] the build manifest is missing or unreadable; will check next launch')
      return
    }
    // The manifest the last update parked is the build the player edited against.
    const prev = (await readManifest(join(getParkedPath(), MANIFEST_REL))) ?? cur

    for (const charId of listPregenCharIds()) {
      if (hasShippedCopy(charId)) continue
      await rescue(charId, cur.files, prev.files)
    }
    await writeFile(marker, '')
  } catch (err) {
    console.warn('[cast] could not check the shipped characters for edits:', messageOf(err))
  }
}
