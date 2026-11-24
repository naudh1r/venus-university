import { useEffect, useId, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import softwareNotice from '../../../assets/echo-public/echo-third-party-notices.txt?raw'
import modelLicense from '../../../assets/echo-public/echo-model-license.txt?raw'
import { useDismissLayer } from './useModalShell'
import type { ScreenTheme } from '../views/clockTheme'
import '../vu_styles/EchoNotice.css'

const notices = {
  software: { title: 'Artwork software notices', text: softwareNotice },
  models: { title: 'Model license', text: modelLicense }
}

/** Bundled, read-only text: works offline and never opens a file: URL or arbitrary path. */
export function EchoNotice({ notice, theme }: { notice: keyof typeof notices; theme?: ScreenTheme }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [inheritedTheme, setInheritedTheme] = useState<ScreenTheme>('day')
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId(), content = notices[notice]
  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    // The dismiss stack closes this layer during keydown. Suppress the native
    // default too, or Escape can then close the underlying Echo dialog.
    const preventNativeEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') event.preventDefault() }
    window.addEventListener('keydown', preventNativeEscape, true)
    element.showModal()
    return () => { window.removeEventListener('keydown', preventNativeEscape, true); element.close(); trigger.current?.focus() }
  }, [open])
  useDismissLayer(() => setOpen(false), open)
  return <>
    <button ref={trigger} type="button" className="echo-notice-link" onClick={event => {
      setInheritedTheme(event.currentTarget.closest('[data-theme]')?.getAttribute('data-theme') === 'night' ? 'night' : 'day')
      setOpen(true)
    }}>{content.title}</button>
    {open && createPortal(<dialog ref={dialog} className="echo-notice-dialog" data-theme={theme ?? inheritedTheme} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); setOpen(false) }}
      onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <header><h2 id={titleId}>{content.title}</h2><button type="button" className="vu-btn vu-btn--quiet" autoFocus onClick={() => setOpen(false)}>Close notices</button></header>
      <pre tabIndex={0}>{content.text}</pre>
    </dialog>, document.body)}
  </>
}
