/**
 * The question a Scene Creator scene ends on, or is left on: keep it to replay later, under a
 * name, or let it go.
 */
import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

import { SCENE_NAME_MAX } from '@shared/sceneCreator'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/SceneCreator.css'

export interface SaveSceneModalProps {
  theme: ScreenTheme
  /** The name a blank field saves under. */
  defaultName: string
  /** Resolves once the scene is written, false where the write was refused. */
  onSave: (name: string) => Promise<boolean>
  onDiscard: () => void
  /**
   * What a dismissal answers — staying in the scene, where the question was asked on the way
   * out of one still running; absent, the question has only its two answers.
   */
  onDismiss?: () => void
}

/** The save question: a name, then Don't save and Save. */
export function SaveSceneModal({
  theme,
  defaultName,
  onSave,
  onDiscard,
  onDismiss
}: SaveSceneModalProps): JSX.Element | null {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  /** Writes the scene, held dead while the write is out. */
  async function save(): Promise<void> {
    if (saving) return
    setSaving(true)
    const saved = await onSave(name)
    if (!saved) setSaving(false)
  }

  const { host, overlayProps, primaryProps } = useModalShell(
    () => {
      if (!saving) onDismiss?.()
    },
    'panel',
    () => void save()
  )
  if (!host) return null

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.form
        id="save-scene"
        className="vu-scene-panel vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Save this scene"
        variants={panelUnderTab}
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        {...primaryProps}
      >
        <TitleTab>Save this scene?</TitleTab>

        <p className="vu-note-text">You'll be able to replay it later via the Load scene option.</p>

        <TextField
          id="save-scene-name"
          label="Name"
          value={name}
          onChange={setName}
          placeholder={defaultName}
          maxLength={SCENE_NAME_MAX}
          autoFocus
        />

        <div className="vu-foot">
          <motion.button
            id="save-scene-discard"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(saving, quietLift, quietPress)}
            disabled={saving}
            onClick={onDiscard}
          >
            Don&apos;t save
          </motion.button>
          <motion.button
            id="save-scene-save"
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            type="submit"
            {...gestures(saving, lift, press)}
            disabled={saving}
          >
            Save
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}
