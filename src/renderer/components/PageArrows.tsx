import { useRef, type JSX, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import { motion } from 'motion/react'
import { gestures, quietLift, quietPress, rowLift, rowPress } from '../views/motion'
import { ChevronIcon } from '../views/screenIcons'
import { accumulateNotch, wheelNotches, type WheelTravel } from '../views/wheel'
import '../vu_styles/PageArrows.css'

/** A page index on the ring of pages: one past the last is the first, one before the first the last. */
export function wrapPage(to: number, pageCount: number): number {
  return ((to % pageCount) + pageCount) % pageCount
}

export interface PageArrowsProps {
  /** The frame's own id, where its caller is looked up by one. */
  id?: string
  /** What the controls are named from: `-prev`, `-next`, `-dots` and `-dot-<n>` after it. */
  idPrefix: string
  page: number
  pageCount: number
  onPage: (page: number) => void
  /** Something is running under the page, and the wheel turns nothing. */
  busy?: boolean
  /** The page on screen, standing between the arrows. */
  children: ReactNode
}

/**
 * A page between the two tall arrows that turn it, with a dot per page under it. The wheel over
 * any of it turns the page a notch at a time. The pages are a ring: turning past either end
 * lands on the other.
 */
export function PageArrows({
  id,
  idPrefix,
  page,
  pageCount,
  onPage,
  busy = false,
  children
}: PageArrowsProps): JSX.Element {
  const travel = useRef<WheelTravel>({ sum: 0, at: 0 })

  /** Turns to a page, round the ring: past the last page is the first, before the first the last. */
  const turn = (to: number): void => {
    const next = wrapPage(to, pageCount)
    if (next !== page) onPage(next)
  }

  /**
   * A notch down turns forward and a notch up turns back, once the notches add up to one, and
   * never more than a page an event, however many notches arrive in it.
   */
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    if (busy) return
    const step = accumulateNotch(travel.current, wheelNotches(event.nativeEvent))
    if (step !== 0) turn(page + Math.sign(step))
  }

  return (
    <div id={id} className="vu-pages" onWheel={onWheel}>
      <div className="vu-pages-row">
        <motion.button
          id={`${idPrefix}-prev`}
          className="vu-pages-arrow"
          type="button"
          aria-label="Previous page"
          {...gestures(false, rowLift, rowPress)}
          onClick={() => turn(page - 1)}
        >
          <ChevronIcon back />
        </motion.button>

        {children}

        <motion.button
          id={`${idPrefix}-next`}
          className="vu-pages-arrow"
          type="button"
          aria-label="Next page"
          {...gestures(false, rowLift, rowPress)}
          onClick={() => turn(page + 1)}
        >
          <ChevronIcon />
        </motion.button>
      </div>

      <div id={`${idPrefix}-dots`} className="vu-pages-dots">
        {Array.from({ length: pageCount }, (_, index) =>
          index === page ? (
            <span key={index} className="vu-pages-dot vu-pages-dot--on" aria-current="true" />
          ) : (
            <motion.button
              key={index}
              id={`${idPrefix}-dot-${index}`}
              className="vu-pages-dot"
              type="button"
              aria-label={`Page ${index + 1}`}
              {...gestures(false, quietLift, quietPress)}
              onClick={() => turn(index)}
            />
          )
        )}
      </div>
    </div>
  )
}
