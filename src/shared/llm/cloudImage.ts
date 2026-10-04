import { base64ToBytes, bytesToBase64 } from '../base64'
import { appError, isAppError } from '../errors'
import { assertPhotoRequest, PHOTO_TIMEOUT_MS, type PhotoRequest } from '../photos'
import type { ImageSize, ThinkingLevel } from '../providers'
import { imageTypeOf } from '../imageBytes'
import type { Settings } from '../types'
import { imageAdapterFor } from './index'
import { pictureTarget, sendCall, startClock, type PictureTarget } from './transport'

/**
 * Cloud image transport — the picture-generating sibling of `cloudLlm`. Never
 * streamed, key stays in main.
 */

/** What one image call may vary; every field absent is the room pair's call. */
export interface ImageRequest {
  /** The Gemini image model to draw on; ignored under a custom endpoint, which has its own. */
  model?: string
  /**
   * A photo's pick among a custom endpoint's image models, drawn on in place of its images model;
   * ignored under Gemini, and by every other picture.
   */
  customModel?: string
  /** Omitted from the wire when absent, never defaulted. */
  imageSize?: ImageSize
  /** The shape of the picture; absent means `16:9`. */
  aspectRatio?: string
  thinkingLevel?: ThinkingLevel
  quality?: string
  /** Images to edit or take reference from, in order, and the type each one's bytes are. */
  sources?: Array<{ bytes: Uint8Array; mimeType: string }>
  signal?: AbortSignal
}

/**
 * Sends one prompt to an image model and answers with the image bytes exactly as the
 * model returned them, never re-encoded. `sources` make it an edit of, or a reference to,
 * those images; `override` draws on candidate settings instead of the stored ones. A custom
 * endpoint's model refused while a size was asked for is asked once more at its own size.
 */
export async function generateImage(
  prompt: string,
  request: ImageRequest = {},
  override?: Settings
): Promise<Uint8Array> {
  const target = await pictureTarget('generate images', request.model, override, request.customModel)
  if (!request.imageSize || target.api === 'gemini') return drawOnce(prompt, target, request)

  try {
    return await drawOnce(prompt, target, request)
  } catch (err) {
    if (!isAppError(err) || err.code !== 'LLM_REQUEST_REJECTED') throw err
    console.log(
      `[image] ↻ ${target.label} ${target.modelId} refused ${request.imageSize}; ` +
        'asking at its own size'
    )
    return drawOnce(prompt, target, { ...request, imageSize: undefined })
  }
}

/** One round trip to `target`, answering the bytes once they read as an image. */
async function drawOnce(
  prompt: string,
  target: PictureTarget,
  request: ImageRequest
): Promise<Uint8Array> {
  const adapter = imageAdapterFor(target.api)
  const sources = request.sources ?? []

  const call = adapter.buildImageCall({
    prompt,
    baseUrl: target.baseUrl,
    modelId: target.modelId,
    apiKey: target.apiKey,
    imageSize: request.imageSize,
    aspectRatio: request.aspectRatio,
    thinkingLevel: request.thinkingLevel,
    quality: request.quality,
    images: sources.map((source) => ({
      mimeType: source.mimeType,
      data: bytesToBase64(source.bytes)
    }))
  })

  const inputKb = Math.round(sources.reduce((total, source) => total + source.bytes.length, 0) / 1024)
  const inputNote =
    sources.length === 0
      ? ''
      : sources.length === 1
        ? ` [+${sources[0].mimeType}, ${inputKb}KB]`
        : ` [+${sources.length} images, ${inputKb}KB]`
  const what = `${target.label} ${target.modelId}`
  console.log(`[image] → ${what}${inputNote}:`, prompt)
  const elapsed = startClock()

  const response = await sendCall(
    call,
    adapter,
    { tag: 'image', what, label: target.label },
    elapsed,
    request.signal
  )

  // Sizes only, never the base64: one image would bury the whole console.
  let bodyText: string
  try {
    bodyText = await response.text()
  } catch (err) {
    // An abort landing while the body drains is the same cancellation as one before it.
    if (request.signal?.aborted) throw appError('CANCELLED', 'The job was cancelled.')
    throw err
  }
  const image = adapter.imageOf(bodyText, target.label)
  const bytes = base64ToBytes(image.data)
  console.log(
    `[image] ← ${what} (${image.mimeType}, ${Math.round(bytes.length / 1024)}KB, ${elapsed()}ms)`
  )
  if (!imageTypeOf(bytes)) {
    // Retryable, with the rest of the malformed replies.
    throw appError(
      'LLM_MALFORMED',
      'The image model returned something that could not be read as an image.',
      `${image.mimeType}, ${bytes.length} bytes`
    )
  }
  return bytes
}

/**
 * Draws one Bunnyboard photo from its reference pictures, off a request already built and never
 * re-sent differently. Bounded on top of the caller's own cancellation, so a model that never
 * answers is not waited on forever; the timeout firing is its own retryable failure rather than
 * the cancellation the caller's own signal raises.
 */
export async function generatePhoto(request: PhotoRequest, signal: AbortSignal): Promise<Uint8Array> {
  // Anything but strings decodes to no picture, which the check below refuses.
  const references = Array.isArray(request.references)
    ? request.references.map((reference) => base64ToBytes(typeof reference === 'string' ? reference : ''))
    : []
  const background =
    request.background === undefined
      ? undefined
      : base64ToBytes(typeof request.background === 'string' ? request.background : '')
  assertPhotoRequest(request, references, background)
  const options = request.options
  const sources = [...references, ...(background ? [background] : [])]

  const bounded = AbortSignal.any([signal, AbortSignal.timeout(PHOTO_TIMEOUT_MS)])
  try {
    return await generateImage(request.prompt, {
      model: options.model,
      customModel: options.model,
      imageSize: options.imageSize,
      aspectRatio: options.aspectRatio,
      thinkingLevel: options.thinkingLevel,
      quality: options.quality,
      sources: sources.map((bytes) => ({ bytes, mimeType: 'image/jpeg' })),
      signal: bounded
    })
  } catch (err) {
    if (isAppError(err) && err.code === 'CANCELLED' && !signal.aborted) {
      throw appError('PHOTO_TIMEOUT', 'The image model did not answer within 5 minutes.')
    }
    throw err
  }
}
