import type { JSX } from 'react'

/**
 * The marks a character's action row wears in the Edit modal. Lucide-shaped and drawn in
 * `currentColor`, so the square they sit in tints them with one rule.
 */

export function DuplicateIcon(): JSX.Element {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="8" width="13" height="13" rx="3" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

/** A portrait in a frame: the SillyTavern card export. */
export function CardIcon(): JSX.Element {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6 19c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5" />
    </svg>
  )
}

/** Two figures side by side: the SillyTavern sprite pack export. */
export function SpritesIcon(): JSX.Element {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0.5-3.5 2.5-5.5 5-5.5s4.5 2 5 5.5" />
      <circle cx="18" cy="7" r="2.2" />
      <path d="M14.5 13.5c2-0.6 4 0.6 5 3.5" />
    </svg>
  )
}

export function FolderIcon(): JSX.Element {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

/** A counter-clockwise arrow: Reset to default. */
export function ResetIcon(): JSX.Element {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
