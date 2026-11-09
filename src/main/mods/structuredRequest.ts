import type { StructuredRequest } from '@shared/types'
import type { Emotion } from '@shared/types'
import { isEmotion } from '@shared/emotions'
import { completeStructured } from '@shared/llm/cloudLlm'
import { getSettings } from '../services/settingsService'
import { readCharacterImage } from '../services/characterService'

/** A main-side mod request, using the configured provider without disclosing its settings. */
export async function completeModStructured<T>(request: StructuredRequest, signal: AbortSignal, lowLatency=false): Promise<T> {
  const settings = lowLatency ? {...await getSettings(),thinkingLevel:'minimal' as const,reasoningEffort:'minimal' as const} : undefined
  return completeStructured<T>(request,signal,undefined,settings)
}
/** Whether a generated or bundled expression is available for a scene participant. */
export async function hasExpressionArt(id:string, expression:Emotion):Promise<boolean>{
  return isEmotion(expression) && Boolean(await readCharacterImage(id,`expressions/${expression}.png`))
}
