import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { openPanel, useModalShell, TitleTab, veilIn, panelUnderTab, currentRun, runStale, useScene, type SceneSeatProps, type GameModalProps } from '@vx/modkit/renderer'
import { SCENE_NOTES, DOCUMENT_LIMIT, DOCUMENT_LIMIT_LABEL, DOCUMENT_SIZE_ERROR, fitsDocumentLimit, readSceneDocument } from '../../shared/sceneNotes'
import { notesAvailable, useNotesAvailable } from './host'
import { readStoredSceneNotes, saveSceneNotes } from './state'
import './style.css'
export const NotesIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></svg>
export function NotesSeat({ Seat, visible }: SceneSeatProps) {
  const available = useNotesAvailable()
  const dead = useScene(view => view?.busy ?? true)
  return <Seat label="Shared document" state={!available || !visible ? 'gone' : dead ? 'dim' : 'shown'} onClick={() => { if (!dead && notesAvailable()) openPanel(SCENE_NOTES) }}><NotesIcon/></Seat>
}
export function SceneNotes({ theme, onClose }: GameModalProps): JSX.Element | null {
  const [document, setDocument] = useState(readStoredSceneNotes)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [run] = useState(currentRun)
  const shell = useModalShell(onClose)
  async function save() {
    if (runStale(run)) { onClose(); return }
    setBusy(true)
    const result = await saveSceneNotes(document)
    setBusy(false)
    if (result.ok) onClose(); else setError(result.error.message)
  }
  if (!shell.host) return null
  return createPortal(<motion.div className="vu-veil" data-theme={theme} variants={veilIn} initial="hidden" animate="shown" exit="gone" {...shell.overlayProps}>
    <motion.section className="vu-shared-document vu-paper" role="dialog" aria-modal="true" aria-label="Shared document" variants={panelUnderTab} onKeyDown={e => e.stopPropagation()}>
      <TitleTab>Shared document</TitleTab><button className="shared-document-close" aria-label="Close Shared document" onClick={onClose}>×</button>
      <div className="shared-document-work">
        <div className="shared-document-notes"><label>Share a document <small>.md or .txt · UTF-8 · up to {DOCUMENT_LIMIT_LABEL}</small>
          <input aria-label="Attach notes" type="file" accept=".md,.txt,text/plain,text/markdown" disabled={busy} onClick={e => { e.currentTarget.value = '' }} onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return
            setBusy(true)
            try {
              if (file.size > DOCUMENT_LIMIT) throw Error(DOCUMENT_SIZE_ERROR)
              const next = readSceneDocument(file.name, new Uint8Array(await file.arrayBuffer()))
              if (runStale(run)) return
              setDocument(next); setError('')
            } catch (err) { setError((err as Error).message) }
            finally { setBusy(false) }
          }}/></label>
          {document && <p role="status"><b>{document.name}</b><button disabled={busy} onClick={() => setDocument(null)}>Remove</button></p>}
          {document && (fitsDocumentLimit(document)
            ? <small>Roughly {Math.ceil(document.text.length / 4).toLocaleString()} tokens per request. The count varies by model and language.</small>
            : <p role="status">This saved document exceeds {DOCUMENT_LIMIT_LABEL}. It stays in your save. Choose a smaller file to share it again.</p>)}
          <p>The characters in this scene can use the active document while studying or sharing your laptop.</p>
        </div>
        {error && <p role="alert" className="shared-document-error">{error}</p>}
        <div className="shared-document-actions"><button disabled={busy} onClick={() => void save()}>Use these notes</button></div>
        <small className="shared-document-disclosure">Your configured AI provider receives the full active document with every scene request, including the closing.</small>
      </div>
    </motion.section>
  </motion.div>, shell.host)
}
