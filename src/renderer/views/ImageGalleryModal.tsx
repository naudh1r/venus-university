import { useRef, useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { POSITIONS } from '@shared/positions'
import { ROOM_VARIANTS, type RoomVariant } from '@shared/room'
import { ROOM_PICTURE_TYPES } from '@shared/roomPicture'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import {
  cgTargetFor,
  liveCgTasks,
  liveTaskFor,
  roomUrl,
  spriteUrl,
  stagedOf,
  useCharacterStore,
  useSpriteVersion
} from '../stores/characterStore'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  revealed,
  rowPress,
  spin,
  veilIn,
  yielded
} from './motion'
import { UploadIcon } from './screenIcons'
import '../vu_styles/ImageGallery.css'
import type { Position, SetTarget } from '@shared/types'

/** Which of the two landscape image sets a gallery is showing. */
type GalleryKind = Extract<SetTarget, 'cgs' | 'room'>

/** Everything that differs between the two galleries — the rest is shared. */
const KINDS: Record<
  GalleryKind,
  {
    title: string
    keys: readonly string[]
    /** Two 16:9 frames side by side instead of eight CGs. */
    pair: boolean
    urlOf: (charId: string, key: string, version: number, staged: boolean) => string
    labelOf: (key: string) => string
  }
> = {
  cgs: {
    title: 'NSFW CG',
    keys: POSITIONS,
    pair: false,
    urlOf: (charId, key, version, staged) => spriteUrl(charId, key as Position, version, staged),
    labelOf: (key) => key.replaceAll('_', ' ')
  },
  room: {
    title: 'Room BG',
    keys: ROOM_VARIANTS,
    pair: true,
    urlOf: (charId, key, version, staged) => roomUrl(charId, key as RoomVariant, version, staged),
    labelOf: (key) => key
  }
}

/** What a click on a cell does, and the pill that says so. */
interface CellAction {
  /** The pill's words, and its mark where it has one. */
  pill: ReactNode
  /** Work on this image is under way, so the pill stays up rather than waiting on a hover. */
  held: boolean
  /** What the cell is called to a screen reader, where its picture alone would not say. */
  ariaLabel?: string
  onAct: () => void
}

/** The pill's ring and word while work on its image is under way. */
function Busy({ word }: { word: string }): JSX.Element {
  return (
    <>
      <motion.span className="vu-ring" animate={spin} />
      {word}
    </>
  )
}

/**
 * One image, and — where the player may act on it — the control that does it, shown on the
 * hover. Its own component so each cell owns the hover state driving that reveal.
 */
function GalleryCell({
  src,
  label,
  action
}: {
  src: string | null
  label: string
  /** Absent where the image is not the player's to act on — a plain picture. */
  action?: CellAction
}): JSX.Element {
  const [hovered, setHovered] = useState(false)

  // A gap's word gives way to the pill raised over it, which would otherwise sit on top of it.
  const picture =
    src === null ? (
      <motion.span
        className="vu-gallery-empty"
        variants={action ? yielded : undefined}
        initial={false}
      >
        NOT GENERATED
      </motion.span>
    ) : (
      <img className="vu-gallery-img" src={src} alt={label} />
    )
  const empty = src === null ? ' vu-gallery-cell--empty' : ''

  return (
    <li className="vu-gallery-item">
      {action ? (
        <motion.button
          className={`vu-gallery-cell vu-gallery-cell--action${empty}`}
          type="button"
          aria-label={action.ariaLabel}
          animate={action.held || hovered ? 'shown' : 'hidden'}
          whileFocus="shown"
          whileTap={rowPress}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          onClick={action.onAct}
        >
          {picture}
          {/* Variants rather than a `whileHover`, so focusing the cell reveals the pill
              inside it; `initial={false}` or it flashes on mount before tucking away. */}
          <motion.span className="vu-pic-action" variants={revealed} initial={false}>
            {action.pill}
          </motion.span>
        </motion.button>
      ) : (
        <div className={`vu-gallery-cell${empty}`}>{picture}</div>
      )}
      <span className="vu-gallery-caption">{label}</span>
    </li>
  )
}

export interface ImageGalleryModalProps {
  charId: string
  kind: GalleryKind
  theme: 'day' | 'night'
  /** Whether a CG may be re-rolled by clicking it. */
  regenEnabled?: boolean
  /**
   * Where a re-roll click goes: the Edit modal's unsaved-changes gate and the tag modal
   * behind it. Absent where no CG is the player's to re-roll; cancel clicks never use it.
   */
  onRegenerate?: (position: Position) => void
  /** Whether a room background may be replaced by a picture the player picks, by clicking it. */
  uploadEnabled?: boolean
  onClose: () => void
}

/**
 * A character's landscape images at full size — all eight CGs four across, or the two
 * room backgrounds side by side, each captioned at rest.
 */
