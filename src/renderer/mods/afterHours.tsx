import { useEffect, useId, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  affectionFor, charKeyOf, EMOTIONS, emptyFlags, globalSlotOf, LOCATIONS, NARRATIVE_LOCATIONS,
  relationshipTagOf, seededRand, threadStartedBy, type TimeSlot
} from '@vx/modkit/shared'
import {
  addMemory,
  character,
  characterInfo,
  conversation,
  fadeIn,
  gestures,
  interludeNow,
  isGraduationSlot,
  modOptionOn,
  noteInThread,
  quietLift,
  quietPress,
  registerHooks,
  rosterIds,
  safePoint,
  saveField,
  showError,
  useGameFacts,
  useModOption,
  usePlayerProfilePicture,
  type ScreenSlotProps,
  type SlotSettled
} from '@vx/modkit/renderer'
import {
  AFTER_HOURS_MOD, asleepTonight, awayTextPrompt, busyPrompt, busyPromptApplies, busyTextPrompt, idleAtHome, morningReturnPrompt,
  nightOwed, nightPrompt, normalize, sleepingTextPrompt, stagedUntil, stayOverLedgerInstruction, stayOverOf, stayOverPrompt,
  type AfterHours
} from '../../shared/afterHours'
import { afterHoursText } from '../../shared/afterHoursText'
import '../vu_styles/AfterHours.css'

const status = saveField<AfterHours>(AFTER_HOURS_MOD, { empty: { busy: false }, normalize })
/** The loaded roster and graduates whose keys an opening can name. */
function gameCharacters(): NonNullable<ReturnType<typeof character>>[] {
  return rosterIds({ alumni: true }).flatMap(id => {
    const contact = character(id)
    return contact ? [contact] : []
  })
}
/**
 * Whether an evening has a night after it: not the one before graduation morning, which opens on
 * the ceremony.
 */
function nightAfter(date: number, time: TimeSlot): boolean {
  return time === 1 && !isGraduationSlot(date + 1, 0)
}

function heldNight() {
  const hold = interludeNow()
  return hold?.owner === AFTER_HOURS_MOD && hold.clock === 'late-night' ? hold : null
}

const CLOSE_TAGS = new Set(['Friend', 'Best Friend', 'BFF', 'Lover'])
const hintIn = fadeIn(0)

/** Keeps the night's sleepers fixed once the held landing opens. */
function recordSleepers(date: number): void {
  const data = status.read()
  const sleep = data.sleep?.date === date ? data.sleep : { date, cast: [] }
  if (sleep.asleep) return
  const asleep = gameCharacters().filter(contact => {
    const info = characterInfo(contact.charId)
    const tag = relationshipTagOf(info?.flags ?? emptyFlags(), affectionFor(info, date, contact))
    return asleepTonight(charKeyOf(contact.firstName, contact.lastName), date, {
      metThisEvening: sleep.cast.includes(contact.charId),
      close: CLOSE_TAGS.has(tag)
    })
  }).map(contact => contact.charId)
  status.set({ ...data, sleep: { ...sleep, asleep } })
}

/** Fixes the daytime idle list once, excluding the person in the morning goodbye. */
function recordWeekendIdle(date: number, time: TimeSlot, homeContacts: readonly string[]): void {
  const data = status.read()
  const slot = globalSlotOf(date, time)
  if (data.weekendIdle?.slot === slot) return
  const overnightGuest = data.stayOver?.morning === slot ? data.stayOver.charId : null
  const charIds = homeContacts.filter(id => {
    if (id === overnightGuest) return false
    const contact = character(id)
    return contact !== undefined && idleAtHome(charKeyOf(contact.firstName, contact.lastName), date, time)
  })
  status.set({ ...data, weekendIdle: { slot, charIds } })
}

