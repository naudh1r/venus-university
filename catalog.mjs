// Fills each mod's cover and screenshots in catalog.json from its art folder:
//   art/<id>/cover.(webp|png|jpg|jpeg)
//   art/<id>/screenshots/*.(webp|png|jpg|jpeg)  in file-name order, at most eight
//   art/<id>/screenshots/captions.txt           optional, one "file name: caption" per line
// Run from this folder: node catalog.mjs
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE = 'https://raw.githubusercontent.com/naudh1r/venus-university/notes/standalone-mods'
const IMAGE = /\.(webp|png|jpe?g)$/i
const MAX_BYTES = 1024 * 1024
const MAX_SHOTS = 8

const catalog = JSON.parse(readFileSync('catalog.json', 'utf8'))
let warnings = 0
const warn = (line) => { warnings += 1; console.warn(`  ! ${line}`) }

/** Whether a file is small enough for the game to fetch, warning where it is not. */
function fits(path) {
  if (statSync(path).size <= MAX_BYTES) return true
  warn(`${path} is over 1 MB, so the game would not show it: left out`)
  return false
}

for (const mod of catalog.mods) {
  const dir = join('art', mod.id)
  console.log(mod.id)

  const cover = existsSync(dir) ? readdirSync(dir).find((name) => /^cover\./i.test(name) && IMAGE.test(name)) : undefined
  if (cover && fits(join(dir, cover))) mod.cover = `${BASE}/art/${mod.id}/${cover}`
  else delete mod.cover
  console.log(`  cover: ${mod.cover ? cover : 'none (the page draws its own)'}`)

  const shotsDir = join(dir, 'screenshots')
  const captions = {}
  const captionFile = join(shotsDir, 'captions.txt')
  if (existsSync(captionFile)) {
    for (const line of readFileSync(captionFile, 'utf8').split(/\r?\n/)) {
      const at = line.indexOf(':')
      if (at > 0 && line.slice(at + 1).trim()) captions[line.slice(0, at).trim()] = line.slice(at + 1).trim()
    }
  }
  const files = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((name) => IMAGE.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    : []
  if (files.length > MAX_SHOTS) warn(`${files.length} screenshots in ${shotsDir}: only the first ${MAX_SHOTS} are listed`)
  for (const name of Object.keys(captions)) if (!files.includes(name)) warn(`captions.txt names ${name}, which is not in ${shotsDir}`)
  const shots = files.slice(0, MAX_SHOTS).filter((name) => fits(join(shotsDir, name))).map((name) => ({
    url: `${BASE}/art/${mod.id}/screenshots/${name}`,
    ...(captions[name] ? { caption: captions[name] } : {})
  }))
  if (shots.length) mod.screenshots = shots
  else delete mod.screenshots
  console.log(`  screenshots: ${shots.length}`)
}

writeFileSync('catalog.json', JSON.stringify(catalog, null, 2) + '\n')
console.log(warnings ? `catalog.json written, with ${warnings} warning(s)` : 'catalog.json written')
