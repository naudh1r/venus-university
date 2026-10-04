import type { JSX } from 'react'
import type { SfwField } from '../views/sfwFields'
import { CheckField } from './CheckField'

/**
 * The content settings as a run of checkboxes over one record: the first-run question and the
 * Settings modal draw them from here, the question with its sound box after the two. A box hands
 * back the whole record it would leave behind, which is what one of them has to write.
 */
export function SfwCheckList<K extends string>({
  fields,
  sfw,
  onChange
}: {
  fields: readonly SfwField<K>[]
  sfw: Record<K, boolean>
  onChange: (next: Record<K, boolean>) => void
}): JSX.Element {
  return (
    <>
      {fields.map((field) => (
        <CheckField
          key={field.key}
          id={field.id}
          label={field.label}
          note={field.note}
          checked={sfw[field.key]}
          onChange={(checked) => onChange({ ...sfw, [field.key]: checked })}
        />
      ))}
    </>
  )
}
