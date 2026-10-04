import { useEffect, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { formatShortGameDate, slotHalf } from '../prompts/gameDate'
import { useWindowKeydown } from '../components/useWindowKeydown'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { usePhotoStore, type GalleryPhoto } from '../stores/photoStore'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, spin, veilIn } from './motion'
import { ChevronIcon } from './screenIcons'
import '../vu_styles/Photos.css'

export interface PhotoViewerModalProps {
  theme: 'day' | 'night'
  playthroughId: string
  photoId: string
  photos: readonly GalleryPhoto[]
  onClose: () => void
}

/**
 * One photo of the gallery at full size: read whole, decoded before it is shown, and stepped
 * through with the arrows either side or the arrow keys. Retake and Save photo read the photo
 * on screen; Retake closes the viewer behind it.
 */
export function PhotoViewerModal({
  theme,
  playthroughId,
  photoId,
  photos,
  onClose
}: PhotoViewerModalProps): JSX.Element | null {
  const readPhoto = usePhotoStore((s) => s.readPhoto)
  const exportPhoto = usePhotoStore((s) => s.exportPhoto)
  const retake = usePhotoStore((s) => s.retake)

  const [current, setCurrent] = useState(photoId)
  const [url, setUrl] = useState<string | null>(null)
  const [decoded, setDecoded] = useState(false)

  const index = photos.findIndex((entry) => entry.photoId === current)
  const photo = index >= 0 ? photos[index] : null
  const meta = photo?.meta ?? null

  // Reads the picture and waits for it to decode before it is shown; the object URL it made is
  // released the moment a newer one replaces it or the viewer closes.
  useEffect(() => {
    let live = true
    setDecoded(false)
    void (async () => {
      const bytes = await readPhoto(playthroughId, current)
      if (!live || !bytes) return
      const objectUrl = URL.createObjectURL(new Blob([bytes]))
      const img = new Image()
      img.src = objectUrl
      try {
        await img.decode()
      } catch {
        // Shown anyway — nothing left to wait on past what the browser already has.
      }
      if (!live) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      setUrl(objectUrl)
      setDecoded(true)
    })()
    return () => {
      live = false
    }
  }, [current, playthroughId, readPhoto])

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )

  /** Steps to the previous or next photo of the list, wrapping either way. */
  function step(delta: number): void {
    if (photos.length === 0) return
    const at = index >= 0 ? index : 0
    const next = (at + delta + photos.length) % photos.length
    setCurrent(photos[next].photoId)
  }

  const { host, overlayProps } = useModalShell(onClose)

  useWindowKeydown((event) => {
    if (!host) return
    if (event.key === 'ArrowLeft') step(-1)
    else if (event.key === 'ArrowRight') step(1)
  })

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
        id="photo-viewer"
        className="vu-photo-viewer vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Photo"
        variants={panelUnderTab}
      >
        <TitleTab>Photo</TitleTab>

        <div className="vu-photo-viewer-row">
          <motion.button
            className="vu-circle"
            type="button"
            aria-label="Previous photo"
            disabled={photos.length < 2}
            {...gestures(photos.length < 2, quietLift, quietPress)}
            onClick={() => step(-1)}
          >
            <ChevronIcon back />
          </motion.button>

          <div className="vu-photo-viewer-frame">
            {url && decoded ? (
              <img className="vu-photo-viewer-img" src={url} alt="" />
            ) : (
              <motion.span className="vu-ring vu-photo-viewer-ring" animate={spin} />
            )}
          </div>

          <motion.button
            className="vu-circle"
            type="button"
            aria-label="Next photo"
            disabled={photos.length < 2}
            {...gestures(photos.length < 2, quietLift, quietPress)}
            onClick={() => step(1)}
          >
            <ChevronIcon />
          </motion.button>
        </div>

        {meta && (
          <span className="vu-photo-viewer-caption">
            {formatShortGameDate(meta.date)} · {slotHalf(meta.time)}
          </span>
        )}

        <div className="vu-foot">
          {meta && (
            <motion.button
              id="photo-viewer-retake"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={() => {
                retake(playthroughId, meta)
                onClose()
              }}
            >
              Retake
            </motion.button>
          )}
          <motion.button
            id="photo-viewer-save"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => void exportPhoto(playthroughId, current)}
          >
            Save photo
          </motion.button>
          <motion.button
            id="photo-viewer-close"
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
