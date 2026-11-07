import { modOptionOn } from '@vx/modkit/main'
import { PHOTO_FEATURE_ID, bindPhotoOptionReader } from '../../shared/photoSwitches'
import { photoInvocations } from '../photoIpc'
import { photoRoute } from '../photoProtocol'

/** The same exports an installed Photo main.js provides. */
export function photoMainEntry() {
  bindPhotoOptionReader(option => modOptionOn(PHOTO_FEATURE_ID, option))
  return { invoke: photoInvocations(), protocols: [{ route: 'photos', handle: photoRoute }] }
}
