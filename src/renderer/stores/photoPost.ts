import { allowedPostTier, settlePhoto, type PhotoTier } from '@shared/photoGate'
import type { ChatPhoto } from '@shared/photoTypes'
import type { SocialPost } from '@shared/types'
import { useGameStore } from './gameStore'
import {
  canSendPhotos,
  photoNamesInSave,
  savePhotoState,
  setFeedPostPhoto
} from './localPhotoStore'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/**
 * The picture on a post on her feed.
 *
 * What a post may show is flat, unlike a thread's. A post is public — there is no relationship
 * to read, no one reader it is for, and nothing she has been through with anybody changes what
 * her whole year gets to see. `allowedPostTier` says so: a swimsuit is ordinary on a feed, and
 * nothing past it is.
 *
 * The other rule here is that a post she took a picture for **waits for the picture**: it is
 * filed as the slot writes it, held (`postIsOut`), and comes out when the picture lands. A render
 * that fails, or that has not answered in {@link RENDER_PATIENCE_MS}, brings the post out anyway
 * with the frame saying so and a reroll on it — the words were written once, by the model, and
 * a machine that could not draw that minute is no reason to lose them. This is the one place the
 * feed and the thread part company — a bubble on a thread appears at once and fills in, because
 * her words have already landed and the reader is watching them land.
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
  const result = await window.api.photo.reserveName(
    game.playthroughId,
    character,
    'bunnyboard',
    photoNamesInSave(charId)
  )
  if (result.ok) return result.data
  console.warn(`[feed] no name for a post's picture: ${result.error.code}`, result.error.message)
  return null
}

/** A picture a post has settled on and reserved a name for, waiting on the post it belongs to. */
export interface PreparedPostPhoto {
  shot: { tier: PhotoTier; scene: string }
  file: string
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

/**
 * How long a render may go unanswered before its post comes out without it. A picture takes
 * about half a minute; the first after ComfyUI starts, or after the checkpoint changes, loads the
 * model first, and any of them can wait behind a sprite. Three minutes is past all of that, so
 * what this catches is a render that has stopped answering rather than a slow one — and a
 * picture that lands after it still fills the frame in.
 */
export const RENDER_PATIENCE_MS = 3 * 60 * 1000

/**
 * What tells BunnyBot a contact posted, handed in by the feed with each post it holds. Kept from
 * the last one, since a post held over a reload comes out with nobody left to hand it in.
 */
let nudgeOf: ((charId: string) => void) | null = null

/**
 * Files the post held: in her feed and in the save from now on, and on nobody's screen until
 * {@link startHeldPostPhoto} has drawn its picture — whenever the reader next commits to
 * something, in this slot or a later one.
 */
export function holdPostPhoto(
  charId: string,
  written: SocialPost,
  prepared: PreparedPostPhoto,
  nudge: (charId: string) => void
): void {
  nudgeOf = nudge
  const { tier, scene } = prepared.shot
  useGameStore.getState().appendFeedPost(charId, {
    ...written,
    photo: { tier, scene, file: prepared.file, held: true }
  })
}

/**
 * The posts whose picture is being drawn right now, by playthrough and post. A post stays in it
 * until its render answers, however late — a timed-out post is out, but its picture may still
 * be on its way, and a second render of the same name would race it.
 */
const drawing = new Set<string>()

/**
 * The renders already started, as one chain: each waits for the one before it (or for its
 * patience to run out), so two pictures are never asked for at once.
 */
let chain: Promise<void> = Promise.resolve()

/** The posts queued behind the render in progress, so a second call does not queue them twice. */
const queued = new Set<string>()

function keyOf(playthroughId: string, postId: string): string {
  return `${playthroughId}:${postId}`
}

/** One post's picture as it stands, or null where the post or its picture has gone. */
function photoOf(charId: string, postId: string): ChatPhoto | null {
  const post = useGameStore.getState().charInfo[charId]?.feed?.find((one) => one.id === postId)
  return post?.photo ?? null
}

/**
 * Sets the picture on a post, and brings the post out if it was held. A post coming out is the
 * moment BunnyBot may say so — there was nothing to be notified about until now.
 */
function settle(charId: string, postId: string, photo: ChatPhoto): void {
  const before = photoOf(charId, postId)
  if (!before) return
  setFeedPostPhoto(charId, postId, photo)
  if (before.held) {
    const flags = useGameStore.getState().charInfo[charId]?.flags
    if (flags?.gaveContactInfo && !flags.blocked) nudgeOf?.(charId)
  }
  // The post changed after the slot save was written, so it goes to disk on its own.
  savePhotoState()
}

/**
 * Draws one post's picture, and answers when it is done or has run out of patience — whichever
 * comes first, so one render that never answers does not hold up every post behind it.
 *
 * Nothing is dropped here. A picture that lands fills the frame; one that fails, or does not
 * answer in time, leaves the post out with a frame that says so and a reroll on it. The name was
 * reserved when the post was written, so a picture that lands after its post gave up on it
 * still finds its frame.
 */
async function drawPostPhoto(charId: string, postId: string): Promise<void> {
  const game = useGameStore.getState()
  const playthroughId = game.playthroughId
  const character = game.characters[charId]
  const photo = photoOf(charId, postId)
  if (!playthroughId || !character || !photo?.file || !photo.scene) return
  const key = keyOf(playthroughId, postId)
  if (drawing.has(key)) return
  const { tier, scene, file } = photo
  const drawn: ChatPhoto = { tier, scene, file }
  const live = (): boolean => useGameStore.getState().playthroughId === playthroughId

  // A render can finish after the save that was waiting on it was written: the picture is on disk
  // and the save still says held. Found, it only has to be let out.
  const landed = await window.api.photo.landed(playthroughId, charId, file)
  if (!live()) return
  if (landed.ok && landed.data) {
    settle(charId, postId, drawn)
    console.log(`[feed] ${character.firstName}'s picture was already drawn: ${file}`)
    return
  }

  drawing.add(key)
  const render = window.api.photo
    .generate(playthroughId, character, tier, scene, file)
    .catch((error: unknown) => ({
      ok: false as const,
      error: { code: 'PHOTO_THREW', message: String(error) }
    }))
    .then((result) => {
      drawing.delete(key)
      // The save may have moved on under a render: a picture from a playthrough the player has
      // left belongs to nothing.
      if (!live()) return
      if (result.ok) {
        settle(charId, postId, drawn)
        console.log(`[feed] ${character.firstName} posted ${file}`)
        return
      }
      console.warn(
        `[feed] a post's picture failed, so the post goes up without it: ${result.error.code}`,
        result.error.message
      )
      settle(charId, postId, { ...drawn, failed: true })
    })

  let timer: ReturnType<typeof setTimeout> | undefined
  const patience = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      // Only a post still waiting: one the render has answered for already is left as it is.
      const now = photoOf(charId, postId)
      if (live() && (now?.held || now?.pending)) {
        console.warn(`[feed] a post's picture has not answered in time, so it goes up without it`)
        settle(charId, postId, { ...drawn, failed: true })
      }
      resolve()
    }, RENDER_PATIENCE_MS)
  })
  await Promise.race([render, patience])
  clearTimeout(timer)
}

