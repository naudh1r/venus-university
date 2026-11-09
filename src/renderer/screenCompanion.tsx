import { companionSurface } from './companionSurface'
import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { companionOverlayLayout, rapidFps, COMPANION_MODES, type CompanionApi, type CompanionMode, type CompanionState } from '../shared/screenCompanion'
import { EMOTIONS, type Emotion } from '../shared/screenCompanion'
import type { Result } from '@vx/modkit/shared'
import { CompanionVoiceSettings } from './CompanionVoiceSettings'
import { CompanionTabs } from './CompanionTabs'
import { CompanionSpeech } from './CompanionSpeech'
import { useCompanionCapture } from './companionCapture'
import { CompanionMoveHandle } from './CompanionMoveHandle'
import { useCompanionMicrophone, useCompanionPlayback } from './companionMedia'
import '@fontsource/young-serif/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/space-mono/latin-400.css'
import './vu_styles/ScreenCompanion.css'

declare global { interface Window { companion: CompanionApi } }

const overlayMode = new URLSearchParams(location.search).get('mode') === 'overlay'
const overlaySlot = Number(new URLSearchParams(location.search).get('slot') ?? 0)
const chatMode = new URLSearchParams(location.search).get('mode') === 'chat'
document.documentElement.classList.toggle('companion-overlay', overlayMode)
const api = companionSurface
window.companion = api
async function unwrap<T>(result: Promise<Result<T>>): Promise<T> {
  const value = await result
  if (!value.ok) throw new Error(value.error.message)
  return value.data
}

