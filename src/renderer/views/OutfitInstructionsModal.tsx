/**
 * When the writer should put her in one of her custom outfits, asked for from its column in the
 * Edit modal. One field, with no placeholder: a blank one takes the outfit off the writer's list.
 */
import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import {
  CUSTOM_OUTFIT_INSTRUCTIONS_MAX,
  customOutfitInstructions,
  customOutfitName
} from '@shared/outfits'
import type { CustomOutfitSlot } from '@shared/types'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { useCharacterStore } from '../stores/characterStore'
import { outfitInstructionsHint } from './characterFields'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/OutfitInstructions.css'

export interface OutfitInstructionsModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: 'day' | 'night'
  charId: string
  slot: CustomOutfitSlot
  onClose: () => void
}

export function OutfitInstructionsModal({
  theme,
  charId,
  slot,
  onClose
}: OutfitInstructionsModalProps): JSX.Element | null {
  const entry = useCharacterStore.getState().characters[charId]?.customOutfits?.[slot]
  const stored = customOutfitInstructions(entry?.instructions)
  // Named as the writer will read it: an unnamed outfit is offered under the slot id.
  const hint = outfitInstructionsHint(customOutfitName(entry?.name) || slot)
  const [text, setText] = useState(stored)
  // The write under way, which the foot answers nothing more during.
  const [busy, setBusy] = useState(false)

  /** Writes the instructions, or closes on words that change nothing; a refused write stays open. */
  async function submit(): Promise<void> {
    if (busy) return
    if (customOutfitInstructions(text) === stored) {
      onClose()
      return
    }
    setBusy(true)
    const written = await useCharacterStore
      .getState()
      .writeCustomOutfit(charId, slot, { instructions: text })
    setBusy(false)
    if (written) onClose()
  }

  // Dismissing is Cancel: nothing is written until Save.
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
        id="outfit-instructions"
        className="vu-outfit-instructions vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Outfit instructions"
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
        <TitleTab>Outfit instructions</TitleTab>

        <TextField
          id="outfit-instructions-text"
          label="Instructions"
          hint={hint}
          value={text}
          onChange={setText}
          maxLength={CUSTOM_OUTFIT_INSTRUCTIONS_MAX}
          autoFocus
        />

        <div className="vu-foot">
          <motion.button
            id="outfit-instructions-cancel"
            className="vu-btn vu-btn--quiet"
            type="button"
            disabled={busy}
            {...gestures(busy, quietLift, quietPress)}
            onClick={onClose}
          >
            Cancel
          </motion.button>
          <motion.button
            id="outfit-instructions-save"
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            type="submit"
            disabled={busy}
            {...gestures(busy, lift, press)}
          >
            Save
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
