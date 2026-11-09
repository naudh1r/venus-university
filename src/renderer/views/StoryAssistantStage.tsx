import { useEffect, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  dealt,
  gestures,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  submitAction,
  takeTurnFromReply,
  useModOption,
  type ScreenSlotProps
} from '@vx/modkit/renderer'
import { ASSISTANT_POPUP, STORY_ASSISTANT } from '../../shared/storyAssistant'
import {
  askAssistant,
  assistantNow,
  useAssistantCancels,
  useAssistantNow,
  useAssistantSeat,
  useChoiceCount,
  useSceneStarted
} from '../stores/storyAssistant'
import { dealtItem, spin } from './motion'
import '../vu_styles/StoryAssistant.css'

/** The ways forward deal out one after another as the menu arrives. */
const CHOICES_DEALT = dealt(0.05)

/**
 * Story Assistant over the stage, on the reader's turn: its ways forward stood as a visual
 * novel's menu, one press each sending a way as his turn, and while there are none yet, one line
 * saying a read is on its way or why it failed. With the pop-up option on it reads the scene of
 * its own accord at every decision point; either way, a read asked for from the panel stands here
 * too.
 */
export function StoryAssistantStage({
  sceneMode,
  cinematic,
  covered,
  uiHidden,
  blocked,
  quiz
}: ScreenSlotProps['stageLayer']): JSX.Element | null {
  const seat = useAssistantSeat()
  const started = useSceneStarted()
  const popup = useModOption(STORY_ASSISTANT, ASSISTANT_POPUP)
  const choices = useChoiceCount()
  const { read, asking, failed } = useAssistantNow()
  const shown = sceneMode && !cinematic && !covered && !uiHidden && !blocked && !quiz && seat === 'shown'
  useAssistantCancels()

  // Once a point, and only on a scene with lines on it: a failure waits for its Retry rather than
  // being sent again on its own. The store is read again as the effect runs, so an ask already
  // out for this point is never sent twice.
  const due =
    popup && sceneMode && !cinematic && started && seat === 'shown' &&
    !covered && !blocked && !read && !asking && !failed
  useEffect(() => {
    if (!due) return
    const now = assistantNow()
    if (!now.read && !now.asking && !now.failed) void askAssistant('', choices)
  }, [due])

  const ways = read?.reply.suggestions ?? []
  if (!shown || (ways.length === 0 && !asking && !failed)) return null

  const choose = (action: string): void => {
    if (takeTurnFromReply()) void submitAction(action)
  }

  return (
    <div className="vu-assistant-stage">
      {asking || failed ? (
        <motion.p
          key={`note-${(asking ?? failed)?.group}`}
          className="vu-assistant-note vu-paper"
          variants={dealtItem}
          initial="hidden"
          animate="shown"
          role={failed ? 'alert' : 'status'}
        >
          {asking ? (
            <>
              <motion.span className="vu-ring" animate={spin} />
              Thinking it over…
            </>
          ) : (
            <>
              {failed?.message}
              <motion.button
                type="button"
                className="vu-pill vu-assistant-retry"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => failed && void askAssistant(failed.question, choices)}
              >
                Retry
              </motion.button>
            </>
          )}
        </motion.p>
      ) : (
        <motion.ul
          key={`ways-${read?.group}`}
          className="vu-assistant-menu"
          aria-label="Ways forward"
          variants={CHOICES_DEALT}
          initial="hidden"
          animate="shown"
        >
          {ways.map((way) => (
            <motion.li key={way.action} variants={dealtItem}>
              <motion.button
                type="button"
                className="vu-assistant-choice vu-paper"
                {...gestures(false, rowLift, rowPress)}
                onClick={() => choose(way.action)}
              >
                <span className="vu-assistant-choicename">{way.label}</span>
                <span className="vu-assistant-choiceaction">{way.action}</span>
              </motion.button>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  )
}
