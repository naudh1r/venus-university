import { useEffect, useId, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  TextField,
  TitleTab,
  useModalShell,
  veilIn,
  type ScreenTheme
} from '@vx/modkit/renderer'
import type { Character } from '@vx/modkit/shared'
import { photoGenerationOn } from '../../shared/photoSwitches'
import type {
  ChatPhoto,
  PhotoInfo,
  PhotoPrompts,
  PhotoRenderOptions
} from '../../shared/photoTypes'
import { usePhotoSwitches } from '../stores/photoSwitchHooks'
import '../vu_styles/PhotoInfo.css'

interface PhotoInfoProps {
  playthroughId: string
  character: Character
  friend?: Character
  photo: ChatPhoto & { file: string }
  onRedraw: (options: PhotoRenderOptions) => void
  redrawing?: boolean
}

/** The corner control opens only the photo's prompt editor. */
export function PhotoInfoButton({ redrawing = false, ...props }: PhotoInfoProps): JSX.Element {
  const [theme, setTheme] = useState<ScreenTheme | null>(null)
  return (
    <>
      {!redrawing && (
        <button
          type="button"
          className="vu-bb-photo-info"
          aria-label="Photo info"
          title="Photo info"
          onPointerDownCapture={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setTheme(
              event.currentTarget.closest('[data-theme]')?.getAttribute('data-theme') === 'day'
                ? 'day'
                : 'night'
            )
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m11 11 2-.5-2 6h2M13.5 7h.01" />
          </svg>
        </button>
      )}
      <AnimatePresence>
        {theme && (
          <PhotoInfoModal
            key={props.photo.file}
            {...props}
            theme={theme}
            onClose={() => setTheme(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/** A short-lived failure notice shared by every view of the old picture. */
export function PhotoRedrawFailure({ failed }: { failed: boolean }): JSX.Element {
  const still = useReducedMotion() ?? false
  return (
    <AnimatePresence>
      {failed && (
        <motion.span
          className="vu-photo-redraw-failure"
          role="status"
          initial={{ opacity: still ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: still ? 0 : 0.14 }}
        >
          Redraw failed. This photo stays.
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** Inspects the exact request and keeps edits local until a redraw is asked for. */
function PhotoInfoModal({
  playthroughId,
  character,
  friend,
  photo,
  onRedraw,
  theme,
  onClose
}: PhotoInfoProps & {
  theme: ScreenTheme
  onClose: () => void
}): JSX.Element | null {
  const [info, setInfo] = useState<PhotoInfo | null>(null)
  const [recorded, setRecorded] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const photosOn = photoGenerationOn(usePhotoSwitches())
  const id = useId()
  const body = useRef<HTMLDivElement>(null)
  const refitFields = useRef(true)

  const dead = busy || !info || !photosOn
  const redraw = (same: boolean): void => {
    if (dead || !info) return
    const prompts: PhotoPrompts = {
      positive: info.positive,
      negative: info.negative,
      ...(friend ? { left: info.left ?? '', right: info.right ?? '' } : {})
    }
    onClose()
    onRedraw({ seed: same ? info.seed : undefined, prompts })
  }
  const { host, overlayProps, primaryProps } = useModalShell(onClose, 'panel', () =>
    redraw(info?.seed !== undefined)
  )
  /** Fits loaded or rewrapped text, preserving a player's taller size while typing. */
  useLayoutEffect(() => {
    const fit = (reset: boolean): void => {
      for (const key of ['positive', 'left', 'right', 'negative']) {
        const area = document.getElementById(`${id}-${key}`)
        if (!(area instanceof HTMLTextAreaElement)) continue
        const style = getComputedStyle(area)
        const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
        if (reset) area.style.height = 'auto'
        if (reset || area.scrollHeight > area.clientHeight) {
          const height = area.scrollHeight + border
          area.style.height = `${reset ? height : Math.max(height, area.offsetHeight)}px`
          const overflow = area.scrollHeight - area.clientHeight
          if (overflow > 0) {
            const fittedHeight = parseFloat(area.style.height)
            area.style.height = `${fittedHeight + overflow + 1}px`
          }
        }
      }
    }
    const reset = refitFields.current
    fit(reset)
    refitFields.current = false
    const element = body.current
    if (!element) return
    let width = reset ? -1 : element.clientWidth
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth
      if (Math.abs(nextWidth - width) < 0.5) return
      width = nextWidth
      fit(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [info, host, id])
  useEffect(() => {
    let active = true
    void window.api.photo
      .info(playthroughId, character, friend, photo.tier, photo.scene ?? '', photo.file)
      .then((result) => {
        if (!active) return
        if (result.ok) {
          refitFields.current = true
          setInfo(result.data)
          setRecorded(result.data.recorded)
        } else setError('Could not read the photo prompt.')
      })
      .catch(() => {
        if (active) setError('Could not read the photo prompt.')
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
    // Opening captures this picture's recorded request; Rebuild reads the current character props.
  }, [playthroughId, photo.file])

  /** Refills only the draft fields, retaining the seed the sidecar recorded. */
  const rebuild = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await window.api.photo.info(
        playthroughId,
        character,
        friend,
        photo.tier,
        photo.scene ?? '',
        photo.file,
        true
      )
      if (result.ok) {
        refitFields.current = true
        setInfo(result.data)
      } else setError('Could not rebuild the photo prompt.')
    } catch {
      setError('Could not rebuild the photo prompt.')
    } finally {
      setBusy(false)
    }
  }

  /** Updates one prompt without changing the recorded seed or the photo's scene. */
  const field = (key: keyof PhotoPrompts, label: string, first = false): JSX.Element => (
    <TextField
      id={`${id}-${key}`}
      label={label}
      value={info?.[key] ?? ''}
      multiline
      rows={3}
      autoFocus={first}
      disabled={busy}
      onChange={(value) => setInfo((before) => before && { ...before, [key]: value })}
    />
  )
  if (!host) return null
  return createPortal(
    <motion.div
      className="vu-veil vu-photo-info-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.section
        className="vu-photo-info vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Photo info"
        aria-busy={busy}
        variants={panelUnderTab}
        {...primaryProps}
      >
        <TitleTab>Photo info</TitleTab>
        <div className="vu-photo-info-body" ref={body}>
          {info ? (
            <>
              <p className="vu-photo-info-meta">
                Seed: {info.seed ?? 'unknown'} · Tier: {info.tier} · LoRA:{' '}
                {info.lora ? `${info.lora.name} @ ${info.lora.weight}` : 'none'}
                {friend ? ` · With: ${friend.firstName}` : ''}
              </p>
              {!info.recorded && (
                <p className="vu-photo-info-note">
                  This prompt was rebuilt from her current tags and settings.
                </p>
              )}
              {recorded && (
                <motion.button
                  type="button"
                  className="vu-btn vu-btn--quiet vu-photo-info-rebuild"
                  disabled={busy}
                  {...gestures(busy, quietLift, quietPress)}
                  onClick={() => {
                    void rebuild()
                  }}
                >
                  Rebuild
                </motion.button>
              )}
              {field('positive', friend ? 'Scene' : 'Positive', true)}
              {friend && field('left', character.firstName)}
              {friend && field('right', friend.firstName)}
              {field('negative', 'Negative')}
            </>
          ) : (
            <p className="vu-photo-info-note">
              {busy ? 'Reading the photo prompt…' : 'The photo prompt could not be read.'}
            </p>
          )}
        </div>
        <div className="vu-foot-stack">
          <p className="vu-form-status" role="status">
            {(error || !photosOn) && (
              <>
                <span className="vu-form-dot vu-form-dot--warn" />
                {error || 'Photo generation is switched off.'}
              </>
            )}
          </p>
          <div className="vu-foot">
            <motion.button
              type="button"
              className="vu-btn vu-btn--quiet"
              {...gestures(false, quietLift, quietPress)}
              onClick={onClose}
            >
              Close
            </motion.button>
            <motion.button
              type="button"
              disabled={dead}
              className={
                info?.seed === undefined
                  ? 'vu-btn vu-btn--primary vu-btn--panel vu-paper'
                  : 'vu-btn vu-btn--quiet'
              }
              {...gestures(
                dead,
                info?.seed === undefined ? lift : quietLift,
                info?.seed === undefined ? press : quietPress
              )}
              onClick={() => redraw(false)}
            >
              Redraw with new seed
            </motion.button>
            {info?.seed !== undefined && (
              <motion.button
                type="button"
                disabled={dead}
                className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
                {...gestures(dead, lift, press)}
                onClick={() => redraw(true)}
              >
                Redraw with same seed
              </motion.button>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>,
    host
  )
}
