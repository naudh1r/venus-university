import { gestures, quietLift, quietPress, SelectField, useScene } from '@vx/modkit/renderer'
import type { PlayerStats, StatKey } from '@vx/modkit/shared'
import { useState } from 'react'
import { motion } from 'motion/react'
import { PERSONAL_GROWTH, quoteTraining, TRAINING_RULES } from '../../shared/talentTrading'
import type { TalentState } from '../../shared/campusTalents'
import { isStatKey, STAT_LABELS } from '@shared/playerStats'

interface TrainingProps {
  safe: boolean
  talents: TalentState
  stats: PlayerStats
  term: number
  date: number
  onTrain: (stat: StatKey) => void
}

export function TalentTrainingControls({ safe, talents, stats, term, date, onTrain }: TrainingProps) {
  const [stat,setStat]=useState<StatKey>('brain')
  const assessment = useScene(scene => scene !== null &&
    (scene.quiz || scene.classCode !== null || scene.projectClass !== null || scene.jobId !== null))
  if (!talents.ranks[PERSONAL_GROWTH]) return null
  const quote=quoteTraining(talents,stats,stat,term,date)
  const blocked=!safe||assessment||!!quote.reason
  const reason=assessment?'Finish the class, project or work scene before training.':!safe?'Finish the current reply or conversation before making changes.':quote.reason
  return <section className="vu-talent-actions" aria-label="Personal Growth controls">
    <SelectField id="talent-training-stat" label="Stat to improve" value={stat} disabled={!safe} onChange={value=>{if(isStatKey(value))setStat(value)}} options={(['brain','body','heart'] as const).map(key=>({value:key,label:`${STAT_LABELS[key]} · ${stats[key]}`}))}/>
    <p data-testid="training-quote"><strong>{STAT_LABELS[stat]} {quote.from} → {quote.to}</strong><br/>
      {quote.gain>0?`${quote.cost} BP · ${quote.recovery?'Recover semester-break loss':'New progress'}`:'Godly reached. Keep your BP for next semester.'}</p>
    <motion.button type="button" className="vu-btn vu-btn--quiet" disabled={blocked} {...gestures(blocked,quietLift,quietPress)} onClick={()=>onTrain(stat)}>{quote.gain>0?`Buy +${quote.gain} ${STAT_LABELS[stat]} · ${quote.cost} BP`:'Godly reached'}</motion.button>
    <p>{quote.weeklyLeft} of {TRAINING_RULES.weekly} purchases left this week; {quote.newWeeklyLeft} of {TRAINING_RULES.newWeekly} new-progress purchases left. Shared across all three stats; unused purchases do not carry over.</p>
    <p>{quote.recoverable>0?`${quote.recoverable} ${STAT_LABELS[stat]} points from the last recorded break remain eligible for the recovery price.`:'No recorded break loss remains for this stat. Recovery prices begin after a semester transition with this version installed.'}</p>
    <p>Purchased points apply in full and still undergo normal semester decay. Existing progress toward your next stat point is kept.</p>
    {reason&&<p role="status">{reason}</p>}
  </section>
}
