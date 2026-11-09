import { minigameLocation, minigameSceneLocation } from '@shared/minigames'
import { locationAvailable } from '@shared/cityLife'
import { locationDefOf, ROOM_LOCATION, LOCATIONS, NARRATIVE_LOCATIONS } from '@shared/locations'
import { keyPattern, LOREBOOK } from '../prompts/lorebook'
import { useGameStore } from '../stores/gameStore'

/**
 * Where the scene on screen is, as a place id the games can be matched to, or null.
 *
 * The scene's place as the classifier wrote it is an id only when the sentence named the place
 * the way the location list does. A sentence that does not ("bowling at the student lanes", an
 * invitation another mod wrote) leaves plain words there, which match no game's places. So the
 * words are read against each place's lorebook keys too, and failing that the scene's background
 * is: the place the scene shows is where the games are.
 */
export function placeOf(sceneLocation: string | null | undefined, bg: string | null | undefined): string | null {
  for (const said of [sceneLocation, bg]) {
    const place = placeNamed(said)
    if (place) return place
  }
  return null
}

/** {@link placeOf} for the scene in the store now. */
export function scenePlace(): string | null {
  const game = useGameStore.getState()
  return reachedScenePlace(game.sceneLocation, game.sceneLog)
}

/** {@link placeOf} for the scene in the store, kept current. */
export function useScenePlace(): string | null {
  return useGameStore((s) => reachedScenePlace(s.sceneLocation, s.sceneLog))
}

/** Reached playback takes precedence over the classifier and queued scene backgrounds. */
export function reachedScenePlace(
  sceneLocation: string | null | undefined,
  reached: readonly { bg?: string }[]
): string | null {
  for (let i = reached.length - 1; i >= 0; i--) {
    const bg = reached[i].bg
    if (bg === undefined) continue
    return placeNamed(minigameSceneLocation(null, [{ bg }]) ?? bg)
  }
  return placeOf(sceneLocation, null)
}

/** Each place's lorebook keys as one pattern, built once: the selector above runs on every change. */
const PLACE_PATTERNS: readonly { id: string; pattern: RegExp }[] = LOREBOOK.flatMap((entry) =>
  entry.id && locationDefOf(entry.id)
    ? [{ id: entry.id, pattern: new RegExp(entry.keys.map((key) => keyPattern(key)).join('|'), 'iu') }]
    : []
)

/** A place id from an id, a background name or a place's own words. */
function placeNamed(text: string | null | undefined): string | null {
  const raw = (text ?? '').trim().toLowerCase()
  if (!raw) return null
  // A place another mod adds is only one where this playthrough has it.
  const known = (id: string): string | null =>
    (id === ROOM_LOCATION || locationDefOf(id)) && locationAvailable(id) ? id : null

  const direct = known(minigameLocation(raw) ?? raw)
  if (direct) return direct

  // A place's lorebook keys, the matcher's own patterns: "bowling", "the bowling alley", "arcade".
  const words = raw.replace(/_/g, ' ')
  for (const { id, pattern } of PLACE_PATTERNS) {
    if (!pattern.test(words)) continue
    const place = known(id)
    if (place) return place
  }
  return null
}

/**
 * The line that keeps a game where the scene is. A game a place has is played there: without
 * this the model may walk them off to wherever it pictures the game (an air hockey table at the
 * arcade, though the alley has one) and change the background with it.
 */
export function hereLine(place: string | null): string[] {
  const label = place ? locationDefOf(place)?.label : undefined
  return label
    ? [
        `Every game listed is played right here at ${label}, where the scene already is: agreeing to one never takes anyone somewhere else, and the background stays as it is.`
      ]
    : []
}

/** Explicit venue names in an action, never generic lore triggers such as "race". */
export function destinationOf(action: string): string | null {
  const words = (text: string): string => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
  const said = words(action)
  const matches = [...LOCATIONS, ...NARRATIVE_LOCATIONS].filter(place =>
    locationAvailable(place.id) && [place.id, place.label, ...(place.id === 'pino_cola_lounge' ? ['pino cola'] : [])]
      .some(name => said.includes(words(name))))
  const ids = [...new Set(matches.map(place => place.id))]
  return ids.length === 1 ? ids[0] : null
}
