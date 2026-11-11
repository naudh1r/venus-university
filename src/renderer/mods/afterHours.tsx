import { useEffect, useId, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { globalSlotOf } from '@vx/modkit/shared'
import {
  fadeIn,
  gestures,
  interludeNow,
  modOptionOn,
  quietPress,
  registerHooks,
  safePoint,
  saveField,
  showError,
  toggleLift,
  useGameFacts,
  useModOption,
  type ScreenSlotProps
} from '@vx/modkit/renderer'
import { AFTER_HOURS_MOD, busyDrops, nightOwed, normalize, type AfterHours } from '../../shared/afterHours'
import { afterHoursText, busyPrompt, nightPrompt } from '../../shared/afterHoursText'
import '../vu_styles/AfterHours.css'

const status = saveField<AfterHours>(AFTER_HOURS_MOD, { empty: { busy: false }, normalize })
const hintIn = fadeIn(0)

/** The loaded game's status, switched in memory or saved immediately when the game can save. */
function StatusChip({ theme }: ScreenSlotProps['chatsHeader']): JSX.Element | null {
  const enabled = useModOption(AFTER_HOURS_MOD, 'busy-status')
  const { playthroughId } = useGameFacts()
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
        className="vu-paper vu-chip vu-after-hours-chip"
        aria-pressed={value.busy}
        aria-describedby={hover ? hintId : undefined}
        disabled={writing}
        onClick={() => void toggle()}
        {...gestures(writing, toggleLift, quietPress)}
      >
        <span className="vu-after-hours-dot" aria-hidden="true" />
        {value.busy ? afterHoursText.busy : afterHoursText.online}
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
  slotInterlude: ({ to }) => {
    if (!modOptionOn(AFTER_HOURS_MOD, 'night') || !nightOwed(to, status.read())) return null
    return {
      lines: [afterHoursText.nightLine],
      rows: [{
        label: afterHoursText.endTheDay,
        confirm: afterHoursText.endTheDayConfirm,
        onPick: () => status.set({ ...status.read(), nightDone: globalSlotOf(to.date, to.time) })
      }],
      clock: 'late-night'
    }
  },
  hangoutVerdict: (verdict, ctx) =>
    interludeNow()?.owner === AFTER_HOURS_MOD ||
    busyDrops(verdict, ctx, modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy) ? null : verdict,
  relaxLabel: ({ time }) => modOptionOn(AFTER_HOURS_MOD, 'night') && time === 1 ? afterHoursText.relax : undefined,
  prompts: {
    dm: {
      lines: ({ character }) => [
        ...(interludeNow()?.owner === AFTER_HOURS_MOD ? [nightPrompt(character.firstName)] : []),
        ...(modOptionOn(AFTER_HOURS_MOD, 'busy-status') && status.read().busy ? [busyPrompt(character.firstName)] : [])
      ]
    }
  }
})
