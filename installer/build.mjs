import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { zipSync } from 'fflate'

/**
 * Builds the Venus Extracurriculars installer: a no-exe zip and a setup wizard that put a build
 * of this repository into an official Venus University folder, and take it out again.
 *
 * It compares two `out` folders of the game's code, the official release's and this build's,
 * and the download carries only what differs: every code file, and the files a mod adds (City
 * Life's backgrounds, say). A file of Venus Dev's that differs and is not code stops the build,
 * so none of his art, music or characters can end up in the download.
 *
 *   node build.mjs --base <official out> --build <this build's out> --game-version 0.4.0
 *                  --manifest <official resources/build-manifest.json>
 *                  [--build-version 0.1.0] [--out <folder>] [--assets <folder>]
 *
 * The game also keeps files outside its code, in `resources/assets`: the cast, the music, the
 * image workflows. The release's `build-manifest.json` lists every one with its hash, so the files
 * a mod adds there (Photo Feature's photo workflow, say) are found the same way, and one of Venus
 * Dev's own that differs stops the build.
 *
 * `--build-version` defaults to `BUILD.version` in `src/shared/mods.ts`.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const raw = (name) => {
  const at = process.argv.indexOf(`--${name}`)
  return at < 0 ? undefined : process.argv[at + 1]
}
const arg = (name) => {
  const value = raw(name)
  if (!value) throw new Error(`--${name} is required`)
  return value
}

/** The build's own name and version, as the main menu shows them. */
async function buildInfo() {
  const source = await readFile(join(ROOT, 'src', 'shared', 'mods.ts'), 'utf8')
  const found = source.match(/BUILD\s*=\s*\{\s*name:\s*'([^']+)',\s*version:\s*'([^']+)'/)
  if (!found) throw new Error('BUILD was not found in src/shared/mods.ts')
  return { name: found[1], version: found[2] }
}

const info = await buildInfo()
const BASE = arg('base')
const BUILD_OUT = arg('build')
const GAME_VERSION = arg('game-version')
const MANIFEST = arg('manifest')
/** The repository's assets folder; a test passes a small one of its own. */
const ASSETS = raw('assets') ?? join(ROOT, 'assets')
const VERSION = raw('build-version') ?? info.version
const NAME = info.name
const SLUG = NAME.replace(/\s+/g, '-')
// Where everything is written; a test passes its own folder.
const OUT = raw('out') ?? join(HERE, 'dist')
const DIST = join(OUT, `${SLUG.toLowerCase()}-${VERSION}`)
const SETUP = join(OUT, `${SLUG}-Setup-${VERSION}.exe`)
const FIXED_DATE = new Date('2026-01-01T00:00:00Z')

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

/** Every file under `dir`, `/`-joined and relative to it. */
async function files(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(relative(dir, join(entry.parentPath, entry.name)).replace(/\\/g, '/'))
  }
  return out.sort()
}

const CODE = /\.(js|mjs|cjs|css|html)$/

/**
 * What turns the official game code into this build's: the files to put in (every changed or
 * new code file, and every file only this build has), the ones to take out, and the hash every
 * official file touched must have in a player's game. Throws if one of the official files
 * differs or goes and is not code, so none of the game's own assets can be shipped.
 */
async function compare(baseDir, buildDir) {
  const baseFiles = new Set(await files(baseDir))
  const buildFiles = await files(buildDir)
  const put = []
  const added = []
  for (const rel of buildFiles) {
    if (!baseFiles.has(rel)) {
      put.push(rel)
      if (!CODE.test(rel)) added.push(rel)
      continue
    }
    const same = sha256(await readFile(join(buildDir, rel))) === sha256(await readFile(join(baseDir, rel)))
    if (same) continue
    if (!CODE.test(rel)) throw new Error(`${rel} is one of the game's own files, differs, and is not code.`)
    put.push(rel)
  }
  const buildSet = new Set(buildFiles)
  const remove = [...baseFiles].filter((rel) => !buildSet.has(rel))
  for (const rel of remove) {
    if (!CODE.test(rel)) throw new Error(`${rel} is one of the game's own files, is gone from the build, and is not code.`)
  }
  const base = {}
  for (const rel of [...put.filter((rel) => baseFiles.has(rel)), ...remove]) {
    base[`out/${rel}`] = sha256(await readFile(join(baseDir, rel)))
  }
  return { put, added, remove, base }
}

