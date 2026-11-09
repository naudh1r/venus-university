import { mkdir, rename, rm, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { CHARACTER_FILE_NAME, isStaleTwinRel, STAGING_DIR } from '@shared/characterFiles'
import { assertSafeCharId } from '@shared/characterRules'
import {
  adoptStamp,
  buildManifest,
  classifyImportEntry,
  MANIFEST_MISSING,
  MANIFEST_NAME,
  MANIFEST_READ,
  MANIFEST_UNREADABLE,
  manifestModJson,
  portableOf,
  readManifestRecord,
  stripWrapper,
  unknownManifestKeys,
  type CharacterManifest
} from '@shared/characterTransfer'
import { MOD_PARTS_DIR } from '@shared/modParts'
import { appError, messageOf } from '@shared/errors'
import { imageTypeOf } from '@shared/imageBytes'
import type { ExportKind } from '@shared/sillyTavern'
import type { Character } from '@shared/types'
import { randomId } from '@shared/uuid'
import { getCharacterPath, getCharactersPath } from '../paths'
import {
  checkExtractedContent,
  copyInto,
  replaceZip,
  discard,
  extractZip,
  relPathsUnder,
  scratchDir,
  stripWrapperDir
} from './archiveService'
import { getCharacter, readCharacterFile } from './characterService'
import { sniffImageFile } from './imageFiles'
import { readJsonFile, writeAtomicJson } from './jsonFile'
import { convertFolderImages } from './legacyImageService'
import { modNameOf, modVersionOf } from './modDataService'
import { characterTransferParts } from './modParts'

/**
 * Each registered mod's share of the export: its json for the manifest, and whatever it wrote
 * into its own folder under `mods/`. A part that throws is left out with a warning, as a picture
 * that is not one is, and the export goes ahead.
 */
async function exportModParts(
  charId: string,
  stagingDir: string
): Promise<Record<string, { version: string; json?: unknown }>> {
  const mods: Record<string, { version: string; json?: unknown }> = {}
  for (const [modId, part] of characterTransferParts()) {
    const dir = join(stagingDir, MOD_PARTS_DIR, modId)
    try {
      await mkdir(dir, { recursive: true })
      const json: unknown = await part.export(charId, dir)
      // Copied through JSON, so what goes in the manifest is what an import reads back.
      mods[modId] = {
        version: modVersionOf(modId),
        ...(json !== undefined ? { json: JSON.parse(JSON.stringify(json)) as unknown } : {})
      }
    } catch (err) {
      console.warn(`[transfer] left out ${modId}'s data:`, messageOf(err))
      await discard(dir)
    }
  }
  return mods
}

/** Runs every rollback in `rollbacks`, the last first; one that throws is logged. */
async function rollBack(rollbacks: readonly { modId: string; undo: () => Promise<void> }[]): Promise<void> {
  for (const { modId, undo } of [...rollbacks].reverse()) {
    await undo().catch((err: unknown) => {
      console.error(`[transfer] ${modId} could not take its data back out:`, err)
    })
  }
}

/**
 * Hands the adopted character to every registered part in turn. One that throws takes the
 * earlier parts' data back out, last first, and removes her folder: she arrives whole or not at
 * all.
 */
async function adoptModParts(
  charId: string,
  run: (modId: string) => Promise<() => Promise<void>>,
  code: string,
  verb: string
): Promise<void> {
  const rollbacks: { modId: string; undo: () => Promise<void> }[] = []
  for (const modId of characterTransferParts().keys()) {
    try {
      rollbacks.push({ modId, undo: await run(modId) })
    } catch (err) {
      await rollBack(rollbacks)
      await rm(getCharacterPath(charId), { recursive: true, force: true }).catch(() => {})
      throw appError(code, `Could not add the ${verb} character: ${modNameOf(modId)} could not take her data.`, messageOf(err))
    }
  }
}

import { readPortableReflection, writePortableReflection, removePortableReflection, validatePortableReflection, type PortableReflection } from './reflectionStorage'

/** Moving one character between installs, as a zip in the shared package format. */

/** Zips one character's folder to `targetPath`, minus staging and with a manifest. */
export async function exportCharacter(charId: string, targetPath: string): Promise<void> {
  assertSafeCharId(charId)
  // Validated before anything is copied: an unreadable character must not become a zip.
  const character = await getCharacter(charId)
  const stagingDir = scratchDir('export')

  try {
    await copyImages(getCharacterPath(charId), stagingDir)

    await writeAtomicJson(join(stagingDir, CHARACTER_FILE_NAME), portableOf(character), {
      code: 'EXPORT_FAILED',
      message: 'Could not write the character into the export.'
    })

    const reflection = await readPortableReflection(charId)
    const mods = await exportModParts(charId, stagingDir)
    const manifest = {
      ...buildManifest(character, new Date().toISOString()),
      ...(reflection ? { exReflection: reflection } : {}),
      ...(Object.keys(mods).length > 0 ? { mods } : {})
    }
    await writeAtomicJson(join(stagingDir, MANIFEST_NAME), manifest, {
      code: 'EXPORT_FAILED',
      message: 'Could not write the export manifest.'
    })

    await replaceZip(stagingDir, targetPath)
  } finally {
    await discard(stagingDir)
  }
}

/** The four bytes every zip local file header opens with. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

/** True where `bytes` opens with a zip local file header. */
function looksLikeZip(bytes: Buffer): boolean {
  return ZIP_SIGNATURE.every((byte, i) => bytes[i] === byte)
}

/**
 * Writes a SillyTavern export the renderer composed: `base64` decoded, sniffed for the shape
 * `kind` claims, then written atomically like every other picture this build saves.
 */
export async function saveExportFile(
  kind: ExportKind,
  targetPath: string,
  base64: string
): Promise<void> {
  const bytes = Buffer.from(base64, 'base64')
  if (kind === 'card' && imageTypeOf(bytes) !== 'image/png') {
    throw appError('EXPORT_FAILED', 'Could not write the export.', 'the card is not a PNG')
  }
  if (kind === 'sprites' && !looksLikeZip(bytes)) {
    throw appError('EXPORT_FAILED', 'Could not write the export.', 'the sprite pack is not a zip')
  }

  const temp = `${targetPath}.tmp`
  try {
    await writeFile(temp, bytes)
    await rename(temp, targetPath)
  } catch (err) {
    await unlink(temp).catch(() => {})
    throw appError('EXPORT_FAILED', 'Could not write the export.', messageOf(err))
  }
}

/**
 * Stamps the folder's `character.json` with its new id, then moves it into `/data/characters`
 * with one same-volume rename.
 */
async function adoptFolder(
  tempDir: string,
  character: Character,
  code: string,
  verb: string,
  reflection?: PortableReflection | null
): Promise<Character> {
  // The other write path stamps in `writeCharacter`.
  const adopted = adoptStamp(character, Date.now())
  await writeAtomicJson(join(tempDir, CHARACTER_FILE_NAME), adopted, {
    code,
    message: `Could not write the ${verb} character.`
  })

  try {
    await mkdir(getCharactersPath(), { recursive: true })
    if (reflection) await writePortableReflection(adopted.charId, reflection)
    await rename(tempDir, getCharacterPath(adopted.charId))
  } catch (err) {
    if (reflection) await removePortableReflection(adopted.charId).catch(() => {})
    throw appError(code, `Could not add the ${verb} character.`, messageOf(err))
  }

  return adopted
}

/**
 * Copies one character's folder under a fresh identity — the import path with the zip taken
 * out.
 */
export async function duplicateCharacter(charId: string): Promise<Character> {
  assertSafeCharId(charId)
  // Validated before anything is copied, as an export is.
  const character = await getCharacter(charId)
  const tempDir = scratchDir('duplicate')

  try {
    await copyImages(getCharacterPath(charId), tempDir)
    // A folder still holding older pictures becomes a copy that holds none.
    await convertFolderImages(tempDir)

    // The id is minted here, never read off the copied file.
    const copy: Character = { ...character, charId: randomId() }
    const adopted = await adoptFolder(tempDir, copy, 'DUPLICATE_FAILED', 'duplicated', await readPortableReflection(charId))
    const parts = characterTransferParts()
    await adoptModParts(adopted.charId, (modId) => parts.get(modId)!.duplicate(charId, adopted.charId), 'DUPLICATE_FAILED', 'duplicated')
    return adopted
  } catch (err) {
    await discard(tempDir)
    throw err
  }
}

/**
 * Copies her record and every one of her pictures out of `from`, leaving behind a staged run,
 * the loose reference, a half-written file, a PNG its WebP twin replaced and anything else the
 * folder has collected.
 */
async function copyImages(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true })
  const rels = await relPathsUnder(from)
  const present = new Set(rels.map((rel) => rel.toLowerCase()))
  for (const rel of rels) {
    const role = classifyImportEntry(rel)
    if (role !== 'record' && role !== 'image') continue
    if (role === 'image' && isStaleTwinRel(rel, present)) continue
    if (role === 'image' && !(await sniffImageFile(join(from, rel)))) {
      console.warn(`[transfer] left out ${rel}: not an image`)
      continue
    }

    await copyInto(join(from, rel), join(to, rel))
  }
}

