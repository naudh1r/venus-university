import { useLayoutEffect, useRef, useState, type JSX } from 'react'

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

/** The sector label explains the sample, halfway above the diagram's visible rim. */
export function DartsSectorLabel(): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const [top, setTop] = useState(24)
  useLayoutEffect(() => {
    const overlay = ref.current!.closest<HTMLElement>('.vu-darts-guide')!
    const content = overlay.querySelector<HTMLElement>('.vu-darts-guide-content')!
    const measure = (): void => {
      const size = Math.min(content.clientWidth, content.clientHeight)
      // The board canvas is 700 square; its outer rim is radius 245 * 1.23.
      const boardTop = content.offsetTop + (content.clientHeight - size) / 2 + size * (350 - 245 * 1.23) / 700
      setTop(boardTop / 2)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(overlay); observer.observe(content)
    return () => observer.disconnect()
  }, [])
  return <span ref={ref} className="vu-darts-sector-label" style={{ top }} aria-label="Example: sector 20">SECTOR 20</span>
}

export function dartsTurnLabel(phase: string, hasOpponents: boolean, playingName: string): string {
  if (phase === 'handover') return 'Change turn'
  if (phase === 'my-turn') return hasOpponents ? 'My turn' : 'Next round'
  if (phase === 'partners') return `${playingName} is playing`
  if (phase === 'preparing') return 'Preparing next turn…'
  if (phase === 'finished') return 'Match complete'
  return "You're playing"
}