const { put, added, remove, base } = await compare(BASE, BUILD_OUT)

/**
 * The same text either way round: a checkout on Windows may have CRLF where the official game
 * ships LF (0.5.0 does), or the reverse. Line endings are the only difference allowed.
 */
function sameText(ours, theirs) {
  const lf = ours.toString('latin1').replace(/\r\n/g, '\n')
  const crlf = lf.replace(/\n/g, '\r\n')
  return [ours, Buffer.from(lf, 'latin1'), Buffer.from(crlf, 'latin1')].some((text) => sha256(text) === theirs)
}

/**
 * The files this build adds beside the game's code, in `resources/assets`. Only folders the
 * release itself ships from the repository and the community sound folder are included.
 * The official cast and music come from the player's game. A differing official file stops the build.
 */
async function externals() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  if (manifest.version !== GAME_VERSION) {
    throw new Error(`${MANIFEST} is ${manifest.version}, not ${GAME_VERSION}.`)
  }
  const PREFIX = 'resources/assets/'
  const official = new Map(manifest.files.filter((f) => f.rel.startsWith(PREFIX)).map((f) => [f.rel, f.sha256]))
  const shipped = new Set([...official.keys()].map((rel) => rel.slice(PREFIX.length).split('/')[0]))
  shipped.delete('characters')
  shipped.delete('sound')
  const assets = ASSETS
  const found = []
  for (const rel of await files(assets)) {
    if ((!shipped.has(rel.split('/')[0]) && !rel.startsWith('sound/community/')) || /(^|\/)(\.gitkeep|README\.md)$/.test(rel)) continue
    const theirs = official.get(PREFIX + rel)
    const ours = await readFile(join(assets, rel))
    if (theirs === undefined) found.push({ rel: PREFIX + rel, sha256: sha256(ours) })
    else if (!sameText(ours, theirs)) throw new Error(`${PREFIX + rel} is one of the game's own files and differs.`)
  }
  return found
}

const external = await externals()
console.log(`  ${put.length} files to put in (${added.length} of them added assets), ${remove.length} to take out.`)
console.log(`  ${external.length} added beside the code.`)
for (const { rel } of external) console.log(`    beside: ${rel}`)
for (const rel of added) console.log(`    added: ${rel}`)

await rm(DIST, { recursive: true, force: true })
await mkdir(join(DIST, 'payload', 'files'), { recursive: true })
for (const { rel } of external) {
  await mkdir(dirname(join(DIST, 'payload', 'external', rel)), { recursive: true })
  await cp(join(ASSETS, rel.slice('resources/assets/'.length)), join(DIST, 'payload', 'external', rel))
}
for (const rel of put) {
  await mkdir(dirname(join(DIST, 'payload', 'files', 'out', rel)), { recursive: true })
  await cp(join(BUILD_OUT, rel), join(DIST, 'payload', 'files', 'out', rel))
}
await writeFile(
  join(DIST, 'payload', 'expected.json'),
  JSON.stringify(
    {
      build: NAME,
      buildVersion: VERSION,
      gameVersion: GAME_VERSION,
      base,
      put: put.map((rel) => `out/${rel}`),
      remove: remove.map((rel) => `out/${rel}`),
      // Beside the code, relative to the game folder.
      external
    },
    null,
    2
  )
)

