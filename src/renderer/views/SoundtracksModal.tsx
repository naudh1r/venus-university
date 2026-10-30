import { useEffect, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { isSoundtrackKey, SOUNDTRACK_LABELS, SOUNDTRACK_MOD, type SoundtrackKey } from '../../shared/soundtracks'
import { toAppError } from '@shared/errors'
import { CheckField } from '../components/CheckField'
import { ConfirmModal } from '../components/ConfirmModal'
import { gestures, panelUnderTab, quietLift, quietPress, veilIn, useModalShell, useModOn, SelectField, TitleTab } from '@vx/modkit/renderer'
import { useAudioStore } from '../stores/audioStore'
import { useSoundtrackStore } from '../stores/soundtrackStore'
import type { ScreenTheme } from '@vx/modkit/renderer'
import '../vu_styles/Soundtracks.css'

const options = Object.entries(SOUNDTRACK_LABELS).map(([value, label]) => ({ value, label }))

/** Assignments save immediately; the main Settings form has no draft of this library. */
export function SoundtracksModal({ theme, onClose }: { theme: ScreenTheme; onClose: () => void }): JSX.Element | null {
  const state = useSoundtrackStore()
  const enabled = useModOn(SOUNDTRACK_MOD)
  const [key, setKey] = useState<SoundtrackKey>('landing_day')
  const [cleaning, setCleaning] = useState(false)
  const [now, setNow] = useState('')
  const [previewError, setPreviewError] = useState('')
  const stop = (): void => useAudioStore.getState().stopSoundtrackPreview()
  const close = (): void => { if (!state.busy) { stop(); onClose() } }
  const { host, overlayProps } = useModalShell(close)
  const item = state.map[key]
  const blocked = state.busy || !enabled

  useEffect(() => { void useSoundtrackStore.getState().load() }, [])
  useEffect(() => {
    const update = (): void => {
      const cues = Object.values(useAudioStore.getState().currentMusic())
        .filter((cue): cue is SoundtrackKey => Boolean(cue && isSoundtrackKey(cue)))
      setNow(cues.map(cue => SOUNDTRACK_LABELS[cue]).join(' + ') || 'No music cue')
    }
    update()
    const timer = setInterval(update, 500)
    return () => { clearInterval(timer); stop() }
  }, [])
  useEffect(() => { stop(); setPreviewError('') }, [key, enabled])
  if (!host) return null

  return createPortal(<>
    <motion.div className="vu-veil" data-theme={theme} variants={veilIn} initial="hidden" animate="shown" exit="gone" {...overlayProps}>
      <motion.section className="vu-soundtracks vu-paper" role="dialog" aria-modal="true" aria-label="Custom soundtracks" variants={panelUnderTab} onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation() }}>
        <TitleTab>Custom soundtracks</TitleTab>
        <div className="vu-soundtracks-body">
          <p className="vu-soundtracks-intro">Give university life a soundtrack of your own.</p>
          <p>Choose local MP3, OGG or WAV files. Imported copies are kept with the game’s data and apply to every playthrough.</p>
          <div className="vu-soundtracks-cue"><span>Current cue</span><strong>{now}</strong></div>
          {!enabled && <p role="status">Enable Custom soundtracks in Mods to use these choices. Your imported tracks are kept.</p>}
          <fieldset className="vu-soundtracks-fields" disabled={state.busy}>
            <SelectField id="soundtrack-slot" label="Game track" value={key} options={options} onChange={value => { if (isSoundtrackKey(value)) setKey(value) }} />
            <div className="vu-soundtracks-file">
              <span className="vu-field-label">Selected audio</span>
              <strong>{item?.name ?? (key==='reckoning_dungeon'?'Rise from the Dark':'Original game music')}</strong>
            </div>
            <CheckField id="soundtrack-loop" label="Loop replacement" note="When off, the replacement plays once when this cue starts. It can play again after the game leaves this cue and returns." checked={item?.loop !== false} disabled={blocked || !item} onChange={value => void state.loop(key, value)} />
            <div className="vu-soundtracks-actions">
              <motion.button className="vu-pill" type="button" disabled={blocked} {...gestures(blocked, quietLift, quietPress)} onClick={() => { stop(); void state.choose(key) }}>{state.busy ? 'Working…' : 'Choose audio file'}</motion.button>
              <motion.button className="vu-pill" type="button" disabled={blocked || !item} {...gestures(blocked || !item, quietLift, quietPress)} onClick={() => void state.remove(key)}>Restore original</motion.button>
              <motion.button className="vu-pill" type="button" disabled={blocked} {...gestures(blocked, quietLift, quietPress)} onClick={() => { setPreviewError(''); void useAudioStore.getState().previewSoundtrack(key).catch(error => setPreviewError(toAppError(error).message)) }}>Preview · 10 seconds</motion.button>
              <motion.button className="vu-pill" type="button" {...gestures(false, quietLift, quietPress)} onClick={stop}>Stop preview</motion.button>
            </div>
          </fieldset>
          <p className="vu-soundtracks-help">Up to 50 MB and 20 minutes per track. Changes save immediately. Music follows the Music volume; venue songs follow Ambience, including the game’s venue effects.</p>
          <p className="vu-soundtracks-status" role="status" aria-live="polite">{previewError || state.errors[key] || state.message}</p>
          <motion.button className="vu-pill" type="button" disabled={blocked} {...gestures(blocked, quietLift, quietPress)} onClick={() => setCleaning(true)}>Clean up unused imports</motion.button>
        </div>
        <div className="vu-foot">
          <motion.button className="vu-btn vu-btn--quiet" type="button" disabled={state.busy} {...gestures(state.busy, quietLift, quietPress)} onClick={close}>Done</motion.button>
        </div>
      </motion.section>
    </motion.div>
    <AnimatePresence propagate>{cleaning && <ConfirmModal key="soundtrack-cleanup" id="soundtrack-cleanup" theme={theme} title="Clean up imports?" message="Delete imported copies that are no longer assigned to a game track. Assigned tracks and your original files stay where they are." confirmText="Clean up" cancelText="Cancel" onCancel={() => setCleaning(false)} onConfirm={() => { setCleaning(false); void state.cleanup() }} />}</AnimatePresence>
  </>, host)
}
