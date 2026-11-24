import {affectionFor,dispositionOf} from '@vx/modkit/shared'
import {character,characterInfo,clock,freeForInvitation} from '@vx/modkit/renderer'
import {studyEligibility} from '../../shared/studyRoom'
import { declinedThisSlot } from './nativeStudy'
export function eligible(id:string) {
  const c=character(id),info=characterInfo(id),slot=clock()
  if(!c||!info||!slot)return 'Unavailable'
  return studyEligibility({contact:info.flags.gaveContactInfo,blocked:info.flags.blocked,
    tier:dispositionOf(affectionFor(info,slot.date,c)),declined:declinedThisSlot(id),unavailable:!freeForInvitation(id),resting:false,committed:false})
}
