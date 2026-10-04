import { useRef, useState } from 'react'
import { endpointProblem, normalizeEndpoint, normalizeImageEndpoint } from '@shared/endpoint'
import { imageFieldsProblem } from '@shared/settingsRules'

import type { ThinkingLevel } from '@shared/providers'
import type { AppError } from '@shared/types'
import { useSettingsStore } from '../stores/settingsStore'

/** What a probe of the custom endpoint has to say: nothing yet, in flight, reached, or why not. */
export type TestState = 'idle' | 'testing' | 'ok' | { error: AppError }

export interface EndpointProbeInput {
  /** Whether the fields describe a custom endpoint at all; nothing is sent while they do not. */
  enabled: boolean
  endpointUrl: string
  /** The endpoint's key as typed; blank sends none, so a stored key is tried. */
  endpointKey: string
  /** The model id as it would be saved (already trimmed). */
  modelId: string
  reasoningEffort: ThinkingLevel
}

export interface EndpointProbe {
  /** What the endpoint answered when asked which models it serves; empty where it was never asked or could not say. */
  modelIds: string[]
  test: TestState
  /** The one word beside the Test button, null until a probe has run: 'TESTING…' | 'CONNECTED' | 'FAILED'. */
  testWord: string | null
  /** Nothing to send: not a custom endpoint, a URL that cannot be sent to, no model id, or a probe in flight. */
  testDead: boolean
  /** Asks the endpoint which models it serves; a list it cannot give is simply no rows. Ignores stale answers (the URL changed while in flight). */
  refreshModels: () => Promise<void>
  /** Sends one tiny request on the fields as typed. */
  runTest: () => Promise<void>
  /** Forgets the rows and the last verdict — the endpoint they belonged to has been left. */
  reset: () => void
}

/** The one word a probe leaves beside the button, and nothing at all until one has been run. */
export function testWordOf(test: TestState): string | null {
  if (test === 'idle') return null
  if (test === 'testing') return 'TESTING…'
  return test === 'ok' ? 'CONNECTED' : 'FAILED'
}

/**
 * The two questions a form asks a custom endpoint — which models it serves, and whether it
 * answers at all — held for whichever screen is asking them. Nothing is sent on its own: the
 * screen decides when a field it would be sent on has been left.
 */
export function useEndpointProbe(input: EndpointProbeInput): EndpointProbe {
  const listModels = useSettingsStore((s) => s.listModels)
  const testWriter = useSettingsStore((s) => s.testWriter)

  // What the endpoint answered when asked which models it serves — the rows under the id
  // fields, and empty wherever it was never asked or could not say.
  const [modelIds, setModelIds] = useState<string[]>([])
  const [test, setTest] = useState<TestState>('idle')

  // The URL the newest probe was sent to: an answer naming any other is stale, the player
  // having typed on while it was in flight.
  const probed = useRef('')

  /** Asks the endpoint which models it serves; a list it cannot give is simply no rows. */
  async function refreshModels(): Promise<void> {
    if (!input.enabled || endpointProblem(input.endpointUrl) !== null) return
    const url = normalizeEndpoint(input.endpointUrl)
    probed.current = url
    const result = await listModels(url, input.endpointKey.trim() || undefined)
    if (probed.current !== url) return
    if (!result.ok) {
      setModelIds([])
      console.warn(`Could not list the models at ${url}: ${result.error.message}`)
      return
    }
    setModelIds(result.data)
  }

  /** Sends one tiny request on the writer fields as typed; what comes back is the whole answer. */
  async function runTest(): Promise<void> {
    setTest('testing')
    const result = await testWriter({
      apiProvider: 'openai',
      endpointModel: input.modelId,
      endpointUrl: normalizeEndpoint(input.endpointUrl),
      reasoningEffort: input.reasoningEffort,
      endpointApiKey: input.endpointKey.trim() || undefined
    })
    setTest(result.ok ? 'ok' : { error: result.error })
  }

  /** Forgets the rows and the last verdict, the endpoint they belonged to having been left. */
  function reset(): void {
    setModelIds([])
    setTest('idle')
  }

  return {
    modelIds,
    test,
    testWord: testWordOf(test),
    // Nothing to send while a field it would be sent on is missing, or while one is in flight.
    // An id the endpoint's list lacks is exactly what a probe should be allowed to try.
    testDead:
      !input.enabled ||
      endpointProblem(input.endpointUrl) !== null ||
      input.modelId === '' ||
      test === 'testing',
    refreshModels,
    runTest,
    reset
  }
}

