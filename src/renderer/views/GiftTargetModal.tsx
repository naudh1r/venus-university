/**
 * "To who?" — the second step of a handover, shown only when more than one girl is standing on
 * the stage. Sized like the New Game picker's face slots: what this modal fills a slot with is a
 * person. A girl the reader has not been told the name of keeps her face, the name masked as the
 * box masks her.
 */
import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import { UNKNOWN_NAME, useGameStore } from '../stores/gameStore'
import type { ScreenTheme } from './clockTheme'
import {
  cardLift,
  dealt,
  gestures,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  slideInQuick,
  veilIn
} from './motion'
import '../vu_styles/Gift.css'

/** The faces arrive with the panel — nothing here resizes. */
const FACE_DEAL = dealt(0, 0.04)

export interface GiftTargetModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: ScreenTheme
  /** Who can be given to, by charId: everyone on the stage, named or not. */
  charIds: readonly string[]
  onPick: (charId: string) => void
  onClose: () => void
}

export function GiftTargetModal({
  theme,
  charIds,
  onPick,
  onClose
}: GiftTargetModalProps): JSX.Element | null {
  const characters = useGameStore((s) => s.characters)
  const charInfo = useGameStore((s) => s.charInfo)
  const { host, overlayProps } = useModalShell(onClose)

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
        id="gift-target"
        className="vu-giftto vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="To who?"
        variants={panelUnderTab}
      >
        <TitleTab>To who?</TitleTab>

        <motion.div className="vu-giftto-row" variants={FACE_DEAL}>
          {charIds.map((charId) => (
            <Face
              key={charId}
              charId={charId}
              name={
                charInfo[charId]?.nameKnown
                  ? (characters[charId]?.firstName ?? charId)
                  : UNKNOWN_NAME
              }
              onPick={() => onPick(charId)}
            />
          ))}
        </motion.div>

        {/* **It commits on the click**, so the one answer left is backing out — which is a
            quiet word beside no primary at all, there being nothing here to confirm. */}
        <div className="vu-foot">
          <motion.button
            id="gift-target-cancel"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={onClose}
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}

/** Her archway and her given name, or the mask, and the whole card is the control. */
function Face({
  charId,
  name,
  onPick
}: {
  charId: string
  name: string
  onPick: () => void
}): JSX.Element {
  const version = useSpriteVersion(charId)

  return (
    <motion.div
      className="vu-card vu-giftto-card"
      variants={slideInQuick}
      {...gestures(false, cardLift, press)}
    >
      <motion.button className="vu-card-face" type="button" aria-label={name} onClick={onPick}>
        <span className="vu-arch vu-giftto-arch vu-paper">
          <span className="vu-crop">
            <img className="vu-crop-img" src={profileUrl(charId, version)} alt="" />
          </span>
        </span>
        <span className="vu-card-caption">
          <span className="vu-card-name">{name}</span>
        </span>
      </motion.button>
    </motion.div>
  )
}
