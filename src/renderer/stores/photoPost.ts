import { allowedPostTier, settlePhoto, type PhotoTier } from '@shared/photoGate'
import type { SocialPost } from '@shared/types'
import { useGameStore } from './gameStore'
import { canSendPhotos, savePhotoState } from './photoStore'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/**
 * The picture on a post on her feed.
 *
 * What a post may show is flat, unlike a thread's. A post is public — there is no relationship
 * to read, no one reader it is for, and nothing she has been through with anybody changes what
 * her whole year gets to see. `allowedPostTier` says so: a swimsuit is ordinary on a feed, and
 * nothing past it is.
 *
 * The other rule here is that a post she took a picture for **waits for the picture**. She
 * posted both at once or she posted nothing: an hour of text under an empty frame is not what
 * anybody wrote, and a picture that never renders leaves no evidence it was meant to. This is
 * the one place the feed and the thread part company — a bubble on a thread appears at once and
 * fills in, because her words have already landed and the reader is watching them land.
 */

/**
 * What a post's picture is allowed to be, read off the caption she wrote rather than a flag
 * beside it, and capped by the one rule a public feed has.
 */
function settlePostPhoto(image: string | undefined): { tier: PhotoTier; scene: string } | null {
  const scene = image?.trim()
  if (!scene || !canSendPhotos()) return null

  const allowed = allowedPostTier(noNsfwImagesOf(useSettingsStore.getState()))
  const verdict = settlePhoto({ sendPhoto: true, photoPrompt: scene, allowed })
  if (!verdict.send) {
    if (verdict.note) console.log(`[feed] no picture on a post: ${verdict.note}`)
    return null
  }
  return { tier: verdict.tier, scene }
}

/** The name the post's picture will land under, settled before the post is filed. */
async function reservePostPhotoName(charId: string): Promise<string | null> {
  const game = useGameStore.getState()
  const character = game.characters[charId]
  if (!character || !game.playthroughId) return null
  const result = await window.api.photo.reserveName(game.playthroughId, character, 'bunnyboard')
  if (result.ok) return result.data
  console.warn(`[feed] no name for a post's picture: ${result.error.code}`, result.error.message)
  return null
}

/**
 * Draws one post's picture and files the post where it landed. Never awaited by the game, only by
 * the queue: the feed is read long after the slot opened, so nothing is kept waiting on a render —
 * but the post itself does not appear until the picture it was written for is on disk.
 *
 * A render that fails takes the post with it, rather than leaving text under an empty frame.
 */
async function postWhenDrawn(
  charId: string,
  written: SocialPost,
  shot: { tier: PhotoTier; scene: string },
  file: string,
  nudge: (charId: string) => void
): Promise<void> {
  const game = useGameStore.getState()
  const character = game.characters[charId]
  const playthroughId = game.playthroughId
  if (!character || !playthroughId) return

  const result = await window.api.photo.generate(
    playthroughId,
    character,
    shot.tier,
    shot.scene,
    file
  )
  const live = useGameStore.getState()
  // The save may have moved on under a render: a picture from a playthrough the player has left
  // belongs to nothing, and neither does the post that was waiting on it.
  if (live.playthroughId !== playthroughId) return
  if (!result.ok) {
    console.warn(
      `[feed] a post's picture failed, so the post is dropped: ${result.error.code}`,
      result.error.message
    )
    return
  }

  live.appendFeedPost(charId, {
    ...written,
    photo: { tier: shot.tier, scene: shot.scene, file }
  })
  // Held back with the post, since there was nothing to be notified about until now.
  const flags = live.charInfo[charId]?.flags
  if (flags?.gaveContactInfo && !flags.blocked) nudge(charId)
  // The post reached the feed after the slot save was written, so it goes to disk on its own.
  savePhotoState()
  console.log(`[feed] ${character.firstName} posted ${file}`)
}

/** A picture a post has settled on and reserved a name for, waiting on the post it belongs to. */
export interface PreparedPostPhoto {
  shot: { tier: PhotoTier; scene: string }
  file: string
}

/**
 * Called as a slot's posts are filed, before any of them are looked at. Whatever the last slot
 * held and the reader never started is let go here: he passed through that slot without doing
 * anything, and the posts it belonged to never existed, which is the same answer a failed render
 * gives.
 */
export function beginSlotPhotos(): void {
  held = []
}

/**
 * The picture one post will carry, or `null` for a post that carries none.
 *
 * Every post whose caption settles gets its picture. Two in one slot are two renders, drawn one
 * after the other by {@link startHeldPostPhoto}; capping a slot at one filed the second post as
 * text under replies the model wrote for its picture.
 *
 * The name is reserved here, and the caller awaits it before filing anything: the slot save is
 * written the moment the posts are filed, and a post that goes into it without the name of the
 * picture it is waiting for can never be told what landed.
 */
export async function preparePostPhoto(
  charId: string,
  image: string | undefined
): Promise<PreparedPostPhoto | null> {
  const shot = settlePostPhoto(image)
  if (!shot) return null
  const file = await reservePostPhotoName(charId)
  return file ? { shot, file } : null
}

/** A post waiting for its picture to be drawn. */
interface HeldPost {
  charId: string
  written: SocialPost
  shot: { tier: PhotoTier; scene: string }
  file: string
  nudge: (charId: string) => void
}

/**
 * The slot's posts waiting for their pictures, in the order they were written.
 *
 * Why they wait rather than starting as the slot opens: a render is half a minute of the machine,
 * and the reader spends the start of a slot on the map deciding where to go. Starting then puts
 * the renders in the one stretch he might be reading the feed, and finishes them in the one
 * stretch he is not. Held until he commits to something instead, they run underneath the scene
 * he committed to — and the posts are on the feed by the time he is free to look at them.
 */
let held: HeldPost[] = []

/**
 * The renders already started, as one chain: each waits for the one before it, so two posts are
 * never drawn at once and a slot's batch never overlaps the last slot's.
 */
let drawing: Promise<void> = Promise.resolve()

/** Files the post and its picture to be drawn when the reader next commits to something. */
export function holdPostPhoto(
  charId: string,
  written: SocialPost,
  prepared: PreparedPostPhoto,
  nudge: (charId: string) => void
): void {
  held.push({ charId, written, shot: prepared.shot, file: prepared.file, nudge })
}

/**
 * Starts the held renders, if there are any, one after the other. Called as the reader commits
 * to an action, which is every turn of a scene as well as the first — so it takes the whole hold
 * before starting, and a second call finds nothing.
 */
export function startHeldPostPhoto(): void {
  if (held.length === 0) return
  const batch = held
  held = []
  drawing = drawing.then(async () => {
    for (const one of batch) {
      try {
        await postWhenDrawn(one.charId, one.written, one.shot, one.file, one.nudge)
      } catch (error) {
        // One post lost, not the queue: the renders behind it still get drawn.
        console.warn("[feed] a post's picture threw, so the post is dropped:", error)
      }
    }
  })
}
