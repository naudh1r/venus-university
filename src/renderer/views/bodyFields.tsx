import { useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  allowedBeside,
  appearanceBreasts,
  bodyTagLabel,
  BODY_FIELDS,
  BODY_POOLS,
  cleanBody,
  drawBody,
  type BodyField,
  type CharacterBody
} from '@shared/characterBody'
import { usePhotoSwitches } from '../stores/photoSwitchHooks'
import { useSettingsStore } from '../stores/settingsStore'
import { gestures, quietLift, quietPress } from './motion'
import '../vu_styles/BodyFields.css'

/**
 * The body switch, in Character Manage beside the other roster actions: it decides what she is
 * asked at creation, what her editor shows and what her sprites, CGs and photos are drawn with,
 * all of which are made here.
 */
export function BodyDetailsToggle(): JSX.Element | null {
  const on = useSettingsStore((s) => s.settings?.bodyDetails === true)
  const update = useSettingsStore((s) => s.update)
  const [saving, setSaving] = useState(false)
  // With the mod off there is no body to switch on; the setting is kept for when it is back.
  const modOn = usePhotoSwitches().on
  if (!modOn) return null
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
 * Her body in the character editor: her build, picked from the pool, and the rest drawn to fit it
 * by the same rules creation draws with — so any character, however old, can be given a body in
 * one choice, and another combination in one click. Her chest starts from her appearance and can
 * be picked here, the sizes her build rules out left unpickable; nothing
 * here can write a tag the checkpoint does not know, or two that contradict each other.
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
    return `As her appearance says (${bodyTagLabel(appearanceBreasts(baseAppearance))})`
  if (field === 'pubicHair') return 'Clean'
  return 'Average'
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
  const switchedOn = useSettingsStore((s) => s.settings?.bodyDetails === true)
  const modOn = usePhotoSwitches().on
  const on = switchedOn && modOn
  // Off, the section is not there; what she has is kept, and written back as it was.
  if (!on) return null

  // A drawn body always names her chest, so an empty one is a character with none yet.
  const hasBody = BODY_FIELDS.some((field) => body[field])

  /** Her build as picked, her chest kept where the build allows it, and the rest drawn fresh. */
  function pickBuild(value: string): void {
    if (value === NOT_SET) onChange({})
    else
      onChange(
        drawBody(value === AVERAGE ? undefined : value, baseAppearance, Math.random, body.breasts)
      )
  }

  /** Her chest as picked; nothing else is drawn again. */
  function pickBreasts(value: string): void {
    onChange(cleanBody({ ...body, breasts: value }) ?? {})
  }

  return (
    <>
      <div className="vu-edit-body-head">
        <span className="vu-field-label">Body</span>
        <span className="vu-check-note">
          Pick her build and her chest, and the rest is drawn to fit, from tags the image model
          knows; reroll for another combination. Her chest starts from her appearance. Used in her
          sprites, CGs and photos once they are generated again.
        </span>
      </div>
      <label className="vu-field" htmlFor="edit-body-build">
        <span className="vu-field-label">{LABELS.build}</span>
        <select
          id="edit-body-build"
          className="vu-input vu-select"
          value={hasBody ? (body.build ?? AVERAGE) : NOT_SET}
          onChange={(e) => pickBuild(e.target.value)}
        >
          <option value={NOT_SET}>Not set (her appearance only)</option>
          <option value={AVERAGE}>Average</option>
          {BODY_POOLS.build.map((tag) => (
            <option key={tag} value={tag}>
              {bodyTagLabel(tag)}
            </option>
          ))}
        </select>
      </label>
      {hasBody && (
        <label className="vu-field" htmlFor="edit-body-breasts">
          <span className="vu-field-label">{LABELS.breasts}</span>
          <select
            id="edit-body-breasts"
            className="vu-input vu-select"
            value={body.breasts ?? appearanceBreasts(baseAppearance)}
            onChange={(e) => pickBreasts(e.target.value)}
          >
            {BODY_POOLS.breasts.map((tag) => (
              <option
                key={tag}
                value={tag}
                disabled={!allowedBeside({ build: body.build }, 'breasts', tag)}
              >
                {bodyTagLabel(tag)}
              </option>
            ))}
          </select>
        </label>
      )}
      {hasBody && (
        <div className="vu-edit-body-drawn">
          <span className="vu-check-note">
            {DRAWN_FIELDS.map(
              (field) =>
                `${LABELS[field]}: ${body[field] ? bodyTagLabel(body[field]) : noneLabel(field, baseAppearance)}`
            ).join(' · ')}
          </span>
          <motion.button
            type="button"
            id="edit-body-reroll"
            className="vu-pill"
            {...gestures(false, quietLift, quietPress)}
            onClick={() =>
              onChange(drawBody(body.build, baseAppearance, Math.random, body.breasts))
            }
          >
            Reroll
          </motion.button>
        </div>
      )}
    </>
  )
}

/** The build dropdown's two answers that are not a tag. */
const NOT_SET = 'not-set'
const AVERAGE = 'average'

/** What the engine drew, shown under her build and her chest. */
const DRAWN_FIELDS: readonly BodyField[] = ['hipsThighs', 'buttocks', 'pubicHair']
