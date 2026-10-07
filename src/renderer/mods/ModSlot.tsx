import type { JSX } from 'react'
import { screenParts, type ScreenSlot, type ScreenSlots } from './hooks'

/**
 * One place in a game screen where mods draw: whatever each mod that is on gives the slot, in
 * list order, and nothing at all when none does.
 */
export function ModSlot<S extends ScreenSlot>({
  slot,
  ...props
}: { slot: S } & ScreenSlots[S]): JSX.Element {
  const parts = screenParts(slot)
  return (
    <>
      {parts.map((Part, index) => (
        <Part key={index} {...(props as unknown as ScreenSlots[S] & JSX.IntrinsicAttributes)} />
      ))}
    </>
  )
}
