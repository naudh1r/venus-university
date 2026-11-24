import {
  CHARACTER_DYNAMICS_MOD, dynamicsKnowsReader, readCharacterDynamics, settleCharacterDynamics,
  type CharacterDynamics
} from './characterDynamics'
import { finalizeEchoSetup } from './echoSetup'
import type { Character, EnrollmentDraft, SaveDraft } from './types'

/** Every established character stays locked, including girls without assigned tags. */
export function returningSetupIds(draft: EnrollmentDraft): string[] {
  const continued = draft.continued
  return continued ? [...new Set([
    ...Object.keys(continued.priorProfiles), ...Object.keys(continued.carry.charInfo)
  ])] : []
}

/** Settle only newcomers against the ending's inherited history, retaining absent girls too. */
export function continuedDynamics(
  draft: EnrollmentDraft, roster: readonly Character[], choices: CharacterDynamics
): CharacterDynamics {
  const returning = new Set(returningSetupIds(draft))
  return settleCharacterDynamics(choices, roster.map(c => c.charId).filter(id => !returning.has(id)),
    readCharacterDynamics(draft.continued?.carry.mods))
}

/** Accepted setup augments the native opening save without replaying a returning girl's history. */
export function withContinuedModSetup(
  save: SaveDraft, draft: EnrollmentDraft, roster: readonly Character[]
): SaveDraft {
  if (!draft.continued) return save
  let result = save
  if (draft.mods?.includes(CHARACTER_DYNAMICS_MOD) && draft.exCharacterDynamics) {
    const dynamics = continuedDynamics(draft, roster, draft.exCharacterDynamics)
    const returning = new Set(returningSetupIds(draft))
    const charInfo = { ...save.charInfo }
    for (const girl of roster) {
      const entry = charInfo[girl.charId]
      if (entry && !returning.has(girl.charId) && dynamicsKnowsReader(dynamics, girl.charId)) {
        charInfo[girl.charId] = { ...entry, nameKnown: true, flags: { ...entry.flags, hasMet: true } }
      }
    }
    result = { ...result, exCharacterDynamics: dynamics, charInfo }
  }
  if (draft.exEcho) {
    result = { ...result, exEcho: finalizeEchoSetup(draft.exEcho, roster, draft.continued.carry.mods?.exEcho) }
  }
  return result
}
