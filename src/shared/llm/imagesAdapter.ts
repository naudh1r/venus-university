import { appError, truncate } from '../errors'
import { isAspectRatio } from '../photos'
import { isImageSize, type ImageModelCaps } from '../providers'
import type { AppError } from '../types'
import type {
  BuildImageCallContext,
  ErrorContext,
  GeneratedImage,
  ImageAdapter,
  LlmCall,
  ModelsCall
} from './adapter'
import {
  classify,
  envelopeErrorFor,
  statusOf,
  type EndpointWording,
  type OpenAiError
} from './openaiAdapter'

/**
 * OpenRouter's Images API, for whatever images URL a custom endpoint names beyond Google's own:
 * one `POST {root}/images` per picture, answered with the image as base64, and the models it
 * accepts listed at `{root}/images/models`.
 */

/** How a failure here names its URL: the images endpoint's, answering the Images API. */
const IMAGES_WORDING: EndpointWording = {
  urlField: 'images endpoint URL',
  service: 'image endpoint'
}

/** Minimal shape of one Images API reply. */
interface ImagesResponse {
  data?: Array<{ b64_json?: unknown; media_type?: unknown; url?: unknown }>
  error?: OpenAiError
}

/** The type and base64 of a `data:` URL, or null for anything else. */
function dataUrlImage(url: unknown): GeneratedImage | null {
  if (typeof url !== 'string') return null
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(url)
  return match ? { mimeType: match[1], data: match[2] } : null
}

/**
 * The Images API call: landscape by default, the sources as its reference images in order, and a
 * resolution or quality only where the caller asked for one — a model is refused a field it does
 * not take. `thinkingLevel` has no field on this wire, so it never rides.
 */
function buildImageCall(args: BuildImageCallContext): LlmCall {
  return {
    url: `${args.baseUrl}/images`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`
    },
    body: {
      model: args.modelId,
      prompt: args.prompt,
      aspect_ratio: args.aspectRatio ?? '16:9',
      ...(args.imageSize ? { resolution: args.imageSize } : {}),
      ...(args.quality ? { quality: args.quality } : {}),
      ...(args.images && args.images.length > 0
        ? {
            input_references: args.images.map((image) => ({
              type: 'image_url',
              image_url: { url: `data:${image.mimeType};base64,${image.data}` }
            }))
          }
        : {})
    }
  }
}

/**
 * The first image of a reply. A reply with no `data` list at all is not the Images API
 * answering, so it is permanent rather than a billed call to repeat; an empty list is the model
 * drawing nothing, retried like Gemini's.
 */
function imageOf(rawBody: string, label: string): GeneratedImage {
  let parsed: ImagesResponse
  try {
    parsed = JSON.parse(rawBody) as ImagesResponse
  } catch {
    throw appError('LLM_MALFORMED', 'The API response was not valid JSON.', truncate(rawBody, 2000))
  }

  if (parsed.error) {
    throw classify(statusOf(parsed.error), parsed.error, label, '', IMAGES_WORDING)
  }
  if (!Array.isArray(parsed.data)) {
    throw appError(
      'LLM_REQUEST_REJECTED',
      `${label} did not answer the way an Images API does. Check the images endpoint URL in Settings.`,
      truncate(rawBody, 2000)
    )
  }

  const first = parsed.data[0]
  if (typeof first?.b64_json === 'string' && first.b64_json) {
    const mimeType = typeof first.media_type === 'string' ? first.media_type : 'image/png'
    return { mimeType, data: first.b64_json }
  }
  const inline = dataUrlImage(first?.url)
  if (inline) return inline
  throw appError('LLM_EMPTY', 'The model returned no image.', truncate(rawBody, 2000))
}

/** The models the Images API itself accepts, which OpenRouter lists without a key. */
function modelsCall(baseUrl: string, apiKey: string): ModelsCall {
  return {
    url: `${baseUrl}/images/models`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  }
}

/** The ids of an Images API model listing. */
function modelIdsOf(rawBody: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return []
  }
  const data = (parsed as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []

  const ids = new Set<string>()
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id) ids.add(id)
  }
  return [...ids].sort()
}

/** A quality word as the Images API lists one. */
function isQualityWord(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{1,16}$/.test(value)
}

/**
 * What one entry of an Images API model listing takes, trusting nothing about its shape: the
 * enum values a supported parameter names, filtered to what this app itself can send, and the
 * ceiling `input_references` puts on a reference image, absent meaning none at all.
 */
export function imageCapsOf(entry: unknown, id: string): ImageModelCaps {
  const model = entry as {
    name?: unknown
    supported_parameters?: {
      resolution?: { values?: unknown }
      aspect_ratio?: { values?: unknown }
      quality?: { values?: unknown }
      input_references?: { max?: unknown }
    }
  } | null
  const params = model?.supported_parameters ?? {}

  const resolutionValues = params.resolution?.values
  const aspectValues = params.aspect_ratio?.values
  const qualityValues = params.quality?.values
  const max = params.input_references?.max

  return {
    id,
    label: typeof model?.name === 'string' && model.name ? model.name : id,
    sizes: (Array.isArray(resolutionValues) ? resolutionValues : []).filter(isImageSize),
    aspectRatios: (Array.isArray(aspectValues) ? aspectValues : []).filter(isAspectRatio),
    thinkingLevels: [],
    qualities: (Array.isArray(qualityValues) ? qualityValues : []).filter(isQualityWord),
    maxReferences: typeof max === 'number' && Number.isFinite(max) ? max : 0
  }
}

export const imagesAdapter: ImageAdapter = {
  buildImageCall,
  imageOf,
  modelsCall,
  modelIdsOf,

  errorFor(context: ErrorContext): AppError {
    return envelopeErrorFor(context, IMAGES_WORDING)
  }
}
