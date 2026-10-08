/**
 * The player's own name for a playthrough, asked for from inside it on Load Game. One field,
 * whose placeholder is a real value like every form's: a blank field gives the playthrough
 * back its place in creation order.
 */
import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import { PLAYTHROUGH_NAME_MAX, playthroughLabel, playthroughNameOf } from '@shared/saveRules'
import type { PlaythroughSummary } from '@shared/types'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { useSaveStore } from '../stores/saveStore'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/LoadGame.css'

export interface RenamePlaythroughModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: ScreenTheme
  playthrough: PlaythroughSummary
  onClose: () => void
}

export function RenamePlaythroughModal({
  theme,
  playthrough,
  onClose
}: RenamePlaythroughModalProps): JSX.Element | null {
  const [name, setName] = useState(playthrough.name ?? '')
  // The write under way, which the foot answers nothing more during.
  const [busy, setBusy] = useState(false)

  /** Writes the name, or closes on a name that changes nothing; a refused write stays open. */
  async function submit(): Promise<void> {
    if (busy) return
    if (playthroughNameOf(name) === (playthrough.name ?? null)) {
      onClose()
      return
    }
    setBusy(true)
    const renamed = await useSaveStore.getState().renamePlaythrough(playthrough.playthroughId, name)
    setBusy(false)
    if (renamed) onClose()
  }

  // Dismissing is Cancel: nothing is written until Rename.
  const { host, overlayProps, primaryProps } = useModalShell(onClose, 'panel', () => void submit())

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
        id="rename-playthrough"
        className="vu-load-rename vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Rename playthrough"
        variants={panelUnderTab}
        // A form, so Enter in the field is the answer the foot gives; the shell gives it to
        // Enter and Space outside the field.
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        // And nothing behind the panel answers that key as well.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation()
        }}
        {...primaryProps}
      >
        <TitleTab>Rename playthrough</TitleTab>

        <TextField
          id="rename-playthrough-name"
          label="Name"
          value={name}
          onChange={setName}
          placeholder={playthroughLabel(null, playthrough.position)}
          maxLength={PLAYTHROUGH_NAME_MAX}
          autoFocus
        />

        <div className="vu-foot">
          <motion.button
            id="rename-playthrough-cancel"
            className="vu-btn vu-btn--quiet"
            type="button"
            disabled={busy}
            {...gestures(busy, quietLift, quietPress)}
            onClick={onClose}
          >
            Cancel
          </motion.button>
          <motion.button
            id="rename-playthrough-save"
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            type="submit"
            disabled={busy}
            {...gestures(busy, lift, press)}
          >
            Rename
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
