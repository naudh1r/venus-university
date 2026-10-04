import type { ChatPhoto } from '@shared/photoTypes'
import { isWebBuild } from '../platform'
import { useGameStore } from './gameStore'
import { writeAutosave } from './loop/saves'
import { loopState } from './loop/state'
import { sceneInProgress } from './loop/stream'
import { useSettingsStore } from './settingsStore'
import { useSetupStore } from './setupStore'

/**
 * The photo feature's writes into the game store, and the one question about whether a picture
 * can exist at all.
 *
 * Both writes would sit more naturally as actions on `gameStore` — in the build this was ported
 * from they were. They live out here because neither closes over anything but `set`: a Zustand
 * store's `setState` is callable from outside, so the same immutable updater works from a file
 * the store has never heard of, and `gameStore.ts` needs no edit at all.
 */

/**
 * Whether a picture can be drawn at all: the local renderer is optional, absent on the web, and
 * switched off while ComfyUI is deferred.
 */
function canRenderImages(): boolean {
  if (isWebBuild()) return false
  if (useSettingsStore.getState().settings?.comfyDeferred === true) return false
  return useSetupStore.getState().status?.comfyReady === true
}

/**
 * Whether a character may send a photograph: the player's switch, and a renderer to draw it
 * with. Asked by the DM prompt and by the feed, so one switch covers both.
 *
 * Absent reads as on — a save written before the feature existed has no `photos` key, and the
 * renderer check below is the real gate anyway.
 */
export function canSendPhotos(): boolean {
  return useSettingsStore.getState().settings?.photos !== false && canRenderImages()
}

/**
 * Hangs a picture on one of her texts, or takes it off again. The same shape the render reports:
 * pending while it draws, a file when it lands, failed when nothing arrives.
 */
export function setMessagePhoto(charId: string, messageId: string, photo: ChatPhoto | null): void {
  useGameStore.setState((state) => {
    const chat = state.bunnyboard.conversations[charId]
    if (!chat) return {}
    const at = chat.messages.findIndex((message) => message.id === messageId)
    // Same-object return for a message that is no longer there: a thread cleared under a render
    // is not a thread to patch.
    if (at < 0) return {}
    const messages = [...chat.messages]
    const { photo: _dropped, ...rest } = messages[at]
    messages[at] = photo ? { ...rest, photo } : rest
    return {
      bunnyboard: {
        ...state.bunnyboard,
        conversations: { ...state.bunnyboard.conversations, [charId]: { ...chat, messages } }
      }
    }
  })
}

/**
 * Every picture name the save points at for her, on her thread and on her feed, whether or not
 * the picture ever reached disk. A new picture is never given one of these.
 */
export function photoNamesInSave(charId: string): string[] {
  const game = useGameStore.getState()
  const onThread = game.bunnyboard.conversations[charId]?.messages ?? []
  const onFeed = game.charInfo[charId]?.feed ?? []
  return [...onThread, ...onFeed].flatMap((item) => (item.photo?.file ? [item.photo.file] : []))
}

/** The same, for a picture attached to one of her posts on the feed. */
export function setFeedPostPhoto(charId: string, postId: string, photo: ChatPhoto | null): void {
  useGameStore.setState((state) => {
    const info = state.charInfo[charId]
    const feed = info?.feed
    if (!feed) return {}
    const at = feed.findIndex((post) => post.id === postId)
    // A post the feed no longer carries is not a post to patch.
    if (at < 0) return {}
    const posts = [...feed]
    const { photo: _dropped, ...rest } = posts[at]
    posts[at] = photo ? { ...rest, photo } : rest
    return { charInfo: { ...state.charInfo, [charId]: { ...info, feed: posts } } }
  })
}

/**
 * Writes the save as soon as a picture settles, rather than leaving it for the next slot.
 *
 * A render lands between saves — she is texted from the phone, which is open for whole slots at
 * a time — so without this the picture reaches disk only when the loop next writes for its own
 * reasons. Close the game before that and the bubble comes back pending forever, pointing at a
 * file that is sitting right there. `settlePendingPhotos` exists to clean that up on load; this
 * is what stops it happening.
 *
 * The same shape `bankTextLedger` uses for the other thing texting changes between slots: the
 * autosave records the last decision point, so nothing half-streamed is written. Mid-stream it
 * does nothing and lets the loop's own imminent write carry the picture — a save is taken from
 * the store, which already has it. Manual saves need nothing here for the same reason.
 */
export function savePhotoState(): void {
  if (sceneInProgress() && !useGameStore.getState().awaitingInput) return
  void writeAutosave(loopState.decisionSave)
}
