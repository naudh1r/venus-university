/**
 * The saved scenes, newest first: one row each, opened to replay it from its first line. A scene
 * whose girl has been deleted cannot be staged and says so; its ✕ still takes it away.
 */
import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

import type { SavedSceneSummary } from '@shared/sceneCreator'
import { andList } from '@shared/sentences'
import type { Character } from '@shared/types'
import { ConfirmModal } from '../components/ConfirmModal'
import { DeleteX } from '../components/DeleteX'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { formatGameDate, formatWeekday, slotHalf } from '../prompts/gameDate'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, rowLift, rowPress, veilIn } from './motion'
import { HalfMarkIcon, halfMarkKindOf } from './screenIcons'
import '../vu_styles/SceneCreator.css'

export interface LoadSceneModalProps {
  theme: ScreenTheme
  scenes: readonly SavedSceneSummary[]
  /** Every character on disk, by charId. */
  characters: Readonly<Record<string, Character>>
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/** When a scene was saved, as a real date. */
function savedOn(savedAt: number): string {
  return new Date(savedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/** Who a scene names that is no longer on disk, by the names it was saved with. */
function missingOf(
  scene: SavedSceneSummary,
  characters: Readonly<Record<string, Character>>
): string[] {
  return scene.setup.cast.flatMap((entry, i) =>
    characters[entry.charId] ? [] : [scene.castNames[i] || 'A character']
  )
}

/** The Load scene panel: the list, then its one way out. */
export function LoadSceneModal({
  theme,
  scenes,
  characters,
  onOpen,
  onDelete,
  onClose
}: LoadSceneModalProps): JSX.Element | null {
  const [deleting, setDeleting] = useState<SavedSceneSummary | null>(null)
  const { host, overlayProps } = useModalShell(onClose)
  if (!host) return null

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
          id="load-scene"
          className="vu-sheet vu-scene-load vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Load scene"
          variants={panelUnderTab}
        >
          <TitleTab>Load scene</TitleTab>

          <div className="vu-scene-load-scroll vu-scroll-box">
            {scenes.length === 0 ? (
              <p className="vu-empty">No saved scenes yet.</p>
            ) : (
              <ul className="vu-rows">
                {scenes.map((scene) => (
                  <SceneRow
                    key={scene.id}
                    scene={scene}
                    characters={characters}
                    onOpen={() => onOpen(scene.id)}
                    onDelete={() => setDeleting(scene)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="vu-foot">
            <motion.button
              id="load-scene-close"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              type="button"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Sibling of the veil, not a child: the confirm leaves when this panel does. */}
      <AnimatePresence propagate>
        {deleting && (
          <ConfirmModal
            key="delete"
            id="load-scene-delete"
            theme={theme}
            title="Delete scene?"
            message={`"${deleting.name}" will be gone for good.`}
            onConfirm={() => {
              onDelete(deleting.id)
              setDeleting(null)
            }}
            onCancel={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}

/** One saved scene: its girls, its name and when it is set, opening it unless one is gone. */
function SceneRow({
  scene,
  characters,
  onOpen,
  onDelete
}: {
  scene: SavedSceneSummary
  characters: Readonly<Record<string, Character>>
  onOpen: () => void
  onDelete: () => void
}): JSX.Element {
  const [hover, setHover] = useState(false)
  const missing = missingOf(scene, characters)
  const dead = missing.length > 0
  const { date, time, weather } = scene.setup

  return (
    <li
      className="vu-scene-load-item"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.button
        className="vu-row vu-scene-load-row"
        type="button"
        disabled={dead}
        {...gestures(dead, rowLift, rowPress)}
        onClick={onOpen}
      >
        <span className="vu-scene-load-faces">
          {scene.setup.cast.map((entry) =>
            characters[entry.charId] ? <Face key={entry.charId} charId={entry.charId} /> : null
          )}
        </span>
        <span className="vu-scene-load-text">
          <span className="vu-scene-load-name">{scene.name}</span>
          <span className="vu-scene-load-meta">
            {formatWeekday(date).slice(0, 3)} {formatGameDate(date)} · {slotHalf(time)}
            <HalfMarkIcon kind={halfMarkKindOf(weather, time === 1)} strokeWidth={2.5} still />
          </span>
          {dead && (
            <span className="vu-scene-load-note">
              {andList(missing)} {missing.length === 1 ? 'was' : 'were'} deleted.
            </span>
          )}
        </span>
        <span className="vu-scene-load-saved">{savedOn(scene.savedAt)}</span>
      </motion.button>
      <DeleteX
        className="vu-x vu-scene-load-x"
        hovered={hover}
        label={`Delete ${scene.name}`}
        onDelete={onDelete}
      />
    </li>
  )
}

/** Her portrait in a small archway. */
function Face({ charId }: { charId: string }): JSX.Element {
  const version = useSpriteVersion(charId)
  return (
    <span className="vu-arch vu-scene-load-face">
      <span className="vu-crop">
        <img className="vu-crop-img" src={profileUrl(charId, version)} alt="" />
      </span>
    </span>
  )
}
