import type { JSX } from 'react'

export function DartsControlGuide(): JSX.Element {
  return <section className="vu-darts-control-help" aria-label="Mouse controls">
    <div className="vu-darts-mouse" aria-hidden="true"><span /></div>
    <ol>
      <li><strong>Move</strong><p>Move the mouse over the board to choose where to aim.</p></li>
      <li><strong>Hold left click</strong><p>Your aim locks. The ellipse appears and the white dot moves inside it.</p></li>
      <li><strong>Release</strong><p>Release left click when the dot is where you want the dart to land.</p></li>
    </ol>
    <p className="vu-darts-control-note">Timing is your accuracy. Moving the mouse while holding does not move the ellipse.</p>
  </section>
}
