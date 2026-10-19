import { useRef, useState } from 'react'
import {
  COMFY_MODEL_SLOTS,
  comfyUrlProblem,
  emptyModelLists,
  normalizeComfyUrl,
  type ComfyMissingNodes,
  type ComfyModelLists,
  type ComfyModelRole,
  type ComfySource
} from '@shared/comfyModels'
import type { AppError } from '@shared/types'
import { useComfyStore } from '../stores/comfyStore'
import { useSetupStore } from '../stores/setupStore'

/** What a test of the player's own ComfyUI has to say: nothing yet, in flight, its verdict, or why not. */
export type ComfyTestState =
  | 'idle'
  | 'testing'
  | { missingNodes: ComfyMissingNodes[] }
  | { error: AppError }

export interface ComfyProbeInput {
  source: ComfySource
  /** The URL as typed; nothing is sent while it cannot be. */
  url: string
}

export interface ComfyProbeState {
  /** Each slot's files, as the folders or the server last answered; empty where never asked. */
  models: ComfyModelLists
  /** Whether a list has arrived at all, which is what marks a pick it lacks as missing. */
  listed: boolean
  /** Which slots have a folder on this machine the app can open. */
  folders: Record<ComfyModelRole, boolean>
  test: ComfyTestState
  /** Nothing to send: the app's own install, a URL that cannot be sent to, or a test in flight. */
  testDead: boolean
  /** Asks for the lists again, silently: the folders on disk, or a probe of the player's server. */
  refreshModels: () => Promise<void>
  /** Probes the player's own server on the URL as typed, and shows what it says. */
  runTest: () => Promise<void>
  /** Forgets the lists and the last verdict, the server they belonged to having been left. */
  reset: () => void
}

/** Every slot at one value. */
function everySlot(value: boolean): Record<ComfyModelRole, boolean> {
  const out = {} as Record<ComfyModelRole, boolean>
  for (const slot of COMFY_MODEL_SLOTS) out[slot.role] = value
  return out
}

/** The one word a test leaves beside its button, and nothing until one has been run. */
export function comfyTestWordOf(test: ComfyTestState, missingModels: number): string | null {
  if (test === 'idle') return null
  if (test === 'testing') return 'TESTING…'
  if ('error' in test) return 'FAILED'
  return test.missingNodes.length > 0 || missingModels > 0 ? 'INCOMPLETE' : 'CONNECTED'
}

/**
 * The questions a form asks about the ComfyUI that draws: which models each slot can pick from
 * and where their folders are, and — for the player's own server — whether it answers with
 * everything the workflows need. Nothing is sent on its own: the screen decides when.
 */
export function useComfyProbe(input: ComfyProbeInput): ComfyProbeState {
  const listLocalModels = useComfyStore((s) => s.listLocalModels)
  const probe = useComfyStore((s) => s.probe)
  // The app's own install's folders exist to be opened once it verified.
  const installed = useSetupStore((s) => Boolean(s.status?.comfyReady))

  const [models, setModels] = useState<ComfyModelLists>(emptyModelLists)
  const [listed, setListed] = useState(false)
  const [externalFolders, setExternalFolders] = useState(() => everySlot(false))
  const [test, setTest] = useState<ComfyTestState>('idle')

  // Which ask is the newest: an answer to any earlier one is stale, the source or the URL it was
  // asked on having changed while it was in flight.
  const asked = useRef(0)

  /** Asks for the lists again; a list that cannot be given is simply no rows. */
  async function refreshModels(): Promise<void> {
    const ask = ++asked.current
    if (input.source === 'managed') {
      const result = await listLocalModels()
      if (asked.current !== ask) return
      if (result.ok) {
        setModels(result.data)
        setListed(true)
      }
      return
    }
    if (comfyUrlProblem(input.url) !== null) return
    const url = normalizeComfyUrl(input.url)
    const result = await probe(url)
    if (asked.current !== ask) return
    if (!result.ok) {
      console.warn(`Could not list the models at ${url}: ${result.error.message}`)
      return
    }
    setModels(result.data.models)
    setListed(true)
    setExternalFolders(result.data.folders)
  }

  /** Probes the player's server on the URL as typed; what comes back is the whole answer. */
  async function runTest(): Promise<void> {
    const ask = ++asked.current
    setTest('testing')
    const result = await probe(normalizeComfyUrl(input.url))
    if (asked.current !== ask) return
    if (!result.ok) {
      setTest({ error: result.error })
      return
    }
    setModels(result.data.models)
    setListed(true)
    setExternalFolders(result.data.folders)
    setTest({ missingNodes: result.data.missingNodes })
  }

  /** Forgets the lists and the last verdict, and any ask still in flight. */
  function reset(): void {
    asked.current++
    setModels(emptyModelLists())
    setListed(false)
    setExternalFolders(everySlot(false))
    setTest('idle')
  }

  return {
    models,
    listed,
    folders: input.source === 'managed' ? everySlot(installed) : externalFolders,
    test,
    testDead:
      input.source !== 'external' || comfyUrlProblem(input.url) !== null || test === 'testing',
    refreshModels,
    runTest,
    reset
  }
}
