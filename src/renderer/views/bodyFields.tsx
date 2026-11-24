import { genderOf, type PhotoGender } from '../../shared/photoGender'
import type { JSX } from 'react'
import { motion } from 'motion/react'
import {
  allowedBeside,
  appearanceBreasts,
  bodyTagLabel,
  bodyOf,
  BODY_FIELDS,
  bodyPoolsFor,
  cleanBody,
  drawBody,
  drawnFieldsFor,
  type BodyField,
  type CharacterBody
} from '../../shared/characterBody'
import { usePhotoSwitches } from '../stores/photoSwitchHooks'
import { gestures, quietLift, quietPress, recordField, type EditorField } from '@vx/modkit/renderer'
import '../vu_styles/BodyFields.css'
import { PHOTO_FEATURE_ID } from '../../shared/photoSwitches'

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
  penis: 'Penis',
  pubicHair: 'Pubic hair'
}

/** What an empty field is drawn as. */
function noneLabel(field: BodyField): string {
  return field === 'pubicHair' ? 'Clean' : 'Average'
}

/** Her body on a character, moved from the old key when the character is written. */
export const PHOTO_BODY_FIELD = recordField<CharacterBody>(PHOTO_FEATURE_ID, {
  empty: {},
  legacy: ['body'],
  normalize: (stored, legacy) => cleanBody(stored === undefined ? legacy.body : stored) ?? {}
})

/** A character write that keeps her body in Photo's slice and retires the old key. */
export function writeBody(value: unknown) {
  return {
    ex: PHOTO_BODY_FIELD.with(
      { ex: {} },
      cleanBody(value, (value as BodyForm | undefined)?.gender) ?? {}
    ).ex,
    body: undefined
  }
}

/** Her body as the form holds it: whatever the pools allow of what her file has. */
interface BodyForm extends CharacterBody {
  /** Form-only context; writeBody stores just the five picks. */
  gender?: 'male'
}

export function bodyForm(
  body: CharacterBody | undefined,
  gender: PhotoGender = 'female'
): BodyForm {
  return { ...(cleanBody(body, gender) ?? {}), ...(gender === 'male' ? { gender } : {}) }
}

export function BodyFieldsSection({
  body,
  baseAppearance,
  onChange
}: {
  body: BodyForm
  baseAppearance: readonly string[]
  onChange: (body: CharacterBody) => void
}): JSX.Element | null {
  const { on: modOn, body: switchedOn } = usePhotoSwitches()
  const gender = body.gender ?? 'female'
  const pools = bodyPoolsFor(gender)
  const change = (value: CharacterBody) => onChange(bodyForm(value, gender))
  const on = switchedOn && modOn
  // Off, the section is not there; what she has is kept, and written back as it was.
  if (!on) return null

  // A drawn body always names her chest, so an empty one is a character with none yet.
  const hasBody = BODY_FIELDS.some((field) => body[field])

  /** Her build as picked, her chest kept where the build allows it, and the rest drawn fresh. */
  function pickBuild(value: string): void {
    if (value === NOT_SET) change({})
    else
      change(
        drawBody(
          value === AVERAGE ? undefined : value,
          baseAppearance,
          Math.random,
          body.breasts,
          gender
        )
      )
  }

  /** Her chest as picked; nothing else is drawn again. */
  function pickBreasts(value: string): void {
    change(cleanBody({ ...body, breasts: value }, gender) ?? {})
  }

  return (
    <>
      <div className="vu-edit-body-head">
        <span className="vu-field-label">Body</span>
        <span className="vu-check-note">
          {gender === 'male'
            ? 'Pick a build and chest, then set his other details or reroll them. Penis size is used in explicit solo photos when visible.'
            : 'Pick a build and chest, and the rest is drawn to fit. Reroll for another combination. The chest starts from the appearance tags. Used in sprites, CGs and photos when drawn again.'}
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
          <option value={NOT_SET}>Not set (appearance only)</option>
          <option value={AVERAGE}>Average</option>
          {pools.build.map((tag) => (
            <option key={tag} value={tag}>
              {bodyTagLabel(tag)}
            </option>
          ))}
        </select>
      </label>
      {(hasBody || gender === 'male') && (
        <label className="vu-field" htmlFor="edit-body-breasts">
          <span className="vu-field-label">{gender === 'male' ? 'Chest' : LABELS.breasts}</span>
          <select
            id="edit-body-breasts"
            className="vu-input vu-select"
            value={body.breasts ?? appearanceBreasts(baseAppearance, gender)}
            onChange={(e) => pickBreasts(e.target.value)}
          >
            {pools.breasts.map((tag) => (
              <option
                key={tag}
                value={tag}
                disabled={!allowedBeside({ build: body.build }, 'breasts', tag, gender)}
              >
                {bodyTagLabel(tag)}
              </option>
            ))}
          </select>
        </label>
      )}
      {gender === 'male' &&
        drawnFieldsFor(gender).map((field) => (
          <label className="vu-field" htmlFor={`edit-body-${field}`} key={field}>
            <span className="vu-field-label">{LABELS[field]}</span>
            <select
              id={`edit-body-${field}`}
              className="vu-input vu-select"
              value={body[field] ?? ''}
              onChange={(e) => change({ ...body, [field]: e.target.value })}
            >
              <option value="">{noneLabel(field)}</option>
              {pools[field].map((tag) => (
                <option key={tag} value={tag}>
                  {bodyTagLabel(tag)}
                </option>
              ))}
            </select>
          </label>
        ))}
      {(hasBody || gender === 'male') && (
        <div className="vu-edit-body-drawn">
          <span className="vu-check-note">
            {drawnFieldsFor(gender).map(
              (field) =>
                `${LABELS[field]}: ${body[field] ? bodyTagLabel(body[field]) : noneLabel(field)}`
            ).join(' · ')}
          </span>
          <motion.button
            type="button"
            id="edit-body-reroll"
            className="vu-pill"
            {...gestures(false, quietLift, quietPress)}
            onClick={() =>
              change(drawBody(body.build, baseAppearance, Math.random, body.breasts, gender))
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

/** Her body as a field in the character editor: read off her, edited, and written back clean. */
export const BODY_EDITOR_FIELD: EditorField = {
  read: (character) => bodyForm(bodyOf(character), genderOf(character)),
  write: writeBody,
  Field: ({ value, onChange, baseAppearance }) => (
    <BodyFieldsSection
      body={value as BodyForm}
      baseAppearance={baseAppearance}
      onChange={onChange}
    />
  )
}
