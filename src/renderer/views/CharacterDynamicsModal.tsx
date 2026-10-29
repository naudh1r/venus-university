import { useState, type DragEvent, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  DYNAMICS_REASON_LIMIT, PERSONALITY_NUDGES, STARTING_RELATIONSHIPS,
  dynamicFor, emptyCharacterDynamics, invalidDynamicsReasons, settleCharacterDynamics,
  type CharacterDynamic, type CharacterDynamics, type PersonalityNudge
} from '../../shared/characterDynamics'
import { fullNameOf, type Character } from '@shared/types'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn, useModalShell } from '@vx/modkit/renderer'
import { spriteUrl } from '../stores/characterStore'
import type { ScreenTheme } from '@vx/modkit/renderer'
import '../vu_styles/CharacterDynamics.css'

const TAG_MIME = 'application/x-vu-personality-nudge'
const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'No shared history' },
  ...STARTING_RELATIONSHIPS.map(tag => ({ value: tag.id, label: tag.name }))
]

interface Props {
  theme: ScreenTheme
  roster: readonly Character[]
  initial?: CharacterDynamics
  /** All returning girls, including those who had no tags. Their history is not restarted. */
  returning?: readonly string[]
  onContinue: (choices: CharacterDynamics) => void
}

/** One setup for history and temperament. Click-to-place is also available for every drag. */
export function CharacterDynamicsModal({ theme, roster, initial, returning = [], onContinue }: Props): JSX.Element | null {
  const [draft, setDraft] = useState(() => structuredClone(initial ?? emptyCharacterDynamics()))
  const [picked, setPicked] = useState<PersonalityNudge | null>(null)
  const [search, setSearch] = useState('')
  const [over, setOver] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { host, overlayProps } = useModalShell(() => {})
  const editable = roster.filter(girl => !returning.includes(girl.charId)).map(girl => girl.charId)
  const missing = invalidDynamicsReasons(draft, editable)
  const pickedTag = PERSONALITY_NUDGES.find(tag => tag.id === picked)
  const matchingTags = PERSONALITY_NUDGES.filter(tag =>
    `${tag.name} ${tag.hint}`.toLowerCase().includes(search.trim().toLowerCase()))

  function update(id: string, change: (entry: CharacterDynamic) => CharacterDynamic): void {
    if (!editable.includes(id)) return
    setDraft(prev => ({ ...prev, characters: { ...prev.characters, [id]: change(dynamicFor(prev, id)) } }))
  }

  function addTag(girl: Character, tag: string): void {
    if (!PERSONALITY_NUDGES.some(entry => entry.id === tag) || !editable.includes(girl.charId)) return
    update(girl.charId, entry => ({ ...entry, traits: [...new Set([...entry.traits, tag])] }))
    setAnnouncement(`${PERSONALITY_NUDGES.find(entry => entry.id === tag)?.name} added to ${girl.firstName}.`)
    setOver(null)
  }

  function drop(event: DragEvent<HTMLElement>, girl: Character): void {
    if (!event.dataTransfer.types.includes(TAG_MIME)) return
    event.preventDefault()
    addTag(girl, event.dataTransfer.getData(TAG_MIME))
  }

  const assigned = roster.filter(girl => {
    const entry = dynamicFor(draft, girl.charId)
    return entry.relationship || entry.traits.length > 0
  }).length

  if (!host) return null
  return createPortal(
    <motion.div className="vu-veil" data-theme={theme} variants={veilIn}
      initial="hidden" animate="shown" exit="gone" {...overlayProps}>
      <motion.div className="vu-dynamics vu-paper" role="dialog" aria-modal="true"
        aria-label="Character Dynamics" variants={panelUnderTab}>
        <TitleTab>Character Dynamics</TitleTab>
        <header className="vu-dynamics-intro">
          <h2>A different beginning</h2>
          <p>Give a girl shared history, gentle personality nudges, or both. Leave her unchanged if you prefer.</p>
          {returning.length > 0 && <p>Returning girls keep their history and choices. Customize only the girls new to this semester.</p>}
        </header>
        <div className="vu-dynamics-body">
          <aside className="vu-dynamics-palette" aria-label="Personality tags">
            <h3>Personality tags</h3>
            <p>Drag tags onto a girl. Or select a tag, then use her “Add” button. You can use several.</p>
            <TextField id="dynamics-tag-search" label="Find a trait" value={search} onChange={setSearch} />
            <span className="vu-dynamics-tag-count" role="status">{matchingTags.length} of {PERSONALITY_NUDGES.length} traits</span>
            <div className="vu-dynamics-tags">
              {matchingTags.length === 0 && <p className="vu-empty">No matching traits. Try another word.</p>}
              {matchingTags.map(tag => (
                <motion.button key={tag.id} type="button" className="vu-dynamics-tag"
                  draggable={!submitted} aria-pressed={picked === tag.id} aria-describedby={`nudge-${tag.id}`}
                  {...gestures(submitted, quietLift, quietPress)} disabled={submitted}
                  onClick={() => setPicked(picked === tag.id ? null : tag.id)}
                  onDragStartCapture={event => {
                    event.dataTransfer.setData(TAG_MIME, tag.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    setPicked(tag.id)
                  }}
                  onDragEndCapture={() => setOver(null)}>
                  <strong>{tag.name}</strong><span id={`nudge-${tag.id}`}>{tag.hint}</span>
                </motion.button>
              ))}
            </div>
          </aside>
          <div className="vu-dynamics-roster" aria-label="Your girls">
            {roster.map(girl => {
              const entry = dynamicFor(draft, girl.charId)
              const locked = returning.includes(girl.charId)
              const relationship = STARTING_RELATIONSHIPS.find(tag => tag.id === entry.relationship?.kind)
              const badReason = missing.includes(girl.charId)
              return (
                <section key={girl.charId} className="vu-dynamics-card" aria-label={fullNameOf(girl)}
                  data-drop={over === girl.charId} data-char-id={girl.charId}
                  onDragOver={event => {
                    if (locked || submitted || !event.dataTransfer.types.includes(TAG_MIME)) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'copy'
                    setOver(girl.charId)
                  }}
                  onDragLeave={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
                  }}
                  onDrop={event => { if (!locked && !submitted) drop(event, girl) }}>
                  <header className="vu-dynamics-girl">
                    <div className="vu-arch vu-dynamics-portrait"><div className="vu-crop">
                      <img src={spriteUrl(girl.charId, 'neutral')} alt="" draggable={false} />
                    </div></div>
                    <div><h3>{fullNameOf(girl)}</h3><p>{locked ? 'Returning · choices retained' : 'This playthrough only'}</p></div>
                  </header>
                  {locked ? (
                    <div className="vu-dynamics-history">
                      <span className="vu-field-label">Starting relationship</span>
                      <strong>{relationship?.name ?? 'No shared history added'}</strong>
                      {entry.relationship && <p>{entry.relationship.reason}</p>}
                    </div>
                  ) : (
                    <>
                      <SelectField id={`dynamics-relationship-${girl.charId}`} label="Starting relationship"
                        value={entry.relationship?.kind ?? ''} options={RELATIONSHIP_OPTIONS} disabled={submitted}
                        onChange={kind => update(girl.charId, current => ({
                          traits: current.traits,
                          ...(kind ? { relationship: { kind, reason: current.relationship?.reason ?? '' } } : {})
                        }))} />
                      {relationship && <div className="vu-dynamics-reason" data-invalid={badReason}>
                        <TextField id={`dynamics-reason-${girl.charId}`} label="Explain why (required)"
                          hint={`${relationship.hint} Use “the reader” for yourself.`}
                          value={entry.relationship?.reason ?? ''} multiline rows={3} maxLength={DYNAMICS_REASON_LIMIT}
                          disabled={submitted}
                          onChange={reason => update(girl.charId, current => ({ ...current, relationship: { kind: relationship.id, reason } }))} />
                        <p className="vu-dynamics-reason-note">{badReason ? 'Add a short explanation to continue.' : `${entry.relationship?.reason.length ?? 0} / ${DYNAMICS_REASON_LIMIT}`}</p>
                      </div>}
                    </>
                  )}
                  {entry.growth && <div className="vu-dynamics-history"><span className="vu-field-label">Earned growth</span><strong>{entry.growth.name}</strong><p>{entry.growth.description}</p></div>}
                  <div className="vu-dynamics-dropzone">
                    <span className="vu-field-label">Personality nudges</span>
                    {entry.traits.length === 0 && <p>{locked ? 'Original personality.' : 'Drop tags here. Her original personality stays.'}</p>}
                    <div className="vu-dynamics-assigned">
                      {entry.traits.map(id => <span key={id} className="vu-dynamics-assigned-tag">
                        {PERSONALITY_NUDGES.find(tag => tag.id === id)?.name}
                        {!locked && <motion.button type="button" aria-label={`Remove ${id} from ${girl.firstName}`}
                          className="vu-square" disabled={submitted} {...gestures(submitted, quietLift, quietPress)}
                          onClick={() => update(girl.charId, current => ({ ...current, traits: current.traits.filter(tag => tag !== id) }))}>×</motion.button>}
                      </span>)}
                    </div>
                    {!locked && pickedTag && <motion.button type="button" className="vu-pill"
                      disabled={submitted || entry.traits.includes(pickedTag.id)}
                      {...gestures(submitted || entry.traits.includes(pickedTag.id), quietLift, quietPress)}
                      onClick={() => addTag(girl, pickedTag.id)}>Add {pickedTag.name}</motion.button>}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
        <footer className="vu-dynamics-footer">
          <div className="vu-dynamics-summary" aria-live="polite">
            <span>{assigned} of {roster.length} girls customized</span>
            <p>{missing.length > 0 ? `${missing.length} ${missing.length === 1 ? 'girl needs an explanation' : 'girls need explanations'}.` : 'No stat changes. Unassigned girls keep their original personality.'}</p>
          </div>
          <motion.button type="button" className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            disabled={missing.length > 0 || submitted} {...gestures(missing.length > 0 || submitted, lift, press)}
            onClick={() => {
              if (missing.length || submitted) return
              const choices = settleCharacterDynamics(draft, editable, initial)
              setSubmitted(true)
              onContinue(choices)
            }}>Continue</motion.button>
        </footer>
        <span className="vu-dynamics-announcement" role="status">{announcement}</span>
      </motion.div>
    </motion.div>, host
  )
}