/** Queues one post's picture behind every render already asked for. */
function enqueue(charId: string, postId: string): void {
  chain = chain.then(async () => {
    try {
      await drawPostPhoto(charId, postId)
    } catch (error) {
      // One post, not the queue: the renders behind it still get drawn.
      console.warn("[feed] a post's picture threw:", error)
    }
  })
}

/**
 * Starts every held post's picture, oldest first. Called as the reader commits to an action,
 * which is every turn of a scene as well as the first, and so as often as he likes: a post
 * already queued or being drawn is not queued again.
 *
 * Why they wait for that rather than starting as the slot opens: a render is half a minute of the
 * machine, and the reader spends the start of a slot on the map deciding where to go. Held until
 * he commits to something, they run underneath the scene he committed to — and the posts are on
 * the feed by the time he is free to look at them. Read off the save rather than a list kept
 * here, so a post held over a reload or into the next slot is picked up the same way.
 */
export function startHeldPostPhoto(): void {
  const game = useGameStore.getState()
  const playthroughId = game.playthroughId
  if (!playthroughId) return
  // Photos switched off: every held post stays held, in the save and off the feed, and is drawn
  // the first time the reader commits to something after they are switched back on.
  if (!canSendPhotos()) return
  const held = Object.entries(game.charInfo).flatMap(([charId, info]) =>
    (info?.feed ?? []).filter((post) => post.photo?.held).map((post) => ({ charId, post }))
  )
  held.sort((a, b) => a.post.date - b.post.date || a.post.time - b.post.time)
  for (const { charId, post } of held) {
    const key = keyOf(playthroughId, post.id)
    if (drawing.has(key) || queued.has(key)) continue
    queued.add(key)
    enqueue(charId, post.id)
    chain = chain.finally(() => queued.delete(key))
  }
}

/**
 * Draws a failed post's picture again, from the scene and the name it already has: no model call,
 * and the post keeps every word it had. The frame waits while it draws. Where the first render
 * is in fact still going, the frame only waits for it rather than asking for a second.
 */
export function rerollPostPhoto(charId: string, postId: string): void {
  const game = useGameStore.getState()
  const photo = photoOf(charId, postId)
  if (!game.playthroughId || !photo?.file || !photo.scene || !canSendPhotos()) return
  const { tier, scene, file } = photo
  setFeedPostPhoto(charId, postId, { tier, scene, file, pending: true })
  if (drawing.has(keyOf(game.playthroughId, postId))) return
  enqueue(charId, postId)
}
