import './fixtures/maestroModelKit'
import { expect, it } from 'vitest'
import { stubApi, restoreApi } from './fixtures'

it('admits all prepared legacy semester fields after renderer registration, including disabled mods', async () => {
  stubApi({ jobs: { onProgress: () => () => {} } })
  try {
    await import('@vx/modkit/shared')
    const { carriedModFields } = await import('../src/shared/modCarry')
    const { useModsStore } = await import('../src/renderer/stores/modsStore')
    const fields = {
      breakthrough: 'exBreakthrough', 'campus-talents': 'exTalents',
      'character-dynamics': 'exCharacterDynamics', echo: 'exEcho',
      'meanwhile-conversations': 'exNpcWatch', reckoning: 'exReckoning',
      'starting-challenge': 'exStartingChallenge', 'story-memory': 'exStoryMemory',
      'venus-whisper': 'exVenusWhisper'
    }
    const carry = Object.fromEntries(Object.values(fields).map(field => [field, { retained: field }]))
    expect(carriedModFields(carry)).toEqual({})
    useModsStore.setState({ switches: { on: Object.fromEntries(Object.keys(fields).map(id => [id, false])), options: {} } })
    await import('../src/renderer/modEntries/breakthrough')
    await import('../src/renderer/modEntries/campus-talents')
    await import('../src/renderer/modEntries/character-dynamics')
    await import('../src/renderer/modEntries/echo')
    await import('../src/renderer/modEntries/meanwhile-conversations')
    await import('../src/renderer/modEntries/reckoning')
    await import('../src/renderer/modEntries/starting-challenge')
    await import('../src/renderer/modEntries/story-memory')
    await import('../src/renderer/modEntries/venus-whisper')
    expect(carriedModFields(carry)).toEqual(carry)
  } finally {
    restoreApi()
  }
})
