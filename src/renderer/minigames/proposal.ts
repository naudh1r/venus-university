import { fewestWith, listed, settledOptions, type MiniGameDef } from '@shared/minigames'
import type { StructuredRequest } from '@shared/types'

/** How a proposed game rides on a scene request, and how her answer is read off the reply. */

/** The reply field her answer comes back in. */
const FIELD = 'minigame'

/** A girl the reader asked: the key the model knows her by, and what the reader calls her. */
export interface Asked {
  charId: string
  key: string
  name: string
}

/**
 * The request for the turn that carries a proposal: the answer asked for as a field of the
 * reply, ahead of the lines so they are written knowing it, and what the field means said at the
 * foot of the prompt, below everything a cache could hold. Where he asked several girls at once,
 * each answers for herself, and the game is on if enough of them are in.
 */
export function withProposal(
  request: StructuredRequest,
  game: MiniGameDef,
  asked: readonly Asked[]
): StructuredRequest {
  const schema = request.schema.schema as {
    required?: string[]
    properties?: Record<string, unknown>
  }
  const options = game.options ?? []
  const several = asked.length > 1
  const name = listed(asked.map((girl) => girl.name))
  const need = fewestWith(game)
  /** A whole number in a range, asked for as one of its numerals: every provider takes that. */
  const numerals = (min: number, max: number): string[] =>
    Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
  const answer = {
    type: 'object',
    additionalProperties: false,
    required: [
      'answer',
      ...(several ? ['who'] : []),
      'stake',
      ...(options.length > 0 ? ['options'] : [])
    ],
    properties: {
      answer: { type: 'string', enum: ['accept', 'decline'] },
      ...(several
        ? {
            who: {
              type: 'object',
              additionalProperties: false,
              required: asked.map((girl) => girl.key),
              properties: Object.fromEntries(
                asked.map((girl) => [girl.key, { type: 'string', enum: ['in', 'out'] }])
              )
            }
          }
        : {}),
      stake: { type: 'string' },
      ...(options.length > 0
        ? {
            options: {
              type: 'object',
              additionalProperties: false,
              required: options.map((option) => option.id),
              properties: Object.fromEntries(
                options.map((option) => [
                  option.id,
                  { type: 'string', enum: numerals(option.min, option.max) }
                ])
              )
            }
          }
        : {})
    }
  }
  const who = several ? 'the players' : 'the two of them'
  return {
    ...request,
    user: [
      request.user,
      '',
      'MINI-GAME',
      `The reader has just asked ${name} to play ${game.name}: ${game.blurb}.`,
      `How it is played: ${game.format}`,
      ...(options.length > 0
        ? [
            `What ${who} may settle about it, in the "options" of the field:`,
            ...options.map(
              (option) =>
                `- "${option.id}": ${option.describe}. From ${option.min} to ${option.max}. Use ${option.default} unless one of them names something else out loud in this exchange.`
            ),
            several
              ? 'Never change an option on your own. A value other than the usual one must have been asked for by the reader in his words, or be said by one of the girls in your lines, so that everyone knows what they are sitting down to.'
              : 'Never change an option on your own. A value other than the usual one must have been asked for by the reader in his words, or be said by her in your lines, so that both of them know what they are sitting down to.'
          ]
        : []),
      several
        ? `That is the whole of what the table can do. The game is run for real, by its rules as written here, and nothing anyone says can change them. If the reader asks for a way of playing this does not cover, they cannot agree to that version: one of them steers it back to what the game does, in character, or they say no.`
        : `That is the whole of what the table can do. The game is run for real, by its rules as written here, and nothing either of them says can change them. If the reader asks for a way of playing this does not cover, ${name} cannot agree to that version: she steers it back to what the game does, in character, or says no.`,
      ...(several
        ? [
            'Each of them decides for herself, in character and in this moment: one may jump at it while another needs talking into it, or says no and watches.',
            `Fill the "${FIELD}" field first. "who" says for each girl asked whether she is "in" or "out" of the game right now. "answer" is "accept" only if ${need === 1 ? 'at least one of them is' : `at least ${need} of them are`} in, and "decline" otherwise. "stake" is what the players have settled is riding on the game, in one sentence written the way your narration is, with the reader as "you" ("If you win, they ..."), or "" if nothing is.`,
            'If the answer is accept, write the ones who are in saying yes and everyone getting set up, and stop there. A girl who is out stays in the scene and watches. Do NOT play the game, deal a card, or say who wins: the game is played for real straight after your lines, and you will be told how it went. Do not send end_scene.',
            'If the answer is decline, carry the scene on from their answers as you normally would.'
          ]
        : [
            `${name} decides for herself, in character and in this moment: she may jump at it, need talking into it, or say no.`,
            `Fill the "${FIELD}" field first. "answer" is "accept" only if she agrees to play right now, and "decline" otherwise. "stake" is what the two of them have settled is riding on the game, in one sentence written the way your narration is, with the reader as "you" ("If you win, she ..."), or "" if nothing is.`,
            'If she accepts, write her saying yes and the two of them getting set up, and stop there. Do NOT play the game, deal a card, or say who wins: the game is played for real straight after your lines, and you will be told how it went. Do not send end_scene.',
            'If she declines, carry the scene on from her answer as you normally would.'
          ])
    ].join('\n'),
    schema: {
      ...request.schema,
      schema: {
        ...schema,
        required: [FIELD, ...(schema.required ?? [])],
        properties: { [FIELD]: answer, ...(schema.properties ?? {}) }
      }
    }
  }
}

/**
 * The answer off a reply: whether the game is on, who is in it, the stake, and how it is to be
 * played. A reply without one is a no, and so is a yes from fewer girls than the game needs.
 */
export function answerOf(
  reply: Readonly<Record<string, unknown>>,
  game: MiniGameDef,
  asked: readonly Asked[]
): {
  accepted: boolean
  /** The girls who are in, by id, as many as the game seats. */
  charIds: string[]
  stake: string
  options: Record<string, number>
} {
  const no = { accepted: false, charIds: [], stake: '', options: settledOptions(game, undefined) }
  const field = reply[FIELD]
  if (!field || typeof field !== 'object') return no
  const { answer, who, stake, options } = field as {
    answer?: unknown
    who?: unknown
    stake?: unknown
    options?: unknown
  }
  if (answer !== 'accept') return no
  const said = who && typeof who === 'object' ? (who as Record<string, unknown>) : null
  const inIt =
    asked.length > 1 && said ? asked.filter((girl) => said[girl.key] === 'in') : [...asked]
  const charIds = inIt.slice(0, game.players.max).map((girl) => girl.charId)
  if (charIds.length < fewestWith(game)) return no
  return {
    accepted: true,
    charIds,
    stake: typeof stake === 'string' ? stake.trim() : '',
    options: settledOptions(game, options)
  }
}
