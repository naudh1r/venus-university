import {
  memoryStatusLine as nativeMemoryStatusLine,
  readerize as nativeReaderize,
  type CharMemory,
  type SceneLine
} from '../bridge/shared'

import { memoryPresentation as presentationOf } from './memoryPresentation'

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
