import { safeStorage } from 'electron'
import { join } from 'node:path'
import { appError } from '@vx/modkit/shared'
import { DEFAULT_COMPANION_VOICE, type CompanionVoicePatch, type CompanionVoiceSettings } from '../../shared/screenCompanion'
import { modDataPath, readJsonFile, writeAtomicJson } from '@vx/modkit/main'

type VoiceFile = Omit<CompanionVoiceSettings, 'whisperKeySet' | 'elevenLabsKeySet'> & {
  schemaVersion: 1; whisperKeyEnc?: string; elevenLabsKeyEnc?: string
}
const failure = { code: 'COMPANION_VOICE_SETTINGS', message: 'Could not read voice settings. Check companion-voice.json in the data folder.' }
const filePath = (): string => join(modDataPath('screen-companion'), 'companion-voice.json')
let writes: Promise<unknown> = Promise.resolve()
const listeners = new Set<(settings: CompanionVoiceSettings) => void>()
export function onVoiceSettings(listener: (settings: CompanionVoiceSettings) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function defaults(): VoiceFile {
  const { whisperKeySet: _w, elevenLabsKeySet: _e, ...settings } = DEFAULT_COMPANION_VOICE
  return { ...settings, voiceIds: {}, schemaVersion: 1 }
}
function endpoint(value: string): string {
  try {
    const url = new URL(value.trim().replace(/\/+$/, '').replace(/\/audio\/transcriptions$/, ''))
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error()
    return url.href.replace(/\/+$/, '')
  } catch { throw appError('COMPANION_WHISPER_URL', 'Use an HTTPS Whisper API base URL, or an HTTP server on localhost. Do not put a key in the URL.') }
}
function checked(value: unknown): VoiceFile {
  if (!value || typeof value !== 'object') throw appError(failure.code, failure.message)
  const s = value as VoiceFile
  if (s.schemaVersion !== 1 || !['windows', 'whisper'].includes(s.input) || typeof s.muted !== 'boolean' ||
      typeof s.whisperEndpoint !== 'string' || typeof s.whisperModel !== 'string' || !s.whisperModel.trim() || s.whisperModel.length > 100 ||
      typeof s.elevenLabsModel !== 'string' || !s.elevenLabsModel.trim() || s.elevenLabsModel.length > 100 ||
      !s.voiceIds || typeof s.voiceIds !== 'object' || Array.isArray(s.voiceIds) || Object.keys(s.voiceIds).length > 500 ||
      Object.entries(s.voiceIds).some(([id, voice]) => id.length > 100 || typeof voice !== 'string' || !/^[a-zA-Z0-9_-]{0,100}$/.test(voice)) ||
      [s.whisperKeyEnc, s.elevenLabsKeyEnc].some(key => key !== undefined && (typeof key !== 'string' || key.length > 12000))) throw appError(failure.code, failure.message)
  return { schemaVersion: 1, input: s.input, muted: s.muted, whisperEndpoint: endpoint(s.whisperEndpoint),
    whisperModel: s.whisperModel.trim(), elevenLabsModel: s.elevenLabsModel.trim(), voiceIds: { ...s.voiceIds },
    whisperKeyEnc: s.whisperKeyEnc, elevenLabsKeyEnc: s.elevenLabsKeyEnc }
}
async function read(): Promise<VoiceFile> {
  const result = await readJsonFile(filePath(), { malformed: failure, unreadable: failure, onMissing: defaults })
  return checked(result.kind === 'missing' ? result.value : result.parsed)
}
function decrypt(blob: string | undefined): string {
  if (!blob) return ''
  try { return safeStorage.decryptString(Buffer.from(blob, 'base64')) }
  catch { throw appError('COMPANION_VOICE_KEY', 'This saved voice key cannot be opened on this Windows account. Enter it again in Voice settings.') }
}
function encrypt(key: unknown): string | undefined {
  if (typeof key !== 'string' || key.length > 4000) throw appError('COMPANION_VOICE_KEY', 'Enter a valid voice API key.')
  if (!key.trim()) return undefined
  if (!safeStorage.isEncryptionAvailable()) throw appError('COMPANION_VOICE_KEY', 'Windows key encryption is unavailable. The voice key was not saved.')
  return safeStorage.encryptString(key.trim()).toString('base64')
}
function publicSettings(s: VoiceFile): CompanionVoiceSettings {
  const { schemaVersion: _v, whisperKeyEnc, elevenLabsKeyEnc, ...publicFields } = s
  return { ...publicFields, whisperKeySet: Boolean(whisperKeyEnc), elevenLabsKeySet: Boolean(elevenLabsKeyEnc) }
}
export async function getCompanionVoice(): Promise<CompanionVoiceSettings> { await writes; return publicSettings(await read()) }
export async function saveCompanionVoice(patch: CompanionVoicePatch): Promise<CompanionVoiceSettings> {
  const task = writes.then(async () => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw appError(failure.code, 'Choose valid voice settings.')
    const held = await read()
    const next = { ...held }
    for (const key of ['input', 'muted', 'whisperEndpoint', 'whisperModel', 'elevenLabsModel', 'voiceIds'] as const) {
      if (Object.hasOwn(patch, key)) Object.assign(next, { [key]: patch[key] })
    }
    // A key belongs to its configured endpoint; changing hosts never forwards the old secret.
    if (patch.whisperEndpoint !== undefined && endpoint(patch.whisperEndpoint) !== held.whisperEndpoint) next.whisperKeyEnc = undefined
    if (patch.whisperKey !== undefined) next.whisperKeyEnc = encrypt(patch.whisperKey)
    if (patch.elevenLabsKey !== undefined) next.elevenLabsKeyEnc = encrypt(patch.elevenLabsKey)
    const valid = checked(next)
    await writeAtomicJson(filePath(), valid, { code: 'COMPANION_VOICE_SAVE', message: 'Could not save voice settings.' })
    const settings = publicSettings(valid)
    for (const listener of listeners) listener(settings)
    return settings
  })
  writes = task.then(() => undefined, () => undefined)
  return task
}

