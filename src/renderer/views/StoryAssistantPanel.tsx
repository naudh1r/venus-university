import { useEffect, useState, type JSX, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  submitAction,
  takeTurnFromReply,
  TextField,
  TitleTab,
  useModalShell,
  veilIn,
  type ScenePanelProps,
  type SceneSeatProps
} from '@vx/modkit/renderer'
import { ASSISTANT_ACTION_LIMIT, ASSISTANT_QUESTION_LIMIT } from '../../shared/storyAssistant'
import {
  askAssistant,
  assistantNow,
  useAssistantNow,
  useAssistantSeat,
  useChoiceCount
} from '../stores/storyAssistant'
import { spin } from './motion'
import '../vu_styles/StoryAssistant.css'

/** The assistant's mark: a speech bubble with a thought trailing in it. */
function AssistantIcon(): JSX.Element {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  )
}

/** The assistant's seat on the rail: there through a cast scene, and live on the reader's turn. */
export function StoryAssistantSeat({ Seat, visible, open }: SceneSeatProps): JSX.Element {
  const seat = useAssistantSeat()
  return (
    <Seat label="Story Assistant" state={visible ? seat : 'gone'} onClick={open}>
      <AssistantIcon />
    </Seat>
  )
}

/** Enter runs `go`, as it sends a turn in the scene; Shift+Enter still breaks a line. */
function enterRuns(go: () => void): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.stopPropagation()
    go()
  }
}

/**
 * What the assistant makes of the scene, and the ways forward it offers. Opened, it reads the
 * scene at once unless it already has where the scene stands; a way forward picked fills the
 * turn, which the player may change before it goes out as his turn in the scene.
 */
export function StoryAssistantPanel({ theme, onClose }: ScenePanelProps): JSX.Element | null {
  const seat = useAssistantSeat()
  const choices = useChoiceCount()
  const { read: current, asking: underWay, failed } = useAssistantNow()
  const [question, setQuestion] = useState(() => current?.question ?? underWay?.question ?? '')
  const [turn, setTurn] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const read = current?.reply ?? null
  const asking = underWay !== null
  const error = sendError ?? failed?.message ?? null

  // Opened with nothing for this point of the scene, nor a read on its way, it reads the scene at
  // once. Closing the panel leaves a read under way to land in the menu over the stage.
  useEffect(() => {
    const now = assistantNow()
    if (!now.read && !now.asking && !now.failed) void askAssistant('', choices)
  }, [])

  const askDead = asking || seat !== 'shown'
  const sendDead = !turn.trim() || seat !== 'shown'
  const askNow = (): void => {
    if (askDead) return
    setSendError(null)
    void askAssistant(question, choices)
  }
  const send = (): void => {
    if (sendDead) return
    if (!takeTurnFromReply()) {
      setSendError('The scene cannot take a turn right now.')
      return
    }
    void submitAction(turn.trim())
    onClose()
  }

  const { host, overlayProps } = useModalShell(onClose)
  if (!host) return null
  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.div
        id="story-assistant-panel"
        className="vu-sheet vu-assistant vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Story Assistant"
        aria-busy={asking}
        variants={panelUnderTab}
      >
        <TitleTab>Story Assistant</TitleTab>

        <div className="vu-assistant-body">
          <div onKeyDown={enterRuns(askNow)}>
            <TextField
              id="story-assistant-question"
              label="Ask about the scene"
              hint="Leave it blank for a read of the scene as a whole."
              value={question}
              onChange={setQuestion}
              maxLength={ASSISTANT_QUESTION_LIMIT}
            />
          </div>

          {asking ? (
            <p className="vu-assistant-state" role="status">
              <motion.span className="vu-ring" animate={spin} />
              Reading the scene…
            </p>
          ) : error ? (
            <p className="vu-assistant-state" role="alert">
              {error}
            </p>
          ) : read?.commentary ? (
            <p className="vu-assistant-read">{read.commentary}</p>
          ) : null}

          {!asking && read && read.suggestions.length > 0 && (
            <ul className="vu-rows vu-assistant-ways" aria-label="Ways forward">
              {read.suggestions.map((way) => (
                <li key={way.action}>
                  <motion.button
                    type="button"
                    className="vu-row vu-assistant-way"
                    {...gestures(false, rowLift, rowPress)}
                    onClick={() => setTurn(way.action)}
                  >
                    <span className="vu-assistant-wayname">{way.label}</span>
                    <span className="vu-assistant-wayaction">{way.action}</span>
                  </motion.button>
                </li>
              ))}
            </ul>
          )}

          <div onKeyDown={enterRuns(send)}>
            <TextField
              id="story-assistant-turn"
              label="Your turn"
              hint="Pick a way forward or write your own, and change it however you like."
              value={turn}
              onChange={setTurn}
              maxLength={ASSISTANT_ACTION_LIMIT}
              multiline
              rows={2}
            />
          </div>
        </div>

        <div className="vu-foot">
          <motion.button
            id="story-assistant-back"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={onClose}
          >
            Back
          </motion.button>
          <motion.button
            id="story-assistant-ask"
            className="vu-btn vu-btn--quiet"
            type="button"
            disabled={askDead}
            {...gestures(askDead, quietLift, quietPress)}
            onClick={askNow}
          >
            {question.trim() ? 'Ask' : 'Read again'}
          </motion.button>
          <motion.button
            id="story-assistant-send"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            disabled={sendDead}
            {...gestures(sendDead, lift, press)}
            onClick={send}
          >
            Send
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
