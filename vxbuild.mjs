// Test-only: builds an in-repo mod as an installed release. node vxbuild.mjs <repo> <id> <out>
import { build } from 'esbuild'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, renameSync } from 'fs'
import { join, relative } from 'path'
import { pathToFileURL } from 'url'
const [repo, id, out] = process.argv.slice(2)
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
const alias = { '@shared': join(repo, 'src/shared') }
const kitExternal = ['@vx/modkit/shared', '@vx/modkit/renderer', '@vx/modkit/main']
const common = { bundle: true, absWorkingDir: repo, alias, metafile: true, logLevel: 'warning', jsx: 'automatic', loader: { '.png': 'dataurl', '.webp': 'dataurl', '.svg': 'dataurl', '.json': 'json' } }
const inputs = new Set(); const kitNames = new Set()
const stub = process.env.STUB ? [{ name: 'stub', setup(b) { b.onResolve({ filter: new RegExp(process.env.STUB) }, () => ({ path: 'stub', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export function EchoPanel() { return null }', loader: 'js' })) } }] : []
const r = await build({ ...common, plugins: stub, entryPoints: [join(repo, `src/renderer/modEntries/${id}.ts`)], format: 'esm', platform: 'browser', outfile: join(out, 'renderer.js'), external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'motion/react', ...kitExternal] })
Object.keys(r.metafile.inputs).forEach((f) => inputs.add(f))
if (existsSync(join(out, 'renderer.css'))) renameSync(join(out, 'renderer.css'), join(out, 'style.css'))
const js = readFileSync(join(out, 'renderer.js'), 'utf8')
for (const m of js.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@vx\/modkit\/(renderer|shared)"/g)) for (const n of m[1].split(',')) { const name = n.trim().split(/\s+as\s+/)[0]; if (name && !/^type /.test(name)) kitNames.add(`${m[2]}:${name}`) }
const table = readFileSync(join(repo, 'packages/modkit/src/shared/hookTable.ts'), 'utf8')
const hookNames = [...table.matchAll(/\{ name: '([^']+)', side: '(?:renderer|shared|main)'/g)].map((m) => m[1])
const entrySrc = [...inputs].filter((f) => !f.includes('node_modules') && !f.includes(':')).map((f) => readFileSync(join(repo, f), 'utf8')).join('\n')
for (const h of hookNames) if (new RegExp(`^\\s*${h}\\s*[:(,]`, 'm').test(entrySrc) && /registerHooks/.test(entrySrc)) kitNames.add(h)
const mainEntry = join(repo, `src/main/modEntries/${id}.ts`)
let hasMain = false
if (existsSync(mainEntry)) {
  hasMain = true
  const wrap = join(out, '_main.ts')
  writeFileSync(wrap, `import * as m from ${JSON.stringify(mainEntry)}\nconst f = Object.values(m).find((v) => typeof v === 'function') as () => object\nmodule.exports = f()\n`)
  const mr = await build({ ...common, entryPoints: [wrap], format: 'cjs', platform: 'node', outfile: join(out, 'main.js'), external: ['electron', ...kitExternal] })
  Object.keys(mr.metafile.inputs).forEach((f) => inputs.add(f))
  rmSync(wrap)
  const mjs = readFileSync(join(out, 'main.js'), 'utf8')
  for (const m of mjs.matchAll(/require\("@vx\/modkit\/(main|shared)"\)/g)) kitNames.add(`${m[1]}:*`)
}
// The ModDef, evaluated.
const defOut = join(out, '_def.mjs')
await build({ ...common, metafile: false, entryPoints: [join(repo, `src/shared/modEntries/${id}.ts`)], format: 'esm', platform: 'node', outfile: defOut, external: kitExternal, plugins: [{ name: 'kitstub', setup(b) { b.onResolve({ filter: /^@vx\/modkit/ }, () => ({ path: 'kit', namespace: 'kit' })); b.onLoad({ filter: /.*/, namespace: 'kit' }, () => ({ contents: 'module.exports = new Proxy({}, { get: () => () => {} })', loader: 'js' })) } }] })
const def = (await import(pathToFileURL(defOut).href)).default
rmSync(defOut)
const manifest = { manifest: 1, id: def.id, name: def.name, author: def.author, version: def.version, blurb: def.blurb, source: 'https://github.com/venus-extracurriculars/build', kit: '0.7.0', hooks: [...new Set([...(def.hooks ?? []), ...kitNames])].filter((h) => !h.endsWith(':*')).sort(), main: hasMain, scope: def.scope, defaultOn: def.defaultOn, ...(def.offNote ? { offNote: def.offNote } : {}), ...(def.options ? { options: def.options } : {}), ...(def.optionGroups ? { optionGroups: def.optionGroups } : {}), ...(def.requires ? { requires: def.requires } : {}), ...(def.optional ? { optional: def.optional } : {}), ...(def.dataPath ? { dataPath: def.dataPath } : {}) }
writeFileSync(join(out, 'vxmod.json'), JSON.stringify(manifest, null, 2))
// Which game files went into the bundle, beyond the mod's own.
const own = JSON.parse(process.env.OWN_GLOBS ?? '[]').map((g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*') + '$'))
const entries = [`src/renderer/modEntries/${id}.ts`, `src/main/modEntries/${id}.ts`, `src/shared/modEntries/${id}.ts`]
const leaks = [...inputs].map((f) => relative(repo, join(repo, f))).filter((f) => !f.includes('node_modules') && !f.startsWith('..') && !f.startsWith('/') && !entries.includes(f) && !own.some((g) => g.test(f)))
const kitLeak = [...inputs].filter((f) => f.includes('packages/modkit'))
console.log(JSON.stringify({ hooks: manifest.hooks, main: hasMain, gameFilesBundled: leaks, kitSourceBundled: kitLeak.length, def: Object.keys(def) }, null, 1))
