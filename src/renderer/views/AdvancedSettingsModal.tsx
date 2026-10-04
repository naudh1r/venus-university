import { useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MAX_OUTPUT_TOKENS } from '@shared/llm/adapter'
import {
  DEFAULT_MEMORY_BUDGETS,
  SAMPLING_FIELDS,
  maxOutputTokensProblem,
  memoryBudgetProblem,
  parseMaxOutputTokens,
  parseMemoryBudget,
  parseSampling,
  samplingProblem,
  storedMaxOutputTokens,
  type MemoryBudgetKey,
  type SamplingField,
  type SamplingKey
} from '@shared/settingsRules'
import type { MemoryBudgets, SettingsPatch } from '@shared/types'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { TextField } from '../components/TextField'
import { useSettingsStore } from '../stores/settingsStore'
import type { ScreenTheme } from './clockTheme'
import { CustomBackgroundsModal } from './CustomBackgroundsModal'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import { SystemPromptModal } from './SystemPromptModal'
import '../vu_styles/Settings.css'
import '../vu_styles/AdvancedSettings.css'

export interface AdvancedSettingsModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

/** The three memory fields, in the order the column shows them. */
const MEMORY_FIELDS: readonly { key: MemoryBudgetKey; label: string }[] = [
  { key: 'one', label: '1 character in the scene' },
  { key: 'two', label: '2 characters in the scene' },
  { key: 'three', label: '3 characters in the scene' }
]

/** A stored number as the text a field would show for it, or blank where it is absent. */
function textOf(value: number | undefined): string {
  return value !== undefined ? String(value) : ''
}

/**
 * The reply cap and sampling values a custom endpoint is sent and the per-cast-size memory
 * budgets, each written the moment its field is left. The cap and the sampling fields are dead
 * under Gemini, which is sent none of them.
 */
