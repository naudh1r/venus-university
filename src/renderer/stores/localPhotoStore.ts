import { explicitPhotosAllowed, photoGenerationOn, PHOTO_FEATURE_ID } from '../../shared/photoSwitches'
import type { ChatPhoto } from '../../shared/photoTypes'
import { canRenderLocalImages, noNsfwImages, conversation, feed, currentRun,
  saveChanges, type RecordWriteOptions } from '@vx/modkit/renderer'
import { messagePhoto, postPhoto } from './photoRecords'

/**
 * Whether a picture can be drawn at all, as the game answers it for its own art: the player's
 * own ComfyUI, or the app's install once verified and not deferred; never on the web.
 */
function canRenderImages(): boolean {
  return canRenderLocalImages()
}

/**
 * Whether a character may send a photograph: the mod and its "Photo generation" option, and a
 * renderer to draw it with. Asked by the DM prompt and by the feed, so one switch covers both.
 */
export function canSendPhotos(): boolean {
  return photoGenerationOn() && canRenderImages()
}

/**
 * Whether an undressed photo is out of the question: the game's "No NSFW images", or the mod's
 * own option where a build has one. What a photo she has already sent may show follows the same.
 */
export function noExplicitPhotos(): boolean {
  return !explicitPhotosAllowed(noNsfwImages())
}


/** Publishes only Photo's slice; a vanished record or departed run is left untouched. */
export function setMessagePhoto(charId: string, messageId: string, photo: ChatPhoto | null,
  options: RecordWriteOptions = { run: currentRun() }) {
  return messagePhoto.set({ kind: 'message', charId, messageId }, photo, options)
}

/** Every reserved picture name, including pending renders, on her thread and feed. */
export function photoNamesInSave(charId: string): string[] {
  return [
    ...(conversation(charId)?.messages ?? []).map(item => messagePhoto.read(item)),
    ...feed(charId).map(item => postPhoto.read(item))
  ].flatMap(photo => photo?.file ? [photo.file] : [])
}

/** Publishes a post's attachment without replacing native post fields. */
export function setFeedPostPhoto(charId: string, postId: string, photo: ChatPhoto | null,
  options: RecordWriteOptions = { run: currentRun() }) {
  return postPhoto.set({ kind: 'post', charId, postId }, photo, options)
}

/** Arrival persists now, or travels with the loop's next save while a scene is playing. */
export function savePhotoState(): void { void savePhotoStateAwaitable() }

export async function savePhotoStateAwaitable(run = currentRun()): Promise<void> {
  await saveChanges(PHOTO_FEATURE_ID, { run })
}
