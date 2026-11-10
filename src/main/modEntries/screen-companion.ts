import { BrowserWindow, ipcMain, webContents } from 'electron'
import { ownsCompanionScene } from '../screenCompanion'
import {modIsOn,type InvokeHandler} from '@vx/modkit/main'
import {companionError, type Emotion} from '../../shared/screenCompanion'
import { appError } from '@vx/modkit/shared'
import type {CompanionMode,CompanionVoicePatch} from '../../shared/screenCompanion'
import {captureFrameCompanion,messageSizeCompanion,rapidCompanion,companionCheckpoint,pointingCompanion,companionDocument,acknowledgeCompanion,assertCompanionSender,cancelCompanionTranscription,captureCompanionDesktop,closeCompanion,commentCompanion,companionAudioDone,companionCharacters,companionSources,companionState,configureCompanion,detachCompanion,dictateCompanion,microphoneCompanion,modeCompanion,muteCompanion,openCompanion,pauseCompanion,pauseCompanionConversation,previewCompanion,showCompanionChat,showCompanionControls,startCompanion,takeCompanionTurn,transcribeCompanion,voiceCompanion} from '../screenCompanion'
let initialized=false
function initialize(){if(initialized)return;initialized=true
 const handle=(channel:string,fn:(event:Electron.IpcMainInvokeEvent,...args:any[])=>unknown)=>ipcMain.handle(channel,async(event,...args)=>{try{if(!await modIsOn('screen-companion'))throw Error('Share Your Laptop is turned off.');return {ok:true,data:await fn(event,...args)}}catch(e){return {ok:false,error:companionError(e)}}})
 handle('surface:screen-companion:frame', (event, id: number, bytes: ArrayBuffer | null, error?: string) => captureFrameCompanion(event.sender, id, bytes, error))
 handle('surface:screen-companion:message-size', (event, percent: number) => { assertCompanionSender(event.sender); messageSizeCompanion(percent) })
 handle('surface:screen-companion:rapid', (event, enabled: boolean) => { assertCompanionSender(event.sender); rapidCompanion(enabled) })
 handle('surface:screen-companion:pointing', (event, enabled: boolean) => { assertCompanionSender(event.sender); pointingCompanion(enabled) })
 handle('surface:screen-companion:mode', (event, mode: CompanionMode, context: string) => { assertCompanionSender(event.sender); modeCompanion(mode, context) })
 handle('surface:screen-companion:chat', (event, show: boolean) => { assertCompanionSender(event.sender); showCompanionChat(show === true) })
 handle('surface:screen-companion:dictate', event => { assertCompanionSender(event.sender); return dictateCompanion(event.sender) })
 handle('surface:screen-companion:voice-settings', (event, patch: CompanionVoicePatch) => { assertCompanionSender(event.sender); return voiceCompanion(patch) })
 handle('surface:screen-companion:mute', (event, muted: boolean) => { assertCompanionSender(event.sender); return muteCompanion(muted) })
 handle('surface:screen-companion:microphone', (event, active: boolean) => { assertCompanionSender(event.sender); microphoneCompanion(event.sender, active === true) })
 handle('surface:screen-companion:transcribe', (event, bytes: ArrayBuffer, mime: string) => { assertCompanionSender(event.sender); return transcribeCompanion(event.sender, bytes, mime) })
 handle('surface:screen-companion:cancel-transcription', event => { assertCompanionSender(event.sender); cancelCompanionTranscription(event.sender) })
 handle('surface:screen-companion:audio-done', (event, id: number, error?: string) => { assertCompanionSender(event.sender); companionAudioDone(event.sender, id, error) })
 handle('surface:screen-companion:state', event => { assertCompanionSender(event.sender); return companionState() })
 handle('surface:screen-companion:characters', event => { assertCompanionSender(event.sender); return companionCharacters() })
 handle('surface:screen-companion:screenshot',(event,delaySeconds:number)=>{assertCompanionSender(event.sender);return captureCompanionDesktop(delaySeconds)})
 handle('surface:screen-companion:sources', event => { assertCompanionSender(event.sender); return companionSources() })
 handle('surface:screen-companion:start', (event, charId: string[] | string, sourceId: string, interval: number) => { assertCompanionSender(event.sender); return startCompanion(charId, sourceId, interval) })
 handle('surface:screen-companion:pause', event => { assertCompanionSender(event.sender); pauseCompanion() })
 handle('surface:screen-companion:pause-conversation', (event, paused: boolean) => { assertCompanionSender(event.sender); pauseCompanionConversation(paused) })
 handle('surface:screen-companion:comment', (event, text: string) => { assertCompanionSender(event.sender); return commentCompanion(text) })
 handle('surface:screen-companion:configure', (event, size: number, clickThrough: boolean) => { assertCompanionSender(event.sender); configureCompanion(size, clickThrough) })
 handle('surface:screen-companion:preview', (event, charId: string[] | string, emotion: Emotion) => { assertCompanionSender(event.sender); return previewCompanion(charId, emotion) })
 handle('surface:screen-companion:controls', event => { assertCompanionSender(event.sender); showCompanionControls() })
 handle('surface:screen-companion:close', event => { assertCompanionSender(event.sender); closeCompanion() })
 let checking=false
 const timer=setInterval(async()=>{
  if(checking||!companionState().sceneId)return
  checking=true
  try{if(!await modIsOn('screen-companion'))closeCompanion()}
  catch{closeCompanion()}
  finally{checking=false}
 },500);timer.unref()
}
function syncDocument(id:unknown,document:unknown,context?:unknown){
 if(companionState().sceneId!==id)throw appError('COMPANION_SCENE_ENDED','That laptop session has ended.')
 if(document===null||document===undefined){companionDocument('','',context);return}
 const doc=document as {name:string;text:string}
 companionDocument(doc.name,doc.text,context)
}
export default function screenCompanionMain() {
  const invoke: Record<string, InvokeHandler> = {
    open: async ({ senderId }, context, id, document) => {
      initialize()
      if (!await modIsOn('screen-companion')) throw Error('Share Your Laptop is off.')
      const sender = webContents.fromId(senderId)
      openCompanion(sender ? BrowserWindow.fromWebContents(sender) : null, String(context ?? ''), String(id ?? ''))
      syncDocument(id, document, context)
    },
    document: ({ senderId }, id, document, context) => {
      if (!ownsCompanionScene(senderId, id)) throw appError('COMPANION_SCENE_ENDED','That laptop session has ended.')
      syncDocument(id, document, context)
    },
    poll: ({ senderId }, id) => ({
      turn: ownsCompanionScene(senderId, id) ? takeCompanionTurn(String(id)) : null,
      checkpoint: companionCheckpoint(),
      sharing: ownsCompanionScene(senderId, id) && companionState().sharing
    }),
    detach: ({ senderId }, id) => {
      const sender = webContents.fromId(senderId)
      if (sender) detachCompanion(sender, String(id))
    },
    ack: ({ senderId }, id, turn, accepted) => {
      const sender = webContents.fromId(senderId)
      if (sender) acknowledgeCompanion(sender, String(id), Number(turn), accepted === true)
    }
  }
  return { invoke }
}
