import { endpointProblem } from '../endpoint'
import { appError, messageOf } from '../errors'
import { isModelId } from '../photos'
import {
  GEMINI_IMAGE_MODELS,
  IMAGE_MODEL_ID,
  imageApiFor,
  providerFor,
  type ImageApi
} from '../providers'
import { imageEndpointOf, imageModelOf, pictureKeyOf, writerReady } from '../settingsRules'
import type { Settings } from '../types'
import type { LlmAdapter, LlmCall } from './adapter'
import { readSettings } from './settingsPort'

/**
 * The HTTP half both cloud services share: prove the call can be made, time the round trip,
 * send it, and hand a non-2xx to the adapter.
 */

/**
 * Settings the writer can run on, or the permanent failure naming what is missing; `purpose`
 * completes that message (… in Settings to …). `override` runs candidate settings instead of
 * the stored ones.
 */
export async function writerSettings(purpose: string, override?: Settings): Promise<Settings> {
  const settings = override ?? (await readSettings())
  if (writerReady(settings, Boolean(settings.apiKey))) return settings

  if (settings.apiProvider === 'openai') {
    const problem = endpointProblem(settings.endpointUrl ?? '')
    if (problem) {
      throw appError('LLM_ENDPOINT_INVALID', `${problem} Fix the endpoint in Settings to ${purpose}.`)
    }
    throw appError(
      'API_KEY_MISSING',
      `No model is set for the custom endpoint. Name one in Settings to ${purpose}.`
    )
  }
  throw appError('API_KEY_MISSING', `No API key is configured. Add one in Settings to ${purpose}.`)
}

/** Where one picture is drawn: its wire format, root, model and key, and who its lines name. */
export interface PictureTarget {
  api: ImageApi
  baseUrl: string
  modelId: string
  apiKey: string
  /** The display label, for the console and for user-facing messages. */
  label: string
}

/**
 * Where the pictures are drawn, or the permanent failure naming what is missing; `purpose`
 * completes that message. Gemini draws on `model` when it names one of its own image models —
 * the graduation picture's pro one, or a photo's pick — else on the room pair's; a custom
 * endpoint draws at its images root on `customModel`, a photo's pick, where the host may be
 * asked for it, else on its images model, `model` going unused. `override` runs candidate
 * settings instead of the stored ones.
 */
export async function pictureTarget(
  purpose: string,
  model: string | undefined,
  override?: Settings,
  customModel?: string
): Promise<PictureTarget> {
  const settings = override ?? (await readSettings())
  const apiKey = pictureKeyOf(settings)

  if (settings.apiProvider !== 'openai') {
    if (!apiKey) {
      throw appError('API_KEY_MISSING', `No API key is configured. Add one in Settings to ${purpose}.`)
    }
    const gemini = providerFor('gemini')
    const modelId =
      model && GEMINI_IMAGE_MODELS.some((candidate) => candidate.id === model) ? model : IMAGE_MODEL_ID
    return {
      api: 'gemini',
      baseUrl: gemini.baseUrl,
      modelId,
      apiKey,
      label: gemini.label
    }
  }

  const baseUrl = imageEndpointOf(settings)
  const problem = endpointProblem(baseUrl, 'images endpoint URL')
  if (problem) {
    throw appError('LLM_ENDPOINT_INVALID', `${problem} Fix it in Settings to ${purpose}.`)
  }
  if (!apiKey) {
    throw appError('API_KEY_MISSING', `No Image API key is set. Add one in Settings to ${purpose}.`)
  }
  const api = imageApiFor(baseUrl)
  return {
    api,
    baseUrl,
    modelId: customModelOf(settings, api, customModel),
    apiKey,
    label: imageLabelOf(api)
  }
}

/**
 * The model a custom endpoint draws on: `pick` where it may be sent — on Google's host, whose URL
 * path carries it, only one of Gemini's own image models or the stored one; on an Images API host,
 * any well-formed id, which rides in the body — else the stored images model.
 */
function customModelOf(settings: Settings, api: ImageApi, pick: string | undefined): string {
  const stored = imageModelOf(settings)
  if (!pick || pick === stored) return stored
  if (api === 'gemini') {
    return GEMINI_IMAGE_MODELS.some((candidate) => candidate.id === pick) ? pick : stored
  }
  return isModelId(pick) ? pick : stored
}

/** How a picture's lines name who draws it: Gemini by its own label, anywhere else the image endpoint. */
export function imageLabelOf(api: ImageApi): string {
  return api === 'gemini' ? providerFor('gemini').label : 'Image endpoint'
}

/** Wall clock for a round trip, in ms; read on every exit path. */
export function startClock(): () => number {
  const startedAt = performance.now()
  return () => Math.round(performance.now() - startedAt)
}

/** What the console lines this call writes are tagged and titled with. */
export interface CallLog {
  /** `'llm'` or `'image'` — the bracketed prefix on every line. */
  tag: string
  /** `"Gemini gemini-3-pro"` — the provider and model, for the failure lines. */
  what: string
  /** The provider's display label on its own, for user-facing messages. */
  label: string
}

/** Sends one built call and answers with a response already known to be 2xx. */
export async function sendCall(
  call: LlmCall,
  adapter: Pick<LlmAdapter, 'errorFor'>,
  log: CallLog,
  elapsed: () => number,
  signal?: AbortSignal
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(call.url, {
      method: 'POST',
      headers: call.headers,
      body: JSON.stringify(call.body),
      signal
    })
  } catch (err) {
    console.log(`[${log.tag}] ✕ ${log.what} failed after ${elapsed()}ms`)
    // An abort arrives here as a network failure.
    if (signal?.aborted) throw appError('CANCELLED', 'The job was cancelled.')
    throw appError('LLM_NETWORK', `Could not reach ${log.label}.`, messageOf(err))
  }

  // A failure body is plain text in both modes, so the ok-check comes before any draining.
  if (!response.ok) {
    const text = await response.text()
    console.log(`[${log.tag}] ✕ ${log.what} HTTP ${response.status} after ${elapsed()}ms`)
    throw adapter.errorFor({
      status: response.status,
      contentType: (response.headers.get('content-type') ?? '').toLowerCase(),
      body: text,
      label: log.label
    })
  }

  return response
}
