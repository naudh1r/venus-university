import type { CompanionPoint } from './companionPointer'
import type { Result } from '@vx/modkit/shared'
import { appError } from '@vx/modkit/shared'
export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'embarrassed', 'aroused'] as const
export type Emotion = (typeof EMOTIONS)[number]
/** Preserve unknown identities in the selector, overlays and invitation text. */
export function companionCharacterName(person: { firstName: string; lastName: string }, known: boolean, index: number): string {
  return known ? `${person.firstName} ${person.lastName}`.trim() : `Unknown character ${index + 1}`
}
export const isEmotion = (value: unknown): value is Emotion => EMOTIONS.some(emotion => emotion === value)
export function companionError(value: unknown) {
  if (value && typeof value === 'object' && 'code' in value && 'message' in value &&
      typeof value.code === 'string' && typeof value.message === 'string') return appError(value.code, value.message)
  return appError('COMPANION_ERROR', value instanceof Error ? value.message : 'The laptop action could not be completed.')
}

export const COMPANION_MODES = {
  hangout: { label: 'Hang out', hint: 'Relax together, react naturally, and talk about what is on screen.' },
  gaming: { label: 'Gaming buddy', hint: 'Celebrate moments and offer a useful suggestion when asked.' },
  fps: { label: 'FPS Coach', hint: 'One actionable tip at a time: positioning, team composition, and the next fight.' },
  study: { label: 'Study / work', hint: 'Talk through what you are working on and help when asked.' }
} as const
export type CompanionMode = keyof typeof COMPANION_MODES
export const rapidFps = (mode: CompanionMode, interval: number): boolean => mode === 'fps' && interval === 1
/** Shared by native window placement, hover hit testing and the overlay's CSS. */
export function companionOverlayLayout(size: number, messageSize: number, rapid: boolean) {
  const scale = Math.max(75, Math.min(200, messageSize)) / 100
  const padding = Math.ceil((rapid ? 230 : 110) * scale)
  const characterWidth = Math.max(240, Math.round(size * 0.62 + 38))
  return { scale, padding, characterWidth, width: Math.max(characterWidth, Math.round(320 * scale) + 16) }
}
/** Rapid FPS is start-to-start, with one request in flight and no accumulated catch-up work. */
export const companionReactionDelay = (mode: CompanionMode, interval: number, elapsed: number): number =>
  rapidFps(mode, interval) ? Math.max(0, 1000 - elapsed) : interval * 1000
export function rapidCallout(text: string): string {
  const sentence = text.trim().match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() ?? text.trim()
  const short = sentence.split(/\s+/u).slice(0, 8).join(' ')
  if (short === sentence && short.length <= 72) return short
  const clipped = short.length > 71 ? short.slice(0, 71).replace(/\s+\S*$/, '') : short
  return clipped.replace(/[,.!?;:]$/, '') + '…'
}
export interface CompanionLine { charId: string; text: string; emotion: Emotion; point?: CompanionPoint | null }
export interface CompanionMember extends CompanionLine { name: string; sequence: number; sprites?: Partial<Record<Emotion, string>> }
export interface CompanionTurn {
  sceneId: string
  id: number
  participants: string[]
  referenceRevision?: string
  invitation: boolean
  message: string
  lines: CompanionLine[]
  rapid?: boolean
}
export interface CompanionPoll { turn: CompanionTurn | null; checkpoint: number; sharing: boolean }
export interface CompanionFrameRequest { id: number; sourceId: string; width: number; height: number }

/** Validate every speaker before a group reply can change any part of a saved scene. */
export function validCompanionLines(value: unknown, participants: readonly string[]): value is CompanionLine[] {
  return Array.isArray(value) && value.length <= 6 && value.every(line => line &&
    participants.includes(line.charId) && typeof line.text === 'string' && line.text.trim().length > 0 &&
    line.text.length <= 500 && isEmotion(line.emotion))
}
export function validCompanionParticipants(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 3 &&
    value.every(id => typeof id === 'string' && id.length > 0 && id.length < 100) && new Set(value).size === value.length
}