export function AdvancedSettingsModal({
  theme,
  onClose
}: AdvancedSettingsModalProps): JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)

  // Seeded once from the store; a stored cap the file cannot mean opens blank, the ceiling.
  const [capText, setCapText] = useState(() =>
    textOf(settings ? storedMaxOutputTokens(settings) : undefined)
  )
  // Held per sampling key and seeded once from the store.
  const [samplingText, setSamplingText] = useState<Record<SamplingKey, string>>(() => {
    const seeded = {} as Record<SamplingKey, string>
    for (const field of SAMPLING_FIELDS) seeded[field.key] = textOf(settings?.[field.key])
    return seeded
  })
  const [memoryText, setMemoryText] = useState<Record<MemoryBudgetKey, string>>(() => ({
    one: textOf(settings?.memoryBudgets?.one),
    two: textOf(settings?.memoryBudgets?.two),
    three: textOf(settings?.memoryBudgets?.three)
  }))
  // Whether the system prompt editor stands over this panel.
  const [editing, setEditing] = useState(false)
  // Whether the player's own backgrounds stand over this panel.
  const [backgrounds, setBackgrounds] = useState(false)

  // What this panel has last sent for each field, ahead of the store while a write is in the
  // lane: each blur is compared and merged against it, so a second field left before the first
  // one's write lands neither repeats that write nor sends the budgets without it.
  const sent = useRef<{
    cap: number | undefined
    sampling: Partial<Record<SamplingKey, number>>
    budgets: MemoryBudgets
  }>({
    cap: settings ? storedMaxOutputTokens(settings) : undefined,
    sampling: Object.fromEntries(SAMPLING_FIELDS.map((field) => [field.key, settings?.[field.key]])),
    budgets: { ...settings?.memoryBudgets }
  })

  // Gemini is sent none of the five, so under it they are dead and checked for nothing.
  const generationDisabled = settings?.apiProvider === 'gemini'

  /** Writes the reply cap once its text checks out and differs from what was last sent. */
  async function commitCap(): Promise<void> {
    if (maxOutputTokensProblem(capText) !== null) return
    const parsed = parseMaxOutputTokens(capText)
    if (parsed === sent.current.cap) return
    sent.current.cap = parsed
    const ok = await update({ maxOutputTokens: parsed })
    if (ok) return
    // Put the field back to whatever the store still holds.
    const stored = useSettingsStore.getState().settings
    sent.current.cap = stored ? storedMaxOutputTokens(stored) : undefined
    setCapText(textOf(sent.current.cap))
  }

  /** Writes a sampling field once its text checks out and differs from what was last sent. */
  async function commitSampling(field: SamplingField): Promise<void> {
    const text = samplingText[field.key]
    if (samplingProblem(field.key, text) !== null) return
    const parsed = parseSampling(field.key, text)
    if (parsed === sent.current.sampling[field.key]) return
    sent.current.sampling[field.key] = parsed
    const ok = await update({ [field.key]: parsed } as Partial<SettingsPatch>)
    if (ok) return
    // Put the field back to whatever the store still holds.
    const stored = useSettingsStore.getState().settings?.[field.key]
    sent.current.sampling[field.key] = stored
    setSamplingText((prev) => ({ ...prev, [field.key]: textOf(stored) }))
  }

  /** Writes a memory budget once its text checks out and differs from what was last sent. */
  async function commitMemory(key: MemoryBudgetKey, label: string): Promise<void> {
    const text = memoryText[key]
    if (memoryBudgetProblem(label, text) !== null) return
    const parsed = parseMemoryBudget(text)
    if (parsed === sent.current.budgets[key]) return
    const next: MemoryBudgets = { ...sent.current.budgets }
    if (parsed === undefined) delete next[key]
    else next[key] = parsed
    sent.current.budgets = next
    const ok = await update({ memoryBudgets: Object.keys(next).length > 0 ? next : undefined })
    if (ok) return
    // Put every budget back to whatever the store still holds.
    const stored = useSettingsStore.getState().settings?.memoryBudgets
    sent.current.budgets = { ...stored }
    setMemoryText({
      one: textOf(stored?.one),
      two: textOf(stored?.two),
      three: textOf(stored?.three)
    })
  }

  // The first thing wrong with a field as it is currently typed, the cap and the sampling fields
  // counted only while they are live.
  const problem =
    (generationDisabled
      ? null
      : (maxOutputTokensProblem(capText) ??
        SAMPLING_FIELDS.map((field) => samplingProblem(field.key, samplingText[field.key])).find(
          (p) => p !== null
        ))) ??
    MEMORY_FIELDS.map((field) => memoryBudgetProblem(field.label, memoryText[field.key])).find(
      (p) => p !== null
    ) ??
    null

  /** Commits every field still holding text it has not sent, a blur not being guaranteed. */
  async function commitAll(): Promise<void> {
    if (!generationDisabled) {
      await commitCap()
      for (const field of SAMPLING_FIELDS) await commitSampling(field)
    }
    for (const field of MEMORY_FIELDS) await commitMemory(field.key, field.label)
  }

  /** The gate in front of leaving: nothing while a field is wrong, else every edit is committed. */
  function requestClose(): void {
    if (problem !== null) return
    void commitAll().then(() => onClose())
  }

  const { host, overlayProps } = useModalShell(requestClose)
  if (!host || !settings) return null

  return createPortal(
    <>
      <motion.div
        className="vu-veil"
        data-theme={theme}
        variants={veilIn}
        initial="hidden"
        animate="shown"
        exit="gone"
        {...overlayProps}
      >
        <motion.div
          id="advanced-settings-modal"
          className="vu-advanced vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Advanced Settings"
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation()
          }}
        >
          <TitleTab>Advanced Settings</TitleTab>

          <div className="vu-advanced-columns">
            <div className="vu-advanced-col">
              <span className="vu-settings-heading">Advanced Generation</span>
              <p className="vu-advanced-note">
                Only change these if your model and endpoint support it. Most API users (Such as
                Google AI Studio) do not need to change these at all.
              </p>
              <TextField
                id="advanced-max-output-tokens"
                label="Max output tokens"
                hint="A minimum of 12000 is recommended, though the game won't immediately break under this number."
                placeholder={String(MAX_OUTPUT_TOKENS)}
                value={capText}
                onChange={setCapText}
                maxLength={7}
                disabled={generationDisabled}
                onBlur={() => void commitCap()}
              />
              {SAMPLING_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  id={`advanced-${field.key}`}
                  label={field.label}
                  value={samplingText[field.key]}
                  onChange={(value) =>
                    setSamplingText((prev) => ({ ...prev, [field.key]: value }))
                  }
                  maxLength={8}
                  disabled={generationDisabled}
                  onBlur={() => void commitSampling(field)}
                />
              ))}
            </div>

            <div className="vu-advanced-col">
              <motion.button
                id="advanced-custom-bg"
                className="vu-pill"
                type="button"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => setBackgrounds(true)}
              >
                Upload custom BG
              </motion.button>
              <motion.button
                id="advanced-edit-prompt"
                className="vu-pill"
                type="button"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => setEditing(true)}
              >
                Edit system prompt
              </motion.button>
              <span className="vu-settings-heading">Max memories</span>
              {MEMORY_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  id={`advanced-memories-${field.key}`}
                  label={field.label}
                  value={memoryText[field.key]}
                  onChange={(value) => setMemoryText((prev) => ({ ...prev, [field.key]: value }))}
                  placeholder={String(DEFAULT_MEMORY_BUDGETS[field.key])}
                  maxLength={3}
                  onBlur={() => void commitMemory(field.key, field.label)}
                />
              ))}
            </div>
          </div>

          <div className="vu-foot-stack">
            <span className="vu-form-status">
              {problem !== null && (
                <>
                  <span className="vu-form-dot vu-form-dot--warn" />
                  {problem}
                </>
              )}
            </span>
            <div className="vu-foot">
              <motion.button
                id="advanced-done"
                className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                type="button"
                disabled={problem !== null}
                {...gestures(problem !== null, lift, press)}
                onClick={requestClose}
              >
                Done
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Siblings of the veil, not children: each nested panel leaves when this one does. */}
      <AnimatePresence propagate>
        {editing && (
          <SystemPromptModal key="system-prompt" theme={theme} onClose={() => setEditing(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {backgrounds && (
          <CustomBackgroundsModal
            key="custom-backgrounds"
            theme={theme}
            onClose={() => setBackgrounds(false)}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