/** Reads and checks the archive's manifest, or says why it is not one of ours. */
async function readManifest(dir: string): Promise<CharacterManifest> {
  const path = join(dir, MANIFEST_NAME)
  const read = await readJsonFile(path, {
    malformed: MANIFEST_READ.malformed,
    unreadable: MANIFEST_UNREADABLE,
    onMissing: (): never => {
      throw appError(MANIFEST_MISSING.code, MANIFEST_MISSING.message, MANIFEST_NAME)
    }
  })
  if (read.kind === 'missing') return read.value

  return readManifestRecord(read.parsed, path)
}

/**
 * Adopts a character zip: validates it, gives her a fresh identity and moves the folder into
 * `/data/characters`.
 */
export async function importCharacter(archivePath: string): Promise<Character> {
  const tempDir = scratchDir('import')
  // The mods' own files, moved out of her folder before it becomes hers.
  const modsDir = scratchDir('import-mods')

  try {
    const entries = await extractZip(archivePath, tempDir)

    // One wrapper level from a hand-rezipped folder is unwrapped rather than refused.
    const wrapper = stripWrapper(entries.map((entry) => entry.path))
    if (wrapper !== null) await stripWrapperDir(tempDir, wrapper)

    await checkExtractedContent(tempDir, classifyImportEntry, 'export')

    const manifest = await readManifest(tempDir) as CharacterManifest & { exReflection?: unknown }
    const reflection = manifest.exReflection === undefined ? null : validatePortableReflection(manifest.exReflection)
    const legacy = unknownManifestKeys(manifest)

    const charId = randomId()
    const { character } = await readCharacterFile(
      join(tempDir, CHARACTER_FILE_NAME),
      charId,
      () => {
        throw appError(
          'IMPORT_CHARACTER_MISSING',
          'That export holds no character.',
          CHARACTER_FILE_NAME
        )
      }
    )

    // Neither is hers: staging is a dead run's images, the manifest describes the archive.
    await discard(join(tempDir, STAGING_DIR))
    await rm(join(tempDir, MANIFEST_NAME), { force: true })
    // An older package's pictures arrive as PNG and are kept as WebP, before she is the player's.
    await convertFolderImages(tempDir)

    // The mods' files are the mods' to take in, never part of her folder.
    await mkdir(modsDir, { recursive: true })
    await rename(join(tempDir, MOD_PARTS_DIR), join(modsDir, MOD_PARTS_DIR)).catch((err: unknown) => {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    })
    const parts = characterTransferParts()
    const dirOf = (modId: string): string => join(modsDir, MOD_PARTS_DIR, modId)
    // Each part finds its folder whether or not the export carries one, as a backup's part does.
    for (const modId of parts.keys()) await mkdir(dirOf(modId), { recursive: true })
    for (const modId of Object.keys(manifest.mods ?? {})) {
      if (!parts.has(modId)) console.log(`[transfer] ${modId} is not installed; its data in the export is left out`)
    }
    for (const [modId, part] of parts) {
      try {
        await part.validate(manifestModJson(manifest, modId), dirOf(modId), legacy)
      } catch (err) {
        throw appError('IMPORT_FAILED', `That export cannot come in: ${modNameOf(modId)} could not read her data.`, messageOf(err))
      }
    }

    const adopted = await adoptFolder(tempDir, character, 'IMPORT_FAILED', 'imported', reflection)
    await adoptModParts(
      adopted.charId,
      (modId) => parts.get(modId)!.adopt(adopted.charId, manifestModJson(manifest, modId), dirOf(modId), legacy),
      'IMPORT_FAILED',
      'imported'
    )
    return adopted
  } catch (err) {
    await discard(tempDir)
    throw err
  } finally {
    await discard(modsDir)
  }
}
