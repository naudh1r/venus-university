/** The ways a picture still being drawn can wait in a DM, as the Mods screen lists them. */
export const PHOTO_LOADERS = [
  { value: 'bunny', label: 'Bunny hop' },
  { value: 'shimmer', label: 'Dot shimmer' },
  { value: 'dots', label: 'Typing dots' }
] as const

export type PhotoLoader = (typeof PHOTO_LOADERS)[number]['value']

/** The stored choice, or the bunny when there is none or it names one this build lacks. */
export function photoLoaderOf(stored: string | undefined): PhotoLoader {
  return PHOTO_LOADERS.find((loader) => loader.value === stored)?.value ?? 'bunny'
}