async function responseBytes(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) throw appError('COMPANION_VOICE_REPLY', 'The voice service returned no data.')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) throw appError('COMPANION_VOICE_REPLY', 'The voice service response was too large.')
      chunks.push(value)
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}
async function request(url: string, init: RequestInit, signal: AbortSignal, label: string): Promise<Response> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]), redirect: 'error' })
    if (!response.ok) {
      let code = '', reason = ''
      try {
        const body = JSON.parse(new TextDecoder().decode(await responseBytes(response, 64000)))
        code = typeof body.detail?.code === 'string' ? body.detail.code : typeof body.detail?.status === 'string' ? body.detail.status : ''
        reason = typeof body.detail?.message === 'string' ? body.detail.message : ''
      } catch { await response.body?.cancel().catch(() => {}) }
      // Map provider details to our own messages; never log their response body or an echoed key.
      const hint = label === 'ElevenLabs' && response.status === 402
        ? /library|professional|paid.plan|free.user/i.test(`${code} ${reason}`)
          ? 'This voice requires paid ElevenLabs API access. Choose a voice available to your plan or update your ElevenLabs plan.'
          : 'ElevenLabs requires payment or more credits for this request. Check your API credit balance and whether this voice is available on your plan.'
        : code === 'missing_permissions'
          ? (label === 'ElevenLabs' ? 'Enable Text to Speech permission on your ElevenLabs API key.' : 'Check that your API key allows transcription.')
          : /quota|credit/.test(code) ? 'Your provider credit allowance is exhausted. Check your account balance or quota.'
            : code === 'voice_not_found' ? 'This voice ID was not found or is unavailable to your account. Choose a voice from your ElevenLabs account.'
              : response.status === 401 ? 'The provider rejected this key or its permissions. Check the saved API key and its access settings.'
                : response.status === 429 ? 'The provider is rate limiting requests. Wait a moment before trying again.'
                  : 'Check the selected model, voice and provider account.'
      throw appError('COMPANION_VOICE_HTTP', `${label} returned HTTP ${response.status}. ${hint}`)
    }
    return response
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && String(error.code).startsWith('COMPANION_')) throw error
    throw appError('COMPANION_VOICE_NETWORK', signal.aborted ? `${label} was cancelled.` : `${label} could not be reached or timed out.`)
  }
}
export async function transcribeCompanionAudio(bytes: ArrayBuffer, mime: string, signal: AbortSignal): Promise<string> {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 32 || bytes.byteLength > 4 * 1024 * 1024 || !['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4'].includes(mime)) throw appError('COMPANION_AUDIO', 'Record a short microphone message of up to 60 seconds.')
  const s = await read()
  if (s.input !== 'whisper') throw appError('COMPANION_AUDIO', 'Select Whisper in Voice settings first.')
  const key = decrypt(s.whisperKeyEnc)
  if (new URL(s.whisperEndpoint).hostname === 'api.openai.com' && !key) throw appError('COMPANION_AUDIO', 'Add your Whisper API key in Voice settings first.')
  const form = new FormData()
  form.set('model', s.whisperModel)
  form.set('response_format', 'json')
  form.set('file', new Blob([bytes], { type: mime }), `microphone.${mime.split('/')[1]}`)
  const response = await request(`${s.whisperEndpoint}/audio/transcriptions`, { method: 'POST', headers: key ? { Authorization: `Bearer ${key}` } : {}, body: form }, signal, 'Whisper')
  let result: { text?: unknown }
  try { result = JSON.parse(new TextDecoder().decode(await responseBytes(response, 64000))) }
  catch { throw appError('COMPANION_AUDIO_REPLY', 'Whisper returned an unreadable transcript.') }
  if (typeof result.text !== 'string' || result.text.length > 2000) throw appError('COMPANION_AUDIO_REPLY', 'Whisper did not return a message under 2,000 characters. Try a shorter recording.')
  return result.text.trim()
}
export async function synthesizeCompanionSpeech(charId: string, text: string, signal: AbortSignal): Promise<string | null> {
  const s = await read()
  const voice = Object.hasOwn(s.voiceIds, charId) ? s.voiceIds[charId] : ''
  if (s.muted || !voice) return null
  const key = decrypt(s.elevenLabsKeyEnc)
  if (!key) throw appError('COMPANION_VOICE_SETUP', 'Save your ElevenLabs API key in Voices to hear screen-sharing replies.')
  const response = await request(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: s.elevenLabsModel })
  }, signal, 'ElevenLabs')
  const bytes = await responseBytes(response, 4 * 1024 * 1024)
  if (bytes.length < 20) throw appError('COMPANION_VOICE_REPLY', 'ElevenLabs returned an empty audio clip.')
  return Buffer.from(bytes).toString('base64')
}
