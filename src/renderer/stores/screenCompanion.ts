import { hasDesktopSurfaces, canRecordSceneTurn, modIsOn, openSceneExchange, sceneExchangeContext, subscribeSceneTurns, showError, spriteUrl } from '@vx/modkit/renderer'
import { appError } from '@vx/modkit/shared'
import { readSceneNotes, notesConversationScope } from '../sceneNotes/state'
import { companionCharacterName, EMOTIONS, validCompanionLines, validCompanionParticipants } from '../../shared/screenCompanion'
import { companionGameApi } from '../screenCompanionHook'
import { setSceneSuggestionsPaused } from '@vx/modkit/renderer'

let reopen: (() => Promise<void>) | undefined
export function canShareLaptop(): boolean {
  return hasDesktopSurfaces() && modIsOn('screen-companion') && canRecordSceneTurn()
}

export async function openScreenCompanion(): Promise<void> {
  if (reopen) return reopen()
  const exchange = hasDesktopSurfaces() ? openSceneExchange('screen-companion') : null
  if (!exchange) {
    showError(appError('COMPANION_SCENE','Open the laptop on your turn in a story or Creator scene.'))
    return
  }
  const sceneId = crypto.randomUUID(), api = companionGameApi(sceneId)
  let closed = false
  function context() {
    const view = sceneExchangeContext(), scope = notesConversationScope()
    return JSON.stringify({
      reader:view.reader, onScreen:view.onScreen, referenceRevision:scope.revision,
      profiles:Object.fromEntries(view.people.map(p=>[p.id,p.profile])),
      characters:Object.fromEntries(view.people.map(p=>[p.id,p.relationship])),
      sprites:Object.fromEntries(view.people.map(p=>[p.id,Object.fromEntries(EMOTIONS.map(e=>[e,spriteUrl(p.id,e)]))])),
      scene:{...view.scene,summary:scope.replaced?null:view.scene.summary,recentLines:scope.transcript.slice(-20)}
    })
  }
  const offTurn = api.onTurn(turn=>{
    if(turn.sceneId!==sceneId)return
    let accepted=false
    if(exchange.current() && (turn.referenceRevision??'')===notesConversationScope().revision &&
       validCompanionParticipants(turn.participants) && validCompanionLines(turn.lines,turn.participants) &&
       typeof turn.invitation==='boolean' && typeof turn.message==='string' && turn.message.length<=2000) {
      const view = turn.invitation ? sceneExchangeContext() : null
      const names = view ? new Map(view.people.map((p,index)=>[p.id,companionCharacterName(p.profile, view.scene.kind === 'creator' || p.relationship.nameKnown === true,index)])) : null
      const invited = turn.participants.map(id=>names?.get(id)??'')
      const label = invited.length>1 ? invited.slice(0,-1).join(', ')+' and '+invited.at(-1) : invited[0]
      const actions = [turn.invitation ? `I open my laptop and share its screen with ${label}.` : '',turn.message].filter(Boolean)
      accepted = exchange.append({id:turn.id,participants:turn.participants,actions,lines:turn.lines,
        deferSave:Boolean(turn.rapid && !actions.length)})
    }
    void api.acknowledge(sceneId,turn.id,accepted)
  }, exchange.flush, active => setSceneSuggestionsPaused('screen-companion', active))
  let document=readSceneNotes()
  const offStore=subscribeSceneTurns(()=>{
    if(!exchange.current()){close();return}
    const next=readSceneNotes()
    if(next!==document){
      document=next
      void api.document(sceneId,next,context()).then(r=>{
        if(closed || !exchange.current())return
        if(!r.ok){
          if(r.error.code==='COMPANION_SCENE_ENDED'){close();return}
          showError(r.error)
        }
      })
    }
  })
  function close(){
    if(closed)return
    closed=true
    setSceneSuggestionsPaused('screen-companion', false)
    reopen=undefined;offTurn();offStore();exchange!.close();void api.detach(sceneId)
  }
  reopen=async()=>{
    const result=await api.open(context(),sceneId,readSceneNotes())
    if(closed)return
    if(!result.ok){close();showError(result.error)}
  }
  await reopen()
}
