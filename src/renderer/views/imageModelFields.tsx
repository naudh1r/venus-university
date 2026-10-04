import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import { imageModelsOf, LORA_STRENGTH, type ModelFiles } from '@shared/imageModels'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { useSettingsStore } from '../stores/settingsStore'

/** The choices for one picker: what the folder holds, and the current pick even if it does not. */
function optionsOf(files: readonly string[], current: string): { value: string; label: string }[] {
  const options = files.map((file) => ({ value: file, label: file }))
  if (!files.includes(current)) options.unshift({ value: current, label: `${current} (not found)` })
  return options
}

/**
 * What every ComfyUI job draws with: the checkpoint and LoRA, picked from the files in ComfyUI's
 * model folders, the LoRA's strength, and its trigger word. The pickers and the slider are
 * written the moment they change; the trigger when the field is left. A change applies to the
 * next picture drawn, and to none already drawn.
 */
export function ImageModelFields(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const models = imageModelsOf(settings)

  const [files, setFiles] = useState<ModelFiles>({ checkpoints: [], loras: [] })
  const [trigger, setTrigger] = useState(models.trigger)
  const [strength, setStrength] = useState(models.strength)

  useEffect(() => {
    void window.api.imageModels?.list().then((result) => {
      if (result.ok) setFiles(result.data)
    })
  }, [])

  const fill = ((strength - LORA_STRENGTH.min) / (LORA_STRENGTH.max - LORA_STRENGTH.min)) * 100

  return (
    <div className="vu-setup-models">
      <SelectField
        id="setup-checkpoint"
        label="Checkpoint"
        value={models.checkpoint}
        options={optionsOf(files.checkpoints, models.checkpoint)}
        onChange={(value) => void update({ imageCheckpoint: value })}
      />
      <SelectField
        id="setup-lora"
        label="LoRA"
        value={models.lora}
        options={optionsOf(files.loras, models.lora)}
        onChange={(value) => void update({ imageLora: value })}
      />
      <div className="vu-range-row">
        <span className="vu-range-label">Strength</span>
        <input
          id="setup-lora-strength"
          className="vu-range"
          type="range"
          min={LORA_STRENGTH.min}
          max={LORA_STRENGTH.max}
          step={LORA_STRENGTH.step}
          value={strength}
          aria-label="LoRA strength"
          style={{ '--range-fill': `${fill}%` } as CSSProperties}
          onChange={(event) => setStrength(Number(event.target.value))}
          onPointerUp={() => void update({ imageLoraStrength: strength })}
          onKeyUp={() => void update({ imageLoraStrength: strength })}
        />
        <span className="vu-range-reading">{strength.toFixed(2)}</span>
      </div>
      <TextField
        id="setup-trigger"
        label="Trigger word"
        hint="Leads every prompt. Leave it empty for a LoRA without one."
        value={trigger}
        onChange={setTrigger}
        onBlur={() => void update({ imageTrigger: trigger.trim() })}
      />
    </div>
  )
}
