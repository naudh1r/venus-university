import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  isVenueTrack,
  VENUE_TRACK_LABELS,
  VENUE_TRACKS,
  type BackgroundKind,
  type VenueTrack
} from '@shared/audio'
import {
  BG_NAME_MAX_LENGTH,
  BG_VARIANTS,
  bgNameProblem,
  normalizeBgName,
  typedBgName,
  type BgVariant
} from '@shared/customBackgrounds'
import { toAppError } from '@shared/errors'
import { ROOM_PICTURE_TYPES } from '@shared/roomPicture'
import { ConfirmModal } from '../components/ConfirmModal'
import { DeleteX } from '../components/DeleteX'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { useAssetStore } from '../stores/assetStore'
import { useCharacterStore } from '../stores/characterStore'
import { cutRoomPicture } from '../stores/roomPicture'
import { useUiStore } from '../stores/uiStore'
import type { ScreenTheme } from './clockTheme'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  revealed,
  rowPress,
  spin,
  toggleLift,
  veilIn,
  yielded
} from './motion'
import { DoorIcon, PlusIcon, SkyIcon, UploadIcon } from './screenIcons'
import '../vu_styles/UploadBackground.css'

export interface UploadBackgroundModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

/** The four pictures, in the order the cards stand. */
const CARDS: readonly { variant: BgVariant; label: string }[] = [
  { variant: 'day', label: 'Day' },
  { variant: 'night', label: 'Night' },
  { variant: 'day_rain', label: 'Day (rainy)' },
  { variant: 'night_rain', label: 'Night (rainy)' }
]

/** The two kinds a background is listed under, as the palette offers them. */
const KINDS: readonly { kind: BackgroundKind; word: string; Mark: () => JSX.Element }[] = [
  { kind: 'interior', word: 'Interior', Mark: DoorIcon },
  { kind: 'exterior', word: 'Exterior', Mark: SkyIcon }
]

/** The songs the place may play, none first. */
const MUSIC_OPTIONS = [
  { value: '', label: 'None' },
  ...VENUE_TRACKS.map((track) => ({ value: track, label: VENUE_TRACK_LABELS[track] }))
]

/** One picture as it has been cut: the PNG the bridge is handed, and the URL its card shows. */
interface Picked {
  bytes: Uint8Array<ArrayBuffer>
  url: string
}

/**
 * One of the four cards: the plus where nothing is picked, the cut picture where something is,
 * and the pill a hover raises saying what a click does. The ✕ beside a picked one clears it.
 */
function PictureCard({
  label,
  picked,
  cutting,
  onChoose,
  onClear
}: {
  label: string
  picked: Picked | undefined
  cutting: boolean
  onChoose: () => void
  onClear: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.li
      className="vu-gallery-item vu-gallery-item--removable"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <motion.button
        className={`vu-gallery-cell${picked ? '' : ' vu-gallery-cell--empty'}`}
        type="button"
        aria-label={`${picked ? 'Replace' : 'Upload'} the ${label.toLowerCase()} picture`}
        animate={cutting || hovered ? 'shown' : 'hidden'}
        whileFocus="shown"
        whileTap={rowPress}
        onClick={() => {
          if (!cutting) onChoose()
        }}
      >
        {picked ? (
          <img className="vu-gallery-img" src={picked.url} alt="" />
        ) : (
          // The plus gives way to the pill raised over it, which would otherwise sit on top of it.
          <motion.span className="vu-bgupload-plus" variants={yielded} initial={false}>
            <PlusIcon size={34} />
          </motion.span>
        )}
        {/* Variants rather than a `whileHover`, so focusing the card reveals the pill inside it;
            `initial={false}` or it flashes on mount before tucking away. */}
        <motion.span className="vu-pic-action" variants={revealed} initial={false}>
          {cutting ? (
            <>
              <motion.span className="vu-ring" animate={spin} />
              Reading
            </>
          ) : (
            <>
              <UploadIcon size={16} ariaHidden />
              {picked ? 'Replace' : 'Upload'}
            </>
          )}
        </motion.span>
      </motion.button>
      {picked && !cutting && (
        <DeleteX
          className="vu-x vu-gallery-x"
          hovered={hovered}
          label={`Clear the ${label.toLowerCase()} picture`}
          onDelete={onClear}
        />
      )}
      <span className="vu-gallery-caption">{label}</span>
    </motion.li>
  )
}

/**
 * A background of the player's own: the name the writer is offered it under, its four pictures
 * — the day and the night required, the rain renders not — whether it is indoors, and the song
 * it plays. Each picture is cut to the stage's shape the moment it is picked, so the card shows
 * what will be kept.
 */
