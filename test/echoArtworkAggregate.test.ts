import { beforeEach, expect, it, vi } from 'vitest'
import { echoArtIds } from '@shared/echoArtwork'

const mocks = vi.hoisted(() => ({ readdir: vi.fn(), read: vi.fn(), mkdir: vi.fn(), write: vi.fn() }))
vi.mock('fs/promises', () => ({
  readdir: mocks.readdir, readFile: mocks.read, mkdir: mocks.mkdir, writeFile: mocks.write
}))
vi.mock('../src/main/paths', () => ({ getDataPath: () => 'qa-review-fixture-only' }))

import { backupEchoArtwork, prepareEchoArtworkRestore } from '../src/main/services/echoArtworkBackup'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')

beforeEach(() => { vi.resetAllMocks() })

it('backs up and restores the aggregate of two valid collections without a separate 4096-image cutoff', async () => {
  const ids = Array.from({ length: 4097 }, (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`)
  const first = ids.slice(0, 2049), second = ids.slice(2049)
  expect(echoArtIds(first)).toEqual(first)
  expect(echoArtIds(second)).toEqual(second)

  // Only synthetic filenames; not a single real image or game file is opened.
  mocks.readdir.mockResolvedValue(ids.map(id => ({ name: `${id}.png`, isFile: () => true })))
  mocks.read.mockResolvedValue(png)
  expect(await backupEchoArtwork('qa-review-export-fixture')).toEqual(ids)
  expect(mocks.write).toHaveBeenCalledTimes(ids.length)
  mocks.write.mockClear()
  const restore = await prepareEchoArtworkRestore('qa-review-export-fixture', ids)
  await restore()
  expect(mocks.write).toHaveBeenCalledTimes(ids.length)
  expect(mocks.write.mock.calls.every(call => call[2]?.flag === 'wx')).toBe(true)
})
