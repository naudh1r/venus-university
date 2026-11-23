import type { ComfyNodePack } from '@vx/modkit/main'

/**
 * ComfyUI-ppm, pinned: its `AttentionCouplePPM` holds each person's prompt to their half of a
 * wide picture of two. It needs no pip packages of its own.
 */
export const PPM_PACK: ComfyNodePack = {
  id: 'ppm',
  label: 'ComfyUI-ppm (Attention Couple)',
  owner: 'pamparamm',
  repo: 'ComfyUI-ppm',
  dirName: 'ComfyUI-ppm',
  sha: '4826dfddfb75f8fe431a3627f407e9421418bcaf',
  bytes: 3697965,
  sha256: '258181EE3808B4C718D1A1162C7123299AF9EEE6445DD7384303EE3BB565AEDE',
  modules: [],
  classes: ['AttentionCouplePPM']
}
