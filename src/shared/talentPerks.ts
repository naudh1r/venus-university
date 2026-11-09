import { talentEffect, talentsEnabled, type TalentState } from './campusTalents'
import type { TalentEffect } from './talentTypes'
import type { CharMemory, ProjectSession, TimeSlot } from '@vx/modkit/shared'
import type { PlayerStats, StatContext, StatusText } from '@vx/modkit/shared'
import { eurekaReady } from './talentAbilities'
import type { ExamPeriod } from './academics'

/** Effects pause with the mod; callers can omit the state for native calculations. */
function effect(s: TalentState | undefined, key: TalentEffect): number {
  return s && talentsEnabled() ? talentEffect(s, key) : 0
}

/** Freeze only the newly earned memory's Heart bonus, separately from Echo affinity. */
export function talentHeartBonus(s: TalentState, memory: CharMemory, source: 'scene' | 'text' | 'gift', group: boolean): number {
  if (memory.type === 'disliked') return 1 - Math.min(.2, effect(s, 'heart.grace'))
  if (memory.type !== 'liked' && memory.type !== 'loved') return 1
  const bonus = effect(s, memory.type === 'loved' ? 'heart.loved' : 'heart.liked') +
    effect(s, source === 'text' ? 'heart.text' : source === 'gift' ? 'heart.gift' : 'heart.group') *
    (source === 'scene' && !group ? 0 : 1)
  return 1 + Math.min(.5, bonus)
}

/** A saved award follows normal memory decay; disabling the mod uses the native value. */
export function talentHeartMultiplier(m: CharMemory): number {
  const n = m.talentHeartMultiplier
  if (!talentsEnabled() || typeof n !== 'number' || !Number.isFinite(n)) return 1
  if (m.type === 'disliked') return n >= .8 && n <= 1 ? n : 1
  return (m.type === 'liked' || m.type === 'loved') && n >= 1 && n <= (m.talentAnticipation ? 1.75 : 1.5) ? n : 1
}

/** Add training only to an activity that really earned the relevant stat. */
export function talentStatGains(s: TalentState, resolved: {deltas: PlayerStats; lines: StatusText[]}, ctx: StatContext, pe: boolean, currentHeart = 0): typeof resolved {
  if (!talentsEnabled() || ctx.sick) return resolved
  const bonus = { brain: 0, body: 0 }
  if (ctx.jobOutcome) {
    if (ctx.jobOutcome.gain.stats.includes('body')) bonus.body = effect(s, 'body.shift')
  } else if (ctx.classScene) {
    if (ctx.classOutcome?.attended) {
      if (ctx.classOutcome.stat === 'brain') bonus.brain = effect(s, 'brain.class')
      if (pe && ctx.classOutcome.stat === 'body') bonus.body = effect(s, 'body.pe')
    }
  } else {
    if (ctx.solo && resolved.deltas.brain > 0) bonus.brain = effect(s, 'brain.solo')
    if (resolved.deltas.body > 0) bonus.body = effect(s, ctx.solo ? 'body.solo' : 'body.company')
  }
  const deltas = {...resolved.deltas}, lines = [...resolved.lines]
  for (const key of ['brain', 'body'] as const) {
    const n = Math.min(2, Math.floor(bonus[key]))
    if (n > 0 && deltas[key] > 0) {
      deltas[key] += n
      lines.push({text: `Campus Talents: ${key === 'brain' ? 'Brain' : 'Body'} went up by another ${n}.`, polarity: 'positive'})
    }
  }
  // Grades are already mixed into the native delta. Separate them before deciding
  // whether the activity earned Heart, so a grade alone cannot trigger training.
  const gradeHeart = ctx.jobOutcome ? 0 : ctx.gradeOutcome?.heart ?? 0
  const activityHeart = resolved.deltas.heart - gradeHeart
  let heartBonus = 0
  if (activityHeart > 0) {
    const source = ctx.jobOutcome ? 'heart.shift' : ctx.classScene ? 'heart.class' : ctx.solo ? 'heart.solo' : 'heart.company'
    const eligible = ctx.jobOutcome ? ctx.jobOutcome.gain.stats.includes('heart') : ctx.classScene ? ctx.classOutcome?.attended && ctx.classOutcome.stat === 'heart' : true
    if (eligible) heartBonus += Math.min(2, Math.floor(effect(s, source)))
    if (Number.isFinite(currentHeart) && currentHeart < 0) heartBonus += Math.min(1, Math.floor(effect(s, 'heart.recovery')))
  }
  if (heartBonus > 0) {
    deltas.heart += heartBonus
    lines.push({text: `Campus Talents: Heart went up by another ${heartBonus}.`, polarity: 'positive'})
  }
  return { deltas, lines }
}

/** One real session can bank up to three work units; the clock still advances one slot. */
export function talentProjectWork(s: TalentState, time: TimeSlot, project?: {term:number;date:number;code:string;exam:ExamPeriod}): number {
  if (project && eurekaReady(s,project.term,project.date,project.code,project.exam)) return 3
  if (time === 1 && effect(s, 'brain.night-work') > 0) return 2
  return 1 + Math.min(.5, effect(s, 'brain.work'))
}

/** Old sessions count as one; earned extra work survives later toggles and upgrades. */
export function projectWorkUnits(session: ProjectSession): number {
  const n = session.talentWorkUnits
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1
}

/** Preserve absence, the zero-work gate, and the native imperfect-work ceiling. */
export function talentAssessment(s: TalentState, score: number, kind: 'exam' | 'showcase', present: boolean, attempted: boolean, complete: boolean): number {
  if (!present || !attempted) return score
  return Math.min(complete ? 100 : 99, score + Math.min(9, Math.floor(effect(s, kind === 'exam' ? 'brain.exam' : 'brain.showcase'))))
}

/** Apply resistance to the reader's odds only; native NPC cold rules stay intact. */
export function talentColdProtection(s: TalentState): {readerCatchFactor: number; readerMildBonus: number} {
  return {readerCatchFactor: 1 - Math.min(.45, effect(s, 'body.resist')), readerMildBonus: Math.min(.2, effect(s, 'body.mild'))}
}
