import * as asar from '@electron/asar'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

/**
 * Installs the photo feature into an official Venus University folder, and takes it out again.
 *
 * The game's code lives in `resources/app.asar`. Installing swaps the few code files the feature
 * changes for its own and adds the photo workflow. Nothing else in the game is touched: the art,
 * fonts, music, characters and the player's `data` folder stay exactly as they are, and none of
 * them are in this download. Uninstalling puts the original `app.asar` back from the copy made
 * at install time.
 */

// Run by the game's own exe (ELECTRON_RUN_AS_NODE), Electron's `fs` would read `app.asar` as a
// folder; this makes it the plain file it is, so the backup is a byte copy.
process.noAsar = true

const HERE = dirname(fileURLToPath(import.meta.url))
const PAYLOAD = join(HERE, 'payload')
const EXE = 'Venus University.exe'
/** Files the packed app keeps outside `app.asar`, as electron-builder was told to. */
const UNPACK = '**/node_modules/7zip-bin/**'

const expected = JSON.parse(await readFile(join(PAYLOAD, 'expected.json'), 'utf8'))

const paths = (game) => {
  const res = join(game, 'resources')
  return {
    res,
    asar: join(res, 'app.asar'),
    unpacked: join(res, 'app.asar.unpacked'),
    backup: join(res, 'app.asar.photo-mod-backup'),
    backupUnpacked: join(res, 'app.asar.unpacked.photo-mod-backup'),
    marker: join(res, 'photo-mod.json'),
    manifest: join(res, 'build-manifest.json'),
    workflow: join(res, 'assets', 'workflows', 'characterPhoto.json')
  }
}

/** A `/`-joined path inside the archive, in the form the archive reader looks it up by. */
const native = (rel) => rel.split('/').join(sep)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

/** The game folder: given, or the folder the mod was unpacked into, or asked for. */
async function findGame(given) {
  const candidates = [given, process.cwd(), resolve(HERE, '..')].filter(Boolean)
  for (const dir of candidates) {
    if (existsSync(join(dir, EXE))) return resolve(dir)
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`Path to your Venus University folder (where "${EXE}" is): `))
    .trim()
    .replace(/^"|"$/g, '')
  rl.close()
  if (!answer || !existsSync(join(answer, EXE))) fail(`"${EXE}" was not found in that folder.`)
  return resolve(answer)
}

