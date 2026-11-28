// A fixture for the boundary test: each import here is one a mod may not make from the window.
import { useGameStore } from '../../../../../src/renderer/stores/gameStore'
import { screenSlot } from '@vx/modkit/host/renderer'
import { parseSource, resolveInstall, resolveRemoval } from '@vx/modkit/host/shared'
import type { App } from 'electron'
import { readFileSync } from 'node:fs'

export const badRenderer = [useGameStore, screenSlot, parseSource, resolveInstall, resolveRemoval, readFileSync] as const
export type A = App
