// Regenerate only from the pinned official source, never from VE's prompt builders.
// Run from a checkout containing that commit: node test/fixtures/generate092PromptFixtures.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const upstream = '7615a5a6d3097c642ab07f2cf17167cb0c104bb9'
const git = args => execFileSync('git', ['-c', `safe.directory=${repo}`, ...args], {
  cwd: repo, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024
})
const files = new Set(git(['ls-tree', '-r', '--name-only', upstream, '--', 'src']).trim().split('\n'))
const resolveSource = name => [name, `${name}.ts`, `${name}.tsx`, `${name}.json`, `${name}/index.ts`]
  .find(file => files.has(file))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 've-upstream092-prompts-'))
const oracleFile = path.join(temp, 'upstream.cjs'), casesFile = path.join(temp, 'cases.cjs')
try {
  await build({
    stdin: { contents: [
      "export * from 'upstream:src/renderer/prompts/classPrompt.ts'",
      "export * from 'upstream:src/renderer/prompts/profilePrompt.ts'",
      "export { __fixtureTextingPersona } from 'upstream:src/renderer/prompts/textingPrompt.ts'"
    ].join('\n'), resolveDir: repo },
    outfile: oracleFile, bundle: true, platform: 'node', format: 'cjs',
    plugins: [{ name: 'pinned-upstream', setup(plugin) {
      plugin.onResolve({ filter: /^upstream:/ }, args => ({
        path: args.path.slice('upstream:'.length), namespace: 'upstream'
      }))
      plugin.onResolve({ filter: /.*/, namespace: 'upstream' }, args => {
        const name = args.path.startsWith('@shared/') ? `src/shared/${args.path.slice(8)}` :
          args.path.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(args.importer), args.path)) : null
        if (name === null) return { path: args.path, external: true }
        const resolved = resolveSource(name)
        if (!resolved) throw Error(`Missing pinned source: ${name}`)
        return { path: resolved, namespace: 'upstream' }
      })
      plugin.onLoad({ filter: /.*/, namespace: 'upstream' }, args => {
        let contents = git(['show', `${upstream}:${args.path}`])
        if (args.path === 'src/renderer/prompts/textingPrompt.ts') {
          contents += '\nexport const __fixtureTextingPersona = TEXTING_PERSONA\n'
        }
        return { contents, loader: args.path.endsWith('.json') ? 'json' : 'ts' }
      })
    } }]
  })
  await build({
    entryPoints: [path.join(repo, 'test/fixtures/newGamePromptCases.ts')], outfile: casesFile,
    bundle: true, platform: 'node', format: 'cjs', alias: { '@shared': path.join(repo, 'src/shared') }
  })
  const require = createRequire(import.meta.url)
  const oracle = require(oracleFile), cases = require(casesFile)
  const fixture = {
    upstream,
    generatedBy: 'test/fixtures/generate092PromptFixtures.mjs (all oracle dependencies read from pinned Git objects)',
    textingPersona: oracle.__fixtureTextingPersona,
    cases: cases.newGamePromptCases(oracle).map(({ name, request }) => ({
      name, sha256: cases.promptFingerprint(request)
    }))
  }
  fs.writeFileSync(path.join(repo, 'test/fixtures/upstream092PromptHashes.json'), JSON.stringify(fixture, null, 2) + '\n')
  console.log(`Wrote ${fixture.cases.length} official 0.9.2 request fingerprints and the texting persona.`)
} finally {
  for (const file of [oracleFile, casesFile]) if (fs.existsSync(file)) fs.unlinkSync(file)
  fs.rmdirSync(temp)
}
