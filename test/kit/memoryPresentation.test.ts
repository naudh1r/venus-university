import { afterEach, expect, it } from 'vitest'
import { memoryStatusLine, readerize } from '@vx/modkit/shared'
import { setMemoryPresentation } from '@vx/modkit/host/shared'
import { memoryStatusLine as nativeMemoryStatusLine } from '@shared/relationship'

afterEach(() => {
  setMemoryPresentation(() => ({ readerName: 'the reader', holder: 'female', reader: 'he' }))
})

it('keeps the two-argument memory helper tied to the current reader', () => {
  let readerName = 'Lucky'
  setMemoryPresentation(() => ({ readerName, holder: 'male', reader: 'she' }))
  const entry = { type: 'liked' as const, desc: 'the reader lent him notes' }

  expect(memoryStatusLine('Sam', entry)).toEqual(
    nativeMemoryStatusLine('Sam', entry, 'Lucky', 'male', 'she')
  )
  readerName = 'Robin'
  expect(memoryStatusLine('Sam', entry)).toEqual(
    nativeMemoryStatusLine('Sam', entry, 'Robin', 'male', 'she')
  )
})

it('keeps the one-argument normalizer usable with the current reader pronouns', () => {
  setMemoryPresentation(() => ({ readerName: 'Lucky', holder: 'female', reader: 'she' }))
  expect(readerize('you were kind to yourself')).toBe('the reader was kind to herself')
})
