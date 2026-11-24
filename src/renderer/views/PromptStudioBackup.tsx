/**
 * The export and restore buttons of one Prompt Studio section, one preset's export, and the
 * confirmation a restore waits behind. Restoring merges the file into what the player has and
 * writes only that section.
 */
import { useRef, useState, type JSX } from 'react'
import { AnimatePresence } from 'motion/react'
import {
  buildPresetsBackup,
  buildPromptsBackup,
  mergePresets,
  parseStudioBackup,
  presetExportName,
  studioBackupName,
  studioBackupWord,
  type StudioBackupKind,
  type StudioBackupOf
} from '../../shared/presets/studioBackup'
import { ConfirmModal, showError, type ScreenTheme } from '@vx/modkit/renderer'
import { usePromptStudioStore } from '../stores/promptStudioStore'
import { StudioPill } from './PromptStudioModals'

/** A restore waiting for the player's yes: the checked file of one kind. */
type Pending = { [K in StudioBackupKind]: { kind: K; backup: StudioBackupOf[K] } }[StudioBackupKind]

/** "1 thing" or "3 things". */
function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Tells the player a backup could not be used. */
function refuse(message: string): void {
  showError({ code: 'STUDIO_BACKUP_INVALID', message })
}

/** A section's backup file's text; presets are exported one at a time instead. */
function backupText(): string {
  return JSON.stringify(buildPromptsBackup(usePromptStudioStore.getState().prompts), null, 2)
}

/** The parts that are not nothing, joined into one sentence, or `none` where every part is. */
function sentence(parts: readonly (string | null)[], none: string): string {
  const kept = parts.filter((part): part is string => part !== null)
  if (kept.length === 0) return none
  const last = kept.pop() as string
  return `It ${kept.length > 0 ? `${kept.join(', ')} and ${last}` : last}.`
}

/** What a restore will do, one paragraph apiece. */
function describe(pending: Pending): string[] {
  const rest = 'Nothing else in Prompt Studio changes.'
  if (pending.kind === 'presets') {
    const merge = mergePresets(
      usePromptStudioStore.getState().presets.map((preset) => preset.id),
      pending.backup
    )
    const active = merge.save.find((preset) => preset.id === merge.active)
    return [
      sentence(
        [
          merge.added > 0 ? `adds ${counted(merge.added, 'preset', 'presets')}` : null,
          merge.replaced > 0 ? `replaces ${counted(merge.replaced, 'of yours', 'of yours')}` : null
        ],
        'It holds no presets.'
      ),
      `"${active?.name ?? ''}" becomes the active preset. ${rest}`
    ]
  }
  const blocks = Object.keys(pending.backup.prompts.blocks ?? {}).length
  const sizes = Object.keys(pending.backup.prompts.classCatalog ?? {}).length
  return [
    sentence(
      [
        blocks > 0 ? `replaces ${counted(blocks, 'prompt', 'prompts')} with the file's` : null,
        sizes > 0 ? `sets ${counted(sizes, 'catalog size', 'catalog sizes')}` : null
      ],
      'It holds no edited prompts, so nothing changes.'
    ),
    `Any prompt it doesn't hold stays as it is. ${rest}`
  ]
}

/**
 * The buttons for one section and the confirmation they open. Presets have Restore alone, each
 * preset being exported from its own row through `exportPreset`.
 */
export function useStudioBackup(
  theme: ScreenTheme,
  kind: StudioBackupKind
): { actions: JSX.Element; panel: JSX.Element; exportPreset: (id: string) => void } {
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const word = studioBackupWord(kind)

  /** Saves what `compose` answers to a file the player chooses; null from it saves nothing. */
  async function saveFile(compose: () => Promise<{ name: string; text: string } | null>): Promise<void> {
    if (working.current) return
    working.current = true
    try {
      const file = await compose()
      if (file === null) return
      const saved = await window.api.studioBackup.save(file.name, file.text)
      if (!saved.ok) showError(saved.error)
    } finally {
      working.current = false
    }
  }

  /** Saves one preset, read whole, as a presets file holding it alone. */
  function exportPreset(id: string): void {
    void saveFile(async () => {
      const read = await window.api.presets.get(id)
      if (!read.ok) {
        showError(read.error)
        return null
      }
      const text = JSON.stringify(buildPresetsBackup([read.data], read.data.id), null, 2)
      return { name: presetExportName(read.data.name), text }
    })
  }

  /** Reads a file the player picks, checks it whole, then opens the confirmation. */
  async function pickFile(): Promise<void> {
    if (working.current) return
    working.current = true
    try {
      const picked = await window.api.studioBackup.pick()
      if (!picked.ok) {
        showError(picked.error)
        return
      }
      if (!picked.data) return
      const checked = parseStudioBackup(kind, picked.data.text)
      if (!checked.ok) {
        refuse(checked.error)
        return
      }
      setPending({ kind, backup: checked.backup } as Pending)
    } finally {
      working.current = false
    }
  }

  /** Merges the checked file into the section. */
  async function restore(file: Pending): Promise<void> {
    setBusy(true)
    try {
      if (file.kind === 'presets') {
        const ids = usePromptStudioStore.getState().presets.map((preset) => preset.id)
        await usePromptStudioStore.getState().restorePresets(mergePresets(ids, file.backup))
      } else {
        await usePromptStudioStore.getState().restorePrompts(file.backup.prompts)
      }
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const actions = (
    <>
      {kind !== 'presets' && (
        <StudioPill
          id={`studio-export-${kind}`}
          word={`Export ${word}`}
          onClick={() => void saveFile(async () => ({ name: studioBackupName(kind), text: backupText() }))}
        />
      )}
      <StudioPill id={`studio-restore-${kind}`} word={`Restore ${word}`} onClick={() => void pickFile()} />
    </>
  )

  const panel = (
    <AnimatePresence propagate>
      {pending && (
        <ConfirmModal
          key={`studio-restore-${kind}`}
          id={`studio-restore-${kind}-confirm`}
          theme={theme}
          title={`Restore ${word}?`}
          message={describe(pending)}
          confirmText={`Restore ${word}`}
          cancelText="Cancel"
          busy={busy}
          busyText="Restoring"
          onConfirm={() => void restore(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </AnimatePresence>
  )

  return { actions, panel, exportPreset }
}
