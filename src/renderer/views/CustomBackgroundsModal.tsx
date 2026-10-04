import { useEffect, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { CustomBackgroundListing } from '@shared/customBackgrounds'
import { ConfirmModal } from '../components/ConfirmModal'
import { DeleteX } from '../components/DeleteX'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { useAssetStore } from '../stores/assetStore'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import { PlusIcon } from './screenIcons'
import { UploadBackgroundModal } from './UploadBackgroundModal'
import '../vu_styles/CustomBackgrounds.css'

export interface CustomBackgroundsModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

/** One of the player's backgrounds: its day picture under its name, and the ✕ a hover reveals. */
function BackgroundCell({
  listing,
  onDelete
}: {
  listing: CustomBackgroundListing
  onDelete: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const { name } = listing.record
  return (
    <motion.li
      className="vu-gallery-item vu-gallery-item--removable"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <div className="vu-gallery-cell">
        <img className="vu-gallery-img" src={listing.urls.day} alt="" decoding="async" />
      </div>
      <DeleteX
        className="vu-x vu-gallery-x"
        hovered={hovered}
        label={`Delete ${name}`}
        onDelete={onDelete}
      />
      <span className="vu-gallery-caption">{name}</span>
    </motion.li>
  )
}

/**
 * The backgrounds the player has brought, kept for every playthrough: the plus that adds one,
 * then each of them by name, any of them removed by its ✕.
 */
export function CustomBackgroundsModal({
  theme,
  onClose
}: CustomBackgroundsModalProps): JSX.Element | null {
  const listings = useAssetStore((s) => s.customBackgrounds)
  const removeCustomBackground = useAssetStore((s) => s.removeCustomBackground)
  // Whether the upload form stands over this panel.
  const [adding, setAdding] = useState(false)
  // The background whose ✕ is waiting on its confirm.
  const [deleting, setDeleting] = useState<string | null>(null)

  // Read again on opening, so the grid is what is kept now rather than what was at boot.
  useEffect(() => {
    void useAssetStore.getState().loadCustomBackgrounds()
  }, [])

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
          id="bgcustom-modal"
          className="vu-bgcustom vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Custom BGs"
          variants={panelUnderTab}
        >
          <TitleTab>Custom BGs</TitleTab>

          <div className="vu-scroll-box">
            <div className="vu-bgcustom-scroll">
              <ul className="vu-gallery-grid vu-gallery-grid--wide vu-bgcustom-grid">
                <li className="vu-gallery-item">
                  <motion.button
                    id="bgcustom-add"
                    className="vu-gallery-cell vu-gallery-cell--empty vu-bgcustom-add"
                    type="button"
                    aria-label="Upload custom BG"
                    {...gestures(false, quietLift, quietPress)}
                    onClick={() => setAdding(true)}
                  >
                    <PlusIcon size={40} />
                  </motion.button>
                  <span className="vu-gallery-caption">{' '}</span>
                </li>
                {listings.map((listing) => (
                  <BackgroundCell
                    key={`${listing.record.name}@${String(listing.record.createdAt)}`}
                    listing={listing}
                    onDelete={() => setDeleting(listing.record.name)}
                  />
                ))}
              </ul>
            </div>
            <div className="vu-scroll-fade" />
          </div>

          <div className="vu-foot">
            <motion.button
              id="bgcustom-close"
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

      {/* Siblings of the veil, not children: each leaves when this panel does. */}
      <AnimatePresence propagate>
        {adding && (
          <UploadBackgroundModal key="upload" theme={theme} onClose={() => setAdding(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence propagate>
        {deleting !== null && (
          <ConfirmModal
            key="delete"
            id="bgcustom-delete-confirm"
            theme={theme}
            title={`Delete ${deleting}?`}
            message="The background is permanently deleted. A scene set there shows the dorm room instead."
            confirmText="Delete background"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              void removeCustomBackground(deleting)
              setDeleting(null)
            }}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
