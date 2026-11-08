import {coverSceneOpening} from '../slotCrossing'
import { currentRun, loopState, runStale } from './state'
import {playerActs} from '../../mods/hooks'
import {applyCast,promptState,reader} from './promptState'
import {armSceneRecords} from './jobs'
import {castCharactersOf} from './cast'
import {buildScenePrompt} from '../../prompts/scenePrompt'
import {settingNow} from '../lorebookStore'
import {streamScene} from './stream'
import {runSceneTurn,failTurn} from './turn'
import {modIsOn} from '../modsStore'
import {useGameStore} from '../gameStore'

export async function enterInvitedScene(modId: string, partner: string, action: string, initialize: () => void) {
 const game=useGameStore.getState(),run=currentRun()
 const snapshot={scene:game.captureScene(),action,charId:partner,retryInvitation:(next:string)=>{
   if (!runStale(run) && modIsOn(modId, loopState.record)) void enterInvitedScene(modId,partner,next,initialize)
 }}
 coverSceneOpening();loopState.lastTurn=snapshot;loopState.jobShift=null;loopState.projectWork=null
 game.setInputDraft('');game.setAwaitingInput(false);game.setBusy(true);playerActs()
 loopState.turnStartedAt=performance.now();game.setStreaming(true);game.setWaitingForLine(true)
 try{
  await applyCast([partner])
  if(runStale(run))return
  initialize()
  armSceneRecords();useGameStore.getState().logPlayerAction(action,false)
  const cast=castCharactersOf([partner]),request=buildScenePrompt(cast,action,promptState(),settingNow(),reader())
  await runSceneTurn(streamScene(request,undefined,{forceShowSpeakers:true}),snapshot,[partner],cast,false)
 }catch(error){if(!runStale(run))failTurn({code:'SCENE_INVITE',message:error instanceof Error?error.message:'Could not start the scene.'},snapshot,true)}
}
