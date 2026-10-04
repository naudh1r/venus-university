import { pairBackgrounds } from '@shared/backgroundSets'
import type { CustomBackgroundListing } from '@shared/customBackgrounds'
import type { BackgroundSets, SaveSummary } from '@shared/types'

/**
 * Every shipped background and its thumbnail, resolved to bundled URLs at build time. A glob
 * because the base name is only known at runtime, which a `new URL(...)` cannot follow.
 */
const BG_URLS = import.meta.glob<string>('../../../assets/bg/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

/**
 * The full renders' quarter-scale WebP stand-ins, the rain renders' included, shipped so a grid
 * of them draws small.
 */
const BG_THUMB_URLS = import.meta.glob<string>('../../../assets/bg_thumbs/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default'
})

/** The glob's URLs re-keyed by bare `{base}_{day|night}` stem; bg ids carry no category. */
const BG_BY_STEM: Record<string, string> = Object.fromEntries(
  Object.entries(BG_URLS).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url])
)

/** The thumbnail glob's URLs, re-keyed the same way. */
const BG_THUMB_BY_STEM: Record<string, string> = Object.fromEntries(
  Object.entries(BG_THUMB_URLS).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -5),
    url
  ])
)

/** The shipped file names grouped by the category folder they sit in. */
const BG_NAMES_BY_CATEGORY: Record<string, string[]> = {}
for (const path of Object.keys(BG_URLS)) {
  const parts = path.split('/')
  const category = parts[parts.length - 2]
  ;(BG_NAMES_BY_CATEGORY[category] ??= []).push(parts[parts.length - 1])
}

/** Which base names have both renders, by category — what the scene prompt may name. */
export function shippedBackgrounds(): BackgroundSets {
  return pairBackgrounds(BG_NAMES_BY_CATEGORY)
}

/** The category folder each base name is shipped under; a pair's two halves share one entry. */
const BG_KIND_BY_BASE: Record<string, 'interior' | 'exterior'> = {}
for (const path of Object.keys(BG_URLS)) {
  const parts = path.split('/')
  const kind = parts[parts.length - 2]
  const stem = parts[parts.length - 1].slice(0, -4)
  // A rain render is the slot's own picture in another sky, so it names no base of its own.
  if (stem.endsWith('_rain')) continue
  if (kind === 'interior' || kind === 'exterior') {
    BG_KIND_BY_BASE[stem.slice(0, stem.lastIndexOf('_'))] = kind
  }
}

/** The player's own backgrounds the stage may show, by name; the asset store keeps it current. */
let customByName: ReadonlyMap<string, CustomBackgroundListing> = new Map()

/** Hands over the player's own backgrounds the stage may show, none under a shipped name. */
export function setCustomBackgrounds(kept: readonly CustomBackgroundListing[]): void {
  customByName = new Map(kept.map((listing) => [listing.record.name, listing]))
}

/** The player's own background named `base` the stage may show, or undefined. */
export function customBackgroundOf(base: string): CustomBackgroundListing | undefined {
  return customByName.get(base)
}

/** Which of the two kinds a background is listed under, or null where it is neither's. */
export function bgKindOf(base: string): 'interior' | 'exterior' | null {
  if (Object.hasOwn(BG_KIND_BY_BASE, base)) return BG_KIND_BY_BASE[base]
  return customBackgroundOf(base)?.record.kind ?? null
}

/**
 * Whose room `base` is, by the owners' room ids: nobody's where a listed background answers to
 * the same name, which is the one the stage, the prompt and the picker all mean by it.
 */
export function roomOwnerOf(
  base: string,
  owners: ReadonlyMap<string, string>,
  listed: ReadonlySet<string>
): string | undefined {
  return listed.has(base) ? undefined : owners.get(base)
}

/** What the background layer falls back to between scenes — the reader's own dorm. */
export const SLOT_BG = 'lowrise_dorm_room'

/**
 * The URL a background base name is drawn from at the current slot, or null if absent: the
 * bundle's, or the player's own. A wet slot takes the place's rain render where there is one
 * and the dry picture where there is none, so every caller says which sky it is asking for.
 */
export function bgUrl(base: string, suffix: 'day' | 'night', wet: boolean): string | null {
  const custom = customBackgroundOf(base)
  if (custom) return (wet ? custom.urls[`${suffix}_rain`] : undefined) ?? custom.urls[suffix]
  const stem = `${base}_${suffix}`
  return (wet ? BG_BY_STEM[`${stem}_rain`] : undefined) ?? BG_BY_STEM[stem] ?? null
}

/** Whether the listed background `base` has its own rain render for `suffix`; a room has none. */
export function hasRainRender(base: string, suffix: 'day' | 'night'): boolean {
  const custom = customBackgroundOf(base)
  if (custom) return custom.urls[`${suffix}_rain`] !== undefined
  return Object.hasOwn(BG_BY_STEM, `${base}_${suffix}_rain`)
}

/**
 * The small picture a grid draws for a background, or the full one where no thumbnail is
 * shipped, as for the player's own. Wet, it is the rain render's where the place has one and
 * the dry one's where it has none, as {@link bgUrl} picks.
 */
export function bgThumbUrl(base: string, suffix: 'day' | 'night', wet: boolean): string | null {
  if (customBackgroundOf(base)) return bgUrl(base, suffix, wet)
  const stem = `${base}_${suffix}`
  return (
    (wet ? BG_THUMB_BY_STEM[`${stem}_rain`] : undefined) ??
    BG_THUMB_BY_STEM[stem] ??
    bgUrl(base, suffix, wet)
  )
}

/**
 * The picture a save's card shows: the frame it was written over where it carries one, and
 * otherwise its place's thumbnail in its half of the day, the dorm where it names none.
 */
export function saveThumbUrl(summary: SaveSummary): string | null {
  if (summary.thumbnail) return `data:image/jpeg;base64,${summary.thumbnail}`
  const half = summary.graduationSeen || summary.time === 1 ? 'night' : 'day'
  return bgThumbUrl(summary.bg ?? SLOT_BG, half, false) ?? bgThumbUrl(SLOT_BG, half, false)
}
