import { existsSync, globSync, readFileSync, statSync } from 'fs'
import { builtinModules } from 'module'
import { posix } from 'path'

/**
 * The import-boundary scanner: reads source text, finds every import, and says which ones reach
 * past what a mod may touch. A mod file may import the kit's entry for its side (and `shared`),
 * React and `motion` in the window, Node and Electron in the main process, its own mod's files,
 * the files of a mod it requires, and any other package (bundled with it). Nothing else of the
 * game: not `@shared`, not a path into `src/`, not the kit's host side. The other way round, no
 * game file imports a mod's file, except core's registries loading the entries.
 */

export type Side = 'shared' | 'renderer' | 'main' | 'preload'

/** One mod's files: globs from the repo's root, and the ids of the mods it requires. */
export interface ModSet {
  readonly globs: readonly string[]
  readonly requires?: readonly string[]
}

export interface Violation {
  readonly file: string
  readonly specifier: string
  readonly reason: string
}

/** An import of a required mod's file: allowed, and reported so the dependency is visible. */
export interface RequiredImport {
  readonly file: string
  readonly specifier: string
  readonly mod: string
}

export interface ScanResult {
  /** The code files scanned, repo-relative. */
  readonly files: readonly string[]
  readonly violations: readonly Violation[]
  readonly required: readonly RequiredImport[]
}

const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const RESOLVED = ['', '.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json', '.d.ts', '/index.ts', '/index.tsx']
const NODE = new Set(builtinModules)

/**
 * The source with its comments blanked, strings left alone: a `/*` inside a glob pattern or a
 * `//` inside an address is not a comment. (A regex literal holding either loses the rest of its
 * line, which no import shares.)
 */
export function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const two = source.slice(i, i + 2)
    const one = source[i]
    if (two === '//') {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
    } else if (one === "'" || one === '"' || one === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== one) j += source[j] === '\\' ? 2 : 1
      out += source.slice(i, j + 1)
      i = j + 1
    } else {
      out += one
      i += 1
    }
  }
  return out
}

/** Every module specifier a source imports, exports from, loads with `import()` or globs. */
export function importsOf(source: string): string[] {
  const code = stripComments(source)
  const found: string[] = []
  for (const pattern of [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  ]) {
    for (const match of code.matchAll(pattern)) found.push(match[1])
  }
  for (const match of code.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g)) {
    for (const spec of match[1].matchAll(/['"]([^'"]+)['"]/g)) found.push(spec[1])
  }
  return found
}

/** Where a file runs, from the first `shared`, `renderer`, `main` or `preload` folder on its path. */
export function sideOf(file: string): Side {
  for (const segment of file.split('/')) {
    if (segment === 'shared' || segment === 'renderer' || segment === 'main' || segment === 'preload') return segment
  }
  return 'shared'
}

function files(root: string, globs: readonly string[]): string[] {
  return globSync([...globs], { cwd: root })
    .map((file) => file.split('\\').join('/'))
    .filter((file) => statSync(posix.join(root, file)).isFile())
}

/** The entry files of `src/{shared,renderer,main}/modEntries`, by mod id; `index.ts` is core's. */
export function entryMods(root: string): Record<string, ModSet> {
  const mods: Record<string, { globs: string[]; requires: string[] }> = {}
  const entries = files(root, ['src/shared/modEntries/*.ts', 'src/renderer/modEntries/*.ts', 'src/main/modEntries/*.ts'])
  for (const file of entries) {
    const id = posix.basename(file, '.ts')
    if (id === 'index') continue
    const mod = (mods[id] ??= { globs: [], requires: [] })
    mod.globs.push(file)
    // The entry's `requires`, read off the text so no mod's code is loaded.
    const requires = readFileSync(posix.join(root, file), 'utf8').match(/\brequires\s*:\s*\[([^\]]*)\]/)
    for (const match of (requires?.[1] ?? '').matchAll(/['"]([^'"]+)['"]/g)) mod.requires.push(match[1])
  }
  return mods
}

/** Each mod file's owner, by repo-relative path. */
function ownerMap(root: string, mods: Record<string, ModSet>): Map<string, string> {
  const owner = new Map<string, string>()
  for (const [id, mod] of Object.entries(mods)) {
    for (const file of files(root, mod.globs)) owner.set(file, id)
  }
  return owner
}

/**
 * The mods an import reaches, `undefined` standing for a file no mod owns: a file's owner (none for
 * a file of the game's), every owner among the files a glob matches, or for a folder (or a glob
 * matching nothing) the owner of whatever is under it.
 */
function reach(root: string, owner: ReadonlyMap<string, string>): (target: string) => (string | undefined)[] {
  return (target) => {
    for (const suffix of RESOLVED) {
      const file = target + suffix
      const found = owner.get(file)
      if (found) return [found]
      if (existsSync(posix.join(root, file)) && statSync(posix.join(root, file)).isFile()) return [undefined]
    }
    const star = target.indexOf('*')
    if (star !== -1) {
      const matched = files(root, [target]).sort()
      if (matched.length > 0) return [...new Set(matched.map((file) => owner.get(file)))]
    }
    // A glob's folder is its path up to the last `/` before its first `*`: `a/b/*.ts` and
    // `a/b/c*.ts` are both under `a/b`.
    const dir = star === -1 ? target : target.slice(0, target.lastIndexOf('/', star))
    for (const [file, id] of owner) if (file.startsWith(`${dir}/`)) return [id]
    return [undefined]
  }
}

