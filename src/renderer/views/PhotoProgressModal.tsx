import { useEffect, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { usePhotoStore } from '../stores/photoStore'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, spin, veilIn } from './motion'
import '../vu_styles/Photos.css'

export interface PhotoProgressModalProps {
  theme: 'day' | 'night'
  jobId: string
  startedAt: number
}

/** Whole seconds since `startedAt`, ticking once a second. */
function useElapsedSeconds(startedAt: number): number {
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000))
  useEffect(() => {
    setSeconds(Math.floor((Date.now() - startedAt) / 1000))
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])
  return seconds
}

/**
 * The job the player is watching: a ring, the word, and how long it has been running. The
 * caller shows this only while `watching` names a job of the open playthrough, so dismissing
 * it is always `watch(null)` — a cancel is answered by its own button alone.
 */
export function PhotoProgressModal({ theme, jobId, startedAt }: PhotoProgressModalProps): JSX.Element | null {
  const cancel = usePhotoStore((s) => s.cancel)
  const watch = usePhotoStore((s) => s.watch)
  const seconds = useElapsedSeconds(startedAt)

  const { host, overlayProps } = useModalShell(() => watch(null))
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
        id="photo-progress"
        className="vu-note vu-photos-progress vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Creating photo"
        variants={panelUnderTab}
      >
        <TitleTab>Creating photo</TitleTab>
        <motion.span className="vu-ring vu-photos-progress-ring" animate={spin} />
        <span className="vu-photos-progress-word">Developing…</span>
        <span className="vu-photos-progress-time">{seconds}s</span>

        <div className="vu-foot vu-note-foot">
          <motion.button
            id="photo-progress-cancel"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => void cancel(jobId)}
          >
            Cancel
          </motion.button>
          <motion.button
            id="photo-progress-background"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={() => watch(null)}
          >
            Generate in background
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
