import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let root = ''
let encryption = true
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: {
    isEncryptionAvailable: () => encryption,
    encryptString: (key: string) => Buffer.from(`encrypted:${key}`),
    decryptString: (bytes: Buffer) => {
      const value = bytes.toString()
      if (!value.startsWith('encrypted:')) throw Error('Wrong account')
      return value.slice(10)
    }
  }
}))
const { saveCompanionVoice, getCompanionVoice, transcribeCompanionAudio, synthesizeCompanionSpeech } = await import('../src/main/services/companionVoice')
const { modDataPath } = await import('@vx/modkit/main')
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'venus-companion-voice-')); encryption = true })
afterEach(async () => { vi.unstubAllGlobals(); await rm(root, { recursive: true, force: true }) })

it('starts unmuted, speaks for assigned voices and remembers a saved mute', async () => {
  const signal = new AbortController().signal
  const fetchMock = vi.fn(async () => new Response(new Uint8Array(64)))
  vi.stubGlobal('fetch', fetchMock)
  expect((await getCompanionVoice()).muted).toBe(false)
  await expect(synthesizeCompanionSpeech('speaker', 'Hello', signal)).resolves.toBeNull()
  await saveCompanionVoice({ elevenLabsKey: 'key', voiceIds: { speaker: 'voice1', other: '' } })
  await expect(synthesizeCompanionSpeech('other', 'Hello', signal)).resolves.toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
  await expect(synthesizeCompanionSpeech('speaker', 'Hello', signal)).resolves.toEqual(expect.any(String))
  await saveCompanionVoice({ muted: true })
  await saveCompanionVoice({ voiceIds: { speaker: 'voice2' } })
  expect((await getCompanionVoice()).muted).toBe(true)
  await expect(synthesizeCompanionSpeech('speaker', 'Hello', signal)).resolves.toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('keeps voice keys encrypted and out of renderer state across concurrent setting writes', async () => {
  await Promise.all([saveCompanionVoice({ whisperKey: 'whisper-secret', elevenLabsKey: 'eleven-secret' }), saveCompanionVoice({ voiceIds: { 'char-1': 'voice1' } }), saveCompanionVoice({ muted: false })])
  const stored = await readFile(join(modDataPath('screen-companion'), 'companion-voice.json'), 'utf8')
  const settings = await getCompanionVoice()
  expect(stored).not.toContain('whisper-secret')
  expect(stored).not.toContain('eleven-secret')
  expect(settings).toMatchObject({ whisperKeySet: true, elevenLabsKeySet: true, muted: false, voiceIds: { 'char-1': 'voice1' } })
  expect(JSON.stringify(settings)).not.toMatch(/secret|KeyEnc/)
  encryption = false
  await expect(saveCompanionVoice({ whisperKey: 'replacement' })).rejects.toMatchObject({ code: 'COMPANION_VOICE_KEY' })
  expect(await readFile(join(modDataPath('screen-companion'), 'companion-voice.json'), 'utf8')).toBe(stored)
})

it('does not forward an old transcription key when the endpoint changes or follow credential redirects', async () => {
  await saveCompanionVoice({ input: 'whisper', whisperKey: 'old-secret' })
  const changed = await saveCompanionVoice({ whisperEndpoint: 'http://127.0.0.1:9000/v1' })
  expect(changed.whisperKeySet).toBe(false)
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ text: 'A local transcript' })))
  vi.stubGlobal('fetch', fetchMock)
  expect(await transcribeCompanionAudio(new ArrayBuffer(64), 'audio/webm', new AbortController().signal)).toBe('A local transcript')
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  expect(init?.headers).toEqual({})
  expect(init?.redirect).toBe('error')
})

it('explains paid voice restrictions without returning echoed secrets from provider errors', async () => {
  await saveCompanionVoice({ elevenLabsKey: 'secret', muted: false, voiceIds: { girl: 'voiceGirl' } })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { status: 'payment_required', message: 'Free users cannot use library voices via the API. secret' } }), { status: 402 })))
  await expect(synthesizeCompanionSpeech('girl', 'Hello', new AbortController().signal)).rejects.toMatchObject({
    message: 'ElevenLabs returned HTTP 402. This voice requires paid ElevenLabs API access. Choose a voice available to your plan or update your ElevenLabs plan.'
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { code: 'missing_permissions', message: 'secret' } }), { status: 403 })))
  await expect(synthesizeCompanionSpeech('girl', 'Hello', new AbortController().signal)).rejects.toMatchObject({
    message: 'ElevenLabs returned HTTP 403. Enable Text to Speech permission on your ElevenLabs API key.'
  })
})
