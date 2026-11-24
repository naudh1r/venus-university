import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CompanionMember } from '../shared/screenCompanion'

type Bubble = { id: number; text: string }
/** Each girl's own previous callouts retire independently; state broadcasts never restart a fade. */
export function CompanionSpeech({ member, rapid, sceneId }: { member?: CompanionMember; rapid: boolean; sceneId?: string }) {
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [fading, setFading] = useState<Bubble[]>([])
  const active = useRef<Bubble | null>(null)
  const identity = useRef('')
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const latestTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const reset = () => {
      for (const timer of timers.current) clearTimeout(timer)
      timers.current.clear(); clearTimeout(latestTimer.current)
      active.current = null; setBubble(null); setFading([])
    }
    const key = `${sceneId}:${member?.charId}:${rapid}`
    if (key !== identity.current || !member?.text) { reset(); identity.current = key }
    if (!member?.text || active.current?.id === member.sequence) return
    const retire = (old: Bubble) => {
      if (!rapid) return
      setFading(previous => [...previous, old].slice(-3))
      const timer = setTimeout(() => {
        setFading(previous => previous.filter(item => item.id !== old.id)); timers.current.delete(timer)
      }, 3000)
      timers.current.add(timer)
    }
    if (active.current) retire(active.current)
    const next = { id: member.sequence, text: member.text }
    active.current = next; setBubble(next); clearTimeout(latestTimer.current)
    latestTimer.current = setTimeout(() => {
      if (active.current === next) { retire(next); active.current = null; setBubble(null) }
    }, 15000)
  }, [member?.sequence, member?.charId, member?.text, rapid, sceneId])
  useEffect(() => () => {
    for (const timer of timers.current) clearTimeout(timer)
    clearTimeout(latestTimer.current)
  }, [])
  return <>
    {fading.map((item, index) => <p key={item.id} aria-hidden="true" className="companion-speech companion-speech-fading"
      style={{ '--ghost-offset': `calc(${(fading.length - index) * 48}px * var(--message-scale))` } as CSSProperties}>{item.text}</p>)}
    {bubble && <p className="companion-speech" role="status">{bubble.text}</p>}
  </>
}
