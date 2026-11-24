import { gestures, quietLift, quietPress } from '@vx/modkit/renderer'
import { lazy, Suspense, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ScreenSlotProps } from '@vx/modkit/renderer'

// Load the editor only when the player opens it.
const SoundtracksModal = lazy(() => import('./SoundtracksModal').then(module => ({
  default: module.SoundtracksModal
})))

/** The mod owns its settings button and the panel it opens over Settings. */
export function SoundtrackSettings({ theme, busy }: ScreenSlotProps['settingsSection']): JSX.Element {
  const [open, setOpen] = useState(false)
  return <>
    <div className="vu-settings-data-actions">
      <motion.button
        id="settings-soundtracks"
        className="vu-pill"
        type="button"
        disabled={busy}
        {...gestures(busy, quietLift, quietPress)}
        onClick={() => setOpen(true)}
      >
        Custom soundtracks
      </motion.button>
    </div>
    <Suspense fallback={null}>
      <AnimatePresence propagate>
        {open && <SoundtracksModal key="soundtracks" theme={theme} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </Suspense>
  </>
}
