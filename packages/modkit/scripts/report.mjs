// The kit's API report: `node scripts/report.mjs` regenerates `api/<entry>.api.md` and
// `dist/<entry>.d.ts` for each entry point; `--check` fails instead when a committed report is out
// of date, which is the PR's cue that the kit's surface, or a core type it hands over, changed.
//
// TypeScript 7 (the repo's) emits the declarations, api-extractor (its own TypeScript 5, a
// dependency of this package alone) rolls them up and writes the report.
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const check = process.argv.includes('--check')
const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(kit, '../..')
const temp = resolve(kit, 'temp')
const require = createRequire(import.meta.url)

if (!existsSync(resolve(kit, 'node_modules/@microsoft/api-extractor'))) {
  console.error('api-extractor is not installed: run `npm install` in packages/modkit once.')
  process.exit(2)
}
const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')

// 1. The declarations, with the repo's layout under temp/dts.
rmSync(temp, { recursive: true, force: true })
const tsc = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(kit, 'tsconfig.dts.json')],
  { cwd: kit, stdio: 'inherit' }
)
if (tsc.status !== 0) {
  console.error('tsc could not emit the declarations.')
  process.exit(tsc.status ?? 1)
}

// 2. A tsconfig for api-extractor's own TypeScript, pointed at the emitted declarations.
const dts = resolve(temp, 'dts')
writeFileSync(
  resolve(temp, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        jsx: 'preserve',
        lib: ['ESNext', 'DOM', 'DOM.Iterable'],
        types: ['node', 'vite/client'],
        typeRoots: [resolve(root, 'node_modules/@types')],
        baseUrl: dts,
        paths: { '@shared/*': ['src/shared/*'] }
      },
      include: [`${dts.split('\\').join('/')}/**/*.d.ts`]
    },
    null,
    2
  )
)

// 3. One report and one rollup per entry point.
let changed = false
for (const entry of ['shared', 'renderer', 'main']) {
  const config = ExtractorConfig.prepare({
    configObject: {
      projectFolder: kit,
      mainEntryPointFilePath: resolve(dts, 'packages/modkit/src', entry, 'index.d.ts'),
      bundledPackages: [],
      compiler: { tsconfigFilePath: resolve(temp, 'tsconfig.json') },
      apiReport: {
        enabled: true,
        reportFileName: `${entry}.api.md`,
        reportFolder: resolve(kit, 'api'),
        reportTempFolder: resolve(temp, 'api')
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: true, untrimmedFilePath: resolve(kit, 'dist', `${entry}.d.ts`) },
      tsdocMetadata: { enabled: false },
      messages: {
        compilerMessageReporting: { default: { logLevel: 'warning', addToApiReportFile: false } },
        extractorMessageReporting: {
          default: { logLevel: 'warning', addToApiReportFile: false },
          // Every type is reached through the bridge rather than exported from the entry, by design.
          'ae-forgotten-export': { logLevel: 'none' },
          // The report is about shapes; core's comments are not held to api-extractor's conventions.
          'ae-missing-release-tag': { logLevel: 'none' },
          'ae-undocumented': { logLevel: 'none' },
          'ae-unresolved-link': { logLevel: 'none' }
        },
        tsdocMessageReporting: { default: { logLevel: 'none' } }
      }
    },
    configObjectFullPath: resolve(kit, 'api-extractor.json'),
    packageJsonFullPath: resolve(kit, 'package.json')
  })
  mkdirSync(resolve(kit, 'api'), { recursive: true })
  const result = Extractor.invoke(config, { localBuild: !check, showVerboseMessages: false })
  if (!result.succeeded) {
    console.error(`api-extractor failed on the ${entry} entry.`)
    process.exit(1)
  }
  if (result.apiReportChanged) changed = true
}

// 4. Typecheck an actual external consumer against the rollups, not src/. The game's
// aliases and ambient augmentations can otherwise conceal missing public declarations.
const consumerConfig = resolve(temp, 'consumer.json')
writeFileSync(
  consumerConfig,
  JSON.stringify({
    compilerOptions: {
      target: 'esnext', module: 'esnext', moduleResolution: 'bundler',
      strict: true, skipLibCheck: false, noEmit: true,
      lib: ['ESNext', 'DOM', 'DOM.Iterable'], types: ['node'],
      typeRoots: [resolve(root, 'node_modules/@types')],
      paths: Object.fromEntries(['shared', 'renderer', 'main'].map(entry => [
        `@vx/modkit/${entry}`, [resolve(kit, 'dist', `${entry}.d.ts`)]
      ]))
    },
    files: [resolve(kit, 'test/consumer.ts')]
  }, null, 2)
)
const consumer = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', consumerConfig],
  { cwd: kit, stdio: 'inherit' }
)
if (consumer.status !== 0) {
  console.error('The rolled-up kit declarations do not compile for a standalone consumer.')
  process.exit(consumer.status ?? 1)
}

if (check && changed) {
  console.error('The API report is out of date: run `npm run report` in packages/modkit and commit api/.')
  process.exit(1)
}
console.log(check ? 'The API report is up to date.' : `The API report is written: ${readFileSync(resolve(kit, 'api/shared.api.md'), 'utf8').split('\n').length} lines for shared.`)
