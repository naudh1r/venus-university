import { create } from 'zustand'
import type { PlaythroughRecord } from '@shared/types'
import { compatibilityWarnings } from '@shared/modCompatibility'
import { useUiStore } from '../stores/uiStore'
import { ConfirmModal } from '../components/ConfirmModal'
import { heldScreenTheme } from './clockTheme'

const pending = create<{ messages: string[]; settle: ((ok: boolean) => void) | null }>(() => ({ messages: [], settle: null }))

/** Ask before crossing into gameplay, using saved enrollment rather than new-game defaults. */
export async function confirmModCompatibility(record?: Pick<PlaythroughRecord, 'mods'>): Promise<boolean> {
  if (pending.getState().settle) return Promise.resolve(false)
  const { MODS } = await import('@shared/mods')
  const { useModsStore } = await import('../stores/modsStore')
  const switches = useModsStore.getState().switches
  const messages = await compatibilityWarnings(MODS, switches, __APP_VERSION__, record)
  if (pending.getState().settle) return false
  if (!messages.length) return Promise.resolve(true)
  return new Promise((settle) => pending.setState({ messages, settle }))
}

export function ModCompatibilityWarning() {
  const { messages, settle } = pending()
  if (!settle) return null
  const finish = (ok: boolean): void => { pending.setState({ messages: [], settle: null }); settle(ok) }
  return <ConfirmModal id="mod-compatibility-warning" theme={heldScreenTheme()}
    title="Mod compatibility unconfirmed" message={messages}
    confirmText="Continue anyway" cancelText="Cancel"
    onConfirm={() => finish(true)} onCancel={() => finish(false)}
    extraText="Review mods" onExtra={() => { finish(false); useUiStore.getState().openModal('mods') }} />
}

/** Existing setup folders can retain a prior playthrough's enrollment. Read it without modifying setup. */
export async function confirmSetupCompatibility(playthroughId: string): Promise<boolean> {
  const listing = await window.api.saves.list(playthroughId)
  if (!listing.ok) { useUiStore.getState().showError(listing.error); return false }
  return confirmModCompatibility(listing.data.record ?? undefined)
}
