import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { zipSync } from 'fflate'

/**
 * Builds a test add-on: a no-exe zip that installs one mod's test build on top of an installed
 * Venus Extracurriculars, and takes it out again.
 *
 *   node addon/build.mjs --base <Extracurriculars out> --build <test build out> \
 *                        --base-version 0.1.0 --name "Feed Comments test" --version 1
 *
 * `--base` is the `out` folder of the exact Extracurriculars release players have, best taken
 * from an installed one: `npx @electron/asar extract "<game>/resources/app.asar" ex`.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const arg = (name) => {
  const at = process.argv.indexOf(`--${name}`)
  const value = at < 0 ? undefined : process.argv[at + 1]
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

const BASE = arg('base')
const BUILD_OUT = arg('build')
const BASE_VERSION = arg('base-version')
const NAME = arg('name')
const VERSION = arg('version')
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const OUT = join(HERE, 'dist')
const FOLDER = `${SLUG}-${VERSION}`
const DIST = join(OUT, FOLDER)
const FIXED_DATE = new Date('2026-01-01T00:00:00Z')

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

async function files(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(relative(dir, join(entry.parentPath, entry.name)).replace(/\\/g, '/'))
  }
  return out.sort()
}

const CODE = /\.(js|mjs|cjs|css|html)$/

// Only code may differ between the two builds: a test add-on brings no art.
const baseFiles = new Set(await files(BASE))
const buildFiles = await files(BUILD_OUT)
const put = []
for (const rel of buildFiles) {
  if (baseFiles.has(rel) && sha256(await readFile(join(BUILD_OUT, rel))) === sha256(await readFile(join(BASE, rel)))) continue
  if (!CODE.test(rel)) throw new Error(`${rel} differs or is new and is not code.`)
  put.push(rel)
}
const buildSet = new Set(buildFiles)
const remove = [...baseFiles].filter((rel) => !buildSet.has(rel))
for (const rel of remove) if (!CODE.test(rel)) throw new Error(`${rel} is gone and is not code.`)
const base = {}
for (const rel of [...put.filter((rel) => baseFiles.has(rel)), ...remove]) {
  base[`out/${rel}`] = sha256(await readFile(join(BASE, rel)))
}
console.log(`  ${put.length} files to put in, ${remove.length} to take out.`)

await rm(DIST, { recursive: true, force: true })
await mkdir(join(DIST, 'payload', 'files'), { recursive: true })
for (const rel of put) {
  await mkdir(dirname(join(DIST, 'payload', 'files', 'out', rel)), { recursive: true })
  await cp(join(BUILD_OUT, rel), join(DIST, 'payload', 'files', 'out', rel))
}
await writeFile(
  join(DIST, 'payload', 'expected.json'),
  JSON.stringify(
    {
      name: NAME,
      slug: SLUG,
      version: VERSION,
      baseBuild: 'Venus Extracurriculars',
      baseVersion: BASE_VERSION,
      base,
      put: put.map((rel) => `out/${rel}`),
      remove: remove.map((rel) => `out/${rel}`)
    },
    null,
    2
  )
)

await build({
  entryPoints: [join(HERE, 'patch.mjs')],
  outfile: join(DIST, 'patch.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  external: ['original-fs'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning'
})

// The launchers are the build's own, named for this add-on.
const crlf = (text) => text.replace(/\r?\n/g, '\r\n')
const fill = (text) =>
  crlf(text)
    .replaceAll('venus-extracurriculars-', `${SLUG}-`)
    .replaceAll('{{NAME}}', NAME)
    .replaceAll('{{VERSION}}', VERSION)
    .replaceAll('{{BASE}}', `Venus Extracurriculars ${BASE_VERSION}`)

const zip = {}
for (const rel of await files(DIST)) zip[`${FOLDER}/${rel}`] = [await readFile(join(DIST, rel)), { mtime: FIXED_DATE }]
for (const name of ['Install.cmd', 'Uninstall.cmd']) {
  zip[`${FOLDER}/${name}`] = [Buffer.from(fill(await readFile(join(HERE, '..', 'files', name), 'utf8'))), { mtime: FIXED_DATE }]
}
zip[`${FOLDER}/README.txt`] = [Buffer.from(fill(await readFile(join(HERE, 'README.txt'), 'utf8'))), { mtime: FIXED_DATE }]
const zipName = `${FOLDER}.zip`
const bytes = zipSync(zip, { level: 9 })
await writeFile(join(OUT, zipName), bytes)
console.log(`  ${join(OUT, zipName)}\n  sha256 ${sha256(bytes)}`)
