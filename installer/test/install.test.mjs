// The patch against a tiny stand-in for the game, no game needed. Run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import asar from '@electron/asar'

const HERE = dirname(fileURLToPath(import.meta.url))
const INSTALLER = join(HERE, '..')
const GAME_VERSION = '9.9.9'
const WORKFLOW = 'resources/assets/workflows/characterPhoto.json'
const COMMUNITY_MUSIC = ['first-mod/opening.mp3', 'another-mod/arrival.ogg', 'later-added-track.wav']
const NATIVE_FILES = [
  'node_modules/7zip-bin/win/x64/7za.exe',
  'node_modules/sharp/lib/index.js',
  'node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node',
  'node_modules/@img/sharp-win32-x64/lib/libvips-42.dll'
]
const sha = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')

async function put(path, text) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
}

/**
 * An official `out`, this build's `out` (one code file changed), a repository `assets` folder
 * with one file of the game's own and one a mod adds, and a game folder made of the official side.
 */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 've-installer-test-'))
  for (const [side, code] of [['base', 'official'], ['build', 'modded']]) {
    await put(join(root, side, 'out/main/index.js'), `console.log('${code}')\n`)
    await put(join(root, side, 'out/renderer/picture.png'), 'not really a picture')
  }
  await put(join(root, 'assets/workflows/characterBase.json'), '{\n  "base": true\n}\n')
  await put(join(root, 'assets/workflows/characterPhoto.json'), '{ "photo": true }\n')
  for (const name of COMMUNITY_MUSIC) await put(join(root, 'assets/sound/community', name), `community audio: ${name}`)
  await put(join(root, 'assets/sound/music/official-track.mp3'), 'not for redistribution')

  const app = join(root, 'app')
  await put(join(app, 'package.json'), '{"name":"venus-university","main":"out/main/index.js"}')
  await put(join(app, 'out/main/index.js'), "console.log('official')\n")
  await put(join(app, 'out/renderer/picture.png'), 'not really a picture')
  for (const rel of NATIVE_FILES) await put(join(app, rel), `native fixture: ${rel}`)
  const game = join(root, 'game')
  const res = join(game, 'resources')
  await mkdir(res, { recursive: true })
  await asar.createPackageWithOptions(app, join(res, 'app.asar'), {
    unpack: '**/node_modules/{7zip-bin,sharp,@img}/**'
  })
  // The game's own workflow, as the release ships it: built on Windows.
  await put(join(res, 'assets/workflows/characterBase.json'), '{\r\n  "base": true\r\n}\r\n')
  await writeFile(join(game, 'Venus University.exe'), 'stand-in')
  const manifest = {
    version: GAME_VERSION,
    files: [
      { rel: 'resources/app.asar', sha256: await sha(join(res, 'app.asar')) },
      { rel: 'resources/assets/workflows/characterBase.json', sha256: await sha(join(res, 'assets/workflows/characterBase.json')) }
    ]
  }
  await writeFile(join(res, 'build-manifest.json'), JSON.stringify(manifest))
  await copyFile(join(res, 'app.asar'), join(root, 'official.asar'))

  const out = join(root, 'dist')
  execFileSync(process.execPath, [
    join(INSTALLER, 'build.mjs'), '--base', join(root, 'base/out'), '--build', join(root, 'build/out'),
    '--game-version', GAME_VERSION, '--manifest', join(res, 'build-manifest.json'),
    '--assets', join(root, 'assets'), '--out', out
  ], { stdio: 'pipe' })
  const patch = join(out, (await readdir(out)).find((name) => name.startsWith('venus-extracurriculars-')), 'patch.mjs')
  return { root, game, res, patch }
}

function run(patch, command, game, fail) {
  // A URL, not a path: on Windows Node reads `C:\...` given to --import as a URL with a `c:` scheme.
  const args = [...(fail ? ['--import', pathToFileURL(join(HERE, 'fail-marker.mjs')).href] : []), patch, command, game]
  const result = spawnSync(process.execPath, args, { env: { ...process.env, FAIL: fail ?? '' }, encoding: 'utf8' })
  return { ...result, text: result.stdout + result.stderr }
}

/** Everything in the game folder with its hash, to compare before and after. */
async function snapshot(dir, base = dir) {
  const out = {}
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) Object.assign(out, await snapshot(path, base))
    else out[path.slice(base.length)] = await sha(path)
  }
  return out
}

for (const fail of ['write', 'rename']) {
  test(`a marker that fails to ${fail} leaves the game as it was`, async () => {
    const { root, game, patch } = await fixture()
    const before = await snapshot(game)
    const result = run(patch, 'install', game, fail)
    assert.notEqual(result.status, 0, result.text)
    assert.match(result.text, /put back as it was/)
    assert.deepEqual(await snapshot(game), before)
    assert.equal(run(patch, 'install', game).status, 0)
    await rm(root, { recursive: true, force: true })
  })
}

