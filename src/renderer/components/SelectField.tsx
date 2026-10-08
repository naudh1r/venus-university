import type { JSX } from 'react'
import { motion } from 'motion/react'
import { fieldDim } from '../views/motion'

interface SelectFieldOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly SelectFieldOption[]
  /** The body-text line under the label saying what the choice means. */
  hint?: string
  /** Held where something else on the form decides it, the field dimmed as a dead one is. */
  disabled?: boolean
}

/**
 * A labelled closed picker in the final design — {@link TextField}'s sibling, and the
 * shape `TagSelect`'s own dropdown wears.
 */
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  disabled
}: SelectFieldProps): JSX.Element {
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
      <select
        id={id}
        className="vu-input vu-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </motion.label>
  )
}