export interface ImageProbeInput {
  /** Whether the fields describe a custom endpoint at all; nothing is sent while they do not. */
  enabled: boolean
  imageEndpointUrl: string
  /** The images model as typed. */
  imageModel: string
  /**
   * The images key as typed; blank sends none, so the stored one is tried, then the Gemini key on
   * Google's own host, then the endpoint's.
   */
  imageKey: string
  /** The writer endpoint as typed, whose key a blank images key draws on. */
  endpointUrl: string
  endpointKey: string
}

export interface ImageProbe {
  /** What the images URL answered when asked which image models it serves; empty where it was never asked or could not say. */
  modelIds: string[]
  test: TestState
  /** The one word beside the images Test button, null until a probe has run. */
  testWord: string | null
  /** Nothing to send: not a custom endpoint, fields Save would refuse, or a probe in flight. */
  testDead: boolean
  /** Asks the images URL which image models it serves; a list it cannot give is simply no rows. Ignores answers to an older ask. */
  refreshModels: () => Promise<void>
  /** Draws one picture on the fields as typed. */
  runTest: () => Promise<void>
  /** Forgets the rows and the last verdict — the endpoint they belonged to has been left. */
  reset: () => void
}

/**
 * The two questions a form asks a custom endpoint's images URL — which image models it serves,
 * and whether it draws at all — held for whichever screen is asking them. Nothing is sent on its
 * own: each test is one real picture, and the screen decides when a field has been left.
 */
export function useImageProbe(input: ImageProbeInput): ImageProbe {
  const listImageModels = useSettingsStore((s) => s.listImageModels)
  const testImages = useSettingsStore((s) => s.testImages)
  const [modelIds, setModelIds] = useState<string[]>([])
  const [test, setTest] = useState<TestState>('idle')

  // Which ask is the newest: an answer to any earlier one is stale, the fields it was asked on
  // having changed while it was in flight.
  const asked = useRef(0)

  /** Asks the images URL which image models it serves; a list it cannot give is simply no rows. */
  async function refreshModels(): Promise<void> {
    if (!input.enabled) return
    const ask = ++asked.current
    if (endpointProblem(input.imageEndpointUrl, 'images endpoint URL') !== null) {
      setModelIds([])
      return
    }
    const url = normalizeImageEndpoint(input.imageEndpointUrl)
    const result = await listImageModels({
      imageEndpointUrl: url,
      imageApiKey: input.imageKey.trim() || undefined,
      endpointUrl: normalizeEndpoint(input.endpointUrl),
      endpointApiKey: input.endpointKey.trim() || undefined
    })
    if (asked.current !== ask) return
    if (!result.ok) {
      setModelIds([])
      console.warn(`Could not list the image models at ${url}: ${result.error.message}`)
      return
    }
    setModelIds(result.data)
  }

  /** Draws one picture on the image fields as typed; what comes back is the whole answer. */
  async function runTest(): Promise<void> {
    setTest('testing')
    const result = await testImages({
      imageEndpointUrl: normalizeImageEndpoint(input.imageEndpointUrl),
      imageModel: input.imageModel.trim(),
      imageApiKey: input.imageKey.trim() || undefined,
      endpointUrl: normalizeEndpoint(input.endpointUrl),
      endpointApiKey: input.endpointKey.trim() || undefined
    })
    setTest(result.ok ? 'ok' : { error: result.error })
  }

  /** Forgets the rows and the last verdict, and any ask still in flight. */
  function reset(): void {
    asked.current++
    setModelIds([])
    setTest('idle')
  }

  return {
    modelIds,
    test,
    testWord: testWordOf(test),
    testDead:
      !input.enabled ||
      imageFieldsProblem(input.imageEndpointUrl, input.imageModel) !== null ||
      test === 'testing',
    refreshModels,
    runTest,
    reset
  }
}
