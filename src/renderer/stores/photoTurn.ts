import { messagePhoto } from './photoRecords'
import { photoInvoke } from './photoInvoke'
import { redrawPhoto, RENDER_PATIENCE_MS } from './photoRedraw'
import { allowedPhotoTier, isPhotoTier, settlePhoto } from '../../shared/photoGate'
import { affectionFor, type Character, type TextingResponse, type Result } from '@vx/modkit/shared'
import type { ChatPhoto, PhotoRenderOptions } from '../../shared/photoTypes'
import { photoGame } from './photoGame'
import {
  canSendPhotos,
  noExplicitPhotos,
  photoNamesInSave,
  savePhotoState,
  savePhotoStateAwaitable,
  setMessagePhoto
} from './localPhotoStore'
import { tellAboutDmPhotos } from './photoTipDelivery'
import { renderPhoto } from './photoWebp'

type PhotoReply = Pick<TextingResponse, 'sendPhoto' | 'photoPrompt' | 'photoTier'> &
  Partial<TextingResponse>

/** Settles the same photo gate before or after her texts arrive. */
function settleReplyPhoto(charId: string, character: Character, data: PhotoReply) {
  const game = photoGame()
  const info = game.charInfo[charId]

  return settlePhoto({
    sendPhoto: data.sendPhoto === true,
    photoPrompt: data.photoPrompt ?? '',
    // Her own reading of what she drew, which may raise the caption's but never lower it.
    stated: data.photoTier && isPhotoTier(data.photoTier) ? data.photoTier : undefined,
    allowed: allowedPhotoTier({
      flags: info?.flags,
      affection: affectionFor(info, game.date, character),
      traits: character.traits,
      noNsfwImages: noExplicitPhotos(),
      canRender: canSendPhotos()
    })
  })
}

interface EarlyPhoto {
  charId: string
  file?: string
  tier: string
  scene: string
  playthroughId: string
  run: object
  ready: Promise<Result<string>>
  render: Promise<Result<string>>
  result?: Result<string>
  attached: boolean
  discarded: boolean
  release: () => void
}
const earlyPhotos = new Map<string, EarlyPhoto>()

/** Whether this render still belongs to the loaded game. */
function earlyIsLive(early: EarlyPhoto): boolean {
  const game = photoGame()
  return game.playthroughId === early.playthroughId && game.run === early.run
}

/** Disposes an unattached render after it settles, leaving any referenced picture alone. */
function discardEarlyPhoto(early: EarlyPhoto): void {
  if (early.attached || early.discarded) return
  early.discarded = true
  early.release()
  if (early.file) {
    void photoInvoke('drop', [early.playthroughId, early.charId, early.file, { cancelOnly: true }])
      .catch((error) => console.warn('[photo] could not cancel an early photo:', error))
  }
  if (earlyPhotos.get(early.charId) === early) earlyPhotos.delete(early.charId)
  void early.render
    .then(async () => {
      if (!early.file) return
      const game = photoGame()
      if (
        game.playthroughId === early.playthroughId &&
        photoNamesInSave(early.charId).includes(early.file)
      )
        return
      const dropped = await photoInvoke('drop', [early.playthroughId, early.charId, early.file])
      if (!dropped.ok) console.warn('[photo] could not drop an unused early photo:', dropped.error)
    })
    .catch((error) => console.warn('[photo] could not clean up an early photo:', error))
}

/** Drops every early request left behind by a previous game or reply. */
export function clearEarlyPhotos(): void {
  for (const early of earlyPhotos.values()) discardEarlyPhoto(early)
}

