/**
 * Whether the reader commented during this phone visit. Kept apart from the thread call so the
 * mod's registration can watch the phone without loading anything that draws.
 */

let commented = false

/** He left a comment; closing the phone will ask for the answers. */
export function markCommented(): void {
  commented = true
}

/** Whether he commented since the last time this was asked, clearing it. */
export function takeCommented(): boolean {
  const was = commented
  commented = false
  return was
}
