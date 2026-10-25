import {
  fewestWith,
  settledOptions,
  suggestRate,
  type MiniGameDef,
  type SuggestRate
} from '@shared/minigames'
import { charKeyOf, type Character, type StructuredRequest } from '@shared/types'
import { locationDefOf } from '@shared/locations'
import { hereLine } from './place'

/** Detailed agreement context is sent only for a named game or an unanswered invitation. */

/** The reply field the signal comes back in; the proposal's own turn uses it for her answer. */
const FIELD = 'minigame'

const RATE: Record<SuggestRate, string> = {
  often: 'It is what people come here for: she is likely to suggest it herself, and more than once.',
  sometimes: 'She may suggest it herself when the moment is slow or playful.',
  rarely: 'She brings it up herself only if the moment really calls for it.',
  never: 'She does not bring it up herself here. The reader still may.'
}

/** A whole number in a range, asked for as one of its numerals: every provider takes that. */
function numerals(min: number, max: number): string[] {
  return Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
}

/**
 * Every option the offered games declare, by id, each at the widest range any of them gives it:
 * one shape for the field whichever game is agreed on. What comes back is held to the agreed
 * game's own range afterwards.
 */
function optionRanges(games: readonly MiniGameDef[]): Map<string, { min: number; max: number }> {
  const ranges = new Map<string, { min: number; max: number }>()
  for (const option of games.flatMap((game) => game.options ?? [])) {
    const had = ranges.get(option.id)
    ranges.set(option.id, {
      min: Math.min(had?.min ?? option.min, option.min),
      max: Math.max(had?.max ?? option.max, option.max)
    })
  }
  return ranges
}

/**
 * A turn's request with the standing offer on it: the field ahead of the lines, and what it
 * means at the foot of the prompt, below everything a cache could hold.
 */
export function withOffer(
  request: StructuredRequest,
  games: readonly MiniGameDef[],
  cast: readonly Character[],
  location: string | null,
  busy: boolean,
  keen: boolean,
  travelling = false
): StructuredRequest {
  const schema = request.schema.schema as {
    required?: string[]
    properties?: Record<string, unknown>
  }
  const ranges = optionRanges(games)
  const several = cast.length > 1
  const field = {
    type: 'object',
    additionalProperties: false,
    required: ['play', 'with', 'stake', ...(ranges.size > 0 ? ['options'] : [])],
    properties: {
      play: { type: 'string', enum: ['', ...games.map((game) => game.id)] },
      // One girl here is named, or not; of several, each is said to be in or out.
      with: several
        ? {
            type: 'object',
            additionalProperties: false,
            required: cast.map((c) => charKeyOf(c.firstName, c.lastName)),
            properties: Object.fromEntries(
              cast.map((c) => [
                charKeyOf(c.firstName, c.lastName),
                { type: 'string', enum: ['in', 'out'] }
              ])
            )
          }
        : { type: 'string', enum: ['', ...cast.map((c) => charKeyOf(c.firstName, c.lastName))] },
      stake: { type: 'string' },
      ...(ranges.size > 0
        ? {
            options: {
              type: 'object',
              additionalProperties: false,
              required: [...ranges.keys()],
              properties: Object.fromEntries(
                [...ranges].map(([id, { min, max }]) => [
                  id,
                  { type: 'string', enum: numerals(min, max) }
                ])
              )
            }
          }
        : {})
    }
  }

  const described = games.flatMap((game) => [
    `- ${game.name} (id "${game.id}"): ${game.blurb}.`,
    ...(several
      ? [
          game.players.max <= 1
            ? '  The reader plays it with one girl, or with her beside him where it is his alone to play.'
            : `  The reader plays it with ${fewestWith(game) === game.players.max ? game.players.max : `${fewestWith(game)} to ${game.players.max}`} girls at once.`
        ]
      : []),
    ...(game.options ?? []).map(
      (option) =>
        `  Option "${option.id}" (${option.label ?? option.describe}): ${
          option.values
            ? Array.from(
                { length: option.max - option.min + 1 },
                (_, i) => `${option.min + i} is ${option.values?.[option.min + i] ?? option.min + i}`
              ).join(', ')
            : `${option.min} to ${option.max}`
        }; ${option.default} is the standard game.`
    ),
    `  ${RATE[suggestRate(game, location, busy, keen)]}`
  ])

  return {
    ...request,
    user: [
      request.user, '', 'MINI-GAME AGREEMENT',
      'These are playable games. Never narrate moves, scores or outcomes; the engine reports results later.',
      ...(travelling ? [
        `Destination: ${location ? locationDefOf(location)?.label ?? location : 'another venue'}. Get agreement first; if accepted, narrate arrival with its correct background, then setup. If declined, do not travel just to play.`
      ] : hereLine(location)),
      ...described,
      ...games.map(game => `${game.name} rules: ${game.format}`),
      several
        ? 'Set minigame.play to the game ID only when the reader and participating girls have ALL agreed to play now. In minigame.with mark each girl "in" or "out"; spectators may stay. Respect participant limits.'
        : 'Set minigame.play to the game ID and minigame.with to her key only when the reader and girl have BOTH agreed to play now.',
      'Otherwise play is "" and with is empty (or every girl "out"). A suggestion, refusal, hypothetical or plan for later is not consent. Do not assume a vague reply accepts: use the conversation.',
      'stake: agreed stakes in second person, or "". Use default options unless explicitly agreed otherwise. Reject unsupported rules in character.',
      'On agreement, stop after setup; end_scene must be false. Do not play. If merely inviting, stop for the reader to answer.'
    ].join('\n'),
    schema: {
      ...request.schema,
      schema: {
        ...schema,
        required: [FIELD, ...(schema.required ?? [])],
        properties: { [FIELD]: field, ...(schema.properties ?? {}) }
      }
    }
  }
}

