import type { JSX } from 'react'

/** The two columns of dots a row is dragged by. */
export function GripIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {[5, 12, 19].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.9" />
          <circle cx="15" cy={y} r="1.9" />
        </g>
      ))}
    </svg>
  )
}
