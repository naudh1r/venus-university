import { useEffect, useState, type JSX } from 'react'
import type { CompanionApi, CompanionVoicePatch, CompanionVoiceSettings } from '../shared/screenCompanion'
import { companionResult } from './companionMedia'
import { CompanionTabs } from './CompanionTabs'

type Person = { charId: string; name: string }
export function CompanionVoiceSettings({ api, settings, people, report }: { api: CompanionApi; settings: CompanionVoiceSettings; people: Person[]; report: (error: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(settings)
  const [whisperKey, setWhisperKey] = useState(''), [elevenKey, setElevenKey] = useState('')
  const [clearWhisper, setClearWhisper] = useState(false), [clearEleven, setClearEleven] = useState(false)
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<'voices' | 'microphone'>('voices')
  const signature = JSON.stringify({ ...settings, muted: undefined })
  useEffect(() => { if (!dirty) setDraft(settings) }, [signature, dirty])
  const changed = (): void => { setDirty(true); setSaved(false) }
  const edit = (patch: Partial<CompanionVoiceSettings>): void => { setDraft(previous => ({ ...previous, ...patch })); changed() }
  const save = async (): Promise<void> => {
    setBusy(true); report('')
    try {
      const patch: CompanionVoicePatch = { input: draft.input, whisperEndpoint: draft.whisperEndpoint, whisperModel: draft.whisperModel, elevenLabsModel: draft.elevenLabsModel, voiceIds: draft.voiceIds }
      if (whisperKey.trim() || clearWhisper) patch.whisperKey = clearWhisper ? '' : whisperKey
      if (elevenKey.trim() || clearEleven) patch.elevenLabsKey = clearEleven ? '' : elevenKey
      const result = await companionResult(api.voiceSettings(patch))
      setDraft(result); setDirty(false); setWhisperKey(''); setElevenKey(''); setClearWhisper(false); setClearEleven(false); setSaved(true)
    } catch (error) { report(error instanceof Error ? error.message : 'Could not save voice settings.') }
    finally { setBusy(false) }
  }
  return <div className="companion-voice">
    <CompanionTabs id="laptop-voice" label="Voice setup" active={tab} onChange={setTab} tabs={[{ id: 'voices', label: 'Their voices' }, { id: 'microphone', label: 'Your microphone' }]} />
    <div id="laptop-voice-panel-voices" role="tabpanel" aria-labelledby="laptop-voice-tab-voices" hidden={tab !== 'voices'} className="companion-grid">
      <section className="companion-card"><h2>Hear her voice</h2>
        <label>ElevenLabs API key<input type="password" autoComplete="off" value={elevenKey} placeholder={settings.elevenLabsKeySet ? 'Saved · leave blank to keep' : 'Enter API key'} onChange={e => { setElevenKey(e.target.value); changed() }} /></label>
        {settings.elevenLabsKeySet && <label className="companion-check"><input type="checkbox" checked={clearEleven} onChange={e => { setClearEleven(e.target.checked); changed() }} /> Remove saved ElevenLabs key</label>}
        <label>Speech model<input value={draft.elevenLabsModel} maxLength={100} onChange={e => edit({ elevenLabsModel: e.target.value })} /></label>
        <p className="companion-hint">Spoken replies use ElevenLabs credits.</p>
      </section>
      <section className="companion-card"><h2>A voice for each girl</h2>
        <p className="companion-hint">These voices are used for screen-sharing replies. Leave a voice ID blank to keep that speaker silent.</p>
        {people.map(person => <label key={person.charId}>{person.name} · voice ID<input value={draft.voiceIds[person.charId] ?? ''} maxLength={100} placeholder="Paste an ElevenLabs voice ID" onChange={e => edit({ voiceIds: { ...draft.voiceIds, [person.charId]: e.target.value.trim() } })} /></label>)}
      </section>
    </div>
    <div id="laptop-voice-panel-microphone" role="tabpanel" aria-labelledby="laptop-voice-tab-microphone" hidden={tab !== 'microphone'} className="companion-grid">
      <section className="companion-card"><h2>Your turn to speak</h2>
        <label>Microphone input<select aria-label="Microphone input" value={draft.input} onChange={e => edit({ input: e.target.value as 'windows' | 'whisper' })}><option value="windows">Windows voice typing</option><option value="whisper">Whisper API</option></select></label>
        {draft.input === 'whisper' && <>
          <label>Whisper API base URL<input value={draft.whisperEndpoint} onChange={e => edit({ whisperEndpoint: e.target.value })} /></label>
        </>}
        <p className="companion-hint">{draft.input === 'whisper' ? 'A local transcription server can use its own URL. Changing it clears the saved key.' : 'Windows voice typing uses your system microphone and language settings.'}</p>
      </section>
      <section className="companion-card companion-note-card"><h2>{draft.input === 'whisper' ? 'Connect to Whisper' : 'Say what’s on your mind'}</h2>
        {draft.input === 'whisper' && <>
          <label>Transcription model<input value={draft.whisperModel} maxLength={100} onChange={e => edit({ whisperModel: e.target.value })} /></label>
          <label>Whisper API key<input type="password" autoComplete="off" value={whisperKey} placeholder={settings.whisperKeySet ? 'Saved · leave blank to keep' : 'Enter API key'} onChange={e => { setWhisperKey(e.target.value); changed() }} /></label>
          {settings.whisperKeySet && <label className="companion-check"><input type="checkbox" checked={clearWhisper} onChange={e => { setClearWhisper(e.target.checked); changed() }} /> Remove saved Whisper key</label>}
        </>}
        <p>{draft.input === 'whisper' ? 'Tap Speak in Chat, then Stop & transcribe when you’re done. Review the words before you send them.' : 'Tap Speak in Chat to open Windows voice typing. Win+H stops listening. Review the words before sending.'}</p>
        <p className="companion-hint">Keys are encrypted. Provider data policies apply to audio you send.</p>
      </section>
    </div>
    <div className="companion-voice-save"><p className="companion-hint">{dirty && 'You have unsaved changes.'}</p><div className="companion-actions">
      {saved && <span className="companion-status" role="status">Saved</span>}<button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save voice settings'}</button>
    </div></div>
  </div>
}