/**
 * The game agreed on, off a reply: which, with whom, for what and how. Null for a
 * reply that agrees on nothing, or names a game not on offer or a girl not in the scene.
 */
export function agreedOf(
  reply: Readonly<Record<string, unknown>>,
  games: readonly MiniGameDef[],
  cast: readonly Character[]
): {
  game: MiniGameDef
  /** The girls who are in, as many as the game seats. */
  characters: Character[]
  stake: string
  options: Record<string, number>
} | null {
  const field = reply[FIELD]
  if (!field || typeof field !== 'object') return null
  const { play, with: who, stake, options } = field as {
    play?: unknown
    with?: unknown
    stake?: unknown
    options?: unknown
  }
  const game = games.find((entry) => entry.id === play)
  if (!game) return null
  // Of one girl here she is named; of several, each is said to be in or out.
  const said = who && typeof who === 'object' ? (who as Record<string, unknown>) : null
  const characters = cast
    .filter((c) => {
      const key = charKeyOf(c.firstName, c.lastName)
      return said ? said[key] === 'in' : key === who
    })
    .slice(0, game.players.max)
  if (characters.length < fewestWith(game)) return null
  return {
    game,
    characters,
    stake: typeof stake === 'string' ? stake.trim() : '',
    options: settledOptions(game, options)
  }
}

export interface InviteChoice { game: MiniGameDef; location: string | null }

/** Cheap discovery context for ordinary conversation: no game options or launch schema. */
export function withGameHints(
  request: StructuredRequest, games: readonly MiniGameDef[], location: string | null,
  busy: boolean, keen: boolean, outings: readonly InviteChoice[] = []
): StructuredRequest {
  return withInvitationField({ ...request, user: [request.user, '', `GAMES HERE (${location ?? 'unknown'}):`,
    ...games.map(game => `${game.id}: ${game.blurb}. Suggest: ${suggestRate(game, location, busy, keen)}.`),
    ...outings.map(choice => `Possible outing: ${choice.game.id} at ${choice.location ? locationDefOf(choice.location)?.label ?? choice.location : ''} (${choice.location}). Agree before travelling.`),
    'Suggest naturally only when appropriate (rarely means exceptional occasions; never means do not suggest). Never narrate gameplay or results. Stop at an invitation for the reader to answer.'
  ].join('\n') }, games, [...games.map(game => ({ game, location })), ...outings])
}

/** Explicit invite metadata avoids guessing which game a later "okay" accepts. */
export function withInvitationField(request: StructuredRequest, games: readonly MiniGameDef[], choices: readonly InviteChoice[] = games.map(game => ({game, location: null}))): StructuredRequest {
  const schema = request.schema.schema as { required?: string[]; properties?: Record<string, unknown> }
  return { ...request,
    user: request.user + '\nminigameInvite: {game, location} from the listed pairs only when an NPC leaves an invitation awaiting the reader; otherwise both strings empty. Inviting never starts a game or implies consent.',
    schema: { ...request.schema, schema: { ...schema,
      required: [...(schema.required ?? []), 'minigameInvite'],
      properties: { ...schema.properties, minigameInvite: { type: 'object', additionalProperties: false, required: ['game', 'location'], properties: { game: { type: 'string', enum: ['', ...new Set(choices.map(choice => choice.game.id))] }, location: { type: 'string', enum: ['', ...new Set(choices.map(choice => choice.location).filter((id): id is string => Boolean(id)))] } } } }
    } }
  }
}
