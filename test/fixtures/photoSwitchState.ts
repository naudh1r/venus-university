import { stubApi } from '../fixtures'
import type { PhotoPpmState } from '../../src/shared/photoTypes'
import type { PhotoSwitches } from '../../src/shared/photoSwitches'

if (typeof window === 'undefined' || !window.api) stubApi({ jobs: { onProgress: () => () => {} } })
const { useModsStore, modOptionOn } = await import('../../src/renderer/stores/modsStore')
const { withMod, withOption } = await import('../../src/shared/mods')
const { PHOTO_LOADERS } = await import('../../src/shared/photoLoader')
const { PHOTO_FEATURE_ID, bindPhotoOptionReader, bindPhotoPpmReader } = await import('../../src/shared/photoSwitches')

export { useModsStore }
let ppm: PhotoPpmState | null = 'installed'

/** Supplies the fake installed-pack answer used by Photo's save and pairing fixtures. */
export function setRendererPhotoPpm(state: PhotoPpmState | null): void {
  ppm = state
  bindPhotoPpmReader(() => ppm)
}

export function bindRendererPhotoReader(): void {
  bindPhotoPpmReader(() => ppm)
  bindPhotoOptionReader(option => modOptionOn(PHOTO_FEATURE_ID, option))
}

/** The real renderer switches, with Photo's reader bound to the same kit function as its entry. */
export function setRendererPhotoSwitches(next: Partial<PhotoSwitches>): void {
  bindRendererPhotoReader()
  let switches = useModsStore.getState().switches
  if (next.on !== undefined) switches = withMod(switches, PHOTO_FEATURE_ID, next.on)
  for (const key of ['photos', 'explicit', 'webp', 'body', 'duo'] as const) {
    if (next[key] !== undefined) switches = withOption(switches, PHOTO_FEATURE_ID, key, next[key])
  }
  if (next.loader !== undefined) {
    for (const loader of PHOTO_LOADERS) {
      switches = withOption(switches, PHOTO_FEATURE_ID, `loader-${loader.value}`, loader.value === next.loader)
    }
  }
  useModsStore.setState({ switches })
}
