import type { CompanionApi } from '../shared/screenCompanion'

import type { DesktopSurfaceBridge } from '@vx/modkit/shared'
declare global {interface Window {modSurface: DesktopSurfaceBridge}}
const surface = window.modSurface
export const companionSurface: CompanionApi = {
  screenshot: (...args)=>surface.invoke('screenshot',...args),
  state: (...args)=>surface.invoke('state',...args),
  characters: (...args)=>surface.invoke('characters',...args),
  sources: (...args)=>surface.invoke('sources',...args),
  start: (...args)=>surface.invoke('start',...args),
  pause: (...args)=>surface.invoke('pause',...args),
  pauseConversation: (...args)=>surface.invoke('pause-conversation',...args),
  pointing: (...args)=>surface.invoke('pointing',...args),
  rapid: (...args)=>surface.invoke('rapid',...args),
  messageSize: (...args)=>surface.invoke('message-size',...args),
  frame: (...args)=>surface.invoke('frame',...args),
  comment: (...args)=>surface.invoke('comment',...args),
  configure: (...args)=>surface.invoke('configure',...args),
  preview: (...args)=>surface.invoke('preview',...args),
  controls: (...args)=>surface.invoke('controls',...args),
  mode: (...args)=>surface.invoke('mode',...args),
  chat: (...args)=>surface.invoke('chat',...args),
  dictate: (...args)=>surface.invoke('dictate',...args),
  voiceSettings: (...args)=>surface.invoke('voice-settings',...args),
  mute: (...args)=>surface.invoke('mute',...args),
  microphone: (...args)=>surface.invoke('microphone',...args),
  transcribe: (...args)=>surface.invoke('transcribe',...args),
  cancelTranscription: (...args)=>surface.invoke('cancel-transcription',...args),
  audioDone: (...args)=>surface.invoke('audio-done',...args),
  close: (...args)=>surface.invoke('close',...args),
  onMoveHandle: listener=>surface.on('move-handle',listener),
  onFrameRequest: listener=>surface.on('capture-request',listener),
  onAudio: listener=>surface.on('audio',listener),
  onChatFocus: listener=>surface.on('focus-chat',listener),
  onState: listener=>surface.on('changed',listener),
}