export interface CompanionVoiceSettings {
  input: 'windows' | 'whisper'
  whisperEndpoint: string
  whisperModel: string
  whisperKeySet: boolean
  elevenLabsKeySet: boolean
  elevenLabsModel: string
  voiceIds: Record<string, string>
  muted: boolean
}
export const DEFAULT_COMPANION_VOICE: CompanionVoiceSettings = {
  input: 'windows', whisperEndpoint: 'https://api.openai.com/v1', whisperModel: 'whisper-1',
  whisperKeySet: false, elevenLabsKeySet: false, elevenLabsModel: 'eleven_multilingual_v2', voiceIds: {}, muted: false,
}
export type CompanionVoicePatch = Partial<Omit<CompanionVoiceSettings, 'whisperKeySet' | 'elevenLabsKeySet'>> & {
  whisperKey?: string
  elevenLabsKey?: string
}
export interface CompanionAudio { id: number; data: string }
export interface GameCompanionApi {
  open(gameContext?: string, sceneId?: string, document?: import('./sceneNotes').SceneDocument | null): Promise<Result<void>>
  document(sceneId: string, document: import('./sceneNotes').SceneDocument | null, gameContext: string): Promise<Result<void>>
  detach(sceneId: string): Promise<Result<void>>
  acknowledge(sceneId: string, id: number, accepted: boolean): Promise<Result<void>>
  onTurn(listener: (turn: CompanionTurn) => void, checkpoint?: () => void, sharing?: (active: boolean) => void): () => void
}
export interface CompanionState {
  /** The reference shared with every activity mode for this laptop session. */
  documentName?: string
  sharing: boolean
  /** Seconds until the first screen capture; zero once sharing is underway. */
  startingIn?: number
  conversationPaused: boolean
  pointing: boolean
  busy: boolean
  members: CompanionMember[]
  /** The current line, shared by controls and quick chat. */
  charId: string
  name: string
  emotion: Emotion
  text: string
  lineSequence: number
  error: string
  sourceId: string
  sourceName: string
  interval: number
  clickThrough: boolean
  size: number
  messageSize: number
  revision: number
  sceneId: string
  contextRevision: number
  sceneKind: 'story' | 'creator' | ''
  mode: CompanionMode
  coachingContext: string
  shortcutWarning: string
  voice: CompanionVoiceSettings
  voiceError: string
  recording: boolean
  inputEpoch: number
}
export interface CompanionApi {
  state(): Promise<Result<CompanionState>>
  characters(): Promise<Result<{ charId: string; name: string; onScreen: boolean }[]>>
  sources(): Promise<Result<{ id: string; name: string }[]>>
  start(charIds: string[] | string, sourceId: string, interval: number): Promise<Result<void>>
  pause(): Promise<Result<void>>
  pauseConversation(paused: boolean): Promise<Result<void>>
  pointing(enabled: boolean): Promise<Result<void>>
  rapid(enabled: boolean): Promise<Result<void>>
  onMoveHandle(listener: (visible: boolean) => void): () => void
  messageSize(percent: number): Promise<Result<void>>
  frame(id: number, bytes: ArrayBuffer | null, error?: string): Promise<Result<void>>
  onFrameRequest(listener: (request: CompanionFrameRequest | null) => void): () => void
  comment(text: string): Promise<Result<void>>
  screenshot(delaySeconds?:number): Promise<Result<string>>
  configure(size: number, clickThrough: boolean): Promise<Result<void>>
  preview(charIds: string[] | string, emotion: Emotion): Promise<Result<void>>
  controls(): Promise<Result<void>>
  mode(mode: CompanionMode, context: string): Promise<Result<void>>
  chat(show: boolean): Promise<Result<void>>
  dictate(): Promise<Result<void>>
  voiceSettings(patch: CompanionVoicePatch): Promise<Result<CompanionVoiceSettings>>
  mute(muted: boolean): Promise<Result<void>>
  microphone(active: boolean): Promise<Result<void>>
  transcribe(bytes: ArrayBuffer, mime: string): Promise<Result<string>>
  cancelTranscription(): Promise<Result<void>>
  audioDone(id: number, error?: string): Promise<Result<void>>
  onAudio(listener: (audio: CompanionAudio | null) => void): () => void
  onChatFocus(listener: () => void): () => void
  close(): Promise<Result<void>>
  onState(listener: (state: CompanionState) => void): () => void
}
