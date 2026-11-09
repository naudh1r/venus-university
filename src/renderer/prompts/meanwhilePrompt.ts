import type { MeanwhileContext, MeanwhileScene } from '../../shared/meanwhile'
import { fullNameOf, type StructuredRequest } from '@vx/modkit/shared'

/** Only public personality and the native encounter are supplied: no player history or memory retrieval. */
export function buildMeanwhilePrompt(event: MeanwhileScene, game: MeanwhileContext): StructuredRequest {
  return {
    system: 'Write a brief Meanwhile conversation between exactly the two supplied NPCs. The player is absent and cannot act. The encounter and its outcome are established; invented dialogue is an optional dramatization, not new canonical facts. Use mild everyday stakes and their personalities. Do not invent secrets, new romance, breakups, injuries, major life changes, sexual detail or violence. Do not mention the audience or the player or assume access to private memories. Both participants speak. No narrator or additional speakers. Produce 6–12 short dialogue lines, each at most 400 characters.',
    user: JSON.stringify({ event: { date: event.date, where: event.where, outcome: event.positive ? 'bonded' : 'argued' },
      participants: event.participants.map(id => {
        const c = game.characters[id]
        return { id, name: fullNameOf(c), personality: c.personality.slice(0,1800),
          traits: c.traits.slice(0,12).map(v => v.slice(0,100)), likes: c.likes.slice(0,8).map(v => v.slice(0,150)),
          dislikes: c.dislikes.slice(0,8).map(v => v.slice(0,150)) }
      }) }),
    schema: { name: 'meanwhile', schema: { type: 'object', additionalProperties: false, required: ['lines'], properties: {
      lines: { type: 'array', minItems: 6, maxItems: 12, items: { type: 'object', additionalProperties: false,
        required: ['speaker','text'], properties: { speaker: { type: 'string', enum: event.participants }, text: { type: 'string', maxLength: 400 } } } }
    } } }
  }
}
