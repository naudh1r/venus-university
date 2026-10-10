import type { DmBasePrompt, RequestSpots } from '../hooks'
import { hasActiveHooks } from '../hooks'
import { isAwayForSpringBreak } from '../../prompts/springBreak'

/** Replace only built-in writing instructions when Photo Feature is installed and enabled. */
export function strictPhotoDmBase({ character, state }: RequestSpots['dm']): DmBasePrompt | undefined {
  if (!hasActiveHooks('photo-feature')) return undefined
  const away = isAwayForSpringBreak(state.springBreakAway, character.charId, state.date)
  return {
    system: 'Write the supplied character\'s side of a private Bunnyboard phone conversation in her own voice. Use the supplied personality, relationships, memories, and current circumstances. Casual spelling and emoji may suit her. Follow the supplied JSON schema and photo instructions.',
    turn: [
      'YOUR TURN',
      `Reply as ${character.firstName} to the reader's latest text in RECENT MESSAGES. Write only what she types in "messages"; let her established relationship guide her willingness, without forcing a slow burn.`,
      away
        ? 'She is away from campus; respect the supplied spring-break plans when discussing a meeting.'
        : 'She is free to meet now if willing. Respect her supplied whereabouts; if already out, she may prefer the reader to come to her. Do not assume acceptance.',
      ''
    ],
    result: [
      'REPLY STATE',
      'Set "blocked" to true only when she decides to cut off contact completely, with fitting final messages; ordinary annoyance or hurt is insufficient. Otherwise use false.',
      'For "summary", merge TEXTING SO FAR (if present), RECENT MESSAGES, and this reply into a concise recap of what she should remember. Use third person and "the reader", omit concrete dates and unimportant details.'
    ]
  }
}
