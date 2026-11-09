import type { Character } from '@vx/modkit/shared'
import { ECHO_ASPECTS, assignEchoes, normalizeEcho, type EchoAspect, type EchoState } from './echo'
import { explainEchoAspect } from './echoReasons'

/** Setup has its own draft; it never relaxes the edit rules of a running save. */
export function prepareEchoSetup(value:unknown, seed:string, roster:readonly Character[], name:string, bio:string):EchoState {
  return assignEchoes(normalizeEcho(value),seed,Object.fromEntries(roster.map(c=>[c.charId,c])),name,bio)
}

/** Returning identities retain their established aspect and the player's spent change. */
export function echoSetupLocks(carried?:EchoState):string[] {
  if(!carried)return []
  const state=normalizeEcho(carried)
  return [...(state.player?['player']:[]),...Object.keys(state.girls)]
}

export function chooseSetupEchoAspect(value:EchoState, owner:string, aspect:EchoAspect, roster:readonly Character[], bio:string, locked:readonly string[]=[]):EchoState {
  const state=normalizeEcho(value)
  const character=roster.find(c=>c.charId===owner)
  const identity=owner==='player'?state.player:character?state.girls[owner]:undefined
  if(!identity)throw Error('Choose an Echo from this semester’s roster.')
  if(locked.includes(owner))throw Error('This Echo’s aspect carries over from the previous semester.')
  if(!ECHO_ASPECTS.some(a=>a.id===aspect))throw Error('Choose an existing Echo aspect.')
  if(identity.aspect===aspect)return state
  const parts=character?[{label:'personality',text:character.personality,weight:3},{label:'backstory',text:character.backstory,weight:2}]:[{label:'bio',text:bio,weight:3}]
  const updated={...identity,aspect,assignment:'chosen' as const,...explainEchoAspect(aspect,parts,true)}
  if(character)updated.reason=updated.reason.replace('Here are the parts of your story that might speak to it.','Here are the parts of her story that might speak to it.')
  if(owner==='player')state.player=updated;else state.girls[owner]=updated
  return state
}

export function finalizeEchoSetup(value:EchoState, roster:readonly Character[], carried?:EchoState):EchoState {
  const state=normalizeEcho(value),previous=carried?normalizeEcho(carried):undefined
  if(!state.player||roster.some(c=>!state.girls[c.charId]))throw Error('Every selected character needs an Echo before starting.')
  if(previous?.player&&previous.player.aspect!==state.player.aspect)throw Error('Keep the returning player’s Echo aspect.')
  for(const [id,identity] of Object.entries(previous?.girls??{})){
    if(state.girls[id]?.aspect!==identity.aspect)throw Error('Keep returning students’ Echo aspects.')
  }
  // Choosing a starting aspect never consumes the player's one later change.
  state.playerChangeUsed=previous?.playerChangeUsed??false
  return state
}