// One file, nothing to install: the archive library is bundled into it.
await build({
  entryPoints: [join(HERE, 'patch.mjs')],
  outfile: join(DIST, 'patch.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  // Only reached inside Electron; under Node the library takes plain `fs`.
  external: ['original-fs'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning'
})

// The patch and what it installs, zipped in a fixed order with fixed dates, so the same inputs
// always give the same zip and the same hash.
const entries = {}
for (const rel of await files(DIST)) entries[rel] = [await readFile(join(DIST, rel)), { mtime: FIXED_DATE }]
const payload = zipSync(entries, { level: 9 })
const payloadPath = join(OUT, `payload-${VERSION}.zip`)
await writeFile(payloadPath, payload)

// Text the player reads, with Windows line endings whatever the checkout has.
const crlf = (text) => text.replace(/\r?\n/g, '\r\n')
const fill = (text) =>
  crlf(text)
    .replaceAll('{{NAME}}', NAME)
    .replaceAll('{{VERSION}}', VERSION)
    .replaceAll('{{GAME_VERSION}}', GAME_VERSION)

// The same patch without an exe: two small launchers that run it on the game's own exe, the
// patch and what it installs, all readable before anything is run. Antivirus tools flag an
// unsigned exe that unpacks a zip and rewrites another program's files, which is what the
// wizard is; this is the download to offer.
const NO_EXE = `${SLUG}-${VERSION}`
const noExe = {}
for (const [rel, entry] of Object.entries(entries)) noExe[`${NO_EXE}/${rel}`] = entry
for (const name of ['Install.cmd', 'Uninstall.cmd']) {
  noExe[`${NO_EXE}/${name}`] = [Buffer.from(fill(await readFile(join(HERE, 'files', name), 'utf8'))), { mtime: FIXED_DATE }]
}
noExe[`${NO_EXE}/README.txt`] = [
  Buffer.from(fill(await readFile(join(HERE, 'files', 'README-no-exe.txt'), 'utf8'))),
  { mtime: FIXED_DATE }
]
const noExeName = `${NO_EXE}-no-exe.zip`
const noExeZip = zipSync(noExe, { level: 9 })
await writeFile(join(OUT, noExeName), noExeZip)
await writeFile(join(OUT, 'SHA256-no-exe.txt'), `${sha256(noExeZip)}  ${noExeName}\r\n`)
await writeFile(join(OUT, 'README.txt'), fill(await readFile(join(HERE, 'files', 'README.txt'), 'utf8')))

// The wizard, told which build it carries.
const source = (await readFile(join(HERE, 'Setup.cs'), 'utf8'))
  .replace(/BuildName = "[^"]*"/, `BuildName = "${NAME}"`)
  .replace(/BuildVersion = "[^"]*"/, `BuildVersion = "${VERSION}"`)
  .replace(/GameVersion = "[^"]*"/, `GameVersion = "${GAME_VERSION}"`)
  .replace(/PayloadHash = "[0-9a-f]{64}"/, `PayloadHash = "${sha256(payload)}"`)
const generated = join(OUT, 'Setup.generated.cs')
await writeFile(generated, source)

// Compiled on Windows, with Windows' own C# compiler: an exe Mono compiles elsewhere works, but
// Windows Defender blocks it. Built anywhere else, `dist/` gets `build-setup.cmd` instead, which
// finishes the job on a Windows PC with nothing installed.
const exeName = relative(OUT, SETUP)
const references = ['System.Windows.Forms.dll', 'System.Drawing.dll', 'System.IO.Compression.dll']
const cscArgs = (dir) => [
  '/nologo', '/target:winexe', '/optimize+', `/out:${dir}${exeName}`,
  ...references.map((dll) => `/reference:${dll}`),
  `/resource:${dir}payload-${VERSION}.zip,ModPayload`, `${dir}Setup.generated.cs`
]
await rm(SETUP, { force: true })
const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
if (process.platform === 'win32' && existsSync(csc)) {
  execFileSync(csc, cscArgs(OUT + '\\'), { stdio: 'inherit' })
  await writeFile(join(OUT, 'SHA256.txt'), `${sha256(await readFile(SETUP))}  ${exeName}\n`)
} else {
  const quoted = cscArgs('%~dp0').map((arg) => (arg.includes('%~dp0') ? `"${arg}"` : arg)).join(' ')
  await writeFile(
    join(OUT, 'build-setup.cmd'),
    [
      '@echo off',
      `rem Builds the ${NAME} setup with the C# compiler that comes with Windows.`,
      'set "CSC=%WINDIR%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"',
      'if not exist "%CSC%" set "CSC=%WINDIR%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"',
      `"%CSC%" ${quoted}`,
      'if errorlevel 1 (echo. & echo Build failed. & pause & exit /b 1)',
      // certutil prints the file's full path on its first line; only the hash is kept.
      'set "HASH="',
      `for /f "skip=1 delims=" %%h in ('certutil -hashfile "%~dp0${exeName}" SHA256') do if not defined HASH set "HASH=%%h"`,
      `> "%~dp0SHA256.txt" echo %HASH%  ${exeName}`,
      `echo. & echo Built ${exeName}`,
      'pause',
      ''
    ].join('\r\n')
  )
}
console.log(existsSync(SETUP) ? `  Built ${relative(HERE, SETUP)}` : `  Ready in ${relative(HERE, OUT)}: run build-setup.cmd on Windows`)
console.log(`  no-exe zip: ${noExeName}`)
