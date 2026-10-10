import { motion } from 'motion/react'
import type { JSX } from 'react'
import { fadeIn } from '../views/motion'
import '../vu_styles/Lightbox.css'

/**
 * One picture at the size it was drawn, over the page. Anywhere outside it closes it.
 *
 * Shared rather than owned by a screen: her gallery opens one, and so does a photograph on the
 * feed, and a second copy of this would be a second way for the same picture to look different.
 */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }): JSX.Element {
  return (
    <motion.div
      className="vu-lightbox"
      variants={fadeIn(0, 0.18)}
      initial="hidden"
      animate="shown"
      onClick={onClose}
    >
      <img src={src} alt="" />
    </motion.div>
  )
}
