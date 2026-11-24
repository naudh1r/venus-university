import { useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { gestures, quietLift, quietPress, type ScreenSlotProps } from '@vx/modkit/renderer'
import { PromptStudioModal } from './PromptStudioModal'

/** Prompt Studio's button on the Advanced tab, and the editor it raises over Settings. */
export function PromptStudioAdvancedEntry({ theme }: ScreenSlotProps['advancedSettingsEntry']): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <motion.button
        id="advanced-prompt-studio"
        className="vu-pill vu-settings-pill"
        type="button"
        {...gestures(false, quietLift, quietPress)}
        onClick={() => setOpen(true)}
      >
        Prompt Studio
      </motion.button>
      <AnimatePresence propagate>
        {open && <PromptStudioModal key="prompt-studio" theme={theme} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
