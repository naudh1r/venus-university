import { bunnybotSays } from '@vx/modkit/renderer'
import {
  bunnybotDmPhotoTexts,
  bunnybotFeedPhotoTexts,
  DM_PHOTO_TIP_MARK,
  FEED_PHOTO_TIP_MARK
} from '../prompts/photoTips'
import { character } from '@vx/modkit/renderer'
import { PHOTO_FEATURE_ID } from '../../shared/photoSwitches'

/** BunnyBot's DM photo tip, the first time a girl sends the reader a picture. */
export function tellAboutDmPhotos(firstName: string): void {
  bunnybotSays(PHOTO_FEATURE_ID, bunnybotDmPhotoTexts(firstName), { once: DM_PHOTO_TIP_MARK })
}

/**
 * BunnyBot's feed photo tip, the first time a post with a picture is on the Updates tab —
 * whoever posted it, a contact or a stranger the feed was filled out with.
 */
export function tellAboutFeedPhotos(charId: string): void {
  const firstName = character(charId)?.firstName
  if (!firstName) return
  bunnybotSays(PHOTO_FEATURE_ID, bunnybotFeedPhotoTexts(firstName), { once: FEED_PHOTO_TIP_MARK })
}
