import { appError, messageOf } from '@shared/errors'
import { comfySourceOf, comfyUrlOf } from '@shared/comfyModels'
import type { Settings } from '@shared/types'

/** The server's loaded classes and each input's options, bounded by the caller's deadline. */
export async function fetchObjectInfo(baseUrl: string, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${baseUrl}/object_info`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`HTTP ${response.status} from /object_info`)
    const listing: unknown = await response.json()
    if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
      throw new Error('ComfyUI did not answer with a node listing.')
    }
    return listing as Record<string, unknown>
  } catch (err) {
    throw appError('COMFY_UNREACHABLE', 'Could not ask ComfyUI which nodes it loaded.', messageOf(err))
  }
}

type Entry = { until: number; answer: Promise<Record<string, unknown> | null> }
const external = new Map<string, Entry>()
let sourceKey = ''

/** Forgets pack probes after an external render loses its server or node classes. */
export function forgetExternalObjectInfo(): void {
  external.clear()
}

/** Forgets external pack probes when Settings names another source or address. */
export function syncComfyObjectInfoSource(settings: Pick<Settings, 'comfySource' | 'comfyUrl'>): void {
  const next = `${comfySourceOf(settings)} ${comfyUrlOf(settings)}`
  if (next === sourceKey) return
  sourceKey = next
  external.clear()
}

/** Shares one short probe per address for a minute, including failures and concurrent callers. */
export function externalObjectInfo(baseUrl: string): Promise<Record<string, unknown> | null> {
  const kept = external.get(baseUrl)
  if (kept && Date.now() < kept.until) return kept.answer
  const entry: Entry = {
    until: Date.now() + 60_000,
    answer: fetchObjectInfo(baseUrl, 2_000).catch(() => null)
  }
  external.set(baseUrl, entry)
  return entry.answer
}
