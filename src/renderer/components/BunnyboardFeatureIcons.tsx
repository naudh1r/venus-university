import type { JSX } from 'react'

const MARK = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** A conversation being watched, shared by the rail and the page seal. */
export function MeanwhileIcon(): JSX.Element {
  return <svg {...MARK}>
    <path d="M13 14H7l-4 3V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M9 17v1a2 2 0 0 0 2 2h6l4 2V11a2 2 0 0 0-2-2h-2"/>
    <path d="m10 6 3 2-3 2Z"/>
  </svg>
}

/** A masked hare and separate quill, shared by the column's tab and seal. */
export function WhisperIcon(): JSX.Element {
  return <svg {...MARK} viewBox="0 0 64 64" strokeWidth={2.5}>
    <path d="M16 27C12 19 10 8 14 6C18 4 21 16 23 25C24 15 27 4 31 6C36 8 32 20 30 27C36 30 39 35 39 41C39 49 33 55 24 55C15 55 9 49 9 41C9 35 11 30 16 27Z"/>
    <path fill="currentColor" stroke="none" fillRule="evenodd" d="M13 35Q18 32 24 36Q30 32 35 35L33 41Q29 45 24 41Q19 45 15 41ZM16 37Q19 35 22 38Q19 40 16 37ZM26 38Q29 35 32 37Q29 40 26 38Z"/>
    <path d="M20 48c3 2 7 1 9-1"/>
    <path d="M43 47C43 34 49 23 59 17C59 30 53 40 43 47Z"/>
    <path d="M39 58 54 27"/>
  </svg>
}