/** Starts a photo from the streamed lead without writing a message or save. */
export function startDmPhoto(
  charId: string,
  character: Character,
  lead: Readonly<Record<string, unknown>>,
  signal: AbortSignal
): void {
  if (signal.aborted) return
  const previous = earlyPhotos.get(charId)
  if (previous) discardEarlyPhoto(previous)
  const data = {
    sendPhoto: lead.sendPhoto === true,
    photoPrompt: typeof lead.photoPrompt === 'string' ? lead.photoPrompt : '',
    photoTier: typeof lead.photoTier === 'string' ? lead.photoTier : undefined
  }
  const verdict = settleReplyPhoto(charId, character, data)
  const game = photoGame()
  if (!verdict.send || !game.playthroughId) return
  const cancelled: Result<string> = {
    ok: false,
    error: {
      code: 'CANCELLED',
      message: 'The photo reply was abandoned.'
    }
  }
  const early: EarlyPhoto = {
    charId,
    tier: verdict.tier,
    scene: data.photoPrompt.trim(),
    playthroughId: game.playthroughId,
    run: game.run,
    release: () => signal.removeEventListener('abort', abort),
    ready: Promise.resolve(cancelled),
    render: Promise.resolve(cancelled),
    attached: false,
    discarded: false
  }
  const abort = (): void => discardEarlyPhoto(early)
  signal.addEventListener('abort', abort, { once: true })
  earlyPhotos.set(charId, early)
  early.ready = photoInvoke('reserveName', [early.playthroughId, character, 'chat', photoNamesInSave(charId)])
    .then((named) => {
      if (named.ok) early.file = named.data
      return named
    })
    .catch((error: unknown) => ({
      ok: false,
      error: { code: 'PHOTO_THREW', message: String(error) }
    }))
  early.render = early.ready
    .then((named) => {
      if (!named.ok) return named
      if (early.discarded || !earlyIsLive(early) || !canSendPhotos()) return cancelled
      console.log(`[photo] starting early DM render: ${named.data}`)
      return renderPhoto(early.playthroughId, character, early.tier, early.scene, named.data)
    })
    .catch((error: unknown): Result<string> => ({
      ok: false,
      error: { code: 'PHOTO_THREW', message: String(error) }
    }))
    .then((result) => {
      early.result = result
      if (!early.attached && (!earlyIsLive(early) || !canSendPhotos())) discardEarlyPhoto(early)
      return result
    })
}

/**
 * The picture attached to one reply: settled against the save, hung on her last text as a
 * placeholder, and filled in when the render lands — or, when it does not, left saying so with a
 * reroll on it. Everything after the render re-reads the store rather than trusting what it
 * captured before.
 */
