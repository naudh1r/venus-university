import type { JSX } from 'react'
import { motion } from 'motion/react'
import type { ComfyModelPicks } from '@shared/comfyModels'
import { comfyTestWordOf, type ComfyProbeState } from '../views/useComfyProbe'
import { gestures, quietLift, quietPress } from '../views/motion'
import { missingModelLines } from './ComfyModelPicker'
import { TextField } from './TextField'
import '../vu_styles/ComfyModels.css'

export interface ComfyEndpointFieldsProps {
  /** Prefixes every control's id, so two screens' fields never share one. */
  idPrefix: string
  url: string
  onUrlChange: (url: string) => void
  probe: ComfyProbeState
  /** The picks shown beside these fields, which a test checks against the server's lists. */
  picks: ComfyModelPicks | undefined
}

/**
 * Where the player's own ComfyUI answers, and the test that asks it: the word it comes back
 * with, and under it every line saying what the server lacks — its packs' nodes, ComfyUI's own,
 * and the models picked beside it.
 */
export function ComfyEndpointFields({
  idPrefix,
  url,
  onUrlChange,
  probe,
  picks
}: ComfyEndpointFieldsProps): JSX.Element {
  const { test } = probe
  const verdict = typeof test === 'object' && 'missingNodes' in test ? test : null
  const modelLines = verdict ? missingModelLines(picks, probe.models, 'external') : []
  const testWord = comfyTestWordOf(test, modelLines.length)

  return (
    <>
      {/* Leaving it asks the server again, so the pickers have its models to offer. */}
      <TextField
        id={`${idPrefix}-url`}
        label="Endpoint URL"
        hint="The base URL of your ComfyUI server"
        value={url}
        onChange={onUrlChange}
        onBlur={() => void probe.refreshModels()}
      />

      <div className="vu-test-row">
        <motion.button
          id={`${idPrefix}-test`}
          className="vu-btn vu-btn--quiet"
          type="button"
          disabled={probe.testDead}
          {...gestures(probe.testDead, quietLift, quietPress)}
          onClick={() => void probe.runTest()}
        >
          Test connection
        </motion.button>
        {testWord && <span className="vu-btn-sub">{testWord}</span>}
        <span className="vu-check-note">ComfyUI must be running to test the connection.</span>
        {typeof test === 'object' && 'error' in test && (
          <span className="vu-test-note">{test.error.message}</span>
        )}
        {verdict?.missingNodes.map((group) => (
          <span className="vu-test-note" key={group.pack ?? 'core'}>
            {group.pack === null
              ? `Missing core nodes (update ComfyUI): ${group.classes.join(', ')}`
              : `Missing nodes from ${group.pack}: ${group.classes.join(', ')}`}
          </span>
        ))}
        {modelLines.map((line) => (
          <span className="vu-test-note" key={line}>
            {line}
          </span>
        ))}
      </div>
    </>
  )
}
