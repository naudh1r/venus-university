import { useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { gestures, quietLift, quietPress, TextField, type ModDetailProps } from '@vx/modkit/renderer'
import { ASSISTANT_PROMPT_LIMIT } from '../../shared/storyAssistant'
import { DEFAULT_ASSISTANT_PROMPT } from '../prompts/storyAssistantPrompt'
import { saveAssistantPrompt, storedAssistantPrompt } from '../stores/storyAssistant'
import '../vu_styles/StoryAssistant.css'

/**
 * Story Assistant's page on the Mods screen: its options as the screen draws any mod's, then the
 * prompt every read is written from, kept as the box is left. A value it cannot keep stays in the
 * box with the reason under it; Reset to default puts the shipped prompt back.
 */
export function StoryAssistantPage({ mod, Switch, optionOn, setOption }: ModDetailProps): JSX.Element {
  const [stored, setStored] = useState(storedAssistantPrompt)
  const [text, setText] = useState(stored ?? DEFAULT_ASSISTANT_PROMPT)
  const [problem, setProblem] = useState<string | null>(null)

  function keep(value: string): void {
    if (value.trim() === (stored ?? DEFAULT_ASSISTANT_PROMPT)) return
    setProblem(saveAssistantPrompt(value))
    setStored(storedAssistantPrompt())
  }

  function reset(): void {
    setText(DEFAULT_ASSISTANT_PROMPT)
    setProblem(saveAssistantPrompt(''))
    setStored(storedAssistantPrompt())
  }

  const options = mod.options ?? []
  const group = mod.optionGroups?.[0]
  const single = options.filter((option) => !option.group)
  const grouped = options.filter((option) => option.group === group?.id)

  return (
    <>
      <h4 className="vu-mods-label">Options</h4>
      <ul className="vu-mods-options">
        {single.map((option) => (
          <li key={option.id} className="vu-mods-option">
            <span className="vu-mods-option-text">
              <span className="vu-mods-option-label">{option.label}</span>
              <span className="vu-mods-option-hint">{option.hint}</span>
            </span>
            <Switch
              id={`mods-option-${mod.id}-${option.id}`}
              label={option.label}
              on={optionOn(option.id)}
              onChange={(on) => setOption(option.id, on)}
            />
          </li>
        ))}
        {group && (
          <li className="vu-mods-option vu-mods-group">
            <span className="vu-mods-option-text">
              <span className="vu-mods-option-label">{group.label}</span>
              <span className="vu-mods-option-hint">{group.hint}</span>
            </span>
            <ul className="vu-mods-group-list">
              {grouped.map((option) => (
                <li key={option.id} className="vu-mods-group-row">
                  <span className="vu-mods-group-label">{option.label}</span>
                  <Switch
                    id={`mods-option-${mod.id}-${option.id}`}
                    label={option.label}
                    on={optionOn(option.id)}
                    onChange={(on) => setOption(option.id, on)}
                  />
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>

      <div className="vu-assistant-prompthead">
        <h4 className="vu-mods-label">Prompt</h4>
        {stored !== undefined && (
          <motion.button
            id="story-assistant-reset"
            type="button"
            className="vu-pill"
            {...gestures(false, quietLift, quietPress)}
            onClick={reset}
          >
            Reset to default
          </motion.button>
        )}
      </div>
      <TextField
        id="story-assistant-prompt"
        label="What every read is written from"
        hint="Who the assistant is and what it writes. How many choices to offer is added from the option above."
        value={text}
        onChange={(value) => {
          setText(value)
          setProblem(null)
        }}
        onBlur={() => keep(text)}
        maxLength={ASSISTANT_PROMPT_LIMIT}
        multiline
        rows={12}
      />
      {problem && (
        <p className="vu-mods-option-hint" role="alert">
          {problem}
        </p>
      )}
    </>
  )
}
