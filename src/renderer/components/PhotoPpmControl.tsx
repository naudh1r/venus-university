import { useEffect, useRef, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ConfirmModal,
  gestures,
  quietLift,
  quietPress,
  type OptionControlProps,
  type ScreenTheme
} from '@vx/modkit/renderer'
import type { PhotoPpmState } from '../../shared/photoTypes'
import { photoInvoke } from '../stores/photoInvoke'

/** The ppm option's pack state and install confirmation; the player's own server gets a note. */
export function PhotoPpmControl({ on }: OptionControlProps): JSX.Element | null {
  const [state, setState] = useState<PhotoPpmState | null>(null)
  const [installing, setInstalling] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [asking, setAsking] = useState<ScreenTheme | null>(null)
  const row = useRef<HTMLSpanElement>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    if (!on) {
      setState(null)
      return () => { live.current = false }
    }
    void photoInvoke('ppmState', [])
      .then((result) => {
        if (live.current && result.ok) setState(result.data)
      })
      .catch(() => {})
    return () => {
      live.current = false
    }
  }, [on])

  /** Installs the pack, then reads where it stands again. */
  const install = async (): Promise<void> => {
    setAsking(null)
    setInstalling(true)
    setFailure(null)
    try {
      const result = await photoInvoke('installPpm', [])
      if (!live.current) return
      if (!result.ok) setFailure(result.error.message)
      const after = await photoInvoke('ppmState', [])
      if (live.current && after.ok) setState(after.data)
    } catch (error) {
      if (live.current) setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      if (live.current) setInstalling(false)
    }
  }

  if (!on || state === null || state === 'off') return null
  if (state === 'unmanaged') {
    return (
      <span className="vu-check-note">
        Install ComfyUI-ppm on your own ComfyUI to use it for photos of two.
      </span>
    )
  }
  if (state === 'installed' && !installing) {
    return (
      <span className="vu-check-note">ComfyUI-ppm is installed. Photos of two start wide and can be redrawn portrait.</span>
    )
  }
  return (
    <span className="vu-test-row" ref={row}>
      <motion.button
        type="button"
        className="vu-btn vu-btn--quiet"
        disabled={installing}
        {...gestures(installing, quietLift, quietPress)}
        onClick={() =>
          setAsking(
            row.current?.closest('[data-theme]')?.getAttribute('data-theme') === 'day'
              ? 'day'
              : 'night'
          )
        }
      >
        Install ComfyUI-ppm
      </motion.button>
      {(installing || failure) && (
        <span className="vu-btn-sub">{installing ? 'INSTALLING…' : 'FAILED'}</span>
      )}
      <span className="vu-check-note">
        ComfyUI-ppm keeps the two in a photo apart. Photos of two start wide and can be redrawn portrait.
      </span>
      {failure && !installing && <span className="vu-test-note">{failure}</span>}
      <AnimatePresence>
        {asking && (
          <ConfirmModal
            key="photo-ppm-install"
            id="photo-ppm-install"
            theme={asking}
            title="Install ComfyUI-ppm?"
            message={[
              'ComfyUI-ppm needs a recent ComfyUI. It was tested on 0.37.1.',
              'ComfyUI restarts once it is installed, so a photo being drawn right now may fail.'
            ]}
            confirmText="Install"
            onConfirm={() => {
              void install()
            }}
            onCancel={() => setAsking(null)}
          />
        )}
      </AnimatePresence>
    </span>
  )
}