export async function sendPhoto(
  charId: string,
  character: Character,
  // A DM reply, or the photo fields of a girl's entry when she texts first.
  data: PhotoReply,
  useEarly = false
): Promise<void> {
  const early = useEarly ? earlyPhotos.get(charId) : undefined
  if (early) earlyPhotos.delete(charId)
  const game = photoGame()
  const verdict = settleReplyPhoto(charId, character, data)
  if (
    early &&
    (!verdict.send ||
      !earlyIsLive(early) ||
      data.sendPhoto !== true ||
      data.photoPrompt?.trim() !== early.scene ||
      verdict.tier !== early.tier)
  )
    discardEarlyPhoto(early)
  if (!verdict.send) {
    if (verdict.note) console.log(`[texting] no photo from ${character.firstName}: ${verdict.note}`)
    return
  }

  // It hangs on her last text, so the bubble it belongs to is the one she just sent.
  const messages = game.bunnyboard.conversations[charId]?.messages ?? []
  const last = [...messages].reverse().find((message) => message.sender === 'contact')
  const playthroughId = game.playthroughId
  if (!last || !playthroughId) {
    if (early) discardEarlyPhoto(early)
    return
  }

  // Her own words for it, kept on the message: this is what the next turn will read back.
  const scene = (data.photoPrompt ?? '').trim()

  if (early && !early.discarded) {
    const named = await early.ready
    const now = photoGame()
    const message = now.bunnyboard.conversations[charId]?.messages.find((one) => one.id === last.id)
    if (early.discarded || !earlyIsLive(early) || !message || messagePhoto.read(message) || !canSendPhotos()) {
      discardEarlyPhoto(early)
      return
    }
    if (named.ok && early.file) {
      early.attached = true
      early.release()
      setMessagePhoto(charId, last.id, {
        tier: early.tier,
        scene: early.scene,
        file: early.file,
        ...(early.result?.ok ? {} : { pending: true as const })
      })
      tellAboutDmPhotos(character.firstName)
      savePhotoState()
      if (!early.result?.ok) drawMessagePhoto(charId, last.id, early.render)
      return
    }
    discardEarlyPhoto(early)
  }

  // The name before the picture, so the bubble carries it into the save whatever the render does
  // next. A bubble saved without one can never be told what landed, and spins for good.
  const named = await photoInvoke('reserveName', [playthroughId, character, 'chat', photoNamesInSave(charId)])
  if (!named.ok) {
    console.warn(`[texting] no name for her photo: ${named.error.code}`, named.error.message)
    return
  }
  const file = named.data
  // A replacement, load, or disabled Photo Feature can overtake the asynchronous reservation.
  const live = photoGame()
  const held = live.bunnyboard.conversations[charId]?.messages.find(
    (message) => message.id === last.id
  )
  if (
    live.playthroughId !== playthroughId ||
    live.run !== game.run ||
    !held ||
    messagePhoto.read(held) ||
    !canSendPhotos()
  )
    return
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
  const chat = photoGame().bunnyboard.conversations[charId]
  const message = chat?.messages.find((message) => message.id === messageId)
  return message ? messagePhoto.read(message) : null
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
function drawMessagePhoto(
  charId: string,
  messageId: string,
  started?: Promise<Result<string>>
): void {
  const game = photoGame()
  const playthroughId = game.playthroughId
  const character = game.characters[charId]
  const photo = messagePhotoOf(charId, messageId)
  if (!playthroughId || !character || !photo?.file || !photo.scene) return
  const key = `${playthroughId}:${messageId}`
  if (drawing.has(key)) return
  const { tier, scene, file } = photo
  const drawn: ChatPhoto = { tier, scene, file, ...(photo.with ? { with: photo.with } : {}) }
  // A friend gone from the roster since leaves a picture of her alone.
  const friend = photo.with ? game.characters[photo.with] : undefined
  // The save may have moved on under a render: a photo from a playthrough the player has left
  // belongs to nothing.
  const live = (): boolean => {
    const now = photoGame()
    return (
      now.playthroughId === playthroughId &&
      now.run === game.run &&
      messagePhotoOf(charId, messageId)?.file === file
    )
  }

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

  void (started ?? renderPhoto(playthroughId, character, tier, scene, file, friend))
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
  setMessagePhoto(charId, messageId, {
    tier,
    scene,
    file,
    pending: true,
    ...(photo.with ? { with: photo.with } : {})
  })
  drawMessagePhoto(charId, messageId)
}

/** Gives one landed photo's redraw access to its message and save. */
export async function redrawMessagePhoto(
  charId: string,
  messageId: string,
  options: PhotoRenderOptions
): Promise<void> {
  const game = photoGame()
  const playthroughId = game.playthroughId
  const character = game.characters[charId]
  if (!playthroughId || !character || !canSendPhotos()) return
  const photo = messagePhotoOf(charId, messageId)
  await redrawPhoto(
    {
      playthroughId,
      character,
      friend: photo?.with ? game.characters[photo.with] : undefined,
      kind: 'chat',
      read: () => messagePhotoOf(charId, messageId),
      write: async (next) => {
        setMessagePhoto(charId, messageId, next)
        await savePhotoStateAwaitable(game.run)
      },
      live: () => {
        const now = photoGame()
        return now.playthroughId === playthroughId && now.run === game.run
      },
      inSave: () => photoNamesInSave(charId)
    },
    options
  )
}
