import { PHOTO_LOADERS, type PhotoLoader } from './photoLoader'

/**
 * Whether Photo Feature is acting at all, and its options, as the Mods screen has them set.
 *
 * The build sets them through {@link setPhotoSwitches}, at boot and whenever one moves, and every
 * place the mod acts or shows something asks here.
 *
 * Off stops the mod acting and hides what it made: no new photo, no feed comments, no body
 * details, and no photo, gallery or comment on screen. It never deletes anything: every photo,
 * comment and body stays in the save and the character files, and comes back the moment the mod
 * is on again.
 *
 * Main, shared code and the renderer can all read it; each process holds its own copy and the
 * build sets each one.
 */

export interface PhotoSwitches {
  /** The mod itself. */
  on: boolean
  /** New photos are made. Off, the mod stays on and what it already made stays visible. */
  photos: boolean
  /** Undressed photos may be sent; the game's own "No NSFW images" can still forbid them. */
  explicit: boolean
  /** What a DM photo still being drawn waits behind. */
  loader: PhotoLoader
  /** New photos are stored as WebP rather than PNG. */
  webp: boolean
}

/** Before the Mods screen's switches are read: the mod on, nothing forbidden, the bunny. */
export const DEFAULT_PHOTO_SWITCHES: PhotoSwitches = {
  on: true,
  photos: true,
  explicit: true,
  loader: 'bunny',
  webp: true
}

let current: PhotoSwitches = DEFAULT_PHOTO_SWITCHES
const listeners = new Set<() => void>()

/** Sets the switches, and tells everything showing them. */
export function setPhotoSwitches(next: Partial<PhotoSwitches>): void {
  const merged = { ...current, ...next }
  if (
    merged.on === current.on &&
    merged.photos === current.photos &&
    merged.explicit === current.explicit &&
    merged.loader === current.loader &&
    merged.webp === current.webp
  ) {
    return
  }
  current = merged
  for (const listener of listeners) listener()
}

/** The switches as they stand; the same object until one moves. */
export function photoSwitches(): PhotoSwitches {
  return current
}

/** For a screen that redraws when a switch moves; answers how to stop listening. */
export function subscribePhotoSwitches(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether the mod acts: makes photos, asks for body details, writes feed comments. */
export function photoFeatureOn(): boolean {
  return current.on
}

/**
 * Whether what the mod has already made is on screen: its photos, its gallery and its feed
 * comments. Whenever the mod is on, whether or not it makes new photos.
 */
export function photosVisible(switches: PhotoSwitches = current): boolean {
  return switches.on
}

/** Whether new photos are made: the mod on, and its "Photo generation" option. */
export function photoGenerationOn(switches: PhotoSwitches = current): boolean {
  return switches.on && switches.photos
}

/**
 * Whether an undressed photo may be sent or uncovered: the mod's own option, and the game's
 * "No NSFW images". Either one is enough to forbid it; neither can allow what the other forbids.
 */
export function explicitPhotosAllowed(
  noNsfwImages: boolean,
  switches: PhotoSwitches = current
): boolean {
  return switches.explicit && !noNsfwImages
}

/** The option that picks one loading animation. */
export function loaderOptionId(loader: PhotoLoader): string {
  return `loader-${loader}`
}

/**
 * The mod as a mods screen lists it: what a build with one needs to register it. The ids are
 * written to disk there, so they never change once shipped.
 */
export const PHOTO_FEATURE_MOD = {
  id: 'photo-feature',
  name: 'Photo Feature',
  author: 'naudh1r',
  scope: 'anytime' as const,
  defaultOn: true,
  blurb:
    'The girls send photos in their DMs and post them on their feeds, with comments from the rest of campus. Adds a gallery to each contact and optional body details for characters. Needs local image generation.',
  offNote:
    'Off, nobody takes a new photo, posts get no new comments and body details are not used. Photos, galleries and comments already made are hidden. Nothing is deleted: everything comes back when it is on again.',
  options: [
    {
      id: 'photos',
      label: 'Photo generation',
      hint: "Off, no new photos are made, and characters don't know they can send one. Photos already sent stay visible.",
      default: true
    },
    {
      id: 'explicit',
      label: 'Explicit photos',
      hint: 'Off, nobody sends an undressed photo, and ones already sent stay covered. Settings → No NSFW images turns them off too.',
      default: true
    },
    {
      id: 'webp',
      label: 'Save photos as WebP',
      hint: 'New photos are saved as WebP at 85% quality, which takes much less space than PNG. Off, they are saved as PNG. Photos already saved stay as they are.',
      default: true
    },
    // One of these is on at a time: the store turns the others off.
    ...PHOTO_LOADERS.map((loader) => ({
      id: loaderOptionId(loader.value),
      label: loader.label,
      hint: '',
      default: loader.value === 'bunny',
      group: 'loader'
    }))
  ],
  optionGroups: [
    {
      id: 'loader',
      label: 'Loading animation',
      hint: 'The animation shown while a photo is being made.'
    }
  ]
}