/** The reader's face, name and status. Clicking the chip switches the status. */
function StatusChip({ theme }: ScreenSlotProps['chatsHeader']): JSX.Element | null {
  const enabled = useModOption(AFTER_HOURS_MOD, 'busy-status')
  const { playthroughId, readerName } = useGameFacts()
  const picture = usePlayerProfilePicture()
  const value = status.use()
  const [writing, setWriting] = useState(false)
  const [hover, setHover] = useState(false)
  const hintId = useId()
  useEffect(() => setHover(false), [enabled, playthroughId])
  if (!enabled || !playthroughId) return null

  /** Saves against the current value so a delayed write cannot replace a newer status. */
  async function toggle(): Promise<void> {
    const expect = status.read()
    const next = { ...expect, busy: !expect.busy }
    if (safePoint() !== 'open') {
      status.set(next)
      return
    }
    setWriting(true)
    try {
      const result = await status.write(next, { expect })
      if (!result.ok) showError(result.error)
    } finally {
      setWriting(false)
    }
  }

  return (
    <div
      className="vu-after-hours-status"
      data-theme={theme}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <motion.button
        type="button"
        className="vu-after-hours-chip"
        aria-pressed={value.busy}
        aria-describedby={hover ? hintId : undefined}
        disabled={writing}
        onClick={() => void toggle()}
        {...gestures(writing, quietLift, quietPress)}
      >
        <span className="vu-arch vu-bb-face vu-bb-face--sm vu-after-hours-face">
          {picture ? (
            <span className="vu-crop">
              <img className="vu-crop-img" src={picture} alt="" />
            </span>
          ) : (
            <span className="vu-after-hours-initial" aria-hidden="true">{readerName.charAt(0)}</span>
          )}
        </span>
        <span className="vu-after-hours-main">
          <span className="vu-bb-name">{readerName}</span>
          <span className="vu-bb-where">
            <span className={`vu-bb-led${value.busy ? ' vu-bb-led--busy' : ''}`} aria-hidden="true" />
            {value.busy ? afterHoursText.busy : afterHoursText.online}
          </span>
        </span>
      </motion.button>
      <AnimatePresence>
        {hover && (
          <motion.span
            id={hintId}
            role="tooltip"
            className="vu-after-hours-hint"
            variants={hintIn}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            {afterHoursText.hint}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Joins the names of the contacts who kept the meet-up. */
function meetupNames(names: readonly string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
}

/** Records a completed phone meet-up in the conversation that arranged it. */
function noteMeetup({ before, closingCast }: Pick<SlotSettled, 'before' | 'closingCast'>): void {
  const charId = before.sceneTextLedgerSkip
  // An ending resumed from a save has no closing cast of its own; the saved cast stands in for it.
  const cast = closingCast.length > 0
    ? closingCast
    : before.cast.flatMap(id => before.characters[id] ? [before.characters[id]] : [])
  const contact = cast.find(person => person.charId === charId)
  if (!contact) return

  const action = before.currentSceneTranscript[0]?.text.split('\n', 1)[0]
  const plan = before.events.find(event =>
    event.date === before.date && event.time === before.time && event.charIds.includes(contact.charId) &&
    (event.title === action || event.description === action)
  )
  const others = cast.filter(person =>
    person.charId !== contact.charId && plan?.charIds.includes(person.charId)
  )
  const names = meetupNames([contact.firstName, ...others.map(person => person.firstName)])
  const place = [...LOCATIONS, ...NARRATIVE_LOCATIONS].find(location => location.id === before.sceneLocation)?.label
  noteInThread(contact.charId, `You met up with ${names}${place ? ` at ${place}` : ''}.`,
    { date: before.date, time: before.time })
}

registerHooks(AFTER_HOURS_MOD, {
  chatsHeader: StatusChip,
  ownMeetupAsks: () => true,
  warnBeforeMeetup: () => true,
  readReceipts: () => true,
  statusWords: () => true,
  acceptLine: ({ charId, mine }) => {
    const pool = mine ? afterHoursText.acceptMine : afterHoursText.acceptTheirs
    const thread = conversation(charId)?.messages.length ?? 0
    return pool[Math.floor(seededRand(`${AFTER_HOURS_MOD}:accept:${charId}:${thread}`)() * pool.length)]
  },
  chatListLights: () => modOptionOn(AFTER_HOURS_MOD, 'chat-lights'),
  asleepNow: ({ charId, date, time, opening }) => {
    if (opening?.weekend) recordWeekendIdle(date, time, opening.homeContacts)
    if (!modOptionOn(AFTER_HOURS_MOD, 'busy-texts')) return false
    const data = status.read()
    const hold = interludeNow()
    if (hold) {
      return hold.owner === AFTER_HOURS_MOD && hold.clock === 'late-night' && modOptionOn(AFTER_HOURS_MOD, 'night') &&
        data.sleep?.date === hold.from.date && data.sleep.asleep?.includes(charId) === true
    }
    return data.weekendIdle?.slot === globalSlotOf(date, time) && data.weekendIdle.charIds.includes(charId)
  },
  textWhileBusy: () => modOptionOn(AFTER_HOURS_MOD, 'busy-texts'),
  interludePreview: ({ to, ledger }) =>
    modOptionOn(AFTER_HOURS_MOD, 'night') && nightOwed(to, status.read()) && !isGraduationSlot(to.date, to.time) &&
      !stayOverOf(ledger, gameCharacters())
      ? { at: 'from', clock: 'late-night' } : null,
  slotInterlude: ({ from, to }) => {
    if (!modOptionOn(AFTER_HOURS_MOD, 'night') || !nightOwed(to, status.read()) || isGraduationSlot(to.date, to.time)) return null
    recordSleepers(from.date)
    // Seeded by the night, so a reload of the same night reads the same lines.
    const night = globalSlotOf(to.date, to.time)
    const pick = (pool: readonly string[], use: string): string =>
      pool[Math.floor(seededRand(`${AFTER_HOURS_MOD}:${use}:${night}`)() * pool.length)]
    const sleepLine = pick(afterHoursText.sleepLines, 'sleep')
    return {
      lines: [pick(afterHoursText.nightLines, 'night')],
      rows: [{
        label: afterHoursText.goToSleep,
        card: true,
        line: sleepLine,
        onPick: () => status.set({ ...status.read(), nightDone: globalSlotOf(to.date, to.time) })
      }],
      clock: 'late-night'
    }
  },
  relaxLine: ({ date, time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && nightAfter(date, time) ? afterHoursText.relaxLine : undefined,
  // The morning opens with the stay-over partner on stage until the two part.
  openingLook: ({ date, time, reply }) => {
    const stay = status.read().stayOver
    const contact = stay && stay.morning === globalSlotOf(date, time) ? character(stay.charId) : null
    if (!stay || !contact) return null
    return {
      room: { kind: stay.room, charId: stay.charId },
      cast: [stay.charId],
      until: stagedUntil(reply, charKeyOf(contact.firstName, contact.lastName))
    }
  },
  relaxRows: ({ date, time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && nightAfter(date, time) ? [{
    label: afterHoursText.skipTomorrow,
    onPick: () => status.set({ ...status.read(), nightDone: globalSlotOf(date, time) + 1 })
  }] : [],
  slotSettled: ({ before, ledger, closingCast, ownMeetupsLapsed }) => {
    for (const { charId } of ownMeetupsLapsed ?? []) {
      addMemory(AFTER_HOURS_MOD, charId, {
        date: before.date, type: 'disliked', desc: 'you asked to meet up and then changed your mind'
      })
    }
    noteMeetup({ before, closingCast })

    const slot = globalSlotOf(before.date, before.time)
    const { stayOver: past, sleep: _sleep, ...data } = status.read()
    const evening = modOptionOn(AFTER_HOURS_MOD, 'night') && nightAfter(before.date, before.time)
    const stay = nightAfter(before.date, before.time) ? stayOverOf(ledger, gameCharacters()) : null
    status.set(stay
      ? { ...data, nightDone: slot + 1, stayOver: { charId: stay.partner.charId, room: stay.room, morning: slot + 1 } }
      : {
          ...data,
          ...(past && past.morning > slot ? { stayOver: past } : {}),
          ...(evening && data.nightDone !== slot + 1 ? {
            sleep: { date: before.date, cast: closingCast.length > 0 ? closingCast.map(contact => contact.charId) : [...before.cast] }
          } : {})
        })
  },
  requests: {
    ledger: (request, { state, charKeys }) => {
      if (!nightAfter(state.date, state.time) || !modOptionOn(AFTER_HOURS_MOD, 'night')) return request
      const schema = request.schema.schema
      return { ...request, user: `${request.user}\n${stayOverLedgerInstruction(state.readerPronouns)}`, schema: { ...request.schema, schema: {
        ...schema,
        properties: {
          ...schema.properties as Record<string, unknown>,
          stayedOverWith: { type: 'string', enum: [...charKeys, 'none'] },
          stayedOverIn: { type: 'string', enum: ['herRoom', 'hisRoom', 'none'] }
        },
        required: [...((schema.required as string[]) ?? []), 'stayedOverWith', 'stayedOverIn']
      } } }
    },
    'slot-intro': (request, { input, ledger }) => {
      if (input.time !== 0) return request
      const stay = stayOverOf(ledger, gameCharacters())
      if (!stay) return request
      const key = charKeyOf(stay.partner.firstName, stay.partner.lastName)
      // The opening gives the partner their own lines and names where the two part.
      const schema = request.schema.schema as { properties: Record<string, unknown>; required?: string[] }
      const lines = schema.properties.lines as { items: { properties: Record<string, unknown> } }
      return {
        ...request,
        user: `${request.user}\n${morningReturnPrompt(stay.partner, key, stay.room, input.readerPronouns)}`,
        schema: { ...request.schema, schema: {
          ...schema,
          properties: {
            ...schema.properties,
            // Every line names its speaker or uses the empty value for narration.
            lines: { ...lines, items: { ...lines.items,
              properties: {
                ...lines.items.properties,
                speaker: { type: 'string', enum: [key, ''] },
                emotion: { type: 'string', enum: [...EMOTIONS, ''] }
              },
              required: [...((lines.items as { required?: string[] }).required ?? []), 'speaker', 'emotion']
            } },
            homeLine: { type: 'integer' }
          },
          required: [...(schema.required ?? []), 'homeLine']
        } }
      }
    }
  },
  hangoutCheck: ({ startedBy }) =>
    !busyPromptApplies(modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy, startedBy),
  relaxLabel: ({ date, time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && nightAfter(date, time) ? afterHoursText.relax : undefined,
  prompts: {
    scene: {
      lines: ({ state }) => nightAfter(state.date, state.time) && modOptionOn(AFTER_HOURS_MOD, 'night') ? [stayOverPrompt] : []
    },
    dm: {
      lines: ({ character, state }) => {
        const thread = conversation(character.charId)
        const busy = busyPromptApplies(
          modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy,
          threadStartedBy(thread?.messages ?? [], state.date, state.time)
        )
        return [
          ...(state.asleep ? [sleepingTextPrompt(character)] : []),
          ...(state.away !== undefined ? [awayTextPrompt(character, state.away)] : []),
          // A reply written after a class they share is told so by the game itself.
          ...(state.heldUntil && state.commitment && !state.sharedClass ? [busyTextPrompt(character, state.commitment, state.readerPronouns)] : []),
          ...(!state.asleep && state.away === undefined && heldNight() ? [nightPrompt(character)] : []),
          ...(busy ? [busyPrompt(character)] : [])
        ]
      }
    }
  }
})
