// Compiled by report.mjs against dist/ only, without the game's source aliases or
// ambient augmentations. This is the surface a standalone mod author receives.
import { modOn, type GameSave, type PlaythroughRecord } from '@vx/modkit/shared'
import type { ModHooks } from '@vx/modkit/renderer'
import type { ComfyLaunchContext } from '@vx/modkit/main'

export function enrolledMods(record: PlaythroughRecord): string[] | undefined {
  return record.mods
}

export function recordedVersions(record: PlaythroughRecord): Record<string, string> | undefined {
  return record.modVersions
}

export function enabled(record: PlaythroughRecord): boolean {
  return modOn({ on: {}, options: {} }, 'standalone-consumer', record)
}

export function conversations(save: GameSave): GameSave['bunnyboard']['conversations'] {
  return save.bunnyboard.conversations
}

// Import all three entry points so their reachable declarations must also compile.
export type RendererContract = ModHooks
export type MainContract = ComfyLaunchContext
