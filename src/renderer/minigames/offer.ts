import {
  fewestWith,
  settledOptions,
  suggestRate,
  type MiniGameDef,
  type SuggestRate
} from '@shared/minigames'
import { charKeyOf, type Character, type StructuredRequest } from '@shared/types'

/**
 * The standing offer: on every turn of a scene where a game can be played with a girl, the model
 * is told the games are real and played at the table, how readily she brings each up herself, and
 * how to say that the two of them have agreed to play one, whoever suggested it and however the
 * other answered. That signal opens the table, exactly as a yes to the reader's own proposal does.
 */

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
  keen: boolean
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
      request.user,
      '',
      'MINI-GAMES',
      'These games are real here. They are played at a table the reader actually plays at, by their own rules, and you are told afterwards how they went. Never play one out in your lines: do not deal, turn a card, take a shot or say who wins.',
      ...described,
      'A girl suggests a game only as its note above allows, only when it suits her and the moment, and in her own words. When she does, your lines end on her asking, so the reader can answer.',
      `THE "${FIELD}" FIELD`,
      ...(several
        ? [
            'Fill it first. Leave "play" as "" and every girl in "with" as "out" unless, by the end of your lines, the reader and the girls who are to play have ALL agreed in words to play one of these games right now. It takes his word as well as theirs: either his action this turn says yes to a game one of them suggested, or his action asks and they say yes in your lines. A suggestion nobody has answered yet is not an agreement, and neither is talk of playing later.',
            'When they have agreed: "play" is the game\'s id, and "with" says "in" for each girl who is playing and "out" for each who is not, as many in as the game is played with and no more. A girl who is out stays in the scene and watches.'
          ]
        : [
            'Fill it first. Leave "play" and "with" as "" unless, by the end of your lines, the reader and one girl have BOTH agreed in words to play one of these games right now. It takes his word as well as hers: either his action this turn says yes to a game she suggested, or his action asks her to play and she says yes in your lines. A suggestion nobody has answered yet is not an agreement, and neither is talk of playing later.',
            'When they have agreed: "play" is the game\'s id and "with" is her.'
          ]),
      '"stake" is what they have settled is riding on it, in one sentence written the way your narration is, with the reader as "you", or "" if nothing is. An option keeps its standard value unless a different one was named out loud, by him in his action or by her in your lines; never change one on your own.',
      'Then write them getting set up and stop there, without playing. Do not send end_scene on that turn.',
      'That is the whole of what the table can do: nothing either of them says changes a game\'s rules. If the reader asks for a way of playing a game does not cover, she steers it back to what the game does, in character, or says no.'
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
