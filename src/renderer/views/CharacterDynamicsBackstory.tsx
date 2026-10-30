import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { PERSONALITY_NUDGES, STARTING_RELATIONSHIPS, type CharacterDynamic } from '../../shared/characterDynamics'
import { fullNameOf, type Character } from '@shared/types'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn, useModalShell, TitleTab } from '@vx/modkit/renderer'
import type { ScreenTheme } from '@vx/modkit/renderer'
import '../vu_styles/CharacterDynamicsBackstory.css'

interface Props {
  entry: CharacterDynamic
  character: Character
  theme: ScreenTheme
}

/** A small link beside her backstory opens this playthrough's saved choices. */
export function CharacterDynamicsBackstory(props: Props): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const relationship = STARTING_RELATIONSHIPS.find(tag => tag.id === props.entry.relationship?.kind)
  if (!relationship && props.entry.traits.length === 0 && !props.entry.growth) return null
  return <>
    <div className="vu-dynamics-backstory-link">
      <motion.button type="button" className="vu-pill" aria-haspopup="dialog"
        {...gestures(false, quietLift, quietPress)} onClick={() => setOpen(true)}>
        Character Dynamics
      </motion.button>
      <span>{[props.entry.traits.length > 0
        ? props.entry.traits.length + (props.entry.traits.length === 1 ? ' personality nudge' : ' personality nudges') : '',
        relationship?.name, props.entry.growth?.name].filter(Boolean).join(' · ')}</span>
    </div>
    <AnimatePresence propagate>
      {open && <CharacterDynamicsDetails key="dynamics" {...props} onClose={() => setOpen(false)} />}
    </AnimatePresence>
  </>
}

/** Read-only starting history and trait meanings in their own scrolling panel. */
function CharacterDynamicsDetails({ entry, character, theme, onClose }: Props & { onClose: () => void }): JSX.Element | null {
  const { host, overlayProps } = useModalShell(onClose)
  const traits = PERSONALITY_NUDGES.filter(tag => entry.traits.includes(tag.id))
  const relationship = STARTING_RELATIONSHIPS.find(tag => tag.id === entry.relationship?.kind)
  if (!host) return null
  return createPortal(
    <motion.div className="vu-veil" data-theme={theme} variants={veilIn}
      initial="hidden" animate="shown" exit="gone" {...overlayProps}>
      <motion.div className="vu-dynamics-details vu-paper" role="dialog" aria-modal="true"
        aria-label={'Character Dynamics for ' + fullNameOf(character)} variants={panelUnderTab}>
        <TitleTab>Character Dynamics</TitleTab>
        <header className="vu-dynamics-details-head">
          <span>This playthrough</span>
          <h2>{fullNameOf(character)}</h2>
          <p>Her starting tendencies and the growth she has earned in this playthrough.</p>
        </header>
        <div className="vu-dynamics-details-scroll">
          {entry.growth && <section className="vu-dynamics-earned" aria-label="Earned growth"><h3>Earned by breaking through the silence</h3><strong>{entry.growth.name}</strong><p>{entry.growth.description}</p><ul>{entry.growth.reframes.map((line,i)=><li key={i}>{line}</li>)}</ul><p>A change she can build on, while keeping her voice and personality.</p></section>}
          {relationship && <section className="vu-dynamics-starting-background">
            <h3>Starting background</h3>
            <strong>{relationship.name}</strong>
            <p>{entry.relationship?.reason}</p>
          </section>}
          {traits.length > 0 && <section className="vu-dynamics-details-traits">
            <h3>Personality nudges <span>{traits.length}</span></h3>
            <p>Small influences on her original personality.</p>
            <ul aria-label="Assigned personality traits">
              {traits.map(tag => <li key={tag.id}><h4>{tag.name}</h4><p>{tag.hint}</p></li>)}
            </ul>
          </section>}
        </div>
        <div className="vu-foot">
          <motion.button type="button" className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            {...gestures(false, lift, press)} onClick={onClose}>Close</motion.button>
        </div>
      </motion.div>
    </motion.div>, host)
}
