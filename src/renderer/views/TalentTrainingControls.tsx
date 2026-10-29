import { gestures, quietLift, quietPress } from '@vx/modkit/renderer'
import { useState } from 'react'
import { motion } from 'motion/react'
import { PERSONAL_GROWTH, quoteTraining, TRAINING_RULES } from '../../shared/talentTrading'
import { isStatKey, STAT_LABELS, type StatKey } from '@shared/playerStats'
import { useGameStore } from '../stores/gameStore'
import type { TalentChange } from '../stores/talentActions'
import { SelectField } from '../components/SelectField'

export function TalentTrainingControls({safe,act}:{safe:boolean;act:(a:TalentChange)=>Promise<boolean>}) {
  const game=useGameStore(),s=game.exTalents
  const [stat,setStat]=useState<StatKey>('brain')
  if (!s.ranks[PERSONAL_GROWTH]) return null
  const quote=quoteTraining(s,game.stats,stat,game.semesterIndex,game.date)
  const assessment=!!game.sceneQuiz||game.sceneClass!==null||game.sceneProject!==null||game.sceneJob!==null
  const blocked=!safe||assessment||!!quote.reason
  const reason=assessment?'Finish the class, project or work scene before training.':!safe?'Finish the current reply or conversation before making changes.':quote.reason
  return <section className="vu-talent-actions" aria-label="Personal Growth controls">
    <SelectField id="talent-training-stat" label="Stat to improve" value={stat} disabled={!safe} onChange={value=>{if(isStatKey(value))setStat(value)}} options={(['brain','body','heart'] as const).map(key=>({value:key,label:`${STAT_LABELS[key]} · ${game.stats[key]}`}))}/>
    <p data-testid="training-quote"><strong>{STAT_LABELS[stat]} {quote.from} → {quote.to}</strong><br/>
      {quote.gain>0?`${quote.cost} BP · ${quote.recovery?'Recover semester-break loss':'New progress'}`:'Godly reached. Keep your BP for next semester.'}</p>
    <motion.button type="button" className="vu-btn vu-btn--quiet" disabled={blocked} {...gestures(blocked,quietLift,quietPress)} onClick={()=>void act({train:stat})}>{quote.gain>0?`Buy +${quote.gain} ${STAT_LABELS[stat]} · ${quote.cost} BP`:'Godly reached'}</motion.button>
    <p>{quote.weeklyLeft} of {TRAINING_RULES.weekly} purchases left this week; {quote.newWeeklyLeft} of {TRAINING_RULES.newWeekly} new-progress purchases left. Shared across all three stats; unused purchases do not carry over.</p>
    <p>{quote.recoverable>0?`${quote.recoverable} ${STAT_LABELS[stat]} points from the last recorded break remain eligible for the recovery price.`:'No recorded break loss remains for this stat. Recovery prices begin after a semester transition with this version installed.'}</p>
    <p>Purchased points apply in full and still undergo normal semester decay. Existing progress toward your next stat point is kept.</p>
    {reason&&<p role="status">{reason}</p>}
  </section>
}
