import { READER_SPEAKER, type Character, type StructuredRequest } from '@shared/types'
import { objectSchema } from '../prompts/schema'
import { useGameStore } from '../stores/gameStore'

/**
 * A line a girl says at the table, written by the model: one short line, in her voice, from a
 * cue. The cue is the game's (something just happened) or the reader's (he just said something).
 */

/** How long a line may take before the table goes on without it. */
const PATIENCE_MS = 6000

/** How much of the scene she is reminded of. */
const RECENT_LINES = 12

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

function request(character: Character, situation: string, cue: string): StructuredRequest {
  const name = character.firstName
  return {
    system: [
      'You write dialogue for one character in an interactive visual novel, a college dating sim. The reader is the main character and is spoken to as "you".',
      'Answer in JSON only.'
    ].join('\n'),
    user: [
      `CHARACTER: ${name} ${character.lastName}`.trim(),
      character.personality,
      ...(character.likes.length > 0 ? [`Likes: ${character.likes.join(', ')}`] : []),
      ...(character.dislikes.length > 0 ? [`Dislikes: ${character.dislikes.join(', ')}`] : []),
      '',
      'THE SCENE SO FAR',
      ...recentScene(),
      '',
      'AT THE TABLE',
      `${name} and the reader are in the middle of a game, played for real.`,
      situation,
      '',
      'RIGHT NOW',
      cue,
      '',
      `Write the ONE thing ${name} says out loud at this moment, in her own voice and as she is with him in this scene. At most 20 words. Her spoken words only: no narration, no actions, no quotation marks, no name in front. She does not explain the rules, read out the score, or say what is going to happen next in the game.`
    ].join('\n'),
    schema: objectSchema('minigame_line', ['line'], { line: { type: 'string' } })
  }
}

/**
 * Her line for a moment at the table, or null: the call failed, said nothing, or took longer
 * than the table waits. Never throws.
 */
export function tableLine(
  character: Character,
  situation: string,
  cue: string
): Promise<string | null> {
  // The one bridge call that takes any schema and answers whole, with no stream and no group.
  // Asked from inside the chain, so nothing about building the request can throw past it.
  const written = Promise.resolve()
    .then(
      () =>
        window.api.llm.classifyHangout(request(character, situation, cue)) as Promise<
          { ok: true; data: unknown } | { ok: false; error: unknown }
        >
    )
    .then((result) => {
      if (!result.ok) return null
      const { line } = result.data as { line?: unknown }
      const text = typeof line === 'string' ? line.trim().replace(/^["“]+|["”]+$/g, '') : ''
      return text || null
    })
    .catch(() => null)
  const tired = new Promise<null>((resolve) => setTimeout(() => resolve(null), PATIENCE_MS))
  return Promise.race([written, tired])
}
