import { ROOM_LOCATION } from './locations'
import {
  npcBestFriendOf,
  type NpcRelationshipMap,
  type NpcSlotOverlay
} from './npcRelationships'
import { PHOTO_TIERS, type PhotoTier } from './photoGate'
import type { Character, TimeSlot } from './types'

/**
 * Who a girl may put in a picture beside her, and whether the friend she named stays in it.
 *
 * The model is told no rules: only the names it may pick from. Everything that decides whether a
 * second girl is drawn is answered here, from the save, and a pick that fails any of it is a
 * picture of her alone rather than an error.
 */

/** At most this many names offered: a short list keeps the prompt short. */
const MAX_CANDIDATES = 2

/** Where the save says the roster is this slot. */
export interface DuoWhereabouts {
  overlay: NpcSlotOverlay | null
  date: number
  time: TimeSlot
  relationships: NpcRelationshipMap
}

/** Her group this slot, where the save's overlay is stamped with this slot. */
function groupOf(charId: string, where: DuoWhereabouts) {
  const { overlay } = where
  if (!overlay || overlay.date !== where.date || overlay.time !== where.time) return undefined
  return overlay.groups.find((group) => group.members.includes(charId))
}

/**
 * The girls she may name: whoever is with her this slot, else her closest friend, and never more
 * than {@link MAX_CANDIDATES}. Only girls on the roster she is drawn from.
 */
export function duoCandidates(
  charId: string,
  roster: readonly string[],
  where: DuoWhereabouts
): string[] {
  const here =
    groupOf(charId, where)?.members.filter((other) => other !== charId && roster.includes(other)) ??
    []
  if (here.length > 0) return here.slice(0, MAX_CANDIDATES)
  const best = npcBestFriendOf(where.relationships, charId, roster)
  return best ? [best] : []
}

/** Whether the two of them are together this slot, in one of their own rooms. */
export function togetherInPrivate(charId: string, friendId: string, where: DuoWhereabouts): boolean {
  const group = groupOf(charId, where)
  return (
    group !== undefined &&
    group.members.includes(friendId) &&
    group.location === ROOM_LOCATION &&
    (group.host === charId || group.host === friendId)
  )
}

/**
 * The candidate a name means: her first name, or her full name, in any case. Null where it is
 * empty or names nobody on the list.
 */
export function candidateNamed(
  name: string | undefined,
  candidates: readonly Character[]
): Character | null {
  const wanted = (name ?? '').trim().toLowerCase()
  if (!wanted) return null
  return (
    candidates.find(
      (girl) =>
        girl.firstName.toLowerCase() === wanted ||
        `${girl.firstName} ${girl.lastName}`.toLowerCase() === wanted
    ) ?? null
  )
}

/**
 * Whether the friend stays in a picture of `tier`. An everyday picture always keeps her. Past
 * that, only where she would send him that much herself and the two of them are alone together in
 * one of their rooms: otherwise she would be shown to him more undressed than she ever chose to be.
 */
export function friendStays(input: {
  tier: PhotoTier
  /** What she herself would send him, from `allowedPhotoTier`. */
  friendAllows: PhotoTier
  togetherInPrivate: boolean
}): boolean {
  if (input.tier === 'everyday') return true
  return (
    input.togetherInPrivate &&
    PHOTO_TIERS.indexOf(input.friendAllows) >= PHOTO_TIERS.indexOf(input.tier)
  )
}
