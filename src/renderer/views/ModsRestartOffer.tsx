import { motion } from 'motion/react'
import { gestures, lift, press } from './motion'

export function ModsRestartOffer({
  onLater,
  onError
}: {
  onLater: () => void
  onError: (message: string) => void
}) {
  return (
    <div className="vu-mods-note">
      <p>Save any game in progress before restarting.</p>
      <div className="vu-foot">
        <motion.button type="button" className="vu-btn vu-btn--quiet"
          {...gestures(false, lift, press)} onClick={onLater}>
          Later
        </motion.button>
        <motion.button type="button" className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
          {...gestures(false, lift, press)} onClick={async () => {
            try {
              const result = await window.api.mods.restart()
              if (!result.ok) onError(result.error.message)
            } catch {
              onError('Could not restart the game.')
            }
          }}>
          Restart now
        </motion.button>
      </div>
    </div>
  )
}
