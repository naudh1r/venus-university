import type { TargetAndTransition } from 'motion/react'

/** A paid Breakthrough gets a gold-lit announcement; reduced motion holds the card still. */
export const BREAKTHROUGH_SECONDS = 2.6
export const breakthroughBannerMotion: TargetAndTransition = {
  opacity: [0, 1, 1, 0], y: [18, 0, 0, -8], scale: [.96, 1, 1, 1.01],
  transition: {
    duration: BREAKTHROUGH_SECONDS, times: [0, .2, .76, 1], ease: [.2, .7, .2, 1],
    opacity: { duration: BREAKTHROUGH_SECONDS, times: [0, .14, .76, 1], ease: 'easeInOut' }
  }
}
export const breakthroughHaloMotion: TargetAndTransition = {
  opacity: [0, 1, 0], scale: [.65, 1, 1.2],
  transition: { duration: BREAKTHROUGH_SECONDS, times: [0, .35, 1], ease: 'easeOut' }
}