function Companion(): JSX.Element {
  const [state, setState] = useState<CompanionState | null>(null)
  const [error, setError] = useState('')
  const [screenshotDelay,setScreenshotDelay]=useState(5)
  const [characters, setCharacters] = useState<{ charId: string; name: string; onScreen: boolean }[]>([])
  const [sources, setSources] = useState<{ id: string; name: string }[]>([])
  const [charIds, setCharIds] = useState<string[]>([])
  const [sourceId, setSourceId] = useState('')
  const [interval, setIntervalSeconds] = useState(20)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<CompanionMode>('hangout')
  const [tab, setTab] = useState<'share' | 'chat' | 'appearance' | 'voices'>('share')
  const [coachingContext, setCoachingContext] = useState('')
  const [pending, setPending] = useState(false)
  const [emotion, setEmotion] = useState<Emotion>('neutral')
  const [missing, setMissing] = useState(false)
  const [log, setLog] = useState<{ name: string; text: string }[]>([])
  const lastSequence = useRef(0)
  const lastRevision = useRef(-1)
  const input = useRef<HTMLTextAreaElement>(null)
  const member = state?.members[overlaySlot]
  useCompanionCapture(api, !overlayMode && !chatMode)
  useCompanionPlayback(api, chatMode)
  const microphone = useCompanionMicrophone(api, state, !overlayMode && (chatMode || tab === 'chat'), text => { setDraft(previous => previous ? `${previous}\n${text}` : text); input.current?.focus() }, setError)

  const perform = async (work: () => Promise<unknown>): Promise<void> => {
    setError(''); setPending(true)
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'The companion could not complete that action.') }
    finally { setPending(false) }
  }
  const refreshSources = async (): Promise<void> => setSources(await unwrap(api.sources()))

  useEffect(() => {
    const accept = (next: CompanionState): void => {
      if (next.revision < lastRevision.current) return
      lastRevision.current = next.revision
      setState(next)
      if (!overlayMode && next.text && next.lineSequence > lastSequence.current) {
        setLog(previous => [...previous, { name: next.name, text: next.text }].slice(-40))
      }
      lastSequence.current = next.lineSequence

    }
    const off = api.onState(accept)
    void unwrap(api.state()).then(accept).catch(e => setError(String(e.message)))
    if (!overlayMode && !chatMode) {
      void perform(async () => {
        const people = await unwrap(api.characters())
        setCharacters(people)
        const onScreen = people.filter(person => person.onScreen).slice(0, 3)
        setCharIds((onScreen.length ? onScreen : people.slice(0, 1)).map(person => person.charId))
        await refreshSources()
      })
    }
    return off
  }, [])

  useEffect(() => {
    if (!chatMode) return
    const focus = (): void => { input.current?.focus() }
    const off = api.onChatFocus(focus)
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') void api.chat(false)
    }
    window.addEventListener('keydown', key)
    focus()
    return () => { off(); window.removeEventListener('keydown', key) }
  }, [])

  useEffect(() => { setMissing(false) }, [member?.charId, member?.emotion])
  useEffect(() => {
    if (state) { setMode(state.mode); setCoachingContext(state.coachingContext); setIntervalSeconds(state.interval) }
  }, [state?.mode, state?.coachingContext, state?.interval])

  if (overlayMode) {
    const layout = companionOverlayLayout(state?.size ?? 520, state?.messageSize ?? 100, Boolean(state && rapidFps(state.mode, state.interval)))
    const style = { '--message-scale': layout.scale, '--message-padding': `${layout.padding}px`, '--sprite-width': `${layout.characterWidth}px` } as CSSProperties
    return <main className={`companion-body${state && rapidFps(state.mode, state.interval) ? ' companion-rapid' : ''}`} style={style} aria-label="Desktop companion">
      <CompanionMoveHandle api={api} enabled={Boolean(state?.clickThrough && member)} />
      <CompanionSpeech member={member} rapid={Boolean(state && rapidFps(state.mode, state.interval))} sceneId={state?.sceneId} />
      {member?.charId && <img className="companion-sprite" draggable={false}
        src={member.sprites?.[missing ? 'neutral' : member.emotion]}
        alt={`${member.name}, ${missing ? 'neutral' : member.emotion}`}
        onError={() => { if (!missing) setMissing(true) }} />}
    </main>
  }

  const sharing = Boolean(state?.sharing)
  const busy = Boolean(state?.busy) || pending
  const conversation = <section className="companion-card companion-conversation"><h2>{state?.members.length ? state.members.map(member => member.name.split(' ')[0]).join(' · ') : 'A word between you'}</h2>
    {state?.documentName && <p className="companion-hint">Notes available: {state.documentName}</p>}
    {chatMode && <p className="companion-hint">{COMPANION_MODES[state?.mode ?? 'hangout'].label} · {state?.conversationPaused && sharing ? 'Chat paused' : sharing ? 'Laptop shared' : 'Sharing paused'}</p>}
    {chatMode && state?.text && <p className="companion-latest" role="status"><strong>{state.name}</strong> {state.text}</p>}
    <form onSubmit={e => { e.preventDefault(); if (!sharing || state?.conversationPaused || busy || microphone.phase !== 'idle' || !draft.trim()) return; void perform(async () => {
      const text = draft.trim()
      await unwrap(api.comment(text))
      setDraft(''); setLog(previous => [...previous, { name: 'You', text }].slice(-40)); input.current?.focus()
    }) }}>
      <label>Your message<textarea ref={input} value={draft} maxLength={2000} rows={2}
        onChange={e => setDraft(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit() }
        }} placeholder={mode === 'fps' ? 'I’m playing support. How is our team comp?' : 'What do you think?'} /></label>
      <div className="companion-actions"><button disabled={!sharing || state?.conversationPaused || busy || microphone.phase !== 'idle' || !draft.trim()}>{busy ? 'Listening to them…' : 'Send'}</button>
        {state?.voice.input === 'whisper' ? <>
          <button type="button" className="companion-quiet" disabled={microphone.phase === 'requesting' || microphone.phase === 'transcribing' || (state.recording && microphone.phase === 'idle')} onClick={() => {
            setError(''); if (microphone.phase === 'recording') microphone.stop(); else void microphone.start()
          }}>{microphone.phase === 'recording' ? 'Stop & transcribe' : microphone.phase === 'transcribing' ? 'Transcribing…' : microphone.phase === 'requesting' ? 'Opening microphone…' : 'Speak · Whisper'}</button>
          {microphone.phase !== 'idle' && <button type="button" className="companion-quiet" onClick={microphone.cancel}>Cancel recording</button>}
        </> : <button type="button" className="companion-quiet" title="Windows voice typing uses your microphone. Stop with Windows+H or its microphone button. Review before sending." onClick={() => { input.current?.focus(); void perform(() => unwrap(api.dictate())) }}>Speak · Win+H</button>}
        {chatMode && <button type="button" className="companion-quiet" onClick={() => void api.chat(false)}>Hide · Esc</button>}
      </div>
    </form>
    {mode === 'fps' && <div className="companion-actions companion-prompts">{['How is our comp?', 'One tip for the next fight', 'What should I improve?'].map(text => <button key={text} className="companion-quiet" onClick={() => { setDraft(text); input.current?.focus() }}>{text}</button>)}</div>}
    <p className="companion-hint">Enter to send · Shift+Enter for a new line. {state?.voice.input === 'whisper' ? 'Record, transcribe, then review before sending.' : 'Win+H starts or stops voice typing.'}</p>
    {microphone.phase === 'recording' && <p className="companion-recording" role="status">● Microphone recording · voices paused</p>}
    <div className="companion-actions companion-toggles">
      <button className="companion-quiet" title="Mute or unmute voices · Ctrl+Alt+Shift+V" disabled={!state} aria-pressed={state?.voice.muted ?? false} onClick={() => void perform(() => unwrap(api.mute(!state?.voice.muted)))}>{state?.voice.muted ? 'Unmute voices' : 'Mute voices'}</button>
      <button className="companion-quiet" title="Pause or resume chat · Ctrl+Alt+Shift+P" disabled={!sharing} aria-pressed={state?.conversationPaused ?? false} onClick={() => void perform(() => unwrap(api.pauseConversation(!state?.conversationPaused)))}>{state?.conversationPaused ? 'Resume chat' : 'Pause chat'}</button>
    </div>
    {sharing && state?.conversationPaused && <p className="companion-status" role="status">Chat paused. New screen checks, comments and speech are paused; your draft stays here.</p>}
    {state?.voiceError && <p className="companion-error" role="alert">{state.voiceError}</p>}
    {chatMode && <>
      {(error || state?.error) && <p className="companion-error" role="alert">{error || state?.error}</p>}
      <button className="companion-quiet" onClick={() => void api.controls()}>Sharing controls</button>
    </>}
    {chatMode && <div className="companion-log" aria-label="Session conversation">{log.map((line, i) => <p key={i}><strong>{line.name}</strong> {line.text}</p>)}</div>}
  </section>
  if (chatMode) return <main className="companion-controls companion-quick" data-theme="day">{conversation}</main>
  const tabs = [{ id: 'share', label: 'Share' }, { id: 'chat', label: 'Chat' }, { id: 'appearance', label: 'Appearance' }, { id: 'voices', label: 'Voices' }] as const
  const panelProps = (name: typeof tab) => ({ id: `laptop-panel-${name}`, role: 'tabpanel', 'aria-labelledby': `laptop-tab-${name}`, hidden: tab !== name, tabIndex: 0 })
  return <main className="companion-controls companion-workspace" data-theme="day">
    <header className="companion-header"><div><p className="companion-eyebrow">VENUS UNIVERSITY · A LITTLE TIME TOGETHER</p><h1>Show her my screen</h1>
      <p>Pull up a chair. There’s something you want to show her.</p></div>
      <span className="companion-session-tag">{state?.sceneKind === 'creator' ? 'Scene Creator' : 'Your story'}</span></header>
    <section className="companion-people" aria-label="Girls from your scene"><span>With you</span>
      {characters.filter(person => charIds.includes(person.charId)).map(person => <p key={person.charId}>{person.name}</p>)}
      {!characters.length && <p>Waiting for your scene…</p>}
    </section>
    <CompanionTabs id="laptop" label="Laptop" tabs={tabs} active={tab} onChange={setTab} />
    <div className="companion-pages">
      <section {...panelProps('share')} className="companion-grid">
        <section className="companion-card"><span className="companion-eyebrow">01 · SET THE MOOD</span><h2>What are we doing?</h2>
          <label>Mode<select aria-label="Mode" value={mode} disabled={sharing || busy} onChange={e => void perform(() => unwrap(api.mode(e.target.value as CompanionMode, coachingContext)))}>
            {Object.entries(COMPANION_MODES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select></label>
          <p className="companion-hint companion-mode-hint">{COMPANION_MODES[mode].hint}</p>
          <label>{mode === 'fps' ? 'Your game, role & goal (optional)' : 'A little context (optional)'}<textarea value={coachingContext} disabled={sharing || busy} maxLength={1500} rows={3} onChange={e => setCoachingContext(e.target.value)} placeholder={mode === 'fps' ? 'My FPS game and role. Help me use cover and take better angles.' : 'Tell her what you’re up to, or what you’d like a hand with.'} /></label>
          <p className="companion-hint" role="status">{state?.documentName ? <>Using scene notes: <strong>{state.documentName}</strong>. Available in every mode.</> : <>Add a document using the book button in your scene.</>}</p>
          {mode === 'fps' && <p className="companion-hint">Show the scoreboard for team advice. She sees snapshots, so tips won’t track every cooldown or the latest patch.</p>}
        </section>
        <section className="companion-card"><span className="companion-eyebrow">02 · OPEN YOUR LAPTOP</span><h2>A window into your world</h2>
          <label>Share from your laptop<select value={sourceId} disabled={sharing || busy} onChange={e => setSourceId(e.target.value)}>
            <option value="">Choose a screen or window</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <button className="companion-quiet companion-refresh" disabled={sharing || busy} onClick={() => void perform(refreshSources)}>↻ Refresh screens and windows</button>
          {mode === 'fps' && <label className="companion-check"><input type="checkbox" checked={interval === 1} disabled={pending} title="Toggle rapid FPS replies · Ctrl+Alt+Shift+F"
            onChange={e => { const enabled = e.target.checked; if (sharing) void perform(() => unwrap(api.rapid(enabled))); else setIntervalSeconds(enabled ? 1 : 20) }} /> Rapid replies · 1 second</label>}
          {mode === 'fps' && <p className="companion-hint">Toggle while playing: Ctrl+Alt+Shift+F</p>}
          {rapidFps(mode, interval) ? <p className="companion-hint">Tiny callouts and quick highlights, targeting one screen check per second. Previous messages float up and fade over three seconds. AI response time can make updates slower.</p> : <label>Time between reactions<select value={interval} disabled={sharing || busy} onChange={e => setIntervalSeconds(Number(e.target.value))}>
            {[5, 12, 20, 30, 60, 120].map(n => <option key={n} value={n}>{n} seconds after a reply</option>)}
          </select></label>}
          <p className="companion-hint companion-note">She sees occasional screenshots through your AI provider. Shorter intervals use more credits. Game audio stays with you.</p>
        </section>
      </section>
      <section {...panelProps('chat')} className="companion-grid companion-chat-grid">{conversation}
        <section className="companion-card companion-history"><span className="companion-eyebrow">BETWEEN THE TWO OF YOU</span><h2>The conversation</h2>
          <div className="companion-log" aria-label="Session conversation">{log.length ? log.map((line, i) => <p key={i}><strong>{line.name}</strong> {line.text}</p>) : <p className="companion-empty">Their reactions will appear here. Start sharing, then say hello.</p>}</div>
          <p className="companion-hint">{state?.sceneKind === 'creator' ? 'Your conversation joins this scene. Use Save Scene to keep it.' : 'Your conversation joins the story and its autosave.'}</p>
          <button className="companion-quiet" onClick={() => void perform(() => unwrap(api.chat(true)))}>Open quick chat <kbd>Ctrl+Alt+Shift+T</kbd></button>
        </section>
      </section>
      <section {...panelProps('appearance')} className="companion-grid">
        <section className="companion-card"><span className="companion-eyebrow">MAKE YOURSELF COMFORTABLE</span><h2>A place beside you</h2>
          <label>Character height <span className="companion-value">{state?.size ?? 520}px</span><input aria-label="Character height" type="range" min="240" max="800" step="20" value={state?.size ?? 520} onChange={e => void perform(() => unwrap(api.configure(Number(e.target.value), state?.clickThrough ?? false)))} /></label>
          <label>Message size <span className="companion-value">{state?.messageSize ?? 100}%</span><input aria-label="Message size" type="range" min="75" max="200" step="5" value={state?.messageSize ?? 100} onChange={e => void perform(() => unwrap(api.messageSize(Number(e.target.value))))} /></label>
          <p className="companion-hint">Resize the text and bubbles above her, including rapid FPS callouts.</p>
          <label className="companion-check"><input type="checkbox" checked={state?.clickThrough ?? false} onChange={e => void perform(() => unwrap(api.configure(state?.size ?? 520, e.target.checked)))} /> Let game clicks pass through the girls</label>
          <p className="companion-hint">Hover over her to reveal a drag handle in the upper-right corner. The rest of her stays click-through.</p>
          <label className="companion-check"><input type="checkbox" checked={state?.pointing ?? true} onChange={e => void perform(() => unwrap(api.pointing(e.target.checked)))} /> Let her point out details on screen</label>
          <p className="companion-hint">A small aura marks what she means, then fades. Clicks pass through it.</p>
          <label>Screenshot delay<select aria-label="Screenshot delay" value={screenshotDelay} onChange={e=>setScreenshotDelay(Number(e.target.value))}>{[3,5,10,15].map(seconds=><option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label><p className="companion-hint">Controls hide while the timer runs. Alt-Tab to your desktop or browser; she stays visible in the screenshot.</p><button className="companion-quiet" disabled={pending} onClick={()=>void perform(async()=>{const file=await unwrap(api.screenshot(screenshotDelay));setError('Screenshot saved: '+file)})}>Screenshot desktop with character</button>
          <div className="companion-preview"><select aria-label="Preview expression" value={emotion} disabled={sharing || busy} onChange={e => setEmotion(e.target.value as Emotion)}>{EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}</select>
            <button className="companion-quiet" disabled={sharing || busy || !charIds.length} onClick={() => void perform(() => unwrap(api.preview(charIds, emotion)))}>Preview expression</button></div>
        </section>
        <section className="companion-card"><span className="companion-eyebrow">ALWAYS WITHIN REACH</span><h2>A few handy shortcuts</h2>
          <dl className="companion-shortcuts"><div><dt>Rapid FPS on / off</dt><dd>Ctrl+Alt+Shift+F</dd></div><div><dt>Quick chat</dt><dd>Ctrl+Alt+Shift+T</dd></div><div><dt>Mute voices</dt><dd>Ctrl+Alt+Shift+V</dd></div><div><dt>Pause chat</dt><dd>Ctrl+Alt+Shift+P</dd></div><div><dt>Move / click through</dt><dd>Ctrl+Alt+Shift+M</dd></div><div><dt>Pause sharing & return</dt><dd>Ctrl+Alt+Shift+S</dd></div></dl>
        </section>
      </section>
      <section {...panelProps('voices')}>{state && <CompanionVoiceSettings api={api} settings={state.voice} people={characters.filter(person => charIds.includes(person.charId))} report={setError} />}</section>
    </div>
    <footer className="companion-footer">
      <div className="companion-feedback"><p className="companion-status" role="status"><span className={sharing ? 'companion-live-dot is-live' : 'companion-live-dot'} />{sharing ? state?.conversationPaused ? 'Chat paused · still together' : `${state?.busy ? 'Watching together' : 'Sharing'} · ${state?.sourceName}` : state?.busy ? 'Finishing up…' : 'Ready when you are · screen sharing is off'}</p>
        {(error || state?.error || state?.voiceError) && <p className="companion-error" role="alert">{error || state?.error || state?.voiceError}</p>}
        {state?.shortcutWarning && <p className="companion-hint" role="status">{state.shortcutWarning}</p>}
      </div>
      <div className="companion-actions"><button className="companion-quiet" onClick={() => void perform(() => unwrap(api.close()))}>Back to our scene</button>
        <button disabled={!sharing && (!charIds.length || !sourceId || busy)} onClick={() => void perform(async () => {
        if (sharing) await unwrap(api.pause())
        else { await unwrap(api.mode(mode, coachingContext)); await unwrap(api.start(charIds, sourceId, interval)) }
        })}>{sharing ? 'Pause sharing' : 'Start sharing'} <span aria-hidden="true">{sharing ? 'Ⅱ' : '↗'}</span></button>
        {Boolean(state?.startingIn) && <p role="status">Sharing starts in {state!.startingIn}… Switch to the screen or window you want to share.</p>}
      </div>
    </footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<Companion />)
