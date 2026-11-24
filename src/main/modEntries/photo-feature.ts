import { modOptionOn, registerComfyNodePack } from '@vx/modkit/main'
import { PHOTO_FEATURE_ID, bindPhotoOptionReader } from '../../shared/photoSwitches'
import { PPM_PACK } from '../photoNodePack'
import { photoInvocations } from '../photoIpc'
import { photoRoute } from '../photoProtocol'

let unregisterPpm: (() => void) | undefined

/** The same exports an installed Photo main.js provides, with ComfyUI-ppm pinned for it. */
export function photoMainEntry() {
  bindPhotoOptionReader(option => modOptionOn(PHOTO_FEATURE_ID, option))
  unregisterPpm?.()
  unregisterPpm = registerComfyNodePack(PHOTO_FEATURE_ID, PPM_PACK)
  return { invoke: photoInvocations(), protocols: [{ route: 'photos', handle: photoRoute }] }
}
