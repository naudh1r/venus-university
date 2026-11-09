import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { openPanel, useModalShell, TitleTab, veilIn, panelUnderTab, currentRun, runStale, useScene, type SceneSeatProps, type GameModalProps } from '@vx/modkit/renderer'
import { SCENE_NOTES, DOCUMENT_LIMIT, readSceneDocument } from '../../shared/sceneNotes'
import { notesAvailable, useNotesAvailable } from './host'
import { readSceneNotes, saveSceneNotes } from './state'
import './style.css'
export const NotesIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></svg>
export function NotesSeat({ Seat, visible }: SceneSeatProps) {
  const available = useNotesAvailable()
  const dead = useScene(view => view?.busy ?? true)
  return <Seat label="Scene notes" state={!available || !visible ? 'gone' : dead ? 'dim' : 'shown'} onClick={() => { if (!dead && notesAvailable()) openPanel(SCENE_NOTES) }}><NotesIcon/></Seat>
}
export function SceneNotes({ theme, onClose }: GameModalProps): JSX.Element | null {
  const [document, setDocument] = useState(readSceneNotes)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [run] = useState(currentRun)
  const shell = useModalShell(onClose)
  async function apply(document: ReturnType<typeof readSceneNotes>) {
    if (runStale(run)) { onClose(); return }
    setBusy(true)
    try {
      const result = await saveSceneNotes(document)
      if (runStale(run)) return
      if (result.ok) { setDocument(document); setError('') }
      else setError(result.error.message)
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  if (!shell.host) return null
  return createPortal(<motion.div className="vu-veil" data-theme={theme} variants={veilIn} initial="hidden" animate="shown" exit="gone" {...shell.overlayProps}>
    <motion.section className="vu-study-room vu-paper" role="dialog" aria-modal="true" aria-label="Scene notes" variants={panelUnderTab} onKeyDown={e => e.stopPropagation()}>
      <TitleTab>Scene notes</TitleTab><button className="study-close" aria-label="Close Scene notes" onClick={onClose}>×</button>
      <div className="study-work">
        <div className="study-notes"><label>Share a document <small>.md or .txt · UTF-8 · up to 2 MB</small>
          <input aria-label="Attach notes" type="file" accept=".md,.txt,text/plain,text/markdown" disabled={busy} onClick={e => { e.currentTarget.value = '' }} onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return
            setBusy(true)
            try {
              if (file.size > DOCUMENT_LIMIT) throw Error('Choose a file up to 2 MB.')
              const next = readSceneDocument(file.name, new Uint8Array(await file.arrayBuffer()))
              if (runStale(run)) return
              await apply(next)
            } catch (err) { setError((err as Error).message) }
            finally { setBusy(false) }
          }}/></label>
          {document && <p role="status"><b>{document.name}</b> · Active in this scene<button disabled={busy} onClick={() => void apply(null)}>Remove</button></p>}
          <p>The full document is shared with everyone in this scene and used automatically when sharing your laptop.</p>
        </div>
        {error && <p role="alert" className="study-error">{error}</p>}
        <div className="study-actions"><button disabled={busy} onClick={onClose}>Done</button></div>
        <small className="study-disclosure">Your document goes to your configured AI provider with the conversation.</small>
      </div>
    </motion.section>
  </motion.div>, shell.host)
}
