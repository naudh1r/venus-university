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
 * Two of the scene's girls at random, the first the one who posts it; null where fewer than two
 * shared the scene.
 */
export function groupPhotoPair(
  cast: readonly string[],
  rand: () => number = Math.random
): GroupPhotoPair | null {
  const girls = [...new Set(cast)]
  if (girls.length < 2) return null
  const poster = girls.splice(Math.floor(rand() * girls.length), 1)[0]
  const friend = girls[Math.floor(rand() * girls.length)]
  return { poster, friend }
}
