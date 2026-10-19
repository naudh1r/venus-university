import { useEffect, useRef, useState, type JSX, type MutableRefObject } from 'react'
import {
  COMFY_MODEL_SLOTS,
  comfyPicksOf,
  comfySourceOf,
  comfyUrlProblem,
  DEFAULT_LORA_WEIGHT,
  loraWeightOf,
  loraWeightText,
  loraWeightToStore,
  normalizeComfyUrl,
  parseLoraWeight,
  picksToStore,
  type ComfyModelPicks,
  type ComfyModelRole,
  type ComfySource
} from '@shared/comfyModels'
import type { RendererSettings, SettingsPatch } from '@shared/types'
import { ComfyEndpointFields } from '../components/ComfyEndpointFields'
import { ComfyModelPicker, resolvedPickOf } from '../components/ComfyModelPicker'
import { SelectField } from '../components/SelectField'
import { useComfyStore } from '../stores/comfyStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useSetupStore } from '../stores/setupStore'
import { useComfyProbe } from './useComfyProbe'

export interface SettingsComfyTabProps {
  /** Whether the tab is the one on screen; its lists are first asked for when it is. */
  active: boolean
  /** The player's own ComfyUI's URL as typed, staged by the panel behind Save. */
  url: string
  onUrlChange: (url: string) => void
  /** Filled with the LoRA weight's commit, which the panel runs on its way out. */
  commitRef: MutableRefObject<(() => Promise<void>) | null>
}

/** What the source select offers, the app's own install first. */
export const COMFY_SOURCE_OPTIONS: readonly { value: ComfySource; label: string }[] = [
  { value: 'managed', label: 'Install for me (recommended)' },
  { value: 'external', label: 'Use my own' }
]

/** The patch writing one source's LoRA weight. */
function weightPatch(source: ComfySource, weight: number): Partial<SettingsPatch> {
  return source === 'external'
    ? { comfyExternalLoraWeight: loraWeightToStore(weight) }
    : { comfyLoraWeight: loraWeightToStore(weight) }
}

/** Both sources' LoRA weights as their fields show them. */
function weightTextsOf(settings: RendererSettings | null): Record<ComfySource, string> {
  return {
    managed: loraWeightText(settings ? loraWeightOf(settings, 'managed') : DEFAULT_LORA_WEIGHT),
    external: loraWeightText(settings ? loraWeightOf(settings, 'external') : DEFAULT_LORA_WEIGHT)
  }
}

/** What the source select says about the player's own ComfyUI. */
export const OWN_COMFY_NOTE =
  'Please note that I cannot provide technical support for players using their own ComfyUI instance, you are on your own for troubleshooting.'

/**
 * Settings' ComfyUI tab: which ComfyUI draws and, for the player's own, where it answers and
 * whether it has what the workflows need; beside them, the models each source draws with. The
 * source and the picks are written the moment they change, the LoRA weight as it is left; the
 * URL is the panel's to stage.
 */
