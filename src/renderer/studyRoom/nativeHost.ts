import { character, startInvitedScene } from '@vx/modkit/renderer'
import { STUDY_MOD } from '../../shared/studyRoom'
import { eligible } from './session'
import { studyScene } from './nativeStudy'

export async function startNativeStudy(partner: string, topic: string) {
  const person = character(partner)
  if (!person || eligible(partner)) {
    throw Error('This friend is no longer available for this session.')
  }
  const action = `I sit down with ${person.firstName} for a dedicated study session on ${topic}. I ask her to help me understand it through conversation and open-ended questions at my own pace. We find a fitting place to study together.`
  await startInvitedScene(STUDY_MOD, partner, action, () => {
    studyScene.set({partner,topic,document:null,section:0,declined:false})
  }, () => !eligible(partner))
}
