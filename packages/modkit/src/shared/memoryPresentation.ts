// Type-only: erased from the build, so this module loads none of the game's code.
import type { memoryStatusLine } from '../bridge/shared'

/**
 * The reader's name and pronouns, and a named character's, as the memory helpers word them. Kept
 * apart from the helpers themselves, which import the game's shared code: core binds it at boot
 * through `@vx/modkit/host/shared`, which must not pull that code in.
 */
export interface MemoryPresentation {
  readerName: string
  holder: Parameters<typeof memoryStatusLine>[3]
  reader: Parameters<typeof memoryStatusLine>[4]
}

let presentationOf: (name?: string) => MemoryPresentation = () => ({
  readerName: 'the reader',
  holder: 'female',
  reader: 'he'
})

/** Binds the live reader and the named character to the shared memory helpers. */
export function setMemoryPresentation(read: (name?: string) => MemoryPresentation): void {
  presentationOf = read
}

/** The presentation for a named character, or for the reader alone. */
export function memoryPresentation(name?: string): MemoryPresentation {
  return presentationOf(name)
}
