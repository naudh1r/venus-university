import * as asar from '@electron/asar'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

/**
 * Installs a test build of one mod on top of an installed Venus Extracurriculars, and takes it
 * out again, so a player can try the mod before it is in a build.
 *
 * Extracurriculars has already swapped the game's code (`resources/app.asar`) for its own. This
 * swaps the code files the test build changes on top of that, after checking the installed build
 * is the exact one the test was made from. Uninstalling puts Extracurriculars' code back from the
 * copy made at install time; Extracurriculars' own backup of the official code is never touched.
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
const NAME = expected.name
const BASE = `${expected.baseBuild} ${expected.baseVersion}`

const paths = (game) => {
  const res = join(game, 'resources')
  return {
    res,
    asar: join(res, 'app.asar'),
    backup: join(res, `app.asar.${expected.slug}-backup`),
    marker: join(res, `${expected.slug}.json`),
    baseMarker: join(res, 'venus-extracurriculars.json'),
    manifest: join(res, 'build-manifest.json')
  }
}

/** A `/`-joined path inside the archive, in the form the archive reader looks it up by. */
const native = (rel) => rel.split('/').join(sep)

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8').catch(() => 'null'))

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

/** The game folder: given, or the folder the download was unpacked into, or asked for. */
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

/** Refuses a game that is not running exactly the Extracurriculars build the test was made from. */
async function checkBase(p) {
  const base = await readJson(p.baseMarker)
  if (!base) fail(`${expected.baseBuild} is not installed in this folder. Install ${BASE} first.`)
  if (base.buildVersion !== expected.baseVersion) {
    fail(`This test is for ${BASE}, but ${base.build} ${base.buildVersion} is installed. Nothing was changed.`)
  }
  if (base.asar !== (await hashFile(p.asar))) {
    fail(`The game's code is not ${BASE} as its installer left it. Nothing was changed.`)
  }
  const listed = new Set(asar.listPackage(p.asar).map((f) => f.replace(/\\/g, '/').replace(/^\//, '')))
  for (const [rel, hash] of Object.entries(expected.base)) {
    if (!listed.has(rel) || sha256(asar.extractFile(p.asar, native(rel))) !== hash) {
      fail(`The game's ${rel} is not the ${BASE} one. Nothing was changed.`)
    }
  }
}

/**
 * What became of an earlier install, judged from the code archive as it is now:
 * - 'installed': it is the archive the install left.
 * - 'replaced': it is no longer, but it is Extracurriculars' or the official one, so
 *   Extracurriculars was reinstalled or the game updated; the backup is stale.
 * - 'unknown': neither. Nothing is deleted or restored on a guess.
 */
async function installState(p) {
  const marker = await readJson(p.marker)
  if (!marker?.asar || !existsSync(p.asar)) return { state: 'unknown', marker }
  const now = await hashFile(p.asar)
  if (now === marker.asar) return { state: 'installed', marker }
  const base = await readJson(p.baseMarker)
  const manifest = await readJson(p.manifest)
  const official = manifest?.files?.find((f) => f.rel === 'resources/app.asar')?.sha256
  return { state: now === base?.asar || now === official ? 'replaced' : 'unknown', marker }
}

function refuseUnknown(p) {
  fail(
    `The game's code was changed after ${NAME} was installed, so it is not safe to restore or\n` +
      `  delete anything. Nothing was changed: the backup is still at ${p.backup}`
  )
}

async function clearLeftovers(p) {
  await rm(p.backup, { force: true })
  await rm(p.marker, { force: true })
}

async function install(game) {
  const p = paths(game)
  if (!existsSync(p.asar)) fail('resources/app.asar is missing; this does not look like the game.')
  if (existsSync(p.marker)) {
    const { state } = await installState(p)
    if (state === 'installed') fail(`${NAME} is already installed. Uninstall it first.`)
    if (state === 'unknown') refuseUnknown(p)
    await clearLeftovers(p)
  }
  await checkBase(p)

  console.log(`  ${BASE} is installed.`)
  console.log(`  Backing up its code...`)
  await cp(p.asar, p.backup)

  const work = await mkdtemp(join(tmpdir(), `${expected.slug}-`))
  try {
    console.log(`  Adding ${NAME}...`)
    asar.extractAll(p.asar, work)
    for (const rel of expected.remove) await rm(join(work, rel), { force: true })
    for (const rel of expected.put) {
      await mkdir(dirname(join(work, rel)), { recursive: true })
      await cp(join(PAYLOAD, 'files', rel), join(work, rel))
    }
    await asar.createPackageWithOptions(work, p.asar, { unpack: UNPACK })
    await writeFile(
      `${p.marker}.tmp`,
      JSON.stringify(
        {
          name: NAME,
          version: expected.version,
          base: BASE,
          // The archive as this install left it: uninstall restores the backup only over this.
          asar: await hashFile(p.asar)
        },
        null,
        2
      )
    )
    await rename(`${p.marker}.tmp`, p.marker)
  } catch (error) {
    await cp(p.backup, p.asar)
    await rm(`${p.marker}.tmp`, { force: true }).catch(() => {})
    await rm(p.marker, { force: true }).catch(() => {})
    await rm(p.backup, { force: true })
    fail(`Install failed and the game was put back as it was: ${error.message}`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }

  console.log(`\n  Done. ${NAME} is installed on top of ${BASE} in:\n  ${game}\n`)
  console.log(`  Turn it on from Mods on the main menu.`)
  console.log(`  Run this test's Uninstall.cmd before uninstalling ${expected.baseBuild}.\n`)
}

async function uninstall(game) {
  const p = paths(game)
  if (!existsSync(p.marker)) fail(`${NAME} is not installed in this folder.`)
  const { state } = await installState(p)
  if (state === 'unknown') refuseUnknown(p)
  if (state === 'replaced') {
    await clearLeftovers(p)
    console.log(`\n  ${NAME} was already gone from the game; its leftovers were cleared.\n`)
    return
  }
  if (!existsSync(p.backup)) fail(`The backup of ${BASE}'s code is missing, so it cannot be restored.`)

  console.log(`  Restoring ${BASE}...`)
  await rm(p.asar, { force: true })
  await rename(p.backup, p.asar)
  await rm(p.marker, { force: true })
  console.log(`\n  Done. The game is back to ${BASE} in:\n  ${game}\n`)
}

const [command, ...rest] = process.argv.slice(2)
const given = rest.find((arg) => !arg.startsWith('--'))

console.log(`\n  ${NAME} ${expected.version}, unofficial test (on top of ${BASE})`)
console.log('  Close the game before continuing.\n')

if (command === 'install') await install(await findGame(given))
else if (command === 'uninstall') await uninstall(await findGame(given))
else fail('Usage: node patch.mjs install|uninstall [game folder]')
