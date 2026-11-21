import { useEffect, useId, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { charKeyOf, EMOTIONS, globalSlotOf, seededRand, threadStartedBy } from '@vx/modkit/shared'
import {
  character,
  conversation,
  fadeIn,
  gestures,
  interludeNow,
  modOptionOn,
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
  type ScreenSlotProps
} from '@vx/modkit/renderer'
import {
  AFTER_HOURS_MOD, busyPrompt, busyPromptApplies, busyTextPrompt, morningReturnPrompt,
  nightOwed, nightPrompt, normalize, stagedUntil, stayOverLedgerInstruction, stayOverOf, stayOverPrompt,
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
function nightHolds(): boolean {
  const hold = interludeNow()
  return hold?.owner === AFTER_HOURS_MOD && hold.clock === 'late-night'
}
const hintIn = fadeIn(0)

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

registerHooks(AFTER_HOURS_MOD, {
  chatsHeader: StatusChip,
  textWhileBusy: () => modOptionOn(AFTER_HOURS_MOD, 'busy-texts'),
  interludePreview: ({ to, ledger }) =>
    modOptionOn(AFTER_HOURS_MOD, 'night') && nightOwed(to, status.read()) && !stayOverOf(ledger, gameCharacters())
      ? { at: 'from', clock: 'late-night' } : null,
  slotInterlude: ({ to }) => {
    if (!modOptionOn(AFTER_HOURS_MOD, 'night') || !nightOwed(to, status.read())) return null
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
  relaxLine: ({ time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && time === 1 ? afterHoursText.relaxLine : undefined,
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
  relaxRows: ({ date, time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && time === 1 ? [{
    label: afterHoursText.skipTomorrow,
    onPick: () => status.set({ ...status.read(), nightDone: globalSlotOf(date, time) + 1 })
  }] : [],
  slotSettled: ({ before, ledger }) => {
    const slot = globalSlotOf(before.date, before.time)
    const { stayOver: past, ...data } = status.read()
    const stay = before.time === 1 ? stayOverOf(ledger, gameCharacters()) : null
    status.set(stay
      ? { ...data, nightDone: slot + 1, stayOver: { charId: stay.partner.charId, room: stay.room, morning: slot + 1 } }
      : { ...data, ...(past && past.morning > slot ? { stayOver: past } : {}) })
  },
  requests: {
    ledger: (request, { state, charKeys }) => {
      if (state.time !== 1 || !modOptionOn(AFTER_HOURS_MOD, 'night')) return request
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
  relaxLabel: ({ time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && time === 1 ? afterHoursText.relax : undefined,
  prompts: {
    scene: {
      lines: ({ state }) => state.time === 1 && modOptionOn(AFTER_HOURS_MOD, 'night') ? [stayOverPrompt] : []
    },
    dm: {
      lines: ({ character, state }) => {
        const thread = conversation(character.charId)
        const busy = busyPromptApplies(
          modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy,
          threadStartedBy(thread?.messages ?? [], state.date, state.time)
        )
        return [
          // A reply written after a class they share is told so by the game itself.
          ...(state.heldUntil && state.commitment && !state.sharedClass ? [busyTextPrompt(character, state.commitment, state.readerPronouns)] : []),
          ...(nightHolds() ? [nightPrompt(character)] : []),
          ...(busy ? [busyPrompt(character)] : [])
        ]
      }
    }
  }
})