export function SettingsComfyTab({
  active,
  url,
  onUrlChange,
  commitRef
}: SettingsComfyTabProps): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const openModelFolder = useComfyStore((s) => s.openModelFolder)

  // Held here and seeded from the store, so the tab redresses itself on the frame it changes.
  const [source, setSource] = useState<ComfySource>(() =>
    settings ? comfySourceOf(settings) : 'managed'
  )
  // Each source's picks, held so two quick picks cannot lose one to a write still in the lane.
  const [picks, setPicks] = useState<Record<ComfySource, ComfyModelPicks | undefined>>(() => ({
    managed: settings ? comfyPicksOf(settings, 'managed') : undefined,
    external: settings ? comfyPicksOf(settings, 'external') : undefined
  }))
  // Each source's LoRA weight as typed, and the one last sent, ahead of the store while a write
  // is in the lane, so a field left twice neither repeats a write nor compares against a stale one.
  const [weightText, setWeightText] = useState(() => weightTextsOf(settings))
  const sentWeight = useRef<Record<ComfySource, number>>({
    managed: settings ? loraWeightOf(settings, 'managed') : DEFAULT_LORA_WEIGHT,
    external: settings ? loraWeightOf(settings, 'external') : DEFAULT_LORA_WEIGHT
  })

  const probe = useComfyProbe({ source, url })

  // The lists are first asked for when the tab is opened, and again whenever the source changes.
  const asked = useRef<ComfySource | null>(null)
  useEffect(() => {
    if (!active || asked.current === source) return
    asked.current = source
    void probe.refreshModels()
  }, [active, source])

  /** Puts the tab back where the store stands, for a write that did not land. */
  function reseed(stored: RendererSettings | null): void {
    if (!stored) return
    setSource(comfySourceOf(stored))
    setPicks({
      managed: comfyPicksOf(stored, 'managed'),
      external: comfyPicksOf(stored, 'external')
    })
    sentWeight.current = {
      managed: loraWeightOf(stored, 'managed'),
      external: loraWeightOf(stored, 'external')
    }
    setWeightText(weightTextsOf(stored))
  }

  /** Which ComfyUI draws; leaving the app's own stops it, a render in flight with it. */
  function handleSourceChange(value: string): void {
    const next = value as ComfySource
    setSource(next)
    probe.reset()
    void update({ comfySource: next === 'external' ? 'external' : undefined }).then((ok) => {
      if (!ok) {
        reseed(useSettingsStore.getState().settings)
        return
      }
      // A boot that skipped the install's verify, its player having named their own ComfyUI,
      // has no word on the app's own install until it is asked.
      if (next === 'managed' && useSetupStore.getState().status === null) {
        void useSetupStore.getState().refresh(true)
      }
    })
  }

  /**
   * One slot's model for the source on screen, written at once. The LoRA going to None, or
   * picked from None, puts its weight back to the default in the same write.
   */
  function handlePick(role: ComfyModelRole, value: string): void {
    const slot = COMFY_MODEL_SLOTS.find((s) => s.role === role)
    const resetWeight =
      slot !== undefined &&
      slot.optional &&
      (value === '' || resolvedPickOf(slot, picks[source], probe.models, source) === '')
    const nextPicks = picksToStore({ ...picks[source], [role]: value }, source)
    setPicks((prev) => ({ ...prev, [source]: nextPicks }))
    if (resetWeight) {
      sentWeight.current[source] = DEFAULT_LORA_WEIGHT
      setWeightText((prev) => ({ ...prev, [source]: loraWeightText(DEFAULT_LORA_WEIGHT) }))
    }
    void update({
      ...(source === 'external' ? { comfyExternalModels: nextPicks } : { comfyModels: nextPicks }),
      ...(resetWeight ? weightPatch(source, DEFAULT_LORA_WEIGHT) : {})
    }).then((ok) => {
      if (!ok) reseed(useSettingsStore.getState().settings)
    })
  }

  /**
   * Writes the LoRA weight on screen once its text is a weight and differs from what was last
   * sent; text that is not one goes back to that.
   */
  async function commitWeight(): Promise<void> {
    const parsed = parseLoraWeight(weightText[source])
    const weight = parsed ?? sentWeight.current[source]
    setWeightText((prev) => ({ ...prev, [source]: loraWeightText(weight) }))
    if (weight === sentWeight.current[source]) return
    sentWeight.current[source] = weight
    const ok = await update(weightPatch(source, weight))
    if (!ok) reseed(useSettingsStore.getState().settings)
  }

  // The weight still holding text it has not sent, committed on the panel's way out, a blur not
  // being guaranteed; re-filled every render so it reads the text as it stands.
  commitRef.current = commitWeight

  const own = source === 'external'
  const folderUrl = own && comfyUrlProblem(url) === null ? normalizeComfyUrl(url) : null

  return (
    <>
      <div className="vu-settings-col">
        <div className="vu-scroll-box">
          <div className="vu-settings-fields">
            <SelectField
              id="settings-comfy-source"
              label="ComfyUI"
              value={source}
              onChange={handleSourceChange}
              options={COMFY_SOURCE_OPTIONS}
              hint={own ? OWN_COMFY_NOTE : undefined}
            />
            {own && (
              <ComfyEndpointFields
                idPrefix="settings-comfy"
                url={url}
                onUrlChange={onUrlChange}
                probe={probe}
                picks={picks.external}
              />
            )}
          </div>
          <div className="vu-scroll-fade" />
        </div>
      </div>

      <div className="vu-settings-col">
        <div className="vu-scroll-box">
          <div className="vu-settings-fields">
            <span className="vu-settings-heading">Models</span>
            <p className="vu-settings-note">
              { 'You can open the model folder to add or remove models.'}
            </p>
            <ComfyModelPicker
              idPrefix="settings-comfy-model"
              source={source}
              picks={picks[source]}
              models={probe.models}
              listed={probe.listed}
              folders={probe.folders}
              onPick={handlePick}
              onOpenFolder={(role, pick) => {
                if (own && folderUrl === null) return
                void openModelFolder(role, own ? folderUrl : null, own ? pick : undefined)
              }}
              weightText={weightText[source]}
              onWeightText={(text) => setWeightText((prev) => ({ ...prev, [source]: text }))}
              onWeightBlur={() => void commitWeight()}
            />
          </div>
          <div className="vu-scroll-fade" />
        </div>
      </div>
    </>
  )
}
