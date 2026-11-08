import { character, characterInfo, conversation, rosterIds, npcRelationships, clock,
  gameFacts, currentRun } from '@vx/modkit/renderer'
import { charKeyOf, type Character, type CharInfo, type Conversation } from '@vx/modkit/shared'

/** One detached view for Photo's multi-contact decisions; all records come from kit readers. */
export function photoGame() {
  const ids = rosterIds({ alumni: true })
  const characters: Record<string, Character> = {}
  const charInfo: Record<string, CharInfo> = {}
  const conversations: Record<string, Conversation> = {}
  const charKeyToId: Record<string, string> = {}
  for (const id of ids) {
    const girl = character(id)
    const info = characterInfo(id)
    const thread = conversation(id)
    if (girl) { characters[id] = girl; charKeyToId[charKeyOf(girl.firstName, girl.lastName)] = id }
    if (info) charInfo[id] = info
    if (thread) conversations[id] = thread
  }
  return { ...gameFacts(), date: clock()?.date ?? 0, time: clock()?.time ?? 0,
    characters, charInfo, bunnyboard: { conversations }, charKeyToId,
    chars: [...rosterIds()], npcRelationships: npcRelationships() ?? {}, run: currentRun() }
}
