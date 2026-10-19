import { describe, expect, it } from 'vitest'
import type { MiniGameDef } from '../src/shared/minigames'
import { reportText } from '../src/renderer/minigames/report'
import { faultOf, noteFault } from '../src/renderer/minigames/faults'

const game: MiniGameDef = {
  id: 'cards',
  modId: 'cards-pack',
  name: 'Cards',
  icon: '🂡',
  blurb: 'a hand of cards',
  players: { min: 1, max: 3 },
  format: 'One hand.',
  skillBrief: 'Card sense.',
  stepped: false
}

describe('a bug report about a game', () => {
  it('says which game, how it is set and how it stood, and leaves room for what happened', () => {
    const text = reportText({
      game,
      girls: 2,
      options: { hands: 3 },
      account: ['You lead 2 to 1.']
    })
    expect(text).toContain('Mini-game report: Cards (cards)')
    expect(text).toContain('Text: moves on by itself; play-by-play off')
    expect(text).toContain('Girls playing: 2')
    expect(text).toContain('Options: hands 3')
    expect(text).toContain('  You lead 2 to 1.')
    expect(text.trim().endsWith('What happened (your words):')).toBe(true)
  })

  it('carries the last time the game broke off, and only for that game', () => {
    expect(reportText({ game })).not.toContain('Last fault')
    noteFault('cards', new Error('cannot read the deck'))
    expect(faultOf('cards')?.message).toContain('cannot read the deck')
    expect(reportText({ game })).toContain('cannot read the deck')
    expect(reportText({ game: { ...game, id: 'dice' } })).not.toContain('Last fault')
  })
})
