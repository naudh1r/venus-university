import {
  memoryStatusLine as nativeMemoryStatusLine,
  readerize as nativeReaderize,
  type CharMemory,
  type SceneLine
} from '../bridge/shared'

/** The player and memory holder's presentation vocabulary. */
interface MemoryPresentation {
  readerName: string
  holder: Parameters<typeof nativeMemoryStatusLine>[3]
  reader: Parameters<typeof nativeMemoryStatusLine>[4]
}

let presentationOf: (name?: string) => MemoryPresentation = () => ({
  readerName: 'the reader',
  holder: 'female',
  reader: 'he'
})

/** Binds the live reader and the named character to the shared memory helpers. */
export function setMemoryPresentation(read: typeof presentationOf): void {
  presentationOf = read
}

/** A memory announcement using the current reader's name and pronouns. */
export function memoryStatusLine(
  name: string,
  entry: Pick<CharMemory, 'type' | 'desc'>
): SceneLine {
  const { readerName, holder, reader } = presentationOf(name)
  return nativeMemoryStatusLine(name, entry, readerName, holder, reader)
}

/** Files a second-person memory in the third person with the reader's pronouns. */
export function readerize(text: string): string {
  const { holder, reader } = presentationOf()
  return nativeReaderize(text, holder, reader)
}
