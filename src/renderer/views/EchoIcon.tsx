import type { JSX } from 'react'

/** A resonating spark: Echo's mark shares the other app tabs' size, weight and tint. */
export function EchoIcon(): JSX.Element {
  return (
    <svg {...APP_MARK}>
      <path d="m12 6 2 4 3 2-3 2-2 4-2-4-3-2 3-2Z" />
      <path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </svg>
  )
}

const APP_MARK = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
} as const
