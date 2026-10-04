import { allowedPhotoTier, isPhotoTier, settlePhoto } from '@shared/photoGate'
import { affectionFor } from '@shared/relationship'
import type { ChatPhoto } from '@shared/photoTypes'
import type { Character, TextingResponse } from '@shared/types'
import { useGameStore } from './gameStore'
import { RENDER_PATIENCE_MS } from './photoPost'
import { canSendPhotos, photoNamesInSave, savePhotoState, setMessagePhoto } from './localPhotoStore'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'
import { tellAboutDmPhotos } from './photoTipDelivery'

/**
 * The picture attached to one reply: settled against the save, hung on her last text as a
 * placeholder, and filled in when the render lands — or, when it does not, left saying so with a
 * reroll on it. Everything after the render re-reads the store rather than trusting what it
 * captured before.
 */
export async function sendPhoto(
  charId: string,
  character: Character,
  data: TextingResponse
): Promise<void> {
  const game = useGameStore.getState()
  const info = game.charInfo[charId]

  const verdict = settlePhoto({
    sendPhoto: data.sendPhoto === true,
    photoPrompt: data.photoPrompt ?? '',
    // Her own reading of what she drew, which may raise the caption's but never lower it.
    stated: data.photoTier && isPhotoTier(data.photoTier) ? data.photoTier : undefined,
    allowed: allowedPhotoTier({
      flags: info?.flags,
      affection: affectionFor(info, game.date, character),
      traits: character.traits,
      noNsfwImages: noNsfwImagesOf(useSettingsStore.getState()),
      canRender: canSendPhotos()
    })
  })
  if (!verdict.send) {
    if (verdict.note) console.log(`[texting] no photo from ${character.firstName}: ${verdict.note}`)
    return
  }

  // It hangs on her last text, so the bubble it belongs to is the one she just sent.
  const messages = game.bunnyboard.conversations[charId]?.messages ?? []
  const last = [...messages].reverse().find((message) => message.sender === 'contact')
  const playthroughId = game.playthroughId
  if (!last || !playthroughId) return

  // Her own words for it, kept on the message: this is what the next turn will read back.
  const scene = (data.photoPrompt ?? '').trim()

  // The name before the picture, so the bubble carries it into the save whatever the render does
  // next. A bubble saved without one can never be told what landed, and spins for good.
  const named = await window.api.photo.reserveName(
    playthroughId,
    character,
    'chat',
    photoNamesInSave(charId)
  )
  if (!named.ok) {
    console.warn(`[texting] no name for her photo: ${named.error.code}`, named.error.message)
    return
  }
  const file = named.data
  setMessagePhoto(charId, last.id, { tier: verdict.tier, scene, file, pending: true })
  // Her first picture to him is the moment BunnyBot explains them.
  tellAboutDmPhotos(character.firstName)
  // The waiting bubble is saved too, carrying the name the render will land under: that name is
  // the only thing `settlePendingPhotos` has to look for, and a bubble that never reached disk
  // leaves the finished picture orphaned there with nothing pointing at it.
  savePhotoState()

  drawMessagePhoto(charId, last.id)
}

/**
 * The texts whose picture is being drawn right now, by playthrough and message. A text stays in it
 * until its render answers, however late, so a reroll never asks for a second picture under the
 * same name while the first is still on its way.
 */
const drawing = new Set<string>()

/** One text's picture as it stands, or null where the text or its picture has gone. */
function messagePhotoOf(charId: string, messageId: string): ChatPhoto | null {
  const chat = useGameStore.getState().bunnyboard.conversations[charId]
  return chat?.messages.find((message) => message.id === messageId)?.photo ?? null
}

/**
 * Draws the picture on one of her texts, from the scene and the name it already carries.
 *
 * Never awaited by the turn — a thread that waited on ComfyUI would leave her mid-sentence for
 * half a minute. The bubble waits while it draws; a render that fails, or that has not answered
 * in {@link RENDER_PATIENCE_MS}, turns it into a frame that says so and offers a reroll, and a
 * picture that lands after that still fills it in. The text itself is never touched: she sent
 * it, whatever ComfyUI did about it.
 */
function drawMessagePhoto(charId: string, messageId: string): void {
  const game = useGameStore.getState()
  const playthroughId = game.playthroughId
  const character = game.characters[charId]
  const photo = messagePhotoOf(charId, messageId)
  if (!playthroughId || !character || !photo?.file || !photo.scene) return
  const key = `${playthroughId}:${messageId}`
  if (drawing.has(key)) return
  const { tier, scene, file } = photo
  const drawn: ChatPhoto = { tier, scene, file }
  // The save may have moved on under a render: a photo from a playthrough the player has left
  // belongs to nothing.
  const live = (): boolean => useGameStore.getState().playthroughId === playthroughId

  /** Sets the bubble, and saves it: a picture on disk but not in the save comes back waiting. */
  const settle = (next: ChatPhoto): void => {
    if (!live() || !messagePhotoOf(charId, messageId)) return
    setMessagePhoto(charId, messageId, next)
    savePhotoState()
  }

  drawing.add(key)
  const timer = setTimeout(() => {
    if (messagePhotoOf(charId, messageId)?.pending) {
      console.warn(`[texting] her photo has not answered in time`)
      settle({ ...drawn, failed: true })
    }
  }, RENDER_PATIENCE_MS)

  void window.api.photo
    .generate(playthroughId, character, tier, scene, file)
    .catch((error: unknown) => ({
      ok: false as const,
      error: { code: 'PHOTO_THREW', message: String(error) }
    }))
    .then((result) => {
      clearTimeout(timer)
      drawing.delete(key)
      if (result.ok) {
        settle(drawn)
        return
      }
      console.warn(`[texting] her photo failed: ${result.error.code}`, result.error.message)
      settle({ ...drawn, failed: true })
    })
}

/**
 * Draws a failed picture on one of her texts again, under the same name and from the same scene:
 * no model call, and nothing she said changes. Where the first render is in fact still going,
 * the bubble only waits for it rather than asking for a second.
 */
export function rerollMessagePhoto(charId: string, messageId: string): void {
  const photo = messagePhotoOf(charId, messageId)
  if (!photo?.file || !photo.scene || !canSendPhotos()) return
  const { tier, scene, file } = photo
  setMessagePhoto(charId, messageId, { tier, scene, file, pending: true })
  drawMessagePhoto(charId, messageId)
}
