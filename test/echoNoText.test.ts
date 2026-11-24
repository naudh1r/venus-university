import { expect, it } from 'vitest'
import { assignEchoes, normalizeEcho, echoLocalImagePrompt } from '../src/shared/echo'
it('keeps visual name cues and design without literal names or profile prose',()=>{
  const state=assignEchoes(normalizeEcho(),'caption-test',{},'Owner Name','Unique biography text')
  const identity={...state.player!,name:'Frostfang',creature:{type:'Armored wolf',description:'Copper armor and long legs'}}
  const prompt=echoLocalImagePrompt({requestId:'test',identity,name:'Owner Name',bio:'Unique biography text',backstory:'Unique backstory'})
  expect(prompt).toContain('Armored wolf');expect(prompt).toContain('Copper armor');expect(prompt).toContain('icy crystalline details')
  for(const text of ['Frostfang','Owner Name','Unique biography text','Unique backstory','chosen name','named '])expect(prompt).not.toContain(text)
})