/** Scans every file of every mod, each against what its own mod may import. */
export function scanMods(root: string, mods: Record<string, ModSet>): ScanResult {
  const owner = ownerMap(root, mods)
  const ownersOf = reach(root, owner)
  const scanned: string[] = []
  const violations: Violation[] = []
  const required: RequiredImport[] = []
  for (const [file, id] of owner) {
    if (!CODE.test(file)) continue
    scanned.push(file)
    const side = sideOf(file)
    const requires = mods[id].requires ?? []
    for (const specifier of importsOf(readFileSync(posix.join(root, file), 'utf8'))) {
      const fail = (reason: string): void => void violations.push({ file, specifier, reason })
      if (side === 'preload') {
        fail('a mod has no preload code')
        continue
      }
      if (specifier.startsWith('.')) {
        const target = posix.normalize(posix.join(posix.dirname(file), specifier))
        for (const other of ownersOf(target)) {
          if (other === id) continue
          if (other === undefined) fail(`reaches outside the mod: \`${target}\``)
          else if (requires.includes(other)) required.push({ file, specifier, mod: other })
          else fail(`imports mod \`${other}\`, which it does not require`)
        }
        continue
      }
      if (specifier.startsWith('/')) {
        fail('an absolute path')
        continue
      }
      if (specifier.startsWith('@shared/')) {
        fail("core's `@shared`")
        continue
      }
      if (specifier.startsWith('@vx/modkit/')) {
        const entry = specifier.slice('@vx/modkit/'.length)
        if (entry.startsWith('host')) fail("the kit's host side")
        else if (entry !== 'shared' && entry !== 'renderer' && entry !== 'main') fail('not an entry point of the kit')
        else if (entry !== 'shared' && entry !== side) fail(`the kit's \`${entry}\` entry in a ${side} file`)
        continue
      }
      const name = specifier.replace(/^node:/, '')
      const bare = name.split('/')[0]
      if (bare === 'react' || bare === 'react-dom' || bare === 'motion') {
        if (side !== 'renderer') fail(`\`${bare}\` in a ${side} file`)
        continue
      }
      if (bare === 'electron' || NODE.has(bare)) {
        if (side !== 'main') fail(`\`${bare}\` in a ${side} file`)
        continue
      }
      // Any other package is the mod's own, bundled with it.
    }
  }
  return { files: scanned.sort(), violations, required }
}

/** Where the game's own code is: everything under `src/`, and the kit. */
export const GAME_FILES = ['src/**', 'packages/modkit/src/**']

/** The files through which core finds its in-repo mods. Each may import mods' entries. */
export const REGISTRIES = ['src/shared/mods.ts', 'src/renderer/mods/index.ts', 'src/main/modEntries/index.ts']

/**
 * The boundary from the game's side: no game file imports a mod's file, so nothing of the game
 * changes or breaks when a mod moves out. Core finds its in-repo mods only through its registries,
 * which may import a mod's entry (a file in a `modEntries` folder) and nothing else of it.
 */
export function scanGame(
  root: string,
  mods: Record<string, ModSet>,
  game: readonly string[] = GAME_FILES,
  registries: readonly string[] = REGISTRIES
): ScanResult {
  const owner = ownerMap(root, mods)
  const ownersOf = reach(root, owner)
  const scanned: string[] = []
  const violations: Violation[] = []
  for (const file of files(root, game)) {
    if (!CODE.test(file) || owner.has(file)) continue
    scanned.push(file)
    for (const specifier of importsOf(readFileSync(posix.join(root, file), 'utf8'))) {
      let target: string
      if (specifier.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(file), specifier))
      else if (specifier.startsWith('@shared/')) target = `src/shared/${specifier.slice('@shared/'.length)}`
      else continue
      if (registries.includes(file) && /(^|\/)modEntries\/[^/]+$/.test(target)) continue
      for (const mod of new Set(ownersOf(target))) {
        if (mod !== undefined) violations.push({ file, specifier, reason: `imports mod \`${mod}\`` })
      }
    }
  }
  return { files: scanned.sort(), violations, required: [] }
}

/**
 * The kit's own rule: only its `bridge/` files name core, and the rest import each other, React
 * and `motion`. A kit file reaching `@shared` or `src/` would be a hole in the boundary.
 */
export function scanKit(root: string): Violation[] {
  const base = 'packages/modkit/src'
  const violations: Violation[] = []
  for (const file of files(root, [`${base}/**/*.ts`, `${base}/**/*.tsx`])) {
    if (file.startsWith(`${base}/bridge/`)) continue
    for (const specifier of importsOf(readFileSync(posix.join(root, file), 'utf8'))) {
      const fail = (reason: string): void => void violations.push({ file, specifier, reason })
      if (specifier.startsWith('.')) {
        const target = posix.normalize(posix.join(posix.dirname(file), specifier))
        if (!target.startsWith(`${base}/`)) fail(`reaches outside the kit: \`${target}\``)
        continue
      }
      const bare = specifier.split('/')[0]
      if (bare !== 'react' && bare !== 'react-dom' && bare !== 'motion') fail('not the kit\'s to import')
    }
  }
  return violations
}
