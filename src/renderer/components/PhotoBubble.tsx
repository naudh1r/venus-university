import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type JSX } from 'react'
import { photoUrl } from '@shared/photoFiles'
import type { ChatPhoto } from '@shared/photoTypes'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import { useGameStore } from '../stores/gameStore'
import { useSettingsStore } from '../stores/settingsStore'
import { rerollPostPhoto } from '../stores/photoPost'
import { tellAboutFeedPhotos } from '../stores/photoTipDelivery'
import { rerollMessagePhoto } from '../stores/photoTurn'
import { bunnyHop } from '../views/motion'
import { BunnyMark, EyeIcon, EyeOffIcon } from '../views/screenIcons'
import { Lightbox } from './Lightbox'
import '../vu_styles/PhotoBubble.css'

/**
 * The picture on a text, in whichever state the render left it, and the overlay one opens into.
 *
 * Its own component rather than part of `BunnyboardModal`, so that screen's hook is an import and
 * three lines — the thread it draws into is 2000 lines of somebody else's file.
 */

/**
 * The frame while her picture is being drawn: the same bunny the game waits behind between slots,
 * at the size a bubble can carry it, hopping on the same beat. Reduced motion keeps the bunny and
 * drops the hop — the wait still has to be legible as a wait.
 */
function PhotoWait(): JSX.Element {
  const still = useReducedMotion() ?? false
  return (
    <div className="vu-bb-photo vu-bb-photo--pending" role="img" aria-label="Sending a photo">
      <motion.span
        className="vu-bb-photo__bunny"
        aria-hidden="true"
        animate={still ? undefined : { y: [0, -9, 0] }}
        transition={bunnyHop}
      >
        <BunnyMark />
      </motion.span>
    </div>
  )
}

/**
 * The picture itself: a placeholder while it is drawn, the photograph once it lands, and a quiet
 * line where nothing arrived. An explicit one opens covered, so a thread scrolled past in company
 * does not show it unasked.
 */
