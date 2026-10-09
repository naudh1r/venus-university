import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character } from './fixtures'

/**
 * The name a new picture is given. A save can point at names whose pictures are not in the
 * folder, from a render cut short or a save carried over without its pictures; handing one of
 * those out again puts the new picture under both bubbles.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

const { reservePhotoName } = await import('../src/main/services/localPhotoService')

const april = character({ charId: 'april-1', firstName: 'April' })

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-photo-names-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('reservePhotoName', () => {
  it('passes over the names the save already points at, with no file behind them', async () => {
    const name = await reservePhotoName('100', april, 'chat', [
      'april_chat_001.png',
      'april_chat_002.png'
    ])
    expect(name).toBe('april_chat_003.png')
  })

  it('counts what is on disk as well', async () => {
    const folder = join(root, 'data', 'saves', '200', 'photos', 'april-1')
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'april_chat_004.png'), '')
    expect(await reservePhotoName('200', april, 'chat', ['april_chat_001.png'])).toBe(
      'april_chat_005.png'
    )
  })

  it('ignores anything in the list that is not one of its names', async () => {
    expect(await reservePhotoName('300', april, 'chat', ['../escape.png', 42, null])).toBe(
      'april_chat_001.png'
    )
  })
})
