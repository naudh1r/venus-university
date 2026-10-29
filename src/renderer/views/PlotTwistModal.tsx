import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { PLOT_TWIST_LIMIT, PLOT_TWIST_MOD } from '../../shared/plotTwists'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn, useModalShell, useModOn, useSafePoint, type ScreenTheme } from '@vx/modkit/renderer'
import { beginPlotTwistEdit, plotTwist, plotTwistEditor, writePlotTwist } from '../stores/plotTwist'
import '../vu_styles/PlotTwist.css'

/** A save-owned direction editor. The GameView panel blocks scene input underneath it. */
export function PlotTwistModal({ theme, onClose }: {
  theme: ScreenTheme
  onClose: () => void
}): JSX.Element | null {
  const saved = plotTwist.use()
  const currentOwner = plotTwistEditor.use()
  const saveOffer = useSafePoint()
  const enabled = useModOn(PLOT_TWIST_MOD)
  const owner = useRef<object | null>(null)
  const previous = useRef(saved)
  const [text, setText] = useState(saved)
  useEffect(() => {
    const token = beginPlotTwistEdit()
    owner.current = token
    previous.current = plotTwist.read()
    setText(previous.current)
    return () => { if (plotTwistEditor.get() === token) plotTwistEditor.set(null) }
  }, [])
  const [pending, setPending] = useState(false)
  const writing = useRef(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const sameGame = owner.current !== null && owner.current === currentOwner
  const available = enabled && sameGame && saveOffer === 'open' && !pending
  const invalid = text.length > PLOT_TWIST_LIMIT
  const changed = text.trim() !== saved
  const applyDead = !available || invalid || !changed
  const clearDead = !available || !saved
  const close = (): void => { if (!writing.current) onClose() }
  const { host, overlayProps } = useModalShell(close)

  async function apply(value: string): Promise<void> {
    if (writing.current || !available || !owner.current) return
    writing.current = true
    setPending(true)
    setError('')
    setStatus('')
    try {
      const result = await writePlotTwist(value, owner.current, previous.current)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      previous.current = value.trim()
      setText(value.trim())
      setStatus(value.trim() ? 'Saved. Your next scene request will include this direction.' : 'Cleared. Future scene requests will no longer include a twist.')
    } finally {
      writing.current = false
      setPending(false)
    }
  }

  if (!host) return null
  return createPortal(
    <motion.div className="vu-veil" data-theme={theme} variants={veilIn}
      initial="hidden" animate="shown" exit="gone" {...overlayProps}>
      <motion.form className="vu-plot-twist vu-paper" role="dialog" aria-modal="true"
        aria-label="Plot Twist" aria-busy={pending} variants={panelUnderTab}
        onSubmit={(event) => { event.preventDefault(); if (!applyDead) void apply(text) }}
        onKeyDown={(event) => { if (event.key === 'Enter') event.stopPropagation() }}>
        <TitleTab>Plot Twist</TitleTab>
        <p className="vu-plot-twist-hint">
          Give the story a new direction. It guides future scenes without changing stats,
          relationships, or events already narrated. Characters learn secrets through the story.
          Keep it brief: the active text is included in each new scene request.
        </p>
        <TextField id="plot-twist-text" label="Ongoing story direction" value={text}
          onChange={(value) => { setText(value); setStatus(''); setError('') }} multiline rows={7}
          maxLength={PLOT_TWIST_LIMIT} disabled={pending || !enabled || !sameGame} autoFocus
          placeholder="A scholarship review is approaching, and the reader must improve his grades to stay enrolled." />
        <p className="vu-plot-twist-count">{text.length.toLocaleString()} / {PLOT_TWIST_LIMIT.toLocaleString()} characters</p>
        <p className="vu-plot-twist-status" role={error ? 'alert' : 'status'}>
          {error || (!sameGame ? 'The loaded game changed. Close and reopen this editor.'
            : !enabled ? 'Plot Twist is off. Your saved text is kept.'
            : pending ? 'Saving…'
            : invalid ? 'This saved twist exceeds the editing limit. Shorten it before applying.'
            : !available ? 'Wait for the scene to settle before applying changes.'
            : status || 'Applying or clearing writes an autosave. Each save keeps its own twist.')}
        </p>
        <div className="vu-foot">
          <motion.button className="vu-btn vu-btn--quiet" type="button" disabled={pending}
            {...gestures(pending, quietLift, quietPress)} onClick={close}>Back</motion.button>
          <motion.button className="vu-btn vu-btn--quiet" type="button" disabled={clearDead}
            {...gestures(clearDead, quietLift, quietPress)} onClick={() => void apply('')}>Clear twist</motion.button>
          <motion.button className="vu-btn vu-btn--primary vu-btn--panel vu-paper" type="submit"
            disabled={applyDead} {...gestures(applyDead, lift, press)}>Apply twist</motion.button>
        </div>
      </motion.form>
    </motion.div>, host
  )
}
