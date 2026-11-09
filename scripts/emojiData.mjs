// Builds src/renderer/components/emojiData.json, the emoji picker's catalogue, from Unicode's
// emoji-test.txt: node scripts/emojiData.mjs path/to/emoji-test.txt
// Kept to Emoji 15.0, what Windows 11's font draws, and without country flags, which Windows
// draws as two letters. A hand or a person is marked toneable where its five skin tones are the
// tone inserted after its first code point, which is how the picker builds them.
import { readFileSync, writeFileSync } from 'node:fs'

const MAX_VERSION = 15.0
const TONES = [0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff]
const GROUPS = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'people',
  'Animals & Nature': 'nature',
  'Food & Drink': 'food',
  'Activities': 'activities',
  'Travel & Places': 'travel',
  'Objects': 'objects',
  'Symbols': 'symbols',
  'Flags': 'symbols'
}
const SKIPPED_SUBGROUPS = new Set(['country-flag', 'subdivision-flag'])

const text = readFileSync(process.argv[2], 'utf8')
const all = new Map()
const rows = []
let group = null
let subgroup = null
for (const line of text.split('\n')) {
  if (line.startsWith('# group: ')) group = line.slice(9).trim()
  else if (line.startsWith('# subgroup: ')) subgroup = line.slice(12).trim()
  const match = line.match(/^([0-9A-F ]+?)\s*; fully-qualified\s*# (\S+) E(\d+\.\d+) (.+)$/)
  if (!match) continue
  const [, , emoji, version, name] = match
  all.set(emoji, name)
  if (!GROUPS[group] || SKIPPED_SUBGROUPS.has(subgroup) || Number(version) > MAX_VERSION) continue
  // A toned variant is listed under its base, which carries the tones instead.
  if ([...emoji].some((char) => TONES.includes(char.codePointAt(0)))) continue
  rows.push({ group: GROUPS[group], emoji, name })
}

function toned(emoji, tone) {
  const points = [...emoji].map((char) => char.codePointAt(0))
  const rest = points[1] === 0xfe0f ? points.slice(2) : points.slice(1)
  return String.fromCodePoint(points[0], tone, ...rest)
}

const out = Object.fromEntries(Object.values(GROUPS).map((id) => [id, []]))
let toneable = 0
for (const { group, emoji, name } of rows) {
  const tones = TONES.every((tone) => all.has(toned(emoji, tone)))
  if (tones) toneable++
  out[group].push(tones ? [emoji, name, 1] : [emoji, name])
}
writeFileSync(
  new URL('../src/renderer/components/emojiData.json', import.meta.url),
  JSON.stringify(out)
)
console.log(`${rows.length} emoji, ${toneable} toneable`)