export function ImageGalleryModal({
  charId,
  kind,
  theme,
  regenEnabled,
  onRegenerate,
  uploadEnabled,
  onClose
}: ImageGalleryModalProps): JSX.Element | null {
  const spec = KINDS[kind]
  const onDisk = useCharacterStore((s) => (kind === 'cgs' ? s.cgs[charId] : s.rooms[charId]))
  const version = useSpriteVersion(charId)
  const staged = useCharacterStore((s) => s.staged)
  const progress = useCharacterStore((s) => s.progress[charId])
  const cancelSet = useCharacterStore((s) => s.cancelSet)
  const uploadRoom = useCharacterStore((s) => s.uploadRoom)
  // The rooms whose picked picture is still being cut and written.
  const [uploading, setUploading] = useState<ReadonlySet<string>>(new Set())
  const fileInput = useRef<HTMLInputElement>(null)
  // The room the picker was opened for, read when the file comes back.
  const picking = useRef<RoomVariant | null>(null)
  // While the set regenerates, the gallery shows this run's staged images.
  const regenerating = Boolean(liveTaskFor(progress, kind)?.staged)
  const present: Record<string, boolean> | undefined = regenerating
    ? stagedOf(staged, charId, kind)
    : onDisk

  // No per-image re-roll while the whole set runs: its control is where it stops. The tag
  // modal the caller opens is the only way to one, so a caller offering none offers nothing.
  const perImage =
    kind === 'cgs' &&
    regenEnabled === true &&
    onRegenerate !== undefined &&
    !liveTaskFor(progress, 'cgs')
  const rerolling = new Set(liveCgTasks(progress))
  // Not while the set renders: a staged run would commit over the picture, and the night
  // render re-lights whichever day it reads.
  const uploadable = kind === 'room' && uploadEnabled === true && !liveTaskFor(progress, 'room')

  const pick = async (file: File | undefined): Promise<void> => {
    const variant = picking.current
    picking.current = null
    if (!file || !variant) return
    setUploading((now) => new Set(now).add(variant))
    await uploadRoom(charId, variant, file)
    setUploading((now) => {
      const next = new Set(now)
      next.delete(variant)
      return next
    })
  }

  const actionFor = (key: string): CellAction | undefined => {
    if (uploadable) {
      const busy = uploading.has(key)
      return {
        pill: busy ? (
          <Busy word="Uploading" />
        ) : (
          <>
            <UploadIcon size={16} ariaHidden />
            Upload
          </>
        ),
        held: busy,
        ariaLabel: `Upload ${spec.labelOf(key)} room BG`,
        onAct: () => {
          if (busy || !fileInput.current) return
          picking.current = key as RoomVariant
          // Cleared so picking the same file again still fires a change.
          fileInput.current.value = ''
          fileInput.current.click()
        }
      }
    }
    const live = rerolling.has(key as Position)
    // Only an existing image is offered a re-roll; a gap is the set control's job. A re-roll
    // in flight stays clickable to cancel it.
    if (!perImage || !(present?.[key] || live)) return undefined
    return {
      pill: live ? <Busy word="Cancel" /> : '↻ Regenerate',
      held: live,
      onAct: () => {
        if (live) {
          void cancelSet(charId, cgTargetFor(key as Position))
          return
        }
        onRegenerate?.(key as Position)
      }
    }
  }
  const done = spec.keys.filter((key) => present?.[key]).length

  const { host, overlayProps } = useModalShell(onClose)
  if (!host) return null

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.div
        id={`${kind}-gallery`}
        className="vu-gallery vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        variants={panelUnderTab}
      >
        <TitleTab>{spec.title}</TitleTab>

        <div className="vu-gallery-head">
          <span
            className={`vu-count vu-gallery-count vu-count--${done === spec.keys.length ? 'good' : 'warn'}`}
          >
            {done}/{spec.keys.length}
          </span>
          {perImage && <span className="vu-hint">Click on a CG to regenerate it.</span>}
          {uploadable && <span className="vu-hint">Click on a room BG to upload a picture.</span>}
        </div>

        <ul
          className={`vu-gallery-grid${spec.pair ? ' vu-gallery-grid--pair vu-gallery-grid--wide' : ''}`}
        >
          {spec.keys.map((key) => (
            <GalleryCell
              key={key}
              src={present?.[key] ? spec.urlOf(charId, key, version, regenerating) : null}
              label={spec.labelOf(key)}
              action={actionFor(key)}
            />
          ))}
        </ul>
        {uploadable && (
          <input
            ref={fileInput}
            type="file"
            accept={ROOM_PICTURE_TYPES.join(',')}
            hidden
            onChange={(event) => void pick(event.target.files?.[0])}
          />
        )}

        <div className="vu-foot">
          <motion.button
            id={`${kind}-gallery-close`}
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={onClose}
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