export function UploadBackgroundModal({
  theme,
  onClose
}: UploadBackgroundModalProps): JSX.Element | null {
  const shipped = useAssetStore((s) => s.shipped)
  const customs = useAssetStore((s) => s.customBackgrounds)
  const addCustomBackground = useAssetStore((s) => s.addCustomBackground)

  const [name, setName] = useState('')
  const [pictures, setPictures] = useState<Partial<Record<BgVariant, Picked>>>({})
  // The cards whose picked file is still being cut.
  const [cutting, setCutting] = useState<ReadonlySet<BgVariant>>(new Set())
  const [kind, setKind] = useState<BackgroundKind>('interior')
  const [music, setMusic] = useState<VenueTrack | ''>('')
  // Every character's room id, read fresh on opening; Save waits on it.
  const [roomIds, setRoomIds] = useState<readonly string[] | null>(null)
  const [busy, setBusy] = useState(false)
  // The gate in front of leaving with anything entered.
  const [closing, setClosing] = useState(false)

  // Holds off a second Save, and every dismissal, while the write is in flight.
  const saving = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // The card the picker was opened for, read when the file comes back.
  const picking = useRef<BgVariant | null>(null)
  // Bumped by every pick and clear, so a cut that lands after a later one is dropped.
  const tokens = useRef<Record<BgVariant, number>>({ day: 0, night: 0, day_rain: 0, night_rain: 0 })
  const mounted = useRef(false)
  // Every preview URL handed out, let go of when the modal goes.
  const urls = useRef(new Set<string>())

  useEffect(() => {
    mounted.current = true
    let live = true
    void useCharacterStore
      .getState()
      .listRoomBgIds()
      .then((ids) => {
        if (live) setRoomIds(ids)
      })
    const held = urls.current
    return () => {
      live = false
      mounted.current = false
      for (const url of held) URL.revokeObjectURL(url)
      held.clear()
    }
  }, [])

  // Every name a background already answers to: the build's, the player's own and every room.
  const taken = useMemo(
    () =>
      roomIds === null
        ? null
        : new Set([
            ...shipped.interior,
            ...shipped.exterior,
            ...customs.map((listing) => listing.record.name),
            ...roomIds
          ]),
    [roomIds, shipped, customs]
  )

  const pristine = name === '' && Object.keys(pictures).length === 0
  const dirty = !pristine || kind !== 'interior' || music !== ''
  // What the status line says: nothing on an untouched form, else the name's problem first.
  const problem = pristine
    ? null
    : ((taken && bgNameProblem(name, taken)) ??
      (pictures.day && pictures.night ? null : 'Add a day and a night picture.'))
  const saveDead = pristine || problem !== null || taken === null || cutting.size > 0 || busy

  /** Opens the file picker for one card. */
  function choose(variant: BgVariant): void {
    if (!fileInput.current) return
    picking.current = variant
    // Cleared so picking the same file again still fires a change.
    fileInput.current.value = ''
    fileInput.current.click()
  }

  /** Takes one card off the cutting list. */
  function doneCutting(variant: BgVariant): void {
    setCutting((now) => {
      const next = new Set(now)
      next.delete(variant)
      return next
    })
  }

  /** Cuts the picked file onto the card it was picked for, saying why where it cannot. */
  async function pick(file: File | undefined): Promise<void> {
    const variant = picking.current
    picking.current = null
    if (!file || !variant) return
    const token = ++tokens.current[variant]
    setCutting((now) => new Set(now).add(variant))

    let bytes: Uint8Array<ArrayBuffer> | null = null
    try {
      bytes = await cutRoomPicture(file)
    } catch (err) {
      const error = toAppError(err, 'ROOM_PICTURE_INVALID')
      console.warn('[backgrounds] picture refused:', error.message)
      if (mounted.current) useUiStore.getState().showError(error)
    }
    // A later pick or a clear has the card now, or the modal has gone.
    if (!mounted.current || tokens.current[variant] !== token) return
    doneCutting(variant)
    if (!bytes) return

    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
    urls.current.add(url)
    setPictures((now) => ({ ...now, [variant]: { bytes, url } }))
  }

  /** Empties one card, dropping a cut still under way for it. */
  function clear(variant: BgVariant): void {
    tokens.current[variant]++
    doneCutting(variant)
    setPictures((now) => {
      const { [variant]: _cleared, ...rest } = now
      return rest
    })
  }

  /** Keeps the background, closing on success; a refusal has already been shown. */
  async function handleSave(): Promise<void> {
    if (saveDead || saving.current) return
    saving.current = true
    setBusy(true)
    const images: Partial<Record<BgVariant, Uint8Array>> = {}
    for (const variant of BG_VARIANTS) {
      const picked = pictures[variant]
      if (picked) images[variant] = picked.bytes
    }
    const kept = await addCustomBackground(
      { name: normalizeBgName(name), kind, ...(music ? { music } : {}) },
      images
    )
    saving.current = false
    if (!mounted.current) return
    setBusy(false)
    if (kept) onClose()
  }

  /** The gate in front of leaving: nothing while saving, and a discard confirm when dirty. */
  function requestClose(): void {
    if (saving.current) return
    if (dirty) setClosing(true)
    else onClose()
  }

  const { host, overlayProps, primaryProps } = useModalShell(requestClose, 'panel', () => {
    void handleSave()
  })
  if (!host) return null

  return createPortal(
    <>
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
          id="bgupload-modal"
          className="vu-bgupload vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Upload custom BG"
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.stopPropagation()
            // The name is the form's one typed field, so Enter in it is the foot's Save; the
            // shell gives Save to Enter and Space outside the fields.
            if (event.target instanceof HTMLInputElement) void handleSave()
          }}
          {...primaryProps}
        >
          <TitleTab>Upload custom BG</TitleTab>

          <p className="vu-bgupload-note">
            The entered background name will be injected directly into prompts for the LLM to
            use. The name should indicate how it should be used while being as short as possible.
            Rainy variants are optional.
          </p>

          <TextField
            id="bgupload-name"
            label="Background name"
            value={name}
            onChange={(value) => setName(typedBgName(value))}
            onBlur={() => setName((now) => normalizeBgName(now))}
            maxLength={BG_NAME_MAX_LENGTH}
            autoFocus
          />

          <div className="vu-bgupload-pictures">
            <span className="vu-hint">Click on a picture to upload one.</span>
            <ul className="vu-gallery-grid vu-gallery-grid--wide vu-bgupload-grid">
              {CARDS.map((card) => (
                <PictureCard
                  key={card.variant}
                  label={card.label}
                  picked={pictures[card.variant]}
                  cutting={cutting.has(card.variant)}
                  onChoose={() => choose(card.variant)}
                  onClear={() => clear(card.variant)}
                />
              ))}
            </ul>
            <input
              ref={fileInput}
              type="file"
              accept={ROOM_PICTURE_TYPES.join(',')}
              hidden
              onChange={(event) => void pick(event.target.files?.[0])}
            />
          </div>

          <div className="vu-bgupload-row">
            <div className="vu-field vu-bgupload-kind">
              <span className="vu-field-label" id="bgupload-kind-label">
                Interior or exterior
              </span>
              <div className="vu-palette" role="group" aria-labelledby="bgupload-kind-label">
                {KINDS.map((entry) => {
                  const on = entry.kind === kind
                  return (
                    <motion.button
                      key={entry.kind}
                      id={`bgupload-kind-${entry.kind}`}
                      className={`vu-palette-btn${on ? ' vu-palette-btn--on' : ''}`}
                      type="button"
                      aria-pressed={on}
                      {...gestures(false, toggleLift, quietPress)}
                      onClick={() => setKind(entry.kind)}
                    >
                      <entry.Mark />
                      {entry.word}
                    </motion.button>
                  )
                })}
              </div>
            </div>
            <SelectField
              id="bgupload-music"
              label="Ambient music"
              value={music}
              onChange={(value) => setMusic(isVenueTrack(value) ? value : '')}
              options={MUSIC_OPTIONS}
            />
          </div>

          <div className="vu-foot-stack">
            <span className="vu-form-status">
              {problem !== null && (
                <>
                  <span className="vu-form-dot vu-form-dot--warn" />
                  {problem}
                </>
              )}
            </span>
            <div className="vu-foot">
              <motion.button
                id="bgupload-cancel"
                className="vu-btn vu-btn--quiet"
                type="button"
                disabled={busy}
                {...gestures(busy, quietLift, quietPress)}
                onClick={requestClose}
              >
                Cancel
              </motion.button>
              <motion.button
                id="bgupload-save"
                className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                type="button"
                disabled={saveDead}
                {...gestures(saveDead, lift, press)}
                onClick={() => void handleSave()}
              >
                Save
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Sibling of the veil, not a child: the confirm leaves when this panel does. */}
      <AnimatePresence propagate>
        {closing && (
          <ConfirmModal
            key="discard"
            id="bgupload-discard"
            theme={theme}
            title="Discard changes?"
            message="The background has not been saved."
            confirmText="Discard changes"
            cancelText="Keep editing"
            // Taken down before the panel goes, so the two do not leave as one exiting child
            // rendered twice under the same key.
            onConfirm={() => {
              setClosing(false)
              onClose()
            }}
            onCancel={() => setClosing(false)}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
