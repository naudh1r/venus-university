import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { modNames, modsOn } from '@shared/mods'
import { useModsStore } from '../stores/modsStore'
import { gestures, quietLift, quietPress } from '../views/motion'
import { reportText, type ReportOf } from './report'

/** Puts a report on the clipboard, with the mods that are on. False where it would not take it. */
async function copyReport(report: ReportOf): Promise<boolean> {
  try {
    const mods = modNames(modsOn(useModsStore.getState().switches))
    await navigator.clipboard.writeText(reportText(report, mods))
    return true
  } catch {
    return false
  }
}

/** Copies what a bug report about a game needs, and says so where it was pressed. */
export function ReportButton({ id, report }: { id: string; report: () => ReportOf }): JSX.Element {
  const [said, setSaid] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <motion.button
      id={id}
      className="vu-pill vu-minigame-report"
      type="button"
      title="Copies the game, how it is set and how it stands, to paste into a bug report"
      {...gestures(false, quietLift, quietPress)}
      onClick={() => {
        void copyReport(report()).then((copied) => {
          setSaid(copied ? 'Copied' : 'Could not copy')
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setSaid(null), 1800)
        })
      }}
    >
      {said ?? 'Copy bug report'}
    </motion.button>
  )
}
