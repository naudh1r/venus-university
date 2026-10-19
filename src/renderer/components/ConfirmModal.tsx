import type { JSX, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { gestures, lift, press, quietLift, quietPress } from '../views/motion'
import { DialogFrame } from './DialogFrame'
import { useModalShell } from './useModalShell'
import '../vu_styles/Dialog.css'

export interface ConfirmModalProps {
  id: string
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: 'day' | 'night'
  title: string
  /** The prose; a list of strings is one paragraph apiece. */
  message: ReactNode | readonly string[]
  /** Drawn under the message, inside the frame and above the foot — a checkbox the answer carries. */
  aside?: ReactNode
  confirmText?: string
  /** Label for the dismiss button. */
  cancelText?: string
  /** Locks every button while the confirmed action is still running. */
  busy?: boolean
  /** Replaces `confirmText` while `busy`. */
  busyText?: string
  /** Makes an overlay click do nothing, so the only ways out are the buttons. */
  lockOut?: boolean
  /** Lets Enter and Space give the confirm, for one the player is already answering by key. */
  enterConfirms?: boolean
  /**
   * A third answer beside confirm and cancel. Both `extraText` and `onExtra`
   * are needed for the button to appear.
   */
  extraText?: string
  onExtra?: () => void
  /** Locks the third answer alone, where what it offers is not there to give. */
  extraDisabled?: boolean
  /** Stands the third answer before the dismiss button rather than after it. */
  extraFirst?: boolean
  /** Locks the confirm alone, while what it would do is not ready to be done. */
  confirmDisabled?: boolean
  onConfirm: () => void
  /**
   * Omitted for a modal with only one way out: the dismiss button is then
   * hidden and closing the modal runs `onConfirm`.
   */
  onCancel?: () => void
  /**
   * What Escape and a click on the dimming run. Defaults to `onCancel`, then
   * `onConfirm` — pass it only when the quiet button's own action isn't the
   * right thing for those to do.
   */
  onDismiss?: () => void
}

/** Whether a message is a list of paragraphs rather than one node. */
function isParagraphs(message: ReactNode | readonly string[]): message is readonly string[] {
  return Array.isArray(message) && message.every((part) => typeof part === 'string')
}

/**
 * Yes/no gate in front of a destructive action, e.g. deleting a character. Wears the A4
 * frame (`vu_styles/Dialog.css`), which it shares with the error modal.
 */
export function ConfirmModal({
  id,
  theme,
  title,
  message,
  aside,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  busy = false,
  busyText,
  lockOut = false,
  enterConfirms = false,
  extraText,
  onExtra,
  extraDisabled = false,
  extraFirst = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  onDismiss
}: ConfirmModalProps): JSX.Element | null {
  const dismiss = onDismiss ?? onCancel ?? onConfirm
  const extra = extraText && onExtra && (
    <motion.button
      id={`${id}-extra`}
      className="vu-btn vu-btn--quiet"
      type="button"
      disabled={busy || extraDisabled}
      {...gestures(busy || extraDisabled, quietLift, quietPress)}
      onClick={onExtra}
    >
      {extraText}
    </motion.button>
  )
  const { host, overlayProps, primaryProps } = useModalShell(
    busy || lockOut ? () => {} : dismiss,
    'panel',
    enterConfirms && !busy ? onConfirm : undefined
  )
  if (!host) return null

  return createPortal(
    <DialogFrame
      id={id}
      theme={theme}
      role="dialog"
      ariaLabel={title}
      overlayProps={overlayProps}
      primaryProps={primaryProps}
      title={title}
      foot={
        <>
          {extraFirst && extra}
          {onCancel && (
            <motion.button
              id={`${id}-cancel`}
              className="vu-btn vu-btn--quiet"
              type="button"
              disabled={busy}
              {...gestures(busy, quietLift, quietPress)}
              onClick={onCancel}
            >
              {cancelText}
            </motion.button>
          )}
          {!extraFirst && extra}
          <motion.button
            id={`${id}-confirm`}
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            disabled={busy || confirmDisabled}
            {...gestures(busy || confirmDisabled, lift, press)}
            onClick={onConfirm}
          >
            {busy && busyText ? busyText : confirmText}
          </motion.button>
        </>
      }
    >
      {isParagraphs(message) ? (
        message.map((paragraph, index) => (
          <p key={index} className="vu-note-text">
            {paragraph}
          </p>
        ))
      ) : (
        <p className="vu-note-text">{message}</p>
      )}
      {aside}
    </DialogFrame>,
    host
  )
}
