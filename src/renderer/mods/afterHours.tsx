import { useEffect, useId, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { globalSlotOf, threadStartedBy } from '@vx/modkit/shared'
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
import { AFTER_HOURS_MOD, busyPromptApplies, nightOwed, normalize, stayOverOf, type AfterHours } from '../../shared/afterHours'
import {
  afterHoursText, busyPrompt, busyTextPrompt, morningReturnPrompt, nightPrompt,
  stayOverLedgerInstruction, stayOverPrompt
} from '../../shared/afterHoursText'
import '../vu_styles/AfterHours.css'

const status = saveField<AfterHours>(AFTER_HOURS_MOD, { empty: { busy: false }, normalize })
/** The loaded roster and graduates whose keys an opening can name. */
function gameCharacters(): NonNullable<ReturnType<typeof character>>[] {
  return rosterIds({ alumni: true }).flatMap(id => {
    const girl = character(id)
    return girl ? [girl] : []
  })
}
function nightHolds(): boolean {
  const hold = interludeNow()
  return hold?.owner === AFTER_HOURS_MOD && hold.clock === 'late-night'
}
const hintIn = fadeIn(0)

/** His own face, name and status, drawn as the phone draws a contact; a click switches the status. */
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
    return {
      lines: [afterHoursText.nightLine],
      rows: [{
        label: afterHoursText.goToSleep,
        card: true,
        onPick: () => status.set({ ...status.read(), nightDone: globalSlotOf(to.date, to.time) })
      }],
      clock: 'late-night'
    }
  },
  relaxRows: ({ date, time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && time === 1 ? [{
    label: afterHoursText.skipTomorrow,
    onPick: () => status.set({ ...status.read(), nightDone: globalSlotOf(date, time) + 1 })
  }] : [],
  slotSettled: ({ before, ledger }) => {
    if (before.time === 1 && stayOverOf(ledger, gameCharacters())) {
      status.set({ ...status.read(), nightDone: globalSlotOf(before.date, before.time) + 1 })
    }
  },
  requests: {
    ledger: (request, { state, charKeys }) => {
      if (state.time !== 1 || !modOptionOn(AFTER_HOURS_MOD, 'night')) return request
      const schema = request.schema.schema
      return { ...request, user: `${request.user}\n${stayOverLedgerInstruction}`, schema: { ...request.schema, schema: {
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
      return { ...request, user: `${request.user}\n${morningReturnPrompt(stay.girl.firstName, stay.room)}` }
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
          ...(state.heldUntil && state.commitment ? [busyTextPrompt(character.firstName, state.commitment)] : []),
          ...(nightHolds() ? [nightPrompt(character.firstName)] : []),
          ...(busy ? [busyPrompt(character.firstName)] : [])
        ]
      }
    }
  }
})
