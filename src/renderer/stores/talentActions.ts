import { abilityRank, farewellRomance, TALENT_ABILITIES } from '@shared/talentAbilities'
import { abilityUsedThisWeek } from '@shared/talentAbilityState'
import type { TalentState } from '@shared/campusTalents'
import type { ExamPeriod } from '@shared/academics'
import type { StatKey } from '@shared/playerStats'
import { fullNameOf } from '@vx/modkit/shared'
import { projectAssigned, projectPeriodOf, workedOn } from '../prompts/classProgress'
import { interjectOfferOf, replyRowOfferOf } from './loop/playback'
import { useGameStore } from './gameStore'

type Game = ReturnType<typeof useGameStore.getState>
export type TalentChange = {skill:string} | {transfer:number} | {train:StatKey} | {ability:'eureka';code:string;exam:ExamPeriod} |
  {ability:'cancel-eureka'} | {ability:'farewell';charId:string} | {ability:'cancel-farewell'} |
  {ability:'silver-lining';charId:string} | {ability:'cancel-silver-lining'}

/** Only assigned, unfinished projects on the reader's own timetable can be armed. */
export function eurekaProjects(game:Game): Array<{code:string;exam:ExamPeriod;name:string}> {
  return [...new Set(Object.values(game.playerSchedule))].flatMap(code=>{
    const entry=game.classes[code], record=game.classRecords[code]
    const p=entry&&projectPeriodOf(entry,game.date,game.calendar)
    return p && game.date<p.deadlineDate && projectAssigned(record,p) && workedOn(record,p.exam)<p.needed
      ? [{code,exam:p.exam,name:entry.name}] : []
  })
}

/** A scene action uses the same interruption/reply windows as the native input. */
export function talentSceneOpen(game:Game): boolean {
  const offer=interjectOfferOf(game)
  return !!game.playthroughId && !game.replaying && !game.createdScene && !game.sceneQuiz && !game.sceneEnding && !game.statusShown &&
    !game.statusModal && !game.activeGameOver && !game.turnError && !game.exBreakthrough.pending &&
    (offer==='open'||offer==='none'&&(replyRowOfferOf(game)==='open'||game.awaitingInput&&!game.busy&&!game.pendingLines.length)) &&
    (game.currentSceneTranscript.length>0||game.sceneSummary!==null)
}

/** A saved scene action waits for a complete reply, including the native last-line reply row.
 * That row advances to the decision point without cutting any transcript lines. */
export function talentGoodbyeOpen(game:Game): boolean {
  return talentSceneOpen(game) && !game.busy && !game.streaming && !game.waitingForLine && !game.pendingLines.length &&
    (game.awaitingInput || replyRowOfferOf(game)==='open')
}

/** The explicit goodbye is retained verbatim so settlement can verify the reader chose it. */
export function farewellAction(game:Game, id:string): string {
  return `I bring my time with ${fullNameOf(game.characters[id])} to a warm, graceful close, say that I enjoyed being together, and say goodbye without pressing for more. I leave room for us to look forward to our next meeting.`
}

export function silverLiningAction(game:Game, id:string): string {
  return `I try to turn this difficult moment with ${fullNameOf(game.characters[id])} around. I acknowledge what went wrong, use warmth and a little self-aware humor to ease the tension, and offer a constructive way forward that could work in my favor.`
}

/** Validate an ability choice inside the save transaction before it becomes visible. */
export function applyTalentChoice(game:Game, s:TalentState, action:Exclude<TalentChange,{skill:string}|{transfer:number}|{train:StatKey}>): TalentState {
  const abilities={...s.abilities}
  if (action.ability==='cancel-eureka') delete abilities.eureka
  else if (action.ability==='cancel-farewell') delete abilities.farewell
  else if (action.ability==='cancel-silver-lining') delete abilities.silverLining
  else if (action.ability==='eureka') {
    if (!abilityRank(s,TALENT_ABILITIES.eureka)) throw Error('Learn Eureka! first.')
    if (abilityUsedThisWeek(abilities,TALENT_ABILITIES.eureka,game.semesterIndex,game.date)) throw Error('Eureka! returns next calendar week.')
    if (!eurekaProjects(game).some(p=>p.code===action.code&&p.exam===action.exam)) throw Error('Choose an assigned, unfinished project.')
    abilities.eureka={term:game.semesterIndex,code:action.code,exam:action.exam}
  } else if (action.ability==='silver-lining') {
    if (!abilityRank(s,TALENT_ABILITIES.silverLining)) throw Error('Learn Silver Lining first.')
    if (!talentGoodbyeOpen(game)||game.sceneClass!==null||!game.cast.includes(action.charId)||game.departed.includes(action.charId)||!game.characters[action.charId]||!game.charInfo[action.charId]?.nameKnown) throw Error('Finish reading, then choose someone present in an open social scene.')
    if (abilityUsedThisWeek(abilities,TALENT_ABILITIES.silverLining,game.semesterIndex,game.date)) throw Error('Silver Lining returns next calendar week.')
    delete abilities.farewell
    abilities.silverLining={term:game.semesterIndex,date:game.date,time:game.time,charId:action.charId,action:silverLiningAction(game,action.charId),at:game.currentSceneTranscript.length}
  } else {
    if (!abilityRank(s,TALENT_ABILITIES.farewell)) throw Error('Learn Leave Them Wanting More first.')
    if (!talentGoodbyeOpen(game)||game.sceneClass!==null||!game.cast.includes(action.charId)||game.departed.includes(action.charId)||!game.characters[action.charId]||!game.charInfo[action.charId]?.nameKnown||!farewellRomance(game.charInfo[action.charId])) throw Error('Finish reading, then choose a present romantic partner in an open social scene.')
    if (abilityUsedThisWeek(abilities,TALENT_ABILITIES.farewell,game.semesterIndex,game.date)) throw Error('Your graceful goodbye returns next calendar week.')
    delete abilities.silverLining
    abilities.farewell={term:game.semesterIndex,date:game.date,time:game.time,charId:action.charId,action:farewellAction(game,action.charId),at:game.currentSceneTranscript.length}
  }
  return {...s,abilities}
}