test('install puts the build and its added file in; uninstall restores the game exactly', async () => {
  const { root, game, res, patch } = await fixture()
  const before = await snapshot(game)
  assert.equal(run(patch, 'install', game).status, 0)
  const installed = join(root, 'installed')
  asar.extractAll(join(res, 'app.asar'), installed)
  assert.equal(await readFile(join(installed, 'out/main/index.js'), 'utf8'), "console.log('modded')\n")
  assert.equal(await readFile(join(game, WORKFLOW), 'utf8'), '{ "photo": true }\n')
  for (const name of COMMUNITY_MUSIC) {
    assert.equal(await readFile(join(res, 'assets/sound/community', name), 'utf8'), `community audio: ${name}`)
  }
  assert.equal(existsSync(join(res, 'assets/sound/music/official-track.mp3')), false)
  const again = run(patch, 'install', game)
  assert.notEqual(again.status, 0)
  assert.match(again.text, /already installed/)
  assert.equal(run(patch, 'uninstall', game).status, 0)
  assert.deepEqual(await snapshot(game), before)
  await rm(root, { recursive: true, force: true })
})

test('install keeps Sharp and its native libraries unpacked, and uninstall restores them', async () => {
  const { root, game, res, patch } = await fixture()
  const before = await snapshot(game)
  const result = run(patch, 'install', game)
  assert.equal(result.status, 0, result.text)
  for (const rel of NATIVE_FILES) {
    // A leftover file beside the archive is not sufficient: Electron follows its header flag.
    assert.equal(asar.statFile(join(res, 'app.asar'), join(...rel.split('/'))).unpacked, true, rel)
    assert.equal(await readFile(join(res, 'app.asar.unpacked', rel), 'utf8'), `native fixture: ${rel}`)
  }
  assert.equal(asar.statFile(join(res, 'app.asar'), join('out', 'main', 'index.js')).unpacked, undefined)
  assert.equal(run(patch, 'uninstall', game).status, 0)
  assert.deepEqual(await snapshot(game), before)
  await rm(root, { recursive: true, force: true })
})

test('a file already where an added one goes is set aside and put back', async () => {
  const { root, game, patch } = await fixture()
  await put(join(game, WORKFLOW), 'left by a mod installed on its own')
  const musicPath = join(game, 'resources/assets/sound/community', COMMUNITY_MUSIC[0])
  await put(musicPath, 'previous standalone community track')
  const before = await snapshot(game)
  assert.equal(run(patch, 'install', game).status, 0)
  assert.equal(await readFile(musicPath, 'utf8'), `community audio: ${COMMUNITY_MUSIC[0]}`)
  assert.equal(await readFile(join(game, WORKFLOW), 'utf8'), '{ "photo": true }\n')
  assert.equal(run(patch, 'uninstall', game).status, 0)
  assert.deepEqual(await snapshot(game), before)
  await rm(root, { recursive: true, force: true })
})

test('code changed by something else: uninstall and reinstall refuse, and the backup stays', async () => {
  const { root, game, res, patch } = await fixture()
  assert.equal(run(patch, 'install', game).status, 0)
  const tampered = join(root, 'tampered')
  asar.extractAll(join(res, 'app.asar'), tampered)
  await writeFile(join(tampered, 'out/main/index.js'), "console.log('some other mod')\n")
  await asar.createPackage(tampered, join(res, 'app.asar'))
  const before = await snapshot(game)
  for (const command of ['uninstall', 'install']) {
    const result = run(patch, command, game)
    assert.notEqual(result.status, 0, result.text)
    assert.match(result.text, /not safe to restore or delete anything/)
    assert.deepEqual(await snapshot(game), before)
  }
  await rm(root, { recursive: true, force: true })
})

test('code replaced by the official version: uninstall clears what the build left', async () => {
  const { root, game, res, patch } = await fixture()
  const before = await snapshot(game)
  assert.equal(run(patch, 'install', game).status, 0)
  await copyFile(join(root, 'official.asar'), join(res, 'app.asar'))
  const result = run(patch, 'uninstall', game)
  assert.equal(result.status, 0, result.text)
  assert.match(result.text, /replaced by the official version/)
  assert.deepEqual(await snapshot(game), before)
  await rm(root, { recursive: true, force: true })
})

test('a file of the game\'s own that differs stops the build', async () => {
  const { root } = await fixture()
  await put(join(root, 'assets/workflows/characterBase.json'), '{ "changed": true }\n')
  assert.throws(() => execFileSync(process.execPath, [
    join(INSTALLER, 'build.mjs'), '--base', join(root, 'base/out'), '--build', join(root, 'build/out'),
    '--game-version', GAME_VERSION, '--manifest', join(root, 'game/resources/build-manifest.json'),
    '--assets', join(root, 'assets'), '--out', join(root, 'dist2')
  ], { stdio: 'pipe' }), /is one of the game's own files and differs/)
  await rm(root, { recursive: true, force: true })
})

test('the community audio folder cannot replace a different official track', async () => {
  const { root, res } = await fixture()
  const manifestPath = join(res, 'build-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.files.push({
    rel: `resources/assets/sound/community/${COMMUNITY_MUSIC[0]}`,
    sha256: createHash('sha256').update('an official track with the same name').digest('hex')
  })
  await writeFile(manifestPath, JSON.stringify(manifest))
  assert.throws(() => execFileSync(process.execPath, [
    join(INSTALLER, 'build.mjs'), '--base', join(root, 'base/out'), '--build', join(root, 'build/out'),
    '--game-version', GAME_VERSION, '--manifest', manifestPath,
    '--assets', join(root, 'assets'), '--out', join(root, 'dist2')
  ], { stdio: 'pipe' }), /is one of the game's own files and differs/)
  await rm(root, { recursive: true, force: true })
})
