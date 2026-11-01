import { createArrayExtractor, stringElement } from './jsonStream'

/**
 * Incremental preview reader for streaming `TextingResponse` JSON — the texting
 * counterpart of `sceneStream.ts`.
 */

/** A reader that turns a growing JSON prefix into the texts completed so far. */
export interface TextExtractor {
  /** Appends a delta and returns only the message strings that closed within it. */
  feed: (delta: string) => string[]
}

/** Creates a {@link TextExtractor} — the `messages` array of strings (see `jsonStream.ts`). */
export function createTextExtractor(): TextExtractor {
  return createArrayExtractor<string>('messages', stringElement, '[texting]')
}

/** Reads the top-level prefix ahead of messages, once, without reading a partial message. */
export function createDmLeadReader(): {
  feed: (delta: string) => Readonly<Record<string, unknown>> | undefined
} {
  let buffer = ''
  let stopped = false
  return {
    feed(delta) {
      if (stopped) return undefined
      buffer += delta
      let depth = 0
      let key = false
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]
        if (char === '"') {
          const end = stringElement.scan(buffer, i)
          if (end < 0) return undefined
          if (depth === 1 && key && JSON.parse(buffer.slice(i, end + 1)) === 'messages') {
            stopped = true
            try {
              const prefix = buffer.slice(0, i).trimEnd().replace(/,$/, '')
              const lead = JSON.parse(prefix + '}') as Record<string, unknown>
              return Object.keys(lead).length ? Object.freeze(lead) : undefined
            } catch {
              return undefined
            }
          }
          if (depth === 1) key = false
          i = end
        } else if (char === '{' || char === '[') {
          depth++
          if (depth === 1) key = true
        } else if (char === '}' || char === ']') depth--
        else if (char === ',' && depth === 1) key = true
      }
      return undefined
    }
  }
}
