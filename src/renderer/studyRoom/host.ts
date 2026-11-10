import {useSyncExternalStore} from 'react'
import {canInviteToScene,subscribeInvitations,rosterIds,character,characterInfo} from '@vx/modkit/renderer'
import {eligible} from './session'

export const studyLanding=canInviteToScene
export const useStudyLanding=()=>useSyncExternalStore(subscribeInvitations,canInviteToScene)
function contactList() {
  return JSON.stringify(rosterIds().filter(id=>characterInfo(id)?.flags.gaveContactInfo).map(id=>{
    const c=character(id)
    return {id,name:[c?.firstName,c?.lastName].filter(Boolean).join(' '),reason:eligible(id)}
  }))
}
export function useStudyContacts(): {id:string;name:string;reason:string}[] {
  return JSON.parse(useSyncExternalStore(subscribeInvitations,contactList))
}
