import type { JSX } from 'react'
import '../vu_styles/PhotoSettingsHint.css'

/**
 * What a change to the photo switch, or to what a picture may show, does to pictures already on
 * their way. A setting reaches what comes next and nothing before it, so a post or a text written
 * while photos were allowed still arrives — the one thing about these switches nobody would guess.
 *
 * Its own file so the settings screen carries one element for it, under the photo switch.
 */
const HINT =
  'Settings only change what comes next. Photos she has already sent stay as they are, and any still being drawn will still arrive, even after you turn on No photos on Bunnyboard or No NSFW images.'

export function PhotoSettingsHint(): JSX.Element {
  return (
    <div className="vu-photo-hint">
      <span
        className="vu-photo-hint__mark"
        tabIndex={0}
        role="img"
        aria-label={HINT}
        data-tip={HINT}
      >
        !
      </span>
    </div>
  )
}
