import { useEffect, useRef, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ConfirmModal,
  gestures,
  quietLift,
  quietPress,
  type OptionControlProps,
  useLocalImageSource,
  type ScreenTheme
} from '@vx/modkit/renderer'
import { refreshPhotoPpm, usePhotoPpmState } from '../stores/photoPpm'
import { photoInvoke } from '../stores/photoInvoke'

/** The duo option's pack state and install confirmation, or a note for the player's own server. */
/** The node pack's repository, opened in the player's browser. */
const PPM_LINK = (
  <a className="vu-link" href="https://github.com/pamparamm/ComfyUI-ppm" target="_blank" rel="noreferrer">ComfyUI-ppm</a>
)

export function PhotoPpmControl({ on }: OptionControlProps): JSX.Element | null {
  const state = usePhotoPpmState()
  const source = useLocalImageSource()
  const [installing, setInstalling] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [asking, setAsking] = useState<ScreenTheme | null>(null)
  const row = useRef<HTMLSpanElement>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    if (on) void refreshPhotoPpm()
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
      await refreshPhotoPpm()
      if (live.current && !result.ok) setFailure(result.error.message)
    } catch (error) {
      if (live.current) setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      if (live.current) setInstalling(false)
    }
  }

  if (!on || state === null) return null
  if (state !== 'installed' && (source === 'external' || state === 'unmanaged')) {
    return (
      <span className="vu-check-note">
        Photos of two need the {PPM_LINK} node pack. Install it on your own ComfyUI, then restart that server.
      </span>
    )
  }
  if (state === 'installed' && !installing) {
    return (
      <span className="vu-check-note">{PPM_LINK} is installed. Photos of two start wide and can be redrawn portrait.</span>
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
        Photos of two need the {PPM_LINK} node pack. Without it, every photo shows one person.
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
