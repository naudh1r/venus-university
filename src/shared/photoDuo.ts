import {
  areNpcFriends,
  npcPairOf,
  zoneOf,
  type NpcRelationshipMap,
  type CharInfo
} from '@vx/modkit/shared'

/**
 * Who is in a group photo: two of the girls who shared the scene that just ended, one of whom
 * posts it. Two at most, because two is what the renderer holds apart.
 */

/** The girl who posts it, and the friend beside her. */
export interface GroupPhotoPair {
  poster: string
  friend: string
}

/**
 * Two of the scene's girls at random, the first the one who posts it; enemy pairs are left out.
 * Null where the scene has no pair to photograph.
 */
export function groupPhotoPair(
  cast: readonly string[],
  relationships: NpcRelationshipMap | undefined,
  rand: () => number = Math.random
): GroupPhotoPair | null {
  const people = [...new Set(cast)]
  const pairs: GroupPhotoPair[] = []
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i]
      const b = people[j]
      if (zoneOf(npcPairOf(relationships, a, b)?.affinity ?? 0) === 'enemies') continue
      pairs.push({ poster: a, friend: b }, { poster: b, friend: a })
    }
  }
  return pairs.length ? pairs[Math.floor(rand() * pairs.length)] : null
}

/** Friends and current partners share the feed's existing duo roll. */
export function canSharePhoto(
  relationships: NpcRelationshipMap | undefined,
  a: string,
  b: string
): boolean {
  return (
    a !== b &&
    (areNpcFriends(relationships, a, b) || npcPairOf(relationships, a, b)?.dating !== undefined)
  )
}

export function photoCompanions(
  relationships: NpcRelationshipMap | undefined,
  poster: string,
  roster: readonly string[]
): string[] {
  return [...new Set(roster)].filter((id) => canSharePhoto(relationships, poster, id))
}

/** The other girl's handle on a photo, only while she and its poster are friends. */
export function photoFriendHandle(
  relationships: NpcRelationshipMap | undefined,
  posterId: string,
  friendId: string | undefined,
  charInfo: Readonly<Record<string, Pick<CharInfo, 'handle'> | undefined>>
): string | null {
  if (!friendId || friendId === posterId || !canSharePhoto(relationships, posterId, friendId)) {
    return null
  }
  return charInfo[friendId]?.handle || null
}
