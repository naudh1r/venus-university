import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { TEXT_REGENERATION_MOD } from '../../shared/textRegeneration'
import { gestures, quietLift, quietPress, useModOn } from '@vx/modkit/renderer'
import { useGameStore } from '../stores/gameStore'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import { regenerateTextReply, textRegenerationTarget } from '../stores/textingLoop'
import { persistRegeneratedConversation } from '../stores/loop/saves'
import '../vu_styles/TextRegenerate.css'

export function TextRegenerate({ charId }: { charId: string }): JSX.Element | null {
  const on = useModOn(TEXT_REGENERATION_MOD)
  const game = useGameStore(s => s)
  const busy = useBunnyboardStore(s => s.busyCharIds.includes(charId))
  useBunnyboardStore(s => s.armedHangout)
  useBunnyboardStore(s => s.failedCharIds)
  const [message, setMessage] = useState('')
  const revision = useRef(0)
  useEffect(() => {
    revision.current++
    setMessage('')
    return () => { revision.current++ }
  }, [charId, game.loads, game.date, game.time])
  if (!on || !game.characters[charId]) return null
  const target = textRegenerationTarget(charId)
  const disabled = busy || !target
  async function regenerate(): Promise<void> {
    const at = useGameStore.getState(), id = charId, ticket = revision.current
    setMessage('')
    try {
      const result = await regenerateTextReply(id, persistRegeneratedConversation)
      if (revision.current === ticket && useGameStore.getState().loads === at.loads) setMessage(`Replaced ${result.replaced} messages with ${result.created}.`)
    } catch (error) {
      if (revision.current === ticket && useGameStore.getState().loads === at.loads) setMessage(error instanceof Error ? error.message : 'Could not regenerate the reply.')
    }
  }
  return <div className="vu-text-regenerate">
    <motion.button type="button" className="vu-btn vu-btn--quiet" disabled={disabled}
      {...gestures(disabled, quietLift, quietPress)} onClick={() => void regenerate()}>
      {busy ? 'Waiting for reply…' : 'Regenerate whole reply'}
    </motion.button>
    <span className="vu-text-regenerate-note">{target ? `Replaces all ${target.replies.length} messages. Uses your configured AI.` : 'Latest completed reply only, before a scene or hangout.'}</span>
    {message && <p role="status">{message}</p>}
  </div>
}
