import type { InstallChange, InstallRequest, ModSource } from '@vx/modkit/host/shared'
import type { AppError, Result } from './types'

export interface FetchedModSource {
  readonly url: string
  readonly kind: 'list' | 'repo'
  /** Source identity. Trust requires a matching pinned hash. */
  readonly approvedList: boolean
  readonly source: ModSource
}

export type ModSourceResult =
  | Extract<Result<FetchedModSource>, { ok: true }>
  | { readonly ok: false; readonly error: AppError; readonly url?: string; readonly approvedList: boolean }

export type ModPlanRequest =
  | { readonly kind: 'install'; readonly mods: Readonly<Record<string, InstallRequest>> }
  | { readonly kind: 'remove'; readonly id: string }

export interface ModInstallPlan {
  readonly kind: 'install'
  readonly request: Extract<ModPlanRequest, { kind: 'install' }>
  readonly changes: readonly InstallChange[]
}

export type ModPlan = ModInstallPlan | {
  readonly kind: 'remove'
  readonly id: string
  readonly orphaned: readonly string[]
}

export interface PendingModChanges {
  readonly pending: 1
  readonly current: Readonly<Record<string, string>>
  readonly remove: readonly string[]
  readonly cleanup?: Readonly<Record<string, { readonly keep: string; readonly versions: readonly string[] }>>
}

export type ModInstallProgress = {
  readonly id: string
  readonly version: string
} & (
  | { readonly phase: 'downloading'; readonly bytesDone: number; readonly bytesTotal: number }
  | { readonly phase: 'checking' | 'unpacking' | 'recorded' }
)