export function MessagePhoto({
  charId,
  photo,
  onOpen
}: {
  charId: string
  photo: ChatPhoto
  /** Given where the picture may be opened at the size it was drawn; absent on a thread. */
  onOpen?: (src: string) => void
}): JSX.Element {
  const playthroughId = useGameStore((s) => s.playthroughId)
  const [shown, setShown] = useState(photo.tier !== 'explicit')
  // A picture the renderer cannot load says so, rather than collapsing to nothing and leaving
  // her talking about a photograph that is not there.
  const [broken, setBroken] = useState(false)

  if (photo.pending) {
    return <PhotoWait />
  }
  if (photo.failed || broken || !photo.file || !playthroughId) {
    return <div className="vu-bb-photo vu-bb-photo--failed">The photo never came through.</div>
  }

  const src = photoUrl(playthroughId, charId, photo.file)

  /**
   * The eye that covers and uncovers, in the same corner either way, so it reads as one switch
   * rather than two controls. Always on show while the picture is covered — there is nothing for
   * it to be in the way of — and only under the pointer once it is not.
   */
  const eye = (
    <button
      type="button"
      className={`vu-bb-photo-eye${shown ? '' : ' vu-bb-photo-eye--covered'}`}
      aria-pressed={!shown}
      aria-label={shown ? 'Cover the photo' : 'Uncover the photo'}
      title={shown ? 'Cover the photo' : 'Uncover the photo'}
      onClick={() => setShown(!shown)}
    >
      {shown ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
    </button>
  )

  // Only a picture that opens covered gets the switch; the rest were never covered.
  const covers = photo.tier === 'explicit'

  const image = (
    <img
      className={`vu-bb-photo${shown ? '' : ' vu-bb-photo--veiled'}`}
      src={src}
      alt=""
      onError={() => setBroken(true)}
    />
  )

  /**
   * Tapping does the obvious thing for the state it is in: a veiled picture lifts its veil, and
   * one already on show opens at the size it was drawn. The eye does the other direction.
   */
  const picture = !shown ? (
    <button type="button" className="vu-bb-photo-open" onClick={() => setShown(true)}>
      {image}
    </button>
  ) : onOpen ? (
    <button type="button" className="vu-bb-photo-open" onClick={() => onOpen(src)}>
      {image}
    </button>
  ) : (
    image
  )

  if (!covers) return picture
  return (
    <div className="vu-bb-photo-frame">
      {picture}
      {eye}
    </div>
  )
}

/**
 * A picture whose render failed or never answered: the frame says so plainly and offers to draw
 * it again. Only a picture with a name and a scene can be drawn again; an older one without falls
 * back to the quiet line. With photos switched off the frame still says so, and the reroll waits
 * for them to be switched back on.
 */
function RerollablePhoto({
  charId,
  photo,
  onReroll
}: {
  charId: string
  photo: ChatPhoto
  onReroll: () => void
}): JSX.Element {
  const photosOn = useSettingsStore((s) => s.settings?.photos !== false)
  if (photo.failed && photo.file && photo.scene) {
    return (
      <div className="vu-bb-photo vu-bb-photo--failed vu-bb-photo--reroll">
        <span>Image failed to generate.</span>
        {photosOn && (
          <button type="button" className="vu-bb-photo-reroll" onClick={onReroll}>
            Reroll
          </button>
        )}
      </div>
    )
  }
  return <MessagePhoto charId={charId} photo={photo} onOpen={openShot} />
}

/** The picture on one of her posts, which went up without it where the render failed. */
export function PostPhoto({
  charId,
  postId,
  photo
}: {
  charId: string
  postId: string
  photo: ChatPhoto
}): JSX.Element {
  // The first post with a picture on the tab, whoever posted it, is when BunnyBot explains them.
  useEffect(() => tellAboutFeedPhotos(charId), [charId])
  return (
    <RerollablePhoto
      charId={charId}
      photo={photo}
      onReroll={() => rerollPostPhoto(charId, postId)}
    />
  )
}

/**
 * A picture as its own bubble on the thread, the way a phone sends one: her words in one bubble
 * and the photograph in the next, rather than a snapshot pasted under a sentence.
 *
 * It reads the open thread from the Bunnyboard store rather than taking a `charId` prop, so
 * `MessageBubble` keeps the signature it has and every one of its call sites is left alone.
 */
export function MessagePhotoBubble({
  photo,
  sender,
  messageId
}: {
  photo: ChatPhoto
  sender: 'player' | 'contact'
  messageId: string
}): JSX.Element | null {
  const charId = useBunnyboardStore((s) => s.viewingCharId)
  if (!charId) return null
  const side = sender === 'player' ? 'mine' : 'theirs'
  return (
    <div className={`vu-bb-bubble vu-bb-bubble--${side} vu-bb-bubble--photo`}>
      <RerollablePhoto
        charId={charId}
        photo={photo}
        onReroll={() => rerollMessagePhoto(charId, messageId)}
      />
    </div>
  )
}

/**
 * Which picture is open at full size, held outside React because the bubble that opens one and
 * the overlay that draws it are in different parts of the tree — and a store action for this
 * would be a line in `bunnyboardStore.ts`.
 */
let openedShot: string | null = null
const shotListeners = new Set<(src: string | null) => void>()

/** Opens one picture at the size it was drawn. Handed to {@link MessagePhoto} as `onOpen`. */
export function openShot(src: string | null): void {
  openedShot = src
  for (const listener of shotListeners) listener(src)
}

/**
 * Draws whichever picture is open, over everything. Mounted once at a screen's root; any bubble
 * under it can open one.
 */
export function PhotoLightboxHost(): JSX.Element | null {
  const [shot, setShot] = useState<string | null>(openedShot)
  useEffect(() => {
    shotListeners.add(setShot)
    return () => {
      shotListeners.delete(setShot)
    }
  }, [])
  if (!shot) return null
  return <Lightbox src={shot} onClose={() => openShot(null)} />
}
