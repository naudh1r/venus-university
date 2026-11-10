import {describe,it,expect} from 'vitest'
import {studyEligibility} from '../src/shared/studyRoom'
const friend={contact:true,blocked:false,tier:'friendly',unavailable:false,resting:false,committed:false,declined:false}
describe('study access',()=>{
 it('requires a free contact above acquaintance and respects her refusal',()=>{
  expect(studyEligibility(friend)).toBe('')
  for(const p of [{contact:false},{blocked:true},{tier:'neutral'},{tier:'annoyed'},{unavailable:true},{resting:true},{committed:true},{declined:true}])expect(studyEligibility({...friend,...p})).not.toBe('')
  for(const tier of ['friendly','trusted','devoted'])expect(studyEligibility({...friend,tier})).toBe('')
 })
 it('keeps a declined invitation closed for this slot even for a devoted contact',()=>{
  expect(studyEligibility({...friend,tier:'devoted',declined:true})).toBe('She has ended this session for this time slot')
  expect(studyEligibility({...friend,tier:'devoted',declined:false})).toBe('')
 })
})
