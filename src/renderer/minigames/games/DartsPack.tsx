import { useState, type JSX } from 'react'
import { Darts } from './Darts'
import { DartsExtra } from './DartsExtra'
import { type GamePlay } from '../kit'
import { extraModeUnavailable, type ExtraDartsMode } from '../../../shared/minigameRules/darts'
import '../../vu_styles/Darts.css'

const EXTRAS: Record<number, ExtraDartsMode> = { 3: 'girls-team', 4: 'leader', 5: 'precision', 6: 'exact' }
const TITLES = ['Beat the House', '301 Rival Match', 'Player vs Girls Team', 'Chase the Leader', 'Precision Duel', 'Exact Total']
export function DartsPack({ play }: { play: GamePlay }): JSX.Element {
  const [choice, setChoice] = useState(play.options['darts-mode'] ?? 1)
  const reason = (value: number): string | null => value === 2 && !play.opponents.length ? 'Rival Match requires a companion.' : EXTRAS[value] ? extraModeUnavailable(EXTRAS[value], play.opponents.map(p => p.skill)) : value === 1 || value === 2 ? null : 'Unknown Darts mode.'
  const unavailable = reason(choice)
  const configured = { ...play, options: { ...play.options, 'darts-mode': choice } }
  // Existing mode IDs retain their original component and all original fallback rules.
  if (choice === 1 || choice === 2) return <Darts key={choice} play={configured}/>
  if (!unavailable) return <DartsExtra key={choice} play={configured}/>
  return <div className="vu-darts"><p className="vu-darts-mode">Choose a mode</p><section className="vu-darts-mode-picker" aria-label="Available Darts modes">
    <h2>{TITLES[choice - 1] ?? 'Darts'}</h2><p role="status">{unavailable}</p><p>Choose an available mode, or use Walk away. Companion skill is not changed.</p>
    {TITLES.map((title, index) => { const locked = reason(index + 1); return <div key={title}><button type="button" className="vu-btn vu-btn--primary vu-paper vu-btn--panel" disabled={!!locked} onClick={() => setChoice(index + 1)}>{title}</button>{locked && <small>{locked}</small>}</div> })}
  </section></div>
}
