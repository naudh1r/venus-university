import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { SCENE_FIRST_DATE, SCENE_LAST_DATE } from '@shared/sceneCreator'
import { WEEK_COLUMNS, WEEK_DAY_HEADERS } from '@shared/jobs'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { formatDatePart } from '../prompts/gameDate'
import { occasionsOn } from '../prompts/occasions'
import { dayOfMonth, gridCellsOf, MONTHS, monthIndexOf, monthName } from './calendarMonths'
import type { ScreenTheme } from './clockTheme'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  veilIn
} from './motion'
import { ChevronIcon } from './screenIcons'
import '../vu_styles/Calendar.css'
import '../vu_styles/SceneDate.css'

export interface SceneDateModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: ScreenTheme
  /** The day the scene is set on now; the grid opens on its month and rings it. */
  date: number
  onPick: (date: number) => void
  onClose: () => void
}

/**
 * The Calendar's month grid without its day pane: the semester's days a standalone scene can be
 * set on are pressable, each carrying the fixed occasions it falls in, and a pick answers at once.
 */
export function SceneDateModal({
  theme,
  date,
  onPick,
  onClose
}: SceneDateModalProps): JSX.Element | null {
  const [month, setMonth] = useState(() => monthIndexOf(date))
  const { host, overlayProps } = useModalShell(onClose)

  const { first, last } = MONTHS[month]
  const firstMonth = month === 0
  const lastMonth = month === MONTHS.length - 1
  const cells = gridCellsOf(MONTHS[month])

  if (!host) return null

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.div
        id="scene-date"
        className="vu-cal vu-cal--pick vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a date"
        variants={panelUnderTab}
      >
        <TitleTab>Pick a date</TitleTab>

        <div className="vu-cal-month">
          <div className="vu-cal-head">
            {/* The semester's ends are end-stops: dead, rendered, and saying nothing. */}
            <motion.button
              id="scene-date-prev"
              className="vu-square vu-square--step vu-cal-step--back"
              type="button"
              aria-label="Previous month"
              disabled={firstMonth}
              {...gestures(firstMonth, quietLift, quietPress)}
              onClick={() => setMonth((m) => m - 1)}
            >
              <ChevronIcon />
            </motion.button>
            <span className="vu-cal-name">{monthName(first)}</span>
            <motion.button
              id="scene-date-next"
              className="vu-square vu-square--step"
              type="button"
              aria-label="Next month"
              disabled={lastMonth}
              {...gestures(lastMonth, quietLift, quietPress)}
              onClick={() => setMonth((m) => m + 1)}
            >
              <ChevronIcon />
            </motion.button>

            <div className="vu-cal-legend">
              <span className="vu-cal-key" data-cat="occasion">
                Occasion
              </span>
            </div>
          </div>

          <div className="vu-cal-days">
            {WEEK_COLUMNS.map((weekday) => (
              <span className="vu-cal-dayname" key={weekday}>
                {WEEK_DAY_HEADERS[weekday]}
              </span>
            ))}
          </div>

          <div className="vu-cal-grid">
            {cells.map((day) => {
              // Another month's day, or one a scene cannot be set on: a number and nothing else,
              // and not a control.
              if (day < first || day > last || day < SCENE_FIRST_DATE || day > SCENE_LAST_DATE) {
                return (
                  <div className="vu-cal-cell vu-cal-cell--out" key={day}>
                    <span className="vu-cal-num">{dayOfMonth(day)}</span>
                  </div>
                )
              }

              const picked = day === date
              return (
                <motion.button
                  className={`vu-cal-cell${picked ? ' vu-cal-cell--on' : ''}`}
                  key={day}
                  type="button"
                  aria-pressed={picked}
                  aria-label={formatDatePart(day)}
                  {...gestures(false, rowLift, rowPress)}
                  onClick={() => {
                    onPick(day)
                    onClose()
                  }}
                >
                  <span className="vu-cal-num">{dayOfMonth(day)}</span>
                  <span className="vu-cal-chips">
                    {occasionsOn(day, []).map((occasion) => (
                      <span className="vu-cal-chip" data-cat="occasion" key={occasion.id}>
                        <span className="vu-cal-chip-label">{occasion.title}</span>
                      </span>
                    ))}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* Every pick is already an answer, so the foot carries one. */}
          <div className="vu-foot">
            <motion.button
              id="scene-date-close"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              type="button"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Close
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
