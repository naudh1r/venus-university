import { useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ConfirmModal } from '../components/ConfirmModal'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { TextField } from '../components/TextField'
import { useSettingsStore } from '../stores/settingsStore'
import { DEFAULT_SCENE_PERSONA } from '../prompts/scenePrompt'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/SystemPrompt.css'

export interface SystemPromptModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

/** The cast scene's own persona, opened for hand-editing over the Advanced Settings panel. */
export function SystemPromptModal({ theme, onClose }: SystemPromptModalProps): JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)

  // What is stored, or the shipped persona where nothing has replaced it.
  const stored = settings?.scenePersona ?? DEFAULT_SCENE_PERSONA
  const [text, setText] = useState(stored)
  // Holds off a second click while Save's write is in flight.
  const saving = useRef(false)
  // The gate in front of leaving with the well not matching what is stored.
  const [closing, setClosing] = useState(false)

  const atDefault = text === DEFAULT_SCENE_PERSONA
  const empty = text.trim().length === 0

  /** Writes the well, clearing back to the shipped default where the two now agree. */
  async function handleSave(): Promise<void> {
    if (saving.current || empty) return
    saving.current = true
    const value = text.replace(/\s+$/, '')
    const ok = await update({ scenePersona: value === DEFAULT_SCENE_PERSONA ? undefined : value })
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
          id="system-prompt-modal"
          className="vu-sysprompt vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Edit system prompt"
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation()
          }}
        >
          <TitleTab>Edit system prompt</TitleTab>

          <TextField
            id="sysprompt-text"
            label="System prompt"
            value={text}
            onChange={setText}
            multiline
          />

          <div className="vu-foot">
            <motion.button
              id="sysprompt-reset"
              className="vu-btn vu-btn--quiet"
              type="button"
              disabled={atDefault}
              {...gestures(atDefault, quietLift, quietPress)}
              onClick={() => setText(DEFAULT_SCENE_PERSONA)}
            >
              Reset to default
            </motion.button>
            <motion.button
              id="sysprompt-save"
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
            id="sysprompt-discard"
            theme={theme}
            title="Discard changes?"
            message="The system prompt has not been saved."
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
