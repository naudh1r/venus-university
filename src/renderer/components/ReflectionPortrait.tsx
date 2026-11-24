import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { DEFAULT_REFLECTION_STAGE, reflectionStageOf, reflectionStageTransform, type ReflectionStage, type ReflectionArtSource } from '@shared/reflectionPortrait'
import { useModOn } from '../stores/modsStore'
import { spriteUrl, useSpriteVersion } from '../stores/characterStore'
import { useModalShell } from './useModalShell'
import { Lightbox } from './Lightbox'
import { SelectField } from './SelectField'
import { DownloadIcon, UploadIcon } from '../views/screenIcons'
import '../vu_styles/ReflectionPortrait.css'

const versions = create(() => ({ art: 0, stage: 0 }))
export function useReflectionPortrait(charId: string): string | null {
 const revision = versions(s => s.art), [image, setImage] = useState<string | null>(null)
 useEffect(() => {
  let live = true; setImage(null)
  if (charId && window.api.echo?.reflectionRead) void window.api.echo.reflectionRead(charId).then(r => { if (live && r.ok) setImage(r.data) }).catch(() => {})
  return () => { live = false }
 }, [charId, revision])
 return image
}
export function useReflectionStage(charId: string): ReflectionStage {
 const revision = versions(s => s.stage), [stage, setStage] = useState(DEFAULT_REFLECTION_STAGE)
 useEffect(() => {
  let live = true; setStage(DEFAULT_REFLECTION_STAGE)
  if (charId && window.api.echo?.reflectionStageRead) void window.api.echo.reflectionStageRead(charId).then(r => { if (live && r.ok) setStage(reflectionStageOf(r.data)) }).catch(() => {})
  return () => { live = false }
 }, [charId, revision])
 return stage
}

/** A compact doorway on the character sheet; generation and staging have their own screen. */
export function ReflectionPortraitControl({ charId, name, theme, height = 1 }: { charId: string; name: string; height?: number; theme: 'day' | 'night' }): JSX.Element | null {
 const on = useModOn('reckoning'), [open, setOpen] = useState(false)
 if (!on) return null
 return <div className="vu-reflection-entry">
  <button type="button" className="vu-btn vu-btn--outline vu-paper" onClick={() => setOpen(true)}>Unheard Soul</button>
  <span>Unheard Soul artwork &amp; position</span>
  {open && <ReflectionPortraitEditor key={charId} charId={charId} name={name} theme={theme} height={height} onClose={() => setOpen(false)}/>}
 </div>
}

