import { useEffect, useId, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { globalSlotOf } from '@vx/modkit/shared'
import {
  character,
  charCommitmentAt,
  fadeIn,
  freeForInvitation,
  gestures,
  interludeNow,
  isGraduationSlot,
  modOptionOn,
  modState,
  quietLift,
  quietPress,
  registerHooks,
  safePoint,
  saveField,
  showError,
  useGameFacts,
  useModOption,
  usePlayerProfilePicture,
  type ScreenSlotProps
} from '@vx/modkit/renderer'
import { AFTER_HOURS_MOD, busyDrops, morningInterlude, normalize, type AfterHours, type NightVisit } from '../../shared/afterHours'
import {
  afterHoursText, busyPrompt, busyTextPrompt, morningReturnPrompt, morningScenePrompt, morningText, nightPrompt, visitFieldInstruction,
  visitLedgerInstruction, visitMorningPrompt, visitScenePrompt
} from '../../shared/afterHoursText'
import '../vu_styles/AfterHours.css'

const status = saveField<AfterHours>(AFTER_HOURS_MOD, { empty: { busy: false }, normalize })
const nightState = modState<{
  agreements: Record<string, 'herRoom' | 'hisRoom' | 'none'>
  armed: Pick<NightVisit, 'charId' | 'room'> | null
}>(AFTER_HOURS_MOD, { initial: { agreements: {}, armed: null }, lifetime: 'game' })
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
  slotInterlude: ({ to }) => {
    if (!modOptionOn(AFTER_HOURS_MOD, 'night')) return null
    const data = status.read()
    const visit = data.visit
    const choice = morningInterlude(to, data, Boolean(visit && freeForInvitation(visit.charId)), isGraduationSlot(to.date, to.time))
    if (!choice) {
      if (visit?.stayed && visit.scened && visit.morning === globalSlotOf(to.date, to.time)) status.set({ ...data, visit: undefined })
      return null
    }
    if (choice === 'night') return {
      lines: [afterHoursText.nightLine],
      rows: [{
        label: afterHoursText.endTheDay,
        confirm: afterHoursText.endTheDayConfirm,
        onPick: () => {
          nightState.set({ ...nightState.get(), armed: null })
          status.set({ ...status.read(), visit: undefined, nightDone: globalSlotOf(to.date, to.time) })
        }
      }],
      clock: 'late-night',
      onHangout: (_verdict, ctx) => {
        const room = nightState.get().agreements[ctx.charId]
        nightState.set({ ...nightState.get(), armed: room === 'herRoom' || room === 'hisRoom' ? { charId: ctx.charId, room } : null })
        return room === 'herRoom' || room === 'hisRoom' ? { room } : null
      }
    }
    if (!visit) return null
    const name = character(visit.charId)?.firstName
    if (!name) return null
    if (choice === 'morningScene') {
      status.set({ ...data, visit: { ...visit, scened: true } })
      return {
        lines: [], rows: [],
        scene: { charId: visit.charId, room: visit.room, action: morningText.wakeAction(name), at: 'morning', pays: false }
      }
    }
    const onPick = (): void => { status.set({ ...status.read(), visit: undefined }) }
    return {
      look: { time: to.time, room: { kind: 'herRoom', charId: visit.charId } },
      lines: [],
      rows: [
        { label: morningText.stay(name), onPick, scene: { charId: visit.charId, room: 'herRoom', action: morningText.action(name) } },
        { label: morningText.headBack, onPick }
      ]
    }
  },
  afterDmReply: ({ charId, reply }) => {
    if (!nightHolds()) return
    const value = (reply as { nightVisit?: unknown }).nightVisit
    nightState.set({ ...nightState.get(), agreements: { ...nightState.get().agreements, [charId]: value === 'herRoom' || value === 'hisRoom' ? value : 'none' } })
  },
  playerActs: () => {
    const hold = interludeNow()
    const agreed = nightState.get().armed
    if (hold?.owner !== AFTER_HOURS_MOD || !agreed) return
    const morning = globalSlotOf(hold.to.date, hold.to.time)
    if (status.read().visit?.morning === morning) return
    status.set({ ...status.read(), visit: { ...agreed, morning } })
    nightState.set({ ...nightState.get(), armed: null })
  },
  slotSettled: ({ bonus, ledger }) => {
    const visit = status.read().visit
    if (!bonus || !visit || visit.scened || visit.stayed !== undefined) return
    const fields = ledger as { stayedOver?: unknown } | null
    const stayed = fields?.stayedOver === true
    status.set({ ...status.read(), visit: { ...visit, stayed }, nightDone: visit.morning })
  },
  requests: {
    ledger: request => {
      const visit = status.read().visit
      if (!visit || visit.scened || visit.stayed !== undefined) return request
      const schema = request.schema.schema
      return { ...request, user: `${request.user}\n${visitLedgerInstruction}`, schema: { ...request.schema, schema: {
        ...schema,
        properties: { ...schema.properties as Record<string, unknown>, stayedOver: { type: 'boolean' } },
        required: [...((schema.required as string[]) ?? []), 'stayedOver']
      } } }
    },
    'slot-intro': (request, { input }) => {
      const visit = status.read().visit
      if (!visit || visit.morning !== globalSlotOf(input.date, input.time)) return request
      const name = character(visit.charId)?.firstName
      if (!name) return request
      const line = visit.stayed ? morningReturnPrompt(name, visit.room) : visitMorningPrompt(name, visit.room)
      return { ...request, user: `${request.user}\n${line}` }
    }
  },
  hangoutVerdict: (verdict, ctx) =>
    busyDrops(verdict, ctx, modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy) ? null : verdict,
  relaxLabel: ({ time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && time === 1 ? afterHoursText.relax : undefined,
  prompts: {
    scene: {
      lines: ({ state }) => {
        const visit = status.read().visit
        if (!visit) return []
        if (state.lateNight) return [visitScenePrompt(visit.room)]
        const name = character(visit.charId)?.firstName
        return visit.scened && name ? [morningScenePrompt(name, visit.room, charCommitmentAt(visit.charId))] : []
      }
    },
    dm: {
      lines: ({ character, state }) => [
        ...(state.heldUntil && state.commitment ? [busyTextPrompt(character.firstName, state.commitment)] : []),
        ...(nightHolds() ? [nightPrompt(character.firstName), visitFieldInstruction] : []),
        ...(modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy ? [busyPrompt(character.firstName)] : [])
      ],
      fields: () => nightHolds() ? { nightVisit: { type: 'string', enum: ['herRoom', 'hisRoom', 'none'] } } : {},
      required: () => nightHolds() ? ['nightVisit'] : []
    }
  }
})
