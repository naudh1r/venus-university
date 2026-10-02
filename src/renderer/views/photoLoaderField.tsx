import type { JSX } from 'react'
import { PHOTO_LOADERS, photoLoaderOf } from '@shared/photoLoader'
import { SelectField } from '../components/SelectField'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * The photo switch's own sub-field, tucked under it in Settings the way the writer column's
 * "Use it for" boxes sit under their select. Written the moment it changes, like the switch, and
 * a picture already waiting changes with it: it is only what the wait looks like.
 */
export function PhotoLoaderField(): JSX.Element {
  const stored = useSettingsStore((s) => s.settings?.photoLoader)
  const update = useSettingsStore((s) => s.update)
  return (
    <div className="vu-settings-kinds">
      <SelectField
        id="settings-photo-loader"
        label="Loading animation"
        value={photoLoaderOf(stored)}
        options={PHOTO_LOADERS}
        onChange={(value) => void update({ photoLoader: value })}
      />
    </div>
  )
}