function ReflectionPortraitEditor({ charId, name, theme, height, onClose }: { charId: string; name: string; height: number; theme: 'day' | 'night'; onClose: () => void }): JSX.Element | null {
 const image = useReflectionPortrait(charId), version = useSpriteVersion(charId)
 const [stage, setStage] = useState(DEFAULT_REFLECTION_STAGE), [saved, setSaved] = useState(DEFAULT_REFLECTION_STAGE)
 const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false)
 const [fullImage, setFullImage] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
 const [preview, setPreview] = useState<'portrait' | 'scene'>('portrait')
 const [artSource, setArtSource] = useState<ReflectionArtSource>('api')
 const [discard, setDiscard] = useState(false), request = useRef<string | null>(null), live = useRef(true)
 const dirty = JSON.stringify(stage) !== JSON.stringify(saved)
 const close = (): void => { if (fullImage) { setFullImage(false); return }; if (busy || saving) return; if (dirty) setDiscard(true); else onClose() }
 const { host, overlayProps } = useModalShell(close)
 useEffect(() => {
  live.current = true
  const read = window.api.echo?.reflectionStageRead
  if (read) void read(charId).then(r => {
   if (!live.current) return
   if (!r.ok) { setError(r.error.message); return }
   const value = reflectionStageOf(r.data); setStage(value); setSaved(value); setLoaded(true)
  }).catch(e => { if (live.current) setError(e instanceof Error ? e.message : 'Could not load the position.') })
  return () => { live.current = false; if (request.current) void window.api.echo?.cancel(request.current) }
 }, [charId])
 const generate = async (): Promise<void> => {
  if (busy || !window.api.echo?.reflectionGenerate) return
  const id = crypto.randomUUID(); request.current = id; setBusy(true); setError(''); setMessage('')
  try {
   const r = await window.api.echo.reflectionGenerate(charId, id, artSource)
   if (!r.ok) throw Error(r.error.message)
   versions.setState(s => ({ art: s.art + 1 }))
   if (live.current) setMessage('Unheard Soul artwork saved. Your position settings are kept.')
  } catch (e) { if (live.current) setError(e instanceof Error ? e.message : 'Could not generate the portrait.') }
  finally { request.current = null; if (live.current) setBusy(false) }
 }
 const save = async (): Promise<void> => {
  if (!loaded || saving || !window.api.echo?.reflectionStageSave) return
  setSaving(true); setError(''); setMessage('')
  try {
   const r = await window.api.echo.reflectionStageSave(charId, stage)
   if (!r.ok) throw Error(r.error.message)
   setSaved(r.data); setStage(r.data); setDiscard(false); setMessage('Position saved for this character’s Unheard Soul.')
   versions.setState(s => ({ stage: s.stage + 1 }))
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the position.') }
  finally { setSaving(false) }
 }
 const resetImage = async (): Promise<void> => {
  if (!window.api.echo?.reflectionReset || busy || saving) return
  setSaving(true); setError(''); setMessage('')
  try {
   const r = await window.api.echo.reflectionReset(charId)
   if (!r.ok) throw Error(r.error.message)
   setFullImage(false); versions.setState(s => ({ art: s.art + 1 }))
   setMessage('Default inverted portrait restored. Your position settings are kept.')
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not restore the default portrait.') }
  finally { setSaving(false) }
 }
 const imageAction = async (kind: 'upload' | 'export'): Promise<void> => {
  const action = kind === 'upload' ? window.api.echo?.reflectionUpload : window.api.echo?.reflectionExport
  if (!action || busy || saving) return
  setSaving(true); setError(''); setMessage('')
  try {
   const r = await action(charId)
   if (!r.ok) throw Error(r.error.message)
   if (r.data) {
    if (kind === 'upload') versions.setState(s => ({ art: s.art + 1 }))
    setMessage(kind === 'upload' ? 'Unheard Soul artwork uploaded. Its position is unchanged.' : 'Unheard Soul image downloaded as a PNG.')
   }
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the image.') }
  finally { setSaving(false) }
 }
 if (!host) return null
 return createPortal(<div className="vu-veil vu-reflection-editor-veil" data-theme={theme} {...overlayProps}>
  <section className="vu-reflection-editor vu-paper" role="dialog" aria-modal="true" aria-label={`Unheard Soul · ${name}`}>
   <header><div><small>{name}</small><h1>Unheard Soul</h1><p>Customize the appearance of her Unheard Soul.</p></div><button type="button" aria-label="Close Unheard Soul editor" className="vu-btn vu-btn--quiet" disabled={busy || saving} onClick={close}>×</button></header>
   <div className="vu-reflection-editor-body">
    <section className="vu-reflection-preview-column" aria-label="Unheard Soul preview">
     <div className="vu-reflection-preview-modes" role="group" aria-label="Preview view">
      <button type="button" className={`vu-btn vu-paper ${preview === 'portrait' ? 'vu-btn--primary' : 'vu-btn--outline'}`} aria-pressed={preview === 'portrait'} onClick={() => setPreview('portrait')}>Full portrait</button>
      <button type="button" className={`vu-btn vu-paper ${preview === 'scene' ? 'vu-btn--primary' : 'vu-btn--outline'}`} aria-pressed={preview === 'scene'} onClick={() => setPreview('scene')}>Scene preview</button>
     </div>
     <div className="vu-reflection-viewport" data-preview={preview}>
      {preview === 'portrait' ? <button type="button" className="vu-reflection-full-preview" aria-label="View full Unheard Soul image" disabled={!image} onClick={() => setFullImage(true)}>
       <img className={image ? '' : 'vu-reflection-fallback'} src={image || spriteUrl(charId, 'neutral', version)} alt={`Unheard Soul of ${name}`}/>
       <span>{image ? 'View full image' : 'Inverted portrait preview'}</span>
      </button> : <div className="vu-reflection-preview" role="img" aria-label={`Unheard Soul scene preview of ${name}`}>
       <img className="vu-reflection-preview-bg" src="./echo-dungeons/horizonbound.webp" alt=""/>
       <div className="vu-reflection-scene-anchor" style={{ '--reflection-height': height } as CSSProperties}><img className={`vu-reflection-stage-image${image ? '' : ' vu-reflection-fallback'}`} src={image || spriteUrl(charId, 'neutral', version)} alt="" style={{ transform: reflectionStageTransform(stage) }}/></div>
       <div className="vu-reflection-preview-dialogue">Conversation appears here</div>
      </div>}
     </div>
     <div className="vu-reflection-actions vu-reflection-image-actions">
      <button type="button" className="vu-btn vu-btn--outline" disabled={!image || busy || saving || !window.api.echo?.reflectionExport} onClick={() => void imageAction('export')}><DownloadIcon size={16}/> Download image</button>
      <button type="button" className="vu-btn vu-btn--outline" disabled={busy || saving || !window.api.echo?.reflectionUpload} onClick={() => void imageAction('upload')}><UploadIcon size={16}/> Upload image</button>
      <button type="button" className="vu-btn vu-btn--outline" disabled={!image || busy || saving || !window.api.echo?.reflectionReset} onClick={() => void resetImage()}>Restore default</button>
     </div>
     <p>{preview === 'scene' ? 'Preview your dungeon position here, then save it when you’re ready.' : image ? 'Click the portrait to view the full image.' : 'Your default inverted portrait. Generate or upload separate artwork whenever you’re ready.'}</p>
    </section>
    <section className="vu-reflection-settings">
     <h2>Inner-world portrait position</h2><p>These controls position her Unheard Soul in The Unspoken. During the questions, her portrait always uses the default position and size. Her normal portrait and Echo keep their own settings.</p>
     <fieldset disabled={!loaded || saving}>
      {(['x', 'y', 'scale'] as const).map(key => <label key={key} htmlFor={`reflection-${key}`}><span>{key === 'x' ? 'Horizontal position' : key === 'y' ? 'Vertical position' : 'Size'}<output>{key === 'scale' ? Math.round(stage[key] * 100) : stage[key]}%</output></span><input id={`reflection-${key}`} type="range" min={key === 'scale' ? .25 : -100} max={key === 'scale' ? 2 : 100} step={key === 'scale' ? .01 : 1} value={stage[key]} onChange={e => { setStage(s => ({ ...s, [key]: Number(e.target.value) })); setPreview('scene'); setMessage(''); setDiscard(false) }}/></label>)}
      <p className="vu-reflection-help">Left / right, up / down, and size. Position is saved separately for each character and shared across her local playthroughs.</p>
      <div className="vu-reflection-actions"><button type="button" className="vu-btn vu-btn--primary vu-paper" disabled={!dirty || busy} onClick={() => void save()}>{saving ? 'Saving…' : 'Save position'}</button><button type="button" className="vu-btn vu-btn--outline" onClick={() => { setStage({ ...DEFAULT_REFLECTION_STAGE }); setPreview('scene'); setMessage(''); setDiscard(false) }}>Reset position</button></div>
     </fieldset>
     <h2>Unheard Soul artwork</h2><p>Uses her saved character details and neutral portrait as a reference. Save character edits before generating.</p>
     <SelectField id="reflection-art-source" label="Generate with" value={artSource}
      onChange={value => setArtSource(value as ReflectionArtSource)} disabled={busy || saving || !window.api.echo?.reflectionGenerate}
      options={[{ value: 'api', label: 'Configured image API' }, { value: 'local', label: 'Local ComfyUI' }]}/>
     <p>{artSource === 'local'
      ? 'Uses the server and models selected in Settings → ComfyUI. Set up ComfyUI there first. No image API call is made. Her reference portrait is sent to that server; results depend on its models.'
      : 'Uses your configured image API and may incur a charge.'}</p>
     <button type="button" className="vu-btn vu-btn--primary vu-paper" disabled={busy || saving || !window.api.echo?.reflectionGenerate} onClick={() => void generate()}>{busy ? 'Generating portrait…' : image ? 'Regenerate Unheard Soul portrait' : 'Generate Unheard Soul portrait'}</button>
     {busy && <button type="button" className="vu-btn vu-btn--outline" onClick={() => { if (request.current) void window.api.echo?.cancel(request.current) }}>Cancel generation</button>}
     {!window.api.echo?.reflectionStageRead && <p>Unheard Soul editing is available in the desktop prototype.</p>}
     {error && <p role="alert">{error}</p>}<p role="status">{message}</p>
    </section>
   </div>
   <footer>{discard && <div role="alert">You have unsaved position changes. <button type="button" className="vu-btn vu-btn--outline" onClick={onClose}>Discard changes &amp; return</button></div>}<button type="button" className="vu-btn vu-btn--primary vu-paper" disabled={busy || saving} onClick={close}>Back to character</button></footer>
  </section>
  {fullImage && image && <Lightbox src={image} onClose={() => setFullImage(false)}/>}
 </div>, host)
}
