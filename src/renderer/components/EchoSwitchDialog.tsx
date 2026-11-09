import { useEffect, useId, useRef, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { useDismissLayer } from './useModalShell'
import type { ScreenTheme } from '../views/clockTheme'
import '../vu_styles/Dialog.css'
import '../vu_styles/EchoSwitchDialog.css'

export function EchoSwitchDialog({ firstName, ownerName, theme, busy, canSave, error, onStay, onDiscard, onSave }: {
  firstName?: string
  ownerName?: string
  theme?: ScreenTheme
  busy: boolean
  canSave: boolean
  error: string
  onStay: () => void
  onDiscard: () => void
  onSave: () => void
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null), stay = useRef<HTMLButtonElement>(null)
  const titleId = useId(), descriptionId = useId()
  useEffect(() => {
    const element = dialog.current!, previousFocus = document.activeElement as HTMLElement | null
    // Do not let native Escape also dismiss the manager beneath this dialog.
    const preventNativeEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') event.preventDefault() }
    window.addEventListener('keydown', preventNativeEscape, true)
    element.showModal()
    stay.current?.focus()
    return () => {
      window.removeEventListener('keydown', preventNativeEscape, true)
      element.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  useDismissLayer(() => { if (!busy) onStay() }, true)
  return createPortal(<dialog ref={dialog} className="echo-switch-dialog" data-theme={theme}
    aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onStay() }}
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <section className="vu-dialog vu-paper">
      <span className="vu-dialog-badge vu-paper" aria-hidden="true">!</span>
      <p className="echo-switch-label">UNSAVED ECHO SETTINGS</p>
      <h2 className="vu-dialog-title" id={titleId}>{firstName ? `Save ${firstName}’s Echo changes?` : 'Save your Echo changes?'}</h2>
      <p className="echo-switch-copy" id={descriptionId}>You have unsaved changes to <strong>{ownerName ? `${ownerName}’s Echo` : 'your Echo'}</strong>.<br/>Save your changes before switching Echoes?</p>
      {error && <p className="echo-switch-error" role="alert">{error}</p>}
      <div className="vu-dialog-foot">
        <button ref={stay} type="button" className="vu-btn vu-btn--quiet" disabled={busy} onClick={onStay}>Stay here</button>
        <button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={busy} onClick={onDiscard}>Discard and switch</button>
        <button type="button" className="vu-btn vu-btn--primary vu-paper" disabled={busy || !canSave} onClick={onSave}>{busy ? 'Saving…' : 'Save and switch'}</button>
      </div>
    </section>
  </dialog>, document.body)
}
