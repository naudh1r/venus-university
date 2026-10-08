import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { cgLabelOf } from '@shared/customCgs'
import { afterOf, CUSTOM_CG_SLOTS, customCgSlotOf, STOCK_CG_DISPLAY_ORDER } from '@shared/positions'
import type { Position } from '@shared/types'
import { PageArrows, wrapPage } from '../components/PageArrows'
import { typingIn, useWindowKeydown } from '../components/useWindowKeydown'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { spriteUrl, useSpriteVersion } from '../stores/characterStore'
import { useGameStore } from '../stores/gameStore'
import { cgKnownMissing } from '../stores/stageDisplay'
import type { ScreenTheme } from './clockTheme'
import {
  dealt,
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  slideInQuick,
  veilIn
} from './motion'
import '../vu_styles/ImageGallery.css'
import '../vu_styles/CgPicker.css'

/** One page of the picker: what its head calls it, and its CGs in grid order. */
interface CgPage {
  title: string
  positions: readonly Position[]
  /** Her own pairs, whose names are shown as she wrote them. */
  custom: boolean
}

/**
 * The two pages, always both: the stock eight with each `_after` under its act, then her own
 * pairs with each `_after` under its main.
 */
const PAGES: readonly CgPage[] = [
  { title: 'NSFW CG', positions: STOCK_CG_DISPLAY_ORDER, custom: false },
  {
    title: 'Custom CG',
    positions: [...CUSTOM_CG_SLOTS, ...CUSTOM_CG_SLOTS.map(afterOf)],
    custom: true
  }
]

/** A page's cells dealing in with the page, quick and close together. */
const PAGE_DEAL = dealt(0, 0.02)

export interface CgPickerModalProps {
  /** Drawn by the screen that opened this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  charId: string
  onClose: () => void
}

/**
 * One character's CGs on two pages, the stock eight and her own pairs. A click puts one over the
 * whole stage and a second click on it takes it off; a set not whole on disk is drawn as gaps.
 */
export function CgPickerModal({ theme, charId, onClose }: CgPickerModalProps): JSX.Element | null {
  const character = useGameStore((s) => s.characters[charId])
  const cgReady = useGameStore((s) => s.cgReady)
  const customCgReady = useGameStore((s) => s.customCgReady)
  const cgLock = useGameStore((s) => s.cgLock)
  const setCgLock = useGameStore((s) => s.setCgLock)
  const version = useSpriteVersion(charId)

  /** Whether a CG's whole set is on disk, which is what makes it hers to pick. */
  const pickable = (position: Position): boolean => {
    const slot = customCgSlotOf(position)
    return slot ? customCgReady[charId]?.includes(slot) === true : cgReady[charId] === true
  }
  // Her CG over the stage, as the stage draws it; pressed again, it comes off.
  const inForce =
    cgLock?.charId === charId &&
    !cgKnownMissing(charId, cgLock.position, { cgReady, customCgReady })
      ? cgLock.position
      : null

  // Opens on the page holding her CG in force, else the first with anything to pick.
  const [page, setPage] = useState(() => {
    const held = inForce ? PAGES.findIndex((entry) => entry.positions.includes(inForce)) : -1
    if (held >= 0) return held
    return Math.max(0, PAGES.findIndex((entry) => entry.positions.some(pickable)))
  })

  /** The arrow keys turn the page, as the arrows beside it do. */
  useWindowKeydown((event) => {
    if (typingIn(event)) return
    if (event.key === 'ArrowLeft') setPage((current) => wrapPage(current - 1, PAGES.length))
    else if (event.key === 'ArrowRight') setPage((current) => wrapPage(current + 1, PAGES.length))
  })

  const { host, overlayProps } = useModalShell(onClose)
  if (!host || !character) return null

  const shown = PAGES[page]

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
        id="cg-picker"
        className="vu-gallery vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="CG"
        variants={panelUnderTab}
      >
        <TitleTab>CG</TitleTab>

        <div className="vu-gallery-head">
          <span className="vu-cgpick-page">{shown.title}</span>
          <span className="vu-hint">
            Click a CG to put it on screen. Click it again to take it off.
          </span>
        </div>

        <PageArrows idPrefix="cg-page" page={page} pageCount={PAGES.length} onPage={setPage}>
          <motion.ul
            key={page}
            className={`vu-gallery-grid vu-cgpick-grid${shown.custom ? ' vu-cgpick-grid--custom' : ''}`}
            variants={PAGE_DEAL}
            initial="hidden"
            animate="shown"
          >
            {shown.positions.map((position) => {
              const label = cgLabelOf(character, position)
              const on = position === inForce
              return (
                <motion.li key={position} className="vu-gallery-item" variants={slideInQuick}>
                  {pickable(position) || on ? (
                    <motion.button
                      id={`cg-pick-${position}`}
                      className={`vu-gallery-cell${on ? ' vu-cgpick-cell--on' : ''}`}
                      type="button"
                      aria-pressed={on}
                      {...gestures(false, quietLift, quietPress)}
                      onClick={() => setCgLock(on ? null : { charId, position })}
                    >
                      <img
                        className="vu-gallery-img"
                        src={spriteUrl(charId, position, version)}
                        alt={label}
                        decoding="async"
                      />
                    </motion.button>
                  ) : (
                    <div className="vu-gallery-cell vu-gallery-cell--empty">
                      <span className="vu-gallery-empty">NOT GENERATED</span>
                    </div>
                  )}
                  <span className="vu-gallery-caption">{label}</span>
                </motion.li>
              )
            })}
          </motion.ul>
        </PageArrows>

        {/* A panel with nothing to spend has one answer. */}
        <div className="vu-foot">
          <motion.button
            id="cg-picker-close"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={onClose}
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
