import { base64ToBytes, bytesToBase64 } from '@shared/base64'
import { portableCutout, preparePortableCutout } from './echoCutoutClient'

// This isolated page has no preload, filesystem bridge, credentials or game state.
Object.assign(window, { echoCutout: {
  prepare: () => preparePortableCutout(new AbortController().signal),
  cutout: async (base64: string) => bytesToBase64(await portableCutout(base64ToBytes(base64), new AbortController().signal))
} })
