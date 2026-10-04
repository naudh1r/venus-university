import { useRef, type JSX } from 'react'
import { motion } from 'motion/react'
import { fieldDim } from '../views/motion'
import { useFitToText } from './useFitToText'

export interface TextFieldProps {
  id: string
  /** The mono label over the box; it is also what the field is called to a screen reader. */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** The one line of body text under the label saying what shape the field wants. */
  hint?: string
  /** Caps how much the field takes, single-line or multiline; a name is 32. */
  maxLength?: number
  /** Fires when the field is left, single-line or multiline, for whatever its value is checked against. */
  onBlur?: () => void
  multiline?: boolean
  rows?: number
  /** Grow the box to fit its text. */
  autoGrow?: boolean
  /** Takes focus when the field mounts — a form modal's first field. */
  autoFocus?: boolean
  /** Dims the whole field and disables its input, the way a dead checkbox row does. */
  disabled?: boolean
}

/**
 * A labelled text field: pill single-line, rounded box multiline. The layout is `base.css`'s,
 * shared by every form.
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  onBlur,
  multiline,
  rows = 3,
  autoGrow,
  autoFocus,
  disabled
}: TextFieldProps): JSX.Element {
  const area = useRef<HTMLTextAreaElement | null>(null)

  useFitToText(area, value, autoGrow ?? false)

  return (
    // The disabled rule in CSS reaches buttons alone, so the field dims itself here instead.
    <motion.label
      className="vu-field"
      htmlFor={id}
      variants={fieldDim}
      initial={false}
      animate={disabled ? 'dead' : 'live'}
    >
      <span className="vu-field-label">{label}</span>
      {hint && <span className="vu-field-hint">{hint}</span>}
      {multiline ? (
        <textarea
          ref={area}
          id={id}
          className={`vu-input vu-input--multiline${autoGrow ? ' vu-input--grow' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          onBlur={onBlur}
          autoFocus={autoFocus}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          type="text"
          className="vu-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          onBlur={onBlur}
          autoFocus={autoFocus}
          disabled={disabled}
        />
      )}
    </motion.label>
  )
}
