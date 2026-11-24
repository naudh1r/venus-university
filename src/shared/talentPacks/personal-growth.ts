import type { TalentPack } from '../talentTypes'
import { PERSONAL_GROWTH, TRAINING_RULES } from '../talentTrading'

const pack = {
  id:'personal-growth',name:'Personal Growth',author:'Maestro Leeds',trees:[],
  skills:[{
    id:PERSONAL_GROWTH,tree:'heart',chain:'Shared ability',shared:true,name:'Personal Growth',costs:[TRAINING_RULES.unlock],
    description:'Turn Bond Points into Brain, Body or Heart whenever you can safely save. Each purchase adds one actual stat point, up to Godly (100). Recover recorded semester-break losses for 10 BP per point, or buy new progress for 25 BP below 60 and 40 BP from 60 onward. Six purchases per calendar week across all stats; at most two may be new progress. Fully upgrade one second-row Body, Brain or Heart skill to unlock.',
    prerequisitesAny:[{id:'brain.notes',rank:1},{id:'brain.cram',rank:1},{id:'brain.polish',rank:3},
      {id:'body.partner',rank:1},{id:'body.shift',rank:1},{id:'body.mild',rank:2},
      {id:'heart.ease',rank:2},{id:'heart.work',rank:1},{id:'heart.feet',rank:1}]
  }]
} as const satisfies TalentPack
export default pack
