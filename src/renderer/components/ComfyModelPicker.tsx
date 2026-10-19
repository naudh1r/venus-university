import type { JSX, ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  COMFY_MODEL_SLOTS,
  resolveModelPick,
  storedPickOf,
  type ComfyModelLists,
  type ComfyModelPicks,
  type ComfyModelRole,
  type ComfyModelSlot,
  type ComfySource
} from '@shared/comfyModels'
import { FolderIcon } from '../views/characterIcons'
import { gestures, linkLift, quietLift, quietPress } from '../views/motion'
import { SelectField } from './SelectField'
import { TextField } from './TextField'
import '../vu_styles/ComfyModels.css'

export interface ComfyModelPickerProps {
  /** Prefixes every control's id, so two screens' pickers never share one. */
  idPrefix: string
  /** Which ComfyUI the picks are for, which decides what a slot left unpicked draws. */
  source: ComfySource
  picks: ComfyModelPicks | undefined
  models: ComfyModelLists
  /** Whether a list has arrived, which is what marks a pick it lacks as missing. */
  listed: boolean
  folders: Record<ComfyModelRole, boolean>
  onPick: (role: ComfyModelRole, value: string) => void
  /** Opens a slot's folder, given the file the slot shows so the one holding it can be found. */
  onOpenFolder: (role: ComfyModelRole, pick: string) => void
  /** The LoRA weight as typed, shown blank while the LoRA is None. */
  weightText: string
  onWeightText: (text: string) => void
  /** Fires when the weight is left, for whatever its text is checked against. */
  onWeightBlur: () => void
}

/** The file one slot draws with, as the job would resolve it against the list shown. */
export function resolvedPickOf(
  slot: ComfyModelSlot,
  picks: ComfyModelPicks | undefined,
  models: ComfyModelLists,
  source: ComfySource
): string {
  return resolveModelPick(storedPickOf(picks, slot.role), slot, models[slot.role], source)
}

/** One line per slot whose pick the server's list lacks, in the pickers' order. */
export function missingModelLines(
  picks: ComfyModelPicks | undefined,
  models: ComfyModelLists,
  source: ComfySource
): string[] {
  const lines: string[] = []
  for (const slot of COMFY_MODEL_SLOTS) {
    const pick = resolvedPickOf(slot, picks, models, source)
    if (pick === '' || models[slot.role].includes(pick)) continue
    lines.push(`Missing ${slot.label.toLowerCase()}: ${pick}`)
  }
  return lines
}

/**
 * A model select's options: None where the slot may be left empty, every listed file, and the
 * pick wherever the list lacks it, marked missing once a list has arrived.
 */
export function modelOptionsOf(
  list: readonly string[],
  pick: string,
  listed: boolean,
  withNone: boolean
): { value: string; label: string }[] {
  const options = withNone ? [{ value: '', label: 'None' }] : []
  options.push(...list.map((name) => ({ value: name, label: name })))
  if (pick !== '' && !list.includes(pick)) {
    options.push({ value: pick, label: listed ? `${pick} (missing)` : pick })
  }
  return options
}

export interface ComfyModelRowProps {
  id: string
  label: string
  hint?: ReactNode
  value: string
  options: readonly { value: string; label: string }[]
  onPick: (value: string) => void
  /** A LoRA's weight as typed, shown blank and dead while the pick is None. */
  weight?: { text: string; onText: (text: string) => void; onBlur: () => void }
  /** Opens the folder the slot's files go in; absent where the app cannot open it. */
  onOpenFolder?: () => void
}

/** One model's select, its weight where it is a LoRA, and the folder its files go in. */
export function ComfyModelRow({
  id,
  label,
  hint,
  value,
  options,
  onPick,
  weight,
  onOpenFolder
}: ComfyModelRowProps): JSX.Element {
  return (
    <div className="vu-comfy-model">
      <SelectField
        id={id}
        label={label}
        value={value}
        onChange={onPick}
        options={options}
        hint={hint}
      />
      {weight && (
        <div className="vu-comfy-weight">
          <TextField
            id={`${id}-weight`}
            label="Weight"
            value={value === '' ? '' : weight.text}
            onChange={weight.onText}
            onBlur={weight.onBlur}
            maxLength={8}
            disabled={value === ''}
          />
        </div>
      )}
      {onOpenFolder && (
        <motion.button
          id={`${id}-folder`}
          className="vu-square"
          type="button"
          aria-label="Open folder"
          {...gestures(false, quietLift, quietPress)}
          onClick={onOpenFolder}
        >
          <FolderIcon />
        </motion.button>
      )}
    </div>
  )
}

/**
 * One picker per model slot, each with the folder its files go in beside it where the app can
 * open that folder, and under it a link to the model the game ships in that slot. The LoRA's
 * weight stands between its picker and the folder, dead while the LoRA is None.
 */
export function ComfyModelPicker({
  idPrefix,
  source,
  picks,
  models,
  listed,
  folders,
  onPick,
  onOpenFolder,
  weightText,
  onWeightText,
  onWeightBlur
}: ComfyModelPickerProps): JSX.Element {
  return (
    <div className="vu-comfy-models">
      {COMFY_MODEL_SLOTS.map((slot) => {
        const pick = resolvedPickOf(slot, picks, models, source)
        return (
          <ComfyModelRow
            key={slot.role}
            id={`${idPrefix}-${slot.role}`}
            label={slot.label}
            value={pick}
            options={modelOptionsOf(models[slot.role], pick, listed, slot.optional)}
            onPick={(value) => onPick(slot.role, value)}
            hint={
              <>
                Recommended:{' '}
                <motion.a
                  className="vu-link"
                  href={slot.pin.url}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={linkLift}
                  whileFocus={linkLift}
                >
                  {slot.pin.label}
                </motion.a>
              </>
            }
            weight={
              slot.optional
                ? { text: weightText, onText: onWeightText, onBlur: onWeightBlur }
                : undefined
            }
            onOpenFolder={folders[slot.role] ? () => onOpenFolder(slot.role, pick) : undefined}
          />
        )
      })}
    </div>
  )
}
