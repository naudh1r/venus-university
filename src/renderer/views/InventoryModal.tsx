/**
 * What the reader is carrying, and the one panel that says it: "My stuff" on the shop's own
 * header, and the same panel in `gift` mode, opened by a scene's Gift button. **Not the shop's
 * modal** — it has two openers, so it is its own slice, wearing the app's surface and taking
 * `theme` like any other portalled modal.
 */
import { useMemo, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import { canDose, coldStageAt, isSymptomatic } from '@shared/colds'
import { globalSlotOf } from '@shared/jobs'
import { itemDefOf, type ItemPick } from '@shared/shop'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { formatShortGameDate } from '../prompts/gameDate'
import { useGameStore } from '../stores/gameStore'
import { epilogueOf } from '../stores/textingLoop'
import type { ScreenTheme } from './clockTheme'
import { ItemCard } from './ItemCard'
import { dealt, gestures, lift, panelUnderTab, press, veilIn } from './motion'
import '../vu_styles/Inventory.css'

/** The cards arrive with the panel — nothing here resizes, so no landing to wait on. */
const STUFF_DEAL = dealt(0, 0.03)

export interface InventoryModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: ScreenTheme
  /** `stuff` is the reader looking at what he has; `gift` is him picking one to hand over. */
  mode?: 'stuff' | 'gift'
  onClose: () => void
  /** Called with the chosen line in `gift` mode; nothing is spent until the message is sent. */
  onGift?: (pick: ItemPick) => void
}

export function InventoryModal({
  theme,
  mode = 'stuff',
  onClose,
  onGift
}: InventoryModalProps): JSX.Element | null {
  const inventory = useGameStore((s) => s.inventory)
  const characters = useGameStore((s) => s.characters)
  const charInfo = useGameStore((s) => s.charInfo)
  const season = useGameStore((s) => s.calendar.season)
  // A dose's Use is live while his cold shows and he has had none this slot, and dead through the
  // rest of a slot he has had one in while it still shows. It is absent with no cold showing, and
  // while a scene's ending is being paid for, which has already written the next slot's opening,
  // or on a replay, the goodbye menu or a created scene, none of which keeps the slot it is in.
  const dosing = useGameStore((s): 'live' | 'dead' | null => {
    if (s.sceneEnding || s.endingInFlight || s.replaying !== null || s.createdScene !== null) {
      return null
    }
    if (epilogueOf(s)) return null
    const cold = s.readerCold ?? undefined
    const slot = globalSlotOf(s.date, s.time)
    if (canDose(cold, slot)) return 'live'
    return isSymptomatic(coldStageAt(cold, slot)) ? 'dead' : null
  })
  const { host, overlayProps } = useModalShell(onClose)

  // An item id the catalog does not know is dropped: the def owns everything a card shows. A
  // present says who gave it to him and when, her name only where he knows it.
  const held = useMemo(
    () =>
      inventory.flatMap((entry) => {
        const item = itemDefOf(entry.itemId)
        if (!item) return []
        const { from } = entry
        const pick: ItemPick = { itemId: entry.itemId, ...(from ? { from } : {}) }
        const giver = from && charInfo[from.charId]?.nameKnown ? characters[from.charId] : undefined
        const fromLine = from
          ? [giver ? `From ${giver.firstName}` : null, formatShortGameDate(from.date, season)]
              .filter((part): part is string => part !== null)
              .join(' · ')
          : undefined
        const key = from ? `${entry.itemId}:${from.charId}:${from.date}` : entry.itemId
        return [{ item, count: entry.count, pick, fromLine, key }]
      }),
    [inventory, characters, charInfo, season]
  )

  if (!host) return null

  const gifting = mode === 'gift'
  const title = gifting ? 'Give a gift' : 'My stuff'
  const carried = held.reduce((total, line) => total + line.count, 0)

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
        id="inventory"
        className="vu-inv vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        variants={panelUnderTab}
      >
        <TitleTab>{title}</TitleTab>

        {held.length === 0 ? (
          <p className="vu-inv-empty">You aren&apos;t carrying anything.</p>
        ) : (
          <>
            <p className="vu-inv-count">
              {carried} {carried === 1 ? 'ITEM' : 'ITEMS'}
            </p>
            <motion.div className="vu-inv-grid" variants={STUFF_DEAL}>
              {held.map(({ item, count, pick, fromLine, key }) => (
                <ItemCard
                  key={key}
                  item={item}
                  count={count}
                  from={fromLine}
                  word={gifting ? 'Gift' : 'Use'}
                  // In gift mode every card is a gift; looking at what he has, only a dose of
                  // medicine offers anything, dead once he has had one this slot.
                  onAnswer={
                    gifting
                      ? onGift && (() => onGift(pick))
                      : item.medicine && dosing !== null
                        ? () => useGameStore.getState().takeMedicine(pick)
                        : undefined
                  }
                  dead={!gifting && dosing === 'dead'}
                />
              ))}
            </motion.div>
          </>
        )}

        {/* One answer: a panel that has committed nothing has nothing a Cancel could undo, and
            in gift mode picking a card *is* the commit (the modal-close rule). */}
        <div className="vu-foot">
          <motion.button
            id="inventory-close"
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
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
