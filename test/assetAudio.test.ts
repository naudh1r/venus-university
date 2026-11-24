import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let root = ''
vi.mock('../src/main/paths', () => ({ getSoundPath: () => root }))
const { readAudio } = await import('../src/main/services/assetService')

beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'community-audio-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it('reads stock sounds and nested community tracks without a per-track registration', async () => {
  for (const file of ['music/title.ogg', 'community/one-mod/opening.mp3', 'community/second/arrival.wav', 'community/new_track.ogg']) {
    const target = join(root, file)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, 'synthetic audio bytes')
    expect(await readAudio(file)).toEqual(Buffer.from('synthetic audio bytes'))
  }
  expect(await readAudio('community/absent/track.mp3')).toBeNull()
})

it('rejects traversal, absolute paths and non-audio files before reading them', async () => {
  for (const file of ['community/../settings.json', 'community/a/../../private.mp3', '../outside.ogg', '/community/a.mp3', 'C:/community/a.mp3', 'community\\a.mp3', 'community/a.json', 'community//a.mp3']) {
    await expect(readAudio(file)).rejects.toMatchObject({ code: 'AUDIO_FILE_INVALID' })
  }
})
