import { useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ConfirmModal } from '../components/ConfirmModal'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { TextField } from '../components/TextField'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/SystemPrompt.css'

export interface TextEditModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  /** The panel's own id; its controls are named under `idPrefix`. */
  id: string
  idPrefix: string
  title: string
  label: string
  /** What the discard confirm says has not been kept. */
  discardMessage: string
  /** What is kept now. */
  stored: string
  /** What Reset to default puts back in the well. */
  shipped: string
  /** Lets an empty well be saved, for a text whose shipped text is empty. */
  allowEmpty?: boolean
  /** Keeps the well's text, its trailing whitespace taken off; true where it was kept. */
  save: (value: string) => boolean | Promise<boolean>
  onClose: () => void
}

/**
 * One long text opened for hand-editing in a well, behind Save, with the shipped text a click
 * away and a discard confirm in front of leaving it unsaved.
 */
export function TextEditModal({
  theme,
  id,
  idPrefix,
  title,
  label,
  discardMessage,
  stored,
  shipped,
  allowEmpty = false,
  save,
  onClose
}: TextEditModalProps): JSX.Element | null {
  const [text, setText] = useState(stored)
  // Holds off a second click while Save's write is in flight.
  const saving = useRef(false)
  // The gate in front of leaving with the well not matching what is stored.
  const [closing, setClosing] = useState(false)

  const atDefault = text === shipped
  const empty = !allowEmpty && text.trim().length === 0

  async function handleSave(): Promise<void> {
    if (saving.current || empty) return
    saving.current = true
    const ok = await save(text.replace(/\s+$/, ''))
    saving.current = false
    if (ok) onClose()
  }

  /** The gate in front of leaving: a discard confirm while the well disagrees with what is stored. */
  function requestClose(): void {
    if (text !== stored) setClosing(true)
    else onClose()
  }

  const { host, overlayProps } = useModalShell(requestClose)
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
          id={id}
          className="vu-sysprompt vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation()
          }}
        >
          <TitleTab>{title}</TitleTab>

          <TextField id={`${idPrefix}-text`} label={label} value={text} onChange={setText} multiline />

          <div className="vu-foot">
            <motion.button
              id={`${idPrefix}-reset`}
              className="vu-btn vu-btn--quiet"
              type="button"
              disabled={atDefault}
              {...gestures(atDefault, quietLift, quietPress)}
              onClick={() => setText(shipped)}
            >
              Reset to default
            </motion.button>
            <motion.button
              id={`${idPrefix}-save`}
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              type="button"
              disabled={empty}
              {...gestures(empty, lift, press)}
              onClick={() => void handleSave()}
            >
              Save
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Sibling of the veil, not a child: the confirm leaves when this panel does. */}
      <AnimatePresence propagate>
        {closing && (
          <ConfirmModal
            key="discard"
            id={`${idPrefix}-discard`}
            theme={theme}
            title="Discard changes?"
            message={discardMessage}
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
