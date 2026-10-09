import { gateBody } from '@shared/characterBody'
import { photoFeatureOn } from '@shared/photoSwitches'
import type { Character } from '@shared/types'
import { getSettings } from './services/settingsService'

/**
 * The character a render draws, as the body switch has her. Read once per render, as it starts:
 * the switch is the player's, and a character sent to be drawn arrives with whatever body her
 * file holds, whether or not it is to be used.
 */
export async function withBodySetting(character: Character): Promise<Character> {
  return gateBody(character, photoFeatureOn() && (await getSettings()).bodyDetails === true)
}
