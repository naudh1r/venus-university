import type { ImageApi, ProviderApi, ProviderConfig } from '../providers'
import type { ImageAdapter, LlmAdapter } from './adapter'
import { geminiAdapter } from './geminiAdapter'
import { imagesAdapter } from './imagesAdapter'
import { openaiAdapter } from './openaiAdapter'

/** Adapter registry keyed by `ProviderApi`; `Record` makes missing adapters compile-time errors. */
const ADAPTERS: Record<ProviderApi, LlmAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter
}

/** The picture adapters, keyed by `ImageApi` the same way. */
const IMAGE_ADAPTERS: Record<ImageApi, ImageAdapter> = {
  gemini: geminiAdapter,
  images: imagesAdapter
}

/** The adapter that speaks a provider's API shape. */
export function adapterFor(provider: ProviderConfig): LlmAdapter {
  return ADAPTERS[provider.api]
}

/** The adapter that speaks a picture's wire format. */
export function imageAdapterFor(api: ImageApi): ImageAdapter {
  return IMAGE_ADAPTERS[api]
}

export type { LlmAdapter, StructuredRequest } from './adapter'
