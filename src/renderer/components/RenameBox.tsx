import { useRef, useState, type JSX } from 'react'
import { useDismissLayer } from './useModalShell'

export interface RenameBoxProps {
  /** `.vu-input` and the caller's own class, which sizes the box to the words it stands in for. */
  className: string
  /** What the box is called to a screen reader, where nothing beside it names it. */
  ariaLabel?: string
  /** The name the box opens on. */
  value: string
  placeholder: string
  max: number
  /** The name as it was left, trimmed; not called where Escape or a right-click dropped it. */
  onCommit: (name: string) => void
  /** The box closes, committed or not. */
  onDone: () => void
}

/**
 * A name typed over in place of the words it replaces: Enter or leaving the box keeps it, and
 * Escape or a right-click puts the old one back.
 */
export function RenameBox({
  className,
  ariaLabel,
  value,
  placeholder,
  max,
  onCommit,
  onDone
}: RenameBoxProps): JSX.Element {
  const [nameText, setNameText] = useState(value)
  // Set by Escape or a right-click, so the blur that follows the box leaving commits nothing.
  const dropped = useRef(false)
  /* Escape or a right-click off the box puts the old name back, and it is answered here ahead
     of the modal behind the box, which would otherwise close on the same press. */
  useDismissLayer(() => {
    dropped.current = true
    onDone()
  }, true)

  return (
    <input
      className={className}
      type="text"
      aria-label={ariaLabel}
      maxLength={max}
      placeholder={placeholder}
      value={nameText}
      autoFocus
      onChange={(event) => setNameText(event.target.value)}
      onBlur={() => {
        onDone()
        if (dropped.current) {
          dropped.current = false
          return
        }
        onCommit(nameText.trim())
      }}
      // Enter commits through the blur rather than through a form, and reaches nothing behind
      // the box.
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.blur()
      }}
    />
  )
}
