import { coldStageAt, isSickWindow } from '@shared/colds'
import { globalSlotOf, jobDefOf } from '@shared/jobs'
import { locationDefOf, type LocationDef } from '@shared/locations'
import { affectionFor, dispositionOf } from '@shared/relationship'
import {
  eventNamesGirl,
  rollReceivedGift,
  rollSceneEvent,
  type EventInvite,
  type SceneEventContext
} from '@shared/sceneEvents'
import type { ReceivedGift } from '@shared/types'
import { isWet, weatherAt } from '@shared/weather'
import { classSceneContextOf } from '../../prompts/classProgress'
import { moodIndexOf } from '../../prompts/moods'
import { useGameStore, type SceneKind } from '../gameStore'
import { nameOf } from './cast'
import { resolveLocationId } from './casting'
import { lessNsfwTextNow } from './promptState'
import type { TurnSnapshot } from './state'

/**
 * The curveball and the present a cast scene opens on, read off the store and rolled once per
 * turn: the impure edge of `shared/sceneEvents`.
 */

/** What one scene start rolled: kept on the turn, so a retry sends the same. */
type SceneEventRoll = NonNullable<TurnSnapshot['sceneEvents']>

/** The first two days of her cycle, the period the events read. */
const PERIOD_DAYS = 2

/**
 * What the girl hosting this scene asked him to by text this slot, when her invitation was
 * rolled into an ask the events read; null for anything else.
 */
function inviteOf(host: string | undefined): EventInvite | null {
  if (!host) return null
  const game = useGameStore.getState()
  const messages = game.bunnyboard.conversations[host]?.messages ?? []
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.date !== game.date || message.time !== game.time) break
    if (message.sender !== 'contact' || !message.invite) continue
    if (message.inviteKind === 'herRoom' || message.inviteKind === 'hisRoom') {
      return message.inviteKind
    }
    return message.everydayAsk === 'meal' ? 'meal' : null
  }
  return null
}

/** Whether a place is indoors and on campus, each null where nothing says. */
function flagsOf(def: LocationDef | undefined): Pick<SceneEventContext, 'indoors' | 'onCampus'> {
  return def
    ? { indoors: def.outdoors !== true, onCampus: def.onCampus === true }
    : { indoors: null, onCampus: null }
}

/**
 * Where the scene is, as the events read it: a class on campus, a job at its building, a room
 * he was invited to in a dorm, and otherwise wherever the classifier's place resolves to.
 */
function placeOf(
  scene: SceneKind,
  invite: EventInvite | null
): Pick<SceneEventContext, 'indoors' | 'onCampus'> {
  const game = useGameStore.getState()
  if (scene.classCode) {
    // PE may be on a track or in a pool: on campus, and nothing said about a roof.
    const pe = game.classes[scene.classCode]?.category === 'pe'
    return { indoors: pe ? null : true, onCampus: true }
  }
  const jobId = scene.jobId ?? scene.visitJobId
  if (jobId) return flagsOf(locationDefOf(jobDefOf(jobId)?.locationId ?? ''))
  if ((invite === 'herRoom' || invite === 'hisRoom') && scene.inPublic === false) {
    return { indoors: true, onCampus: true }
  }
  const id = resolveLocationId(scene.location)
  return flagsOf(id ? locationDefOf(id) : undefined)
}

/** The class the scene sits in, as the events read it. */
function classOf(
  scene: SceneKind
): Pick<SceneEventContext, 'classKind' | 'syllabusWeek' | 'cancellable'> {
  const game = useGameStore.getState()
  const entry = scene.classCode ? game.classes[scene.classCode] : undefined
  if (!entry) return { classKind: null, syllabusWeek: false, cancellable: false }
  const meeting = classSceneContextOf(
    entry,
    game.date,
    game.classRecords[entry.code],
    game.calendar
  )
  const syllabusWeek = meeting === null || meeting.index <= 1
  return {
    classKind: entry.category === 'pe' ? 'pe' : 'course',
    syllabusWeek,
    // The meetings that grade him — an exam, a showcase, a handback — always go ahead.
    cancellable:
      meeting !== null &&
      !syllabusWeek &&
      !meeting.isMidterm &&
      !meeting.isFinals &&
      !meeting.isHandback
  }
}

/** Rolls the curveball and the present for a scene about to be cast. */
function rollFor(cast: readonly string[], scene: SceneKind, host?: string): SceneEventRoll {
  const game = useGameStore.getState()
  const invite = inviteOf(host)
  const ctx: SceneEventContext = {
    date: game.date,
    time: game.time,
    cast: cast.map((charId) => ({
      charId,
      onPeriod: moodIndexOf(game.date, game.charInfo[charId]?.moodCycleOffset ?? 0) < PERIOD_DAYS,
      sick: isSickWindow(
        coldStageAt(game.charInfo[charId]?.cold, globalSlotOf(game.date, game.time))
      )
    })),
    ...(host && invite ? { invite: { charId: host, kind: invite } } : {}),
    // Absent is public, as the classifier defaults it.
    inPublic: scene.inPublic !== false,
    wet: isWet(weatherAt(game.weather, game.date, game.time)),
    ...placeOf(scene, invite),
    ...classOf(scene),
    lessNsfwText: lessNsfwTextNow()
  }
  const event = rollSceneEvent(ctx, game.sceneEventsFired)

  // A present waits for the shop he could hand it on from, and comes only from the girl who
  // asked him over or asked to come to his.
  let gift: ReceivedGift | null = null
  if (
    host &&
    (invite === 'herRoom' || invite === 'hisRoom') &&
    cast.includes(host) &&
    game.bunnyshopUnlocked
  ) {
    const info = game.charInfo[host]
    const affection = affectionFor(info, game.date, game.characters[host])
    const itemId = rollReceivedGift({
      invite,
      disposition: dispositionOf(affection),
      lover: info?.flags?.isLover === true
    })
    if (itemId) gift = { itemId, charId: host }
  }
  return { event, gift }
}

/** A roll kept from an earlier attempt, less whatever names a girl the new cast lost. */
function stillCast(roll: SceneEventRoll, cast: readonly string[]): SceneEventRoll {
  const event =
    roll.event && eventNamesGirl(roll.event.id) && !cast.includes(roll.event.charId ?? '')
      ? null
      : roll.event
  const gift = roll.gift && cast.includes(roll.gift.charId) ? roll.gift : null
  return { event, gift }
}

/**
 * The scene-kind fields a cast scene opens with: rolled the first time this turn casts, and the
 * same roll on every retry of it. A scene with nobody in it opens on nothing.
 */
export function sceneEventsFor(
  snapshot: TurnSnapshot,
  cast: readonly string[],
  scene: SceneKind,
  host?: string
): Pick<SceneKind, 'event' | 'receivedGift'> {
  if (cast.length === 0) return {}
  const roll = snapshot.sceneEvents ? stillCast(snapshot.sceneEvents, cast) : rollFor(cast, scene, host)
  snapshot.sceneEvents = roll
  if (roll.event) {
    const who = roll.event.charId ? ` → ${nameOf(roll.event.charId)}` : ''
    console.log(`[event] ${roll.event.id}${who}`)
  }
  if (roll.gift) console.log(`[event] ${nameOf(roll.gift.charId)} brings ${roll.gift.itemId}`)
  return {
    ...(roll.event ? { event: roll.event } : {}),
    ...(roll.gift ? { receivedGift: roll.gift } : {})
  }
}
