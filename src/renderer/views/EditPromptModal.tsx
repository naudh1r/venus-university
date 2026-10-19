import { useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useModalShell } from '../components/useModalShell'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/EditPrompt.css'

export interface EditPromptModalProps {
  id: string
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  /** The advice above the field, in the words of the prompt being edited. */
  hint: ReactNode
  /** The failed call's `user` message, as sent. */
  initialPrompt: string
  onSubmit: (prompt: string) => void
  onCancel: () => void
}

/** The prompt behind a failed turn, opened for hand-editing. */
export function EditPromptModal({
  id,
  theme,
  hint,
  initialPrompt,
  onSubmit,
  onCancel
}: EditPromptModalProps): JSX.Element | null {
  const [prompt, setPrompt] = useState(initialPrompt)
  const empty = prompt.trim().length === 0

  // A no-op close: the overlay's click already does nothing, and Escape is the same click
  // — so silencing one silences
  // both, and this modal answers only by Cancel or Send.
  const { host, overlayProps } = useModalShell(() => {})
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
      <motion.form
        id={id}
        className="vu-editprompt vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Edit the prompt"
        variants={panelUnderTab}
        // A form, so Enter answers through the foot rather than falling through to the scene.
        onSubmit={(event) => {
          event.preventDefault()
          if (empty) return
          onSubmit(prompt)
        }}
        // And the scene behind this never sees that key: the window-level Enter advances a
        // line, and one answered here is not also answered there.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation()
        }}
      >
        <TitleTab>Edit the prompt</TitleTab>

        <p className="vu-editprompt-hint">{hint}</p>

        <TextField
          id={`${id}-text`}
          label="Prompt"
          value={prompt}
          onChange={setPrompt}
          multiline
        />

        <div className="vu-foot">
          <motion.button
            id={`${id}-cancel`}
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={onCancel}
          >
            Cancel
          </motion.button>
          <motion.button
            id={`${id}-submit`}
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            type="submit"
            disabled={empty}
            {...gestures(empty, lift, press)}
          >
            Send
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
