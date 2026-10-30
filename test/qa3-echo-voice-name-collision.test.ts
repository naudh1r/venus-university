import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { firstPersonThought } from '@shared/reckoningVoice'
import type { Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useSettingsStore } from '../src/renderer/stores/settingsStore'
import { startReckoning, unlockReckoningDungeon } from '../src/renderer/stores/reckoning'
import { enterReckoningDungeon } from '../src/renderer/stores/reckoningDungeon'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, restoreApi, sceneLines, stubApi } from './fixtures'

const game = () => useGameStore.getState()
it.each([
 ['Hope Avery', 'My hope is all I have left.'],
 ['Faith Avery', 'I worry that my faith is misplaced.'],
 ['May Avery', 'I may never be good enough.']
])('keeps ordinary first-person words for %s intact in the shared whisper validator', (name, line) => {
 expect(firstPersonThought(line, name)).toBe(line)
 expect(firstPersonThought(`I know ${name.split(' ')[0]} believes this.`, name)).toBeNull()
})
const questions = { thoughts: [
 { belief: 'If I ask for help, I am a burden.', challenge: 'You will eventually get tired of me.', evidence: ['e1','e4'] },
 { belief: 'One mistake makes me a failure.', challenge: 'Why would anyone stay if I fail?', evidence: ['e1','e4'] },
 { belief: 'I have to earn every bit of kindness.', challenge: 'What would be left if I stopped proving myself?', evidence: ['e1','e4'] }
] }
let stop: (() => void) | undefined
const complete = vi.fn<(...args: Parameters<typeof window.api.llm.completeMod>) => Promise<Result<unknown>>>()
const cancel = vi.fn(async () => ({ ok: true as const, data: undefined }))
const saved: SaveDraft[] = []
beforeEach(() => {
 vi.useFakeTimers(); game().reset(); resetLoopState(); saved.length = 0
 complete.mockReset().mockResolvedValue({ ok: true, data: questions }); cancel.mockClear()
 useSettingsStore.setState({ settings: null })
 useModsStore.setState({ switches: { on: { echo: false, reckoning: true, breakthrough: true }, options: { 'reckoning:prepare-questions': true } } })
 const lines = sceneLines('We talked about asking for help.')
 useGameStore.setState({ playthroughId: 'qa3-pending-opening', date: 15, time: 0, chars: ['a'], cast: ['a'], playerFirstName: 'Sam', playerLastName: 'Lee',
  characters: charactersById(character({ charId: 'a', firstName: 'Nina', personality: 'Outspoken but afraid of failing.' })),
  charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 6 }, (_, i) => ({ date: 15, type: 'loved' as const, desc: `The reader listened on occasion ${i}.` })) }) },
  awaitingInput: true, currentSceneTranscript: lines, sceneLog: lines, currentLine: lines[0], exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } }) })
 stubApi({ llm: { completeMod: complete }, jobs: { cancelGroup: cancel }, saves: { autosave: async (_id, draft) => {
  saved.push(structuredClone(draft)); return { ok: true, data: { ...draft, playthroughId: 'qa3-pending-opening', saveId: 'autosave', saveDate: 0 } }
 } } })
})
afterEach(async () => { stop?.(); stop = undefined; await writesSettled(); restoreApi(); vi.useRealTimers() })
async function finishSceneAndEnter() {
 useGameStore.setState({ time: 1, currentSceneTranscript: [], sceneLog: [], currentLine: null, sceneSummary: null, pendingLines: [], cast: [], awaitingInput: true })
 await enterReckoningDungeon()
 await startReckoning('a')
}

it.each([
 ['May', 'I may never be good enough for anyone.'],
 ['Hope', 'I hope for kindness, but I expect people to leave.']
])('accepts a genuine first-person opening for a character named %s', async (firstName, belief) => {
 const girl = game().characters.a
 useGameStore.setState({ characters: charactersById({ ...girl, firstName, lastName: 'Avery' }) })
 complete.mockResolvedValue({ ok: true, data: { thoughts: [{ ...questions.thoughts[0], belief }, ...questions.thoughts.slice(1)] } })
 await unlockReckoningDungeon('a')
 expect(game().exBreakthrough.meters.a).toBe(0)
 // This is a paid link with ordinary first-person words, not narration naming the speaker.
 await expect(finishSceneAndEnter()).resolves.toBeUndefined()
 expect(game().exReckoning.active?.thoughts[0].belief).toBe(belief)
})

it.each([
 'I may never be good enough for anyone.',
 'I hope for kindness, but I expect people to leave.'
])('accepts the identical first-person opening when the name is Nina', async belief => {
 complete.mockResolvedValue({ ok: true, data: { thoughts: [{ ...questions.thoughts[0], belief }, ...questions.thoughts.slice(1)] } })
 await unlockReckoningDungeon('a')
 await expect(finishSceneAndEnter()).resolves.toBeUndefined()
 expect(game().exReckoning.active?.thoughts[0].belief).toBe(belief)
})
