import { useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  allowedBeside,
  appearanceBreasts,
  BODY_FIELDS,
  BODY_POOLS,
  cleanBody,
  type BodyField,
  type CharacterBody
} from '@shared/characterBody'
import { useSettingsStore } from '../stores/settingsStore'
import { gestures, quietLift, quietPress } from './motion'
import '../vu_styles/BodyFields.css'

/**
 * The body switch, in Character Manage beside the other roster actions: it decides what she is
 * asked at creation, what her editor shows and what her sprites, CGs and photos are drawn with,
 * all of which are made here.
 */
export function BodyDetailsToggle(): JSX.Element {
  const on = useSettingsStore((s) => s.settings?.bodyDetails === true)
  const update = useSettingsStore((s) => s.update)
  const [saving, setSaving] = useState(false)
  return (
    <motion.button
      id="manage-body-details"
      className="vu-pill"
      aria-pressed={on}
      title="Asks for, edits and draws her build, chest, hips, backside and hair from fixed tag lists."
      {...gestures(saving, quietLift, quietPress)}
      disabled={saving}
      onClick={() => {
        setSaving(true)
        void update({ bodyDetails: !on }).finally(() => setSaving(false))
      }}
    >
      {on ? 'Body details: on' : 'Body details: off'}
    </motion.button>
  )
}

/**
 * Her body in the character editor: one pick per field, from the pools and nothing else, so the
 * editor cannot write a tag the checkpoint does not know. An option that contradicts a field
 * above it is shown and cannot be chosen, and changing a field clears any below it that no
 * longer fits.
 *
 * Its own file, on the rule the rest of the feature follows: the editor carries one element.
 */

const LABELS: Readonly<Record<BodyField, string>> = {
  build: 'Build',
  breasts: 'Breasts',
  hipsThighs: 'Hips and thighs',
  buttocks: 'Backside',
  pubicHair: 'Pubic hair'
}

/** What an empty field is drawn as. */
function noneLabel(field: BodyField, baseAppearance: readonly string[]): string {
  if (field === 'breasts')
    return `As her appearance says (${spoken(appearanceBreasts(baseAppearance))})`
  if (field === 'pubicHair') return 'Hairless'
  return 'Average'
}

/** A tag as a word: `thick_thighs` is "thick thighs". */
function spoken(tag: string): string {
  return tag.replace(/_/g, ' ')
}

/** Her body as the form holds it: whatever the pools allow of what her file has. */
export function bodyForm(body: CharacterBody | undefined): CharacterBody {
  return cleanBody(body) ?? {}
}

export function BodyFieldsSection({
  body,
  baseAppearance,
  onChange
}: {
  body: CharacterBody
  baseAppearance: readonly string[]
  onChange: (body: CharacterBody) => void
}): JSX.Element | null {
  const on = useSettingsStore((s) => s.settings?.bodyDetails === true)
  // Off, the section is not there; what she has is kept, and written back as it was.
  if (!on) return null

  /** The fields above `field`, which are what decide what it may hold. */
  function before(field: BodyField): CharacterBody {
    const settled: CharacterBody = {}
    for (const one of BODY_FIELDS) {
      if (one === field) break
      settled[one] = body[one]
    }
    return settled
  }

  function pick(field: BodyField, value: string): void {
    const next: CharacterBody = { ...body }
    if (value) next[field] = value
    else delete next[field]
    // Re-settled top down, so a field below that the new pick contradicts is cleared.
    onChange(cleanBody(next) ?? {})
  }

  return (
    <>
      <div className="vu-edit-body-head">
        <span className="vu-field-label">Body</span>
        <span className="vu-check-note">
          Drawn into her sprites, CGs and photos. One pick each, all of them tags the image model
          knows; an empty field is average. Her build and her chest are in every picture, her hips
          wherever they show, her backside where the picture is of it, and the rest only undressed.
        </span>
      </div>
      {BODY_FIELDS.map((field) => (
        <label key={field} className="vu-field" htmlFor={`edit-body-${field}`}>
          <span className="vu-field-label">{LABELS[field]}</span>
          <select
            id={`edit-body-${field}`}
            className="vu-input vu-select"
            value={body[field] ?? ''}
            onChange={(e) => pick(field, e.target.value)}
          >
            <option value="">{noneLabel(field, baseAppearance)}</option>
            {BODY_POOLS[field].map((tag) => (
              <option key={tag} value={tag} disabled={!allowedBeside(before(field), field, tag)}>
                {spoken(tag)}
              </option>
            ))}
          </select>
        </label>
      ))}
    </>
  )
}