/** Refuses a folder that is not the official version this mod was built for. */
async function checkOfficial(p, force) {
  const manifest = JSON.parse(await readFile(p.manifest, 'utf8').catch(() => 'null'))
  if (!manifest) fail('This folder has no build-manifest.json, so it is not an official build.')
  if (manifest.version !== expected.gameVersion) {
    const message = `This mod is for Venus University ${expected.gameVersion}, but this folder is ${manifest.version}.`
    if (!force) fail(`${message} Nothing was changed.`)
    console.warn(`  warning: ${message} Continuing because of --force.`)
  }
  const listed = new Set(asar.listPackage(p.asar).map((f) => f.replace(/\\/g, '/').replace(/^\//, '')))
  for (const [rel, hash] of Object.entries(expected.base)) {
    const ok = listed.has(rel) && sha256(asar.extractFile(p.asar, native(rel))) === hash
    if (!ok) {
      const message = `The game's ${rel} is not the official ${expected.gameVersion} one.`
      if (!force) fail(`${message} Nothing was changed. Is another mod installed?`)
      console.warn(`  warning: ${message} Continuing because of --force.`)
    }
  }
}

/**
 * The marker of an install a game update has since undone, or null. The official updater
 * replaces `app.asar` but leaves this mod's own files where they are, so after an update the
 * marker and the backup still describe the old version: restoring that backup would put the old
 * game's code back over the new one.
 */
async function staleInstall(p) {
  const marker = JSON.parse(await readFile(p.marker, 'utf8').catch(() => 'null'))
  const manifest = JSON.parse(await readFile(p.manifest, 'utf8').catch(() => 'null'))
  if (!marker || !manifest || !marker.gameVersion) return null
  return marker.gameVersion !== manifest.version ? marker : null
}

/** Deletes what an install undone by a game update left behind: its backups and its marker. */
async function clearLeftovers(p, marker) {
  console.log(
    `  The game was updated after Photo Feature ${marker.modVersion} (for ${marker.gameVersion}) ` +
      'was installed, and the update removed it.'
  )
  console.log('  Clearing the files it left behind...')
  await rm(p.backup, { force: true })
  await rm(p.backupUnpacked, { recursive: true, force: true })
  await rm(p.marker, { force: true })
}

async function install(game, force) {
  const p = paths(game)
  if (existsSync(p.marker)) {
    const stale = await staleInstall(p)
    if (!stale) fail('The photo feature is already installed. Uninstall it first.')
    await clearLeftovers(p, stale)
  }
  if (!existsSync(p.asar)) fail('resources/app.asar is missing; this does not look like the game.')
  await checkOfficial(p, force)

  console.log('  Backing up the original game code...')
  await cp(p.asar, p.backup)
  if (existsSync(p.unpacked)) await cp(p.unpacked, p.backupUnpacked, { recursive: true })

  const work = await mkdtemp(join(tmpdir(), 'venus-photo-mod-'))
  try {
    console.log('  Adding the photo feature...')
    asar.extractAll(p.asar, work)
    for (const rel of expected.remove) await rm(join(work, rel), { force: true })
    for (const rel of expected.code) {
      await mkdir(dirname(join(work, rel)), { recursive: true })
      await cp(join(PAYLOAD, 'code', rel), join(work, rel))
    }
    await asar.createPackageWithOptions(work, p.asar, { unpack: UNPACK })
  } catch (error) {
    // Anything half-written goes back to the original before the error is reported.
    await cp(p.backup, p.asar)
    if (existsSync(p.backupUnpacked)) {
      await rm(p.unpacked, { recursive: true, force: true })
      await cp(p.backupUnpacked, p.unpacked, { recursive: true })
    }
    await rm(p.backup, { force: true })
    await rm(p.backupUnpacked, { recursive: true, force: true })
    fail(`Install failed and the game was put back as it was: ${error.message}`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }

  const workflowExisted = existsSync(p.workflow)
  await mkdir(dirname(p.workflow), { recursive: true })
  await cp(join(PAYLOAD, 'characterPhoto.json'), p.workflow)

  await writeFile(
    p.marker,
    JSON.stringify(
      { mod: expected.mod, modVersion: expected.modVersion, gameVersion: expected.gameVersion, workflowExisted },
      null,
      2
    )
  )
  console.log(`\n  Done. The photo feature is installed in:\n  ${game}\n`)
}

async function uninstall(game) {
  const p = paths(game)
  if (!existsSync(p.marker)) fail('The photo feature is not installed in this folder.')
  const stale = await staleInstall(p)
  if (stale) {
    await clearLeftovers(p, stale)
    if (!stale.workflowExisted) await rm(p.workflow, { force: true })
    console.log('\n  Done. Nothing needed restoring: the game is already the official version.\n')
    return
  }
  if (!existsSync(p.backup)) fail('The backup of the original game code is missing, so it cannot be restored.')
  const marker = JSON.parse(await readFile(p.marker, 'utf8'))

  console.log('  Restoring the original game code...')
  await rm(p.asar, { force: true })
  await rename(p.backup, p.asar)
  if (existsSync(p.backupUnpacked)) {
    await rm(p.unpacked, { recursive: true, force: true })
    await rename(p.backupUnpacked, p.unpacked)
  }
  if (!marker.workflowExisted) await rm(p.workflow, { force: true })
  await rm(p.marker, { force: true })
  console.log(`\n  Done. Venus University is back to the official version in:\n  ${game}\n`)
}

const [command, ...rest] = process.argv.slice(2)
const force = rest.includes('--force')
const given = rest.find((arg) => !arg.startsWith('--'))

console.log(`\n  ${expected.mod} ${expected.modVersion} (for Venus University ${expected.gameVersion})`)
console.log('  Close the game before continuing.\n')

if (command === 'install') await install(await findGame(given), force)
else if (command === 'uninstall') await uninstall(await findGame(given))
else fail('Usage: node patch.mjs install|uninstall [game folder] [--force]')
