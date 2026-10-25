import { useEffect, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MANUAL_SAVE_SLOTS } from '@shared/types'
import { manualSlotOf } from '@shared/saveRules'
import { ConfirmModal } from '../components/ConfirmModal'
import {
  SAVE_PAGE_CELLS,
  SavePagesGrid,
  type SaveGridCard,
  type SaveGridEmpty
} from '../components/SavePagesGrid'
import { typingIn, useWindowKeydown } from '../components/useWindowKeydown'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { useCrossingStore } from '../stores/crossingStore'
import { writeManualSave } from '../stores/gameLoop'
import { saveNotes } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { runningReplayIds } from '../stores/loop/replay'
import { useSaveStore, type ResolvedSave } from '../stores/saveStore'
import { manualPagesOf, pageEntriesOf, writtenAt } from './LoadGameModal'
import { gestures, lift, panelUnderTab, press, veilIn } from './motion'

/** The page holding the last manual slot, past which no page opens. */
const LAST_SAVE_PAGE = MANUAL_SAVE_SLOTS / SAVE_PAGE_CELLS - 1

/** The page holding the manual save written last, or the first page where there is none. */
function latestPageOf(saves: readonly ResolvedSave[]): number {
  let latest: { slot: number; savedAt: number } | null = null
  for (const entry of saves) {
    const slot = manualSlotOf(entry.saveId)
    if (slot === null) continue
    if (!latest || entry.savedAt > latest.savedAt) latest = { slot, savedAt: entry.savedAt }
  }
  return latest ? Math.floor((latest.slot - 1) / SAVE_PAGE_CELLS) : 0
}

export interface SaveGameModalProps {
  /** Drawn by the screen that opened this — a portal inherits neither palette nor state rules. */
  theme: 'day' | 'night'
  onClose: () => void
}

/**
 * The Game menu's Save Game: the running playthrough's manual slots a page at a time, as many
 * pages as reach its last save and a blank one past them for every turn beyond. A gap is written
 * on a click, a save already there only once the player has said to overwrite it.
 */
export function SaveGameModal({ theme, onClose }: SaveGameModalProps): JSX.Element | null {
  const sceneMods = useGameStore((s) => s.sceneMods)
  const listSavesOf = useSaveStore((s) => s.listSavesOf)
  const removeSaveOf = useSaveStore((s) => s.removeSaveOf)
  const covered = useCrossingStore((s) => s.phase !== 'idle')

  // Read once: a playthrough does not change under an open panel.
  const [playthroughId] = useState(() => useGameStore.getState().playthroughId)
  const [saves, setSaves] = useState<ResolvedSave[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(0)
  // The furthest page turned to while the panel stands, which keeps a blank page it opened.
  const [reached, setReached] = useState(0)
  // A write or a delete is running, and every slot waits for it.
  const [busy, setBusy] = useState(false)
  // The save waiting on the player's yes before it is written over.
  const [overwriting, setOverwriting] = useState<ResolvedSave | null>(null)
  // And the one waiting on it before it is deleted.
  const [deleting, setDeleting] = useState<ResolvedSave | null>(null)

  /** Lists the slots, and opens on the page written to last. */
  useEffect(() => {
    // Outside a playthrough there is nothing to read, and the panel opens on empty slots.
    if (!playthroughId) {
      setLoaded(true)
      return
    }
    let live = true
    void listSavesOf(playthroughId).then((listed) => {
      if (!live) return
      setSaves(listed)
      setPage(latestPageOf(listed))
      setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [listSavesOf, playthroughId])

  /** Runs a write or a delete with every slot held, then lists the slots again. */
  async function settleWith(run: () => Promise<boolean>): Promise<void> {
    if (!playthroughId) return
    setBusy(true)
    if (await run()) setSaves(await listSavesOf(playthroughId))
    setBusy(false)
  }

  /** Whether a question stands over the panel, which then answers no key of its own. */
  const asking = Boolean(overwriting || deleting)

  /** Turns to a page, holding every page up to it open until the panel closes. */
  function turn(to: number): void {
    setPage(to)
    setReached((current) => Math.max(current, to))
  }

  // Every page up to the last save, the one on screen and any blank one turned to past them.
  const pageCount = Math.max(1, manualPagesOf(saves), page + 1, reached + 1)

  /** The arrow keys turn the page, as the arrows beside it do. */
  useWindowKeydown((event) => {
    if (!loaded || busy || covered || asking || typingIn(event)) return
    if (event.key === 'ArrowLeft' && page > 0) turn(page - 1)
    else if (event.key === 'ArrowRight' && page < LAST_SAVE_PAGE) turn(page + 1)
  })

  const { host, overlayProps } = useModalShell(onClose)
  // Nothing is drawn while the slots are read: it is one local read, and a panel that opens
  // empty and grows a frame later says less than one that opens once.
  if (!host || !loaded) return null

  /** The listed save a card stands for. */
  const entryOf = (card: SaveGridCard): ResolvedSave | undefined =>
    saves.find((candidate) => candidate.saveId === card.saveId)

  return createPortal(
    <>
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
          id="save-game"
          className="vu-sheet vu-sheet--saves vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Save Game"
          variants={panelUnderTab}
        >
          <TitleTab>Save Game</TitleTab>
          {saveNotes(sceneMods).map((note) => (
            <p key={note} className="vu-empty" role="status">{note}</p>
          ))}

          <SavePagesGrid
            id="save-pages"
            mode="save"
            entries={pageEntriesOf(saves, page + 1)}
            page={page}
            pageCount={pageCount}
            onPage={turn}
            ring={false}
            open={page < LAST_SAVE_PAGE}
            count={`${page + 1} / ${pageCount}`}
            busy={busy}
            onPickEmpty={(empty: SaveGridEmpty) => {
              void settleWith(() => writeManualSave(empty.slot))
            }}
            onPick={(card) => {
              const entry = entryOf(card)
              if (entry) setOverwriting(entry)
            }}
            onDelete={(card) => {
              const entry = entryOf(card)
              if (entry) setDeleting(entry)
            }}
          />

          {/* A panel with nothing to spend has one answer. */}
          <div className="vu-foot">
            <motion.button
              id="save-game-close"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              type="button"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Siblings of the veil, not children: a click inside one does not reach the veil's
          own handler through the React tree. */}
      <AnimatePresence propagate>
        {overwriting && (
          <ConfirmModal
            key="overwrite-save"
            id="overwrite-save"
            theme={theme}
            title={`Overwrite save ${manualSlotOf(overwriting.saveId) ?? ''}?`}
            message={`The save from ${writtenAt(overwriting.savedAt)} will be replaced.`}
            confirmText="Overwrite"
            onCancel={() => setOverwriting(null)}
            onConfirm={() => {
              const slot = manualSlotOf(overwriting.saveId)
              setOverwriting(null)
              if (slot !== null) void settleWith(() => writeManualSave(slot))
            }}
          />
        )}

        {deleting && (
          <ConfirmModal
            key="delete-save"
            id="delete-save"
            theme={theme}
            title={`Delete the save from ${writtenAt(deleting.savedAt)}?`}
            message="This save will be permanently deleted."
            confirmText="Delete save"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              const saveId = deleting.saveId
              setDeleting(null)
              // The game being played keeps the replays its next write will name.
              if (playthroughId) {
                const keep = runningReplayIds(playthroughId)
                void settleWith(() => removeSaveOf(playthroughId, saveId, keep))
              }
            }}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
