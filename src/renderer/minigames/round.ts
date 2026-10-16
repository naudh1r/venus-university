import { READER_SPEAKER, type Character, type StructuredRequest } from '@shared/types'
import { objectSchema } from '../prompts/schema'
import { useGameStore } from '../stores/gameStore'

/**
 * A round the model runs. Most games are played by their own code and only talked about by the
 * model; a game of questions, dares or judging has rounds no code can play, and asks the model
 * for one: what a girl asks, what she makes of an answer, who she picks. What comes back is the
 * game's to use, in fields the game named; nothing goes on the scene until the game puts it there.
 */

/** What a game asks of the model for one round. */
export interface RoundAsk {
  /**
   * What the model is to do, in plain words: the game's rule for this round, what has just
   * happened, and what each field is for. Who is at the table and the scene so far are added.
   */
  brief: string
  /** What comes back, by name: a line of free text, or one of the choices listed. */
  fields: Readonly<Record<string, 'text' | readonly string[]>>
}

/** How long a round may take before the game goes on without it. */
const PATIENCE_MS = 25000

/** How much of the scene the model is reminded of. */
const RECENT_LINES = 16

/** The last of the scene, as a script: who said what, the narration unattributed. */
function recentScene(): string[] {
  const game = useGameStore.getState()
  return game.currentSceneTranscript.slice(-RECENT_LINES).map((line) => {
    if (line.speaker === READER_SPEAKER) return `The reader: ${line.text}`
    const charId = game.charKeyToId[line.speaker]
    const name = charId ? game.characters[charId]?.firstName : undefined
    return name ? `${name}: ${line.text}` : line.text
  })
}

function sheet(character: Character): string[] {
  return [
    `${character.firstName} ${character.lastName}`.trim(),
    character.personality,
    ...(character.likes.length > 0 ? [`Likes: ${character.likes.join(', ')}`] : []),
    ...(character.dislikes.length > 0 ? [`Dislikes: ${character.dislikes.join(', ')}`] : []),
    ''
  ]
}

function request(
  gameName: string,
  players: readonly Character[],
  situation: string,
  stake: string,
  ask: RoundAsk
): StructuredRequest {
  const names = Object.keys(ask.fields)
  return {
    system: [
      'You run one round of a game inside an interactive visual novel, a college dating sim. Everyone in it is an adult. The reader is the main character and is spoken to as "you". The girls are written in their own voices and as they are with him in this scene: how close each is to him is what the scene so far shows, and no further.',
      'Answer in JSON only.'
    ].join('\n'),
    user: [
      'AT THE TABLE WITH THE READER',
      ...players.flatMap(sheet),
      'THE SCENE SO FAR',
      ...recentScene(),
      '',
      `THE GAME: ${gameName}`,
      ...(situation ? [situation] : []),
      ...(stake
        ? [`Riding on it: ${stake} What is riding on a game changes nothing about what anyone would say or do in it.`]
        : []),
      '',
      'THIS ROUND',
      ask.brief,
      '',
      'Fill every field. Text a girl says is her spoken words only: no narration, no quotation marks, no name in front.'
    ].join('\n'),
    schema: objectSchema(
      'minigame_round',
      names,
      Object.fromEntries(
        names.map((name) => {
          const kind = ask.fields[name]
          return [name, kind === 'text' ? { type: 'string' } : { type: 'string', enum: [...kind] }]
        })
      )
    )
  }
}

/**
 * One round from the model, or null: the call failed, came back misshapen, or took longer than
 * the game waits. A game has something to fall back on for a null. Never throws.
 */
export function tableRound(
  gameName: string,
  players: readonly Character[],
  situation: string,
  stake: string,
  ask: RoundAsk
): Promise<Record<string, string> | null> {
  const run = Promise.resolve()
    .then(
      () =>
        window.api.llm.classifyHangout(request(gameName, players, situation, stake, ask)) as Promise<
          { ok: true; data: unknown } | { ok: false; error: unknown }
        >
    )
    .then((result) => {
      if (!result.ok || !result.data || typeof result.data !== 'object') return null
      const data = result.data as Record<string, unknown>
      const out: Record<string, string> = {}
      for (const [name, kind] of Object.entries(ask.fields)) {
        const value = data[name]
        if (typeof value !== 'string') return null
        const text = value.trim().replace(/^["“]+|["”]+$/g, '')
        if (kind !== 'text' && !kind.includes(text)) return null
        out[name] = text
      }
      return out
    })
    .catch(() => null)
  const tired = new Promise<null>((resolve) => setTimeout(() => resolve(null), PATIENCE_MS))
  return Promise.race([run, tired])
}
