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
import { photoInvoke } from '../stores/photoInvoke'

type PpmState = 'installed' | 'missing' | 'invalid' | 'unmanaged'

/**
 * Under Two in one photo on the Mods screen: whether ComfyUI-ppm, which draws photos of two
 * wide, is in the game's ComfyUI, and the button that installs it after asking. On the player's
 * own ComfyUI there is nothing to install from here, so it says so in one line.
 */
export function PhotoPpmControl(_props: OptionControlProps): JSX.Element | null {
  const [state, setState] = useState<PpmState | null>(null)
  const [installing, setInstalling] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [asking, setAsking] = useState<ScreenTheme | null>(null)
  const row = useRef<HTMLSpanElement>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    void photoInvoke('ppmState', [])
      .then((result) => {
        if (live.current && result.ok) setState(result.data)
      })
      .catch(() => {})
    return () => {
      live.current = false
    }
  }, [])

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

  if (state === null) return null
  if (state === 'unmanaged') {
    return (
      <span className="vu-check-note">
        Your own ComfyUI draws photos of two wide once ComfyUI-ppm is installed there.
      </span>
    )
  }
  if (state === 'installed' && !installing) {
    return (
      <span className="vu-check-note">ComfyUI-ppm is installed: photos of two are drawn wide.</span>
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
        With ComfyUI-ppm, photos of two are drawn wide, and the two meet in the middle less often.
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
