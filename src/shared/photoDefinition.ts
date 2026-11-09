import { PHOTO_LOADERS } from './photoLoader'

/** Photo Feature's mod id, as saves, slices and calls name it. */
export const PHOTO_FEATURE_ID = 'photo-feature'

/**
 * The mod as a mods screen lists it: what a build with one needs to register it. The ids are
 * written to disk there, so they never change once shipped.
 */
export const PHOTO_FEATURE_MOD = {
  id: PHOTO_FEATURE_ID,
  name: 'Photo Feature',
  author: 'naudh1r',
  scope: 'anytime' as const,
  defaultOn: false,
  blurb:
    "The girls send photos in their DMs and post them on their feeds, with comments from the rest of campus. Adds a gallery to each contact and optional body details for characters. Separate from the game's own Photos tab, where you make pictures yourself. Needs ComfyUI to draw the pictures, the game's own or yours.",
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
      id: 'body',
      label: 'Body details',
      hint: "Gives characters a build and body shape for their pictures. Set them from the main menu, in Manage Characters, under a character's Generation settings.",
      default: false
    },
    {
      id: 'duo',
      label: '2 girls 1 photo (experimental)',
      hint: "A girl's feed post can be a photo of her and a friend, and a scene you are in with other girls can bring a photo of two of them, posted on one's feed. Always two girls, never more. Still being tuned: now and then a face, an outfit or a colour comes out wrong.",
      default: false
    },
    {
      id: 'webp',
      label: 'Save photos as WebP',
      hint: 'New photos are saved as WebP, with no visible quality loss while taking much less space than PNG. Off, they are saved as PNG. Photos already saved stay as they are.',
      default: true
    },
    // One of these is on at a time: the store turns the others off.
    ...PHOTO_LOADERS.map((loader) => ({
      id: `loader-${loader.value}`,
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
