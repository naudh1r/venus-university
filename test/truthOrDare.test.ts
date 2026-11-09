import { describe, expect, it } from 'vitest'
import {
  READER,
  accountOf,
  answerHeard,
  answerRound,
  answeredOf,
  askerAt,
  chooseRound,
  chosenOf,
  clipped,
  evasive,
  heatOf,
  mannerOf,
  remarkCue,
  typedOf,
  judgeRound,
  judgedOf,
  onlooker,
  outcomeOf,
  playerAt,
  poseRound,
  posedOf,
  stock,
  tally,
  turnsIn,
  type Terms,
  type Turn
} from '../src/shared/minigameRules/truthOrDare'

/** Truth or Dare's bookkeeping: who goes and who asks, what a round is told, and what is kept. */

const table = (names: string[], rounds = 2, heat: 1 | 2 | 3 | 4 = 2): Terms => ({ names, rounds, heat })

const turn = (over: Partial<Turn>): Turn => ({
  player: READER,
  asker: 1,
  kind: 'truth',
  prompt: 'What scares you?',
  reply: 'Heights.',
  deed: '',
  verdict: 'honest',
  ...over
})

describe('Truth or Dare', () => {
  it('goes round the table from the reader, the player before asking', () => {
    for (const girls of [1, 2, 3]) {
      const terms = table(['Ana', 'Bea', 'Cy'].slice(0, girls), 2)
      const n = girls + 1
      expect(turnsIn(terms)).toBe(n * 2)
      const order = Array.from({ length: turnsIn(terms) }, (_, t) => playerAt(terms, t))
      expect(order).toEqual([...Array(n).keys(), ...Array(n).keys()])
      for (let t = 0; t < turnsIn(terms); t++) {
        expect(askerAt(terms, t)).toBe((playerAt(terms, t) + n - 1) % n)
        expect(askerAt(terms, t)).not.toBe(playerAt(terms, t))
      }
    }
    // With one girl the two ask each other; round three girls the last asks the reader.
    expect(askerAt(table(['Ana']), 0)).toBe(1)
    expect(askerAt(table(['Ana']), 1)).toBe(READER)
    expect(askerAt(table(['Ana', 'Bea', 'Cy']), 0)).toBe(3)
    expect(askerAt(table(['Ana', 'Bea', 'Cy']), 2)).toBe(1)
  })

  it('tells every round whose turn it is, who asks, the heat and what is already used', () => {
    const terms = table(['Ana', 'Bea'], 2, 3)
    const log = [turn({ asker: 2, prompt: 'Who was your first crush?' })]
    // Turn 2 is Ana's, and the reader asks.
    const plans = [
      chooseRound(terms, log),
      answerRound(terms, log, 'dare', 'Sing something.'),
      answerRound(terms, log, 'truth', 'What scares you?')
    ]
    for (const plan of plans) {
      expect(plan.brief).toContain("It is Ana's turn")
      expect(plan.brief).toContain('the reader is the one who asks')
      expect(plan.brief).toContain('Heat is 3 of 3')
      expect(plan.brief).toContain('"Who was your first crush?"')
      // Every field asked for is explained by name.
      for (const field of Object.keys(plan.fields)) expect(plan.brief).toContain(`"${field}" is`)
    }
    expect(plans[0].fields).toEqual({ choice: ['truth', 'dare'], line: 'text' })
    expect(plans[1].fields).toEqual({ line: 'text', action: 'text', outcome: ['done', 'chickened'], fair: ['yes', 'over'] })
    expect(plans[1].brief).toContain('"Sing something."')
    expect(plans[2].fields).toEqual({ line: 'text', outcome: ['honest', 'dodged'], fair: ['yes', 'over'] })

    // The reader's own turn: Bea asks, then judges what he typed, word for word.
    const mine = table(['Ana', 'Bea'], 1, 1)
    const posed = poseRound(mine, [], 'dare')
    expect(posed.brief).toContain("It is the reader's turn")
    expect(posed.brief).toContain('Bea is the one who asks')
    expect(posed.brief).toContain('Heat is 1 of 3')
    expect(posed.brief).toContain('Nothing has been asked or dared yet')
    expect(posed.fields).toEqual({ prompt: 'text' })
    const judged = judgeRound(mine, [], 'truth', 'What scares you?', 'the dark, honestly')
    expect(judged.brief).toContain('"the dark, honestly"')
    expect(judged.fields).toEqual({ line: 'text', verdict: ['honest', 'dodged'], fair: ['yes', 'over'] })
    for (const field of Object.keys(judged.fields)) expect(judged.brief).toContain(`"${field}" is`)
    // Backing out is settled by the table: she is asked for her line alone.
    expect(judgeRound(mine, [], 'dare', 'Sing.', null).fields).toEqual({ line: 'text' })
  })

  it('carries on from a round that came back empty', () => {
    expect(chosenOf(null, () => 0)).toEqual({ kind: 'truth', line: 'Truth.' })
    expect(chosenOf(null, () => 0.9)).toEqual({ kind: 'dare', line: 'Dare.' })
    expect(chosenOf({ choice: 'dare', line: 'Dare me.' })).toEqual({ kind: 'dare', line: 'Dare me.' })

    // A stock question, and never one already put.
    const first = posedOf(null, 'truth', 2, [])
    expect(first).not.toBe('')
    const second = posedOf(null, 'truth', 2, [turn({ prompt: first }), turn({ prompt: 'x' })])
    expect(second).not.toBe(first)
    const used = stock('dare', 3, [], 3)
    expect(stock('dare', 3, used, 3).some((dare) => used.includes(dare))).toBe(false)
    // Mild never reaches for a hotter list.
    const mild = stock('truth', 1, [], 50)
    expect(stock('truth', 3, [], 50).length).toBeGreaterThan(mild.length)
    expect(stock('truth', 2, [], 50).filter((q) => !mild.includes(q)).every((q) => !mild.includes(q))).toBe(true)

    // She cannot be answered for, nor a dare done for her: either is skipped with nothing said.
    expect(answeredOf(null, 'truth')).toEqual({ line: '', deed: '', verdict: 'skipped' })
    expect(answeredOf(null, 'dare')).toEqual({ line: '', deed: '', verdict: 'skipped' })
    // A dare said to be done with nothing seen done is a failed round, never a point.
    expect(answeredOf({ line: 'Fine.', action: ' ', outcome: 'done', fair: 'yes' }, 'dare').verdict).toBe('skipped')
    // Backing out is always honoured, with or without something seen.
    expect(answeredOf({ line: 'No way.', action: '', outcome: 'chickened', fair: 'yes' }, 'dare')).toEqual({
      line: 'No way.',
      deed: '',
      verdict: 'chickened'
    })
    expect(answeredOf({ line: 'No way.', action: 'Ana shakes her head.', outcome: 'chickened' }, 'dare')).toEqual({
      line: 'No way.',
      deed: 'Ana shakes her head.',
      verdict: 'chickened'
    })
    // The reader is taken at his word; backing out never scores, whatever came back.
    expect(judgedOf(null, 'truth', 'Heights.').verdict).toBe('honest')
    expect(judgedOf(null, 'dare', 'I sing.').verdict).toBe('done')
    expect(judgedOf({ line: 'Ha.', verdict: 'done' }, 'dare', null)).toEqual({ line: 'Ha.', verdict: 'chickened' })
    expect(judgedOf({ line: 'Hm.', verdict: 'dodged' }, 'truth', 'no comment')).toEqual({ line: 'Hm.', verdict: 'dodged' })
  })

  it('scores a straight answer or a dare done, and reads the result from the reader', () => {
    const terms = table(['Ana', 'Bea'], 1)
    const log = [
      turn({ player: 0, asker: 2, verdict: 'honest' }),
      turn({ player: 1, asker: 0, kind: 'dare', verdict: 'chickened' }),
      turn({ player: 2, asker: 1, kind: 'dare', verdict: 'done' })
    ]
    expect(tally(terms, log)).toEqual([1, 0, 1])
    expect(outcomeOf([1, 0, 1])).toBe('draw')
    expect(outcomeOf([2, 0, 1])).toBe('won')
    expect(outcomeOf([1, 2, 2])).toBe('lost')
    expect(outcomeOf([0, 0])).toBe('draw')
  })

  it('lets one girl outside the turn speak, within the cap and never on the last turn', () => {
    const terms = table(['Ana', 'Bea', 'Cy'], 1)
    const ducked = [turn({ player: 0, asker: 3, verdict: 'dodged' })]
    // Ana and Bea watched; nobody at a table of two did.
    expect([1, 2]).toContain(onlooker(terms, ducked, 'some', 0))
    expect(onlooker(terms, ducked, 'quiet', 0)).toBeNull()
    expect(onlooker(terms, ducked, 'some', 2)).toBeNull()
    expect(onlooker(terms, [turn({ player: 0, asker: 3 })], 'some', 0)).toBeNull()
    expect(onlooker(terms, [turn({ player: 0, asker: 3 })], 'lots', 0)).not.toBeNull()
    expect(onlooker(table(['Ana'], 2), [turn({ verdict: 'dodged' })], 'lots', 0)).toBeNull()
    const all = [ducked[0], ducked[0], ducked[0], ducked[0]]
    expect(onlooker(terms, all, 'lots', 0)).toBeNull()
  })

  it('keeps every question and answer in the account as it was given', () => {
    const terms = table(['Ana'], 1, 2)
    const log = [
      turn({ prompt: 'Who do you like?', reply: 'you, obviously', verdict: 'honest' }),
      turn({
        player: 1,
        asker: 0,
        kind: 'dare',
        prompt: 'Sing the fight song.',
        reply: 'Absolutely not.',
        deed: 'Ana hides her face.',
        verdict: 'chickened'
      })
    ]
    const account = accountOf(terms, log)
    expect(account).toHaveLength(5)
    expect(account[1]).toContain('Ana asked the reader: "Who do you like?"')
    expect(account[1]).toContain('the reader answered: "you, obviously"')
    expect(account[2]).toContain('the reader dared Ana: "Sing the fight song."')
    expect(account[2]).toContain('"Absolutely not."')
    expect(account[2]).toContain('Ana hides her face.')
    expect(account[2]).toContain('backed out')
    expect(account[3]).toContain('Ana once')
    expect(account[4]).toContain('the reader 1, Ana 0')
    // A turn the reader backed out of says so, with nothing put in his mouth.
    const backed = accountOf(terms, [turn({ kind: 'dare', reply: '', verdict: 'chickened' })])
    expect(backed[1]).toContain('the reader backed out')
    expect(backed[1]).not.toContain('said:')
  })

  it('treats a blank or repeated field as a failed round', () => {
    expect(chosenOf({ choice: 'dare', line: '   ' }, () => 0)).toEqual({ kind: 'truth', line: 'Truth.' })
    const stockOne = posedOf(null, 'truth', 2, [])
    expect(posedOf({ prompt: '  ' }, 'truth', 2, [])).toBe(stockOne)
    // What was already put this game is not put again, however it is cased.
    const log = [turn({ prompt: 'Who do you like?' })]
    expect(posedOf({ prompt: 'who do you like? ' }, 'truth', 2, log)).not.toMatch(/who do you like/i)
    expect(posedOf({ prompt: ' Why? ' }, 'truth', 2, log)).toBe('Why?')
    expect(answerHeard({ line: ' ', outcome: 'honest' }, 'truth')).toBeNull()
    expect(answerHeard({ line: 'Yes.', outcome: 'done' }, 'truth')).toBeNull()
    expect(answerHeard({ line: 'Fine.', action: '', outcome: 'done' }, 'dare')).toBeNull()
    expect(answerHeard({ line: 'Fine.', outcome: 'done' }, 'dare')).toBeNull()
    expect(answerHeard({ line: 'Heights.', outcome: 'honest' }, 'truth')).toEqual({
      line: 'Heights.',
      deed: '',
      verdict: 'honest'
    })
    expect(judgedOf({ line: ' ', verdict: 'dodged' }, 'truth', 'Heights.').verdict).toBe('honest')
    expect(judgedOf({ line: ' ' }, 'dare', null)).toEqual({ line: 'Backing out? Noted.', verdict: 'chickened' })
  })

  it('holds a skipped turn against nobody', () => {
    const terms = table(['Ana', 'Bea'], 1)
    const skipped = turn({ player: 1, asker: 0, reply: '', verdict: 'skipped' })
    expect(tally(terms, [skipped])).toEqual([0, 0, 0])
    expect(onlooker(terms, [skipped], 'lots', 0)).toBeNull()
    const account = accountOf(terms, [turn({ asker: 2 }), skipped, turn({ player: 2, asker: 1 })])
    expect(account[2]).toContain('the reader asked Ana: "What scares you?"')
    expect(account[2]).toContain('skipped')
    expect(account[2]).not.toContain('dodged')
    expect(account).toContain('Nobody dodged or backed out.')
    expect(account.some((line) => line.includes('Turns skipped') && line.includes('Ana once'))).toBe(true)
  })

  it('says every round what no heat permits and to keep each girl in character', () => {
    for (const heat of [1, 2, 3] as const) {
      const terms = table(['Ana'], 1, heat)
      const plans = [
        poseRound(terms, [], 'dare'),
        judgeRound(terms, [], 'dare', 'Sing.', 'I sing'),
        chooseRound(terms, [turn({})]),
        answerRound(terms, [turn({})], 'dare', 'Sing.')
      ]
      for (const plan of plans) {
        expect(plan.brief).toContain('never sexually explicit')
        expect(plan.brief).toContain('nothing physical beyond a kiss')
        expect(plan.brief).toContain('in her own character and voice')
      }
    }
  })

  it('accounts for a game left part-way without naming a winner', () => {
    const terms = table(['Ana'], 2)
    const account = accountOf(terms, [turn({ prompt: 'Who do you like?', reply: 'you' })])
    expect(account[1]).toContain('"Who do you like?"')
    const last = account[account.length - 1]
    expect(last).toContain('stopped after 1 of 4 turns')
    expect(last).toContain('the reader 1, Ana 0')
    expect(last).toContain('Nobody won')
    expect(last).not.toContain('Final tally')
  })

  it('voids a turn that goes past what was agreed, with no point and nothing repeated', () => {
    const terms = table(['Ana', 'Bea'], 1, 1)
    // Her turn, his question over the line: void whatever else came back, even as done.
    expect(answeredOf({ line: 'Not that.', action: 'Ana does it.', outcome: 'done', fair: 'over' }, 'dare')).toEqual({
      line: 'Not that.',
      deed: '',
      verdict: 'void'
    })
    expect(answerHeard({ line: '', outcome: 'honest', fair: 'over' }, 'truth')?.verdict).toBe('void')
    // His turn, what he typed over the line: void, not a point for typing it.
    expect(judgedOf({ line: 'Ha, no.', verdict: 'done', fair: 'over' }, 'dare', 'something lewd')).toEqual({
      line: 'Ha, no.',
      verdict: 'void'
    })
    expect(judgedOf({ line: 'Ha.', verdict: 'done', fair: 'over' }, 'dare', null).verdict).toBe('chickened')
    const hers = turn({ player: 1, asker: 0, kind: 'dare', prompt: 'OFFENDING DARE', reply: 'Not that.', verdict: 'void' })
    const his = turn({ player: 0, asker: 2, prompt: 'What scares you?', reply: 'OFFENDING ANSWER', verdict: 'void' })
    expect(tally(terms, [hers, his])).toEqual([0, 0, 0])
    const account = accountOf(terms, [hers, his]).join('\n')
    expect(account).not.toContain('OFFENDING')
    expect(account).toContain('turn void, no point to anyone')
    expect(account).toContain('Turns called void for going past what was agreed: 2.')
    expect(account).toContain('Nobody dodged or backed out.')
    // Not carried into later briefs, nor to whoever remarks on it.
    expect(chooseRound(table(['Ana', 'Bea'], 2, 1), [hers]).brief).not.toContain('OFFENDING')
    expect(remarkCue(terms, hers)).not.toContain('OFFENDING')
    expect(remarkCue(terms, his)).not.toContain('OFFENDING')
    expect(remarkCue(terms, hers)).toContain('void')
  })

  it('lets the reader lose a turn on merit', () => {
    const brief = judgeRound(table(['Ana']), [], 'truth', 'What scares you?', 'lol').brief
    expect(brief).toContain('one-word evasion does not score')
    expect(brief).not.toContain('at his word')
    expect(judgedOf({ line: 'Nice try.', verdict: 'dodged', fair: 'yes' }, 'truth', 'ha, you wish').verdict).toBe('dodged')
    expect(judgedOf({ line: 'Coward.', verdict: 'chickened', fair: 'yes' }, 'dare', 'I refuse to').verdict).toBe('chickened')
    // With no model, a word that only waves it off does not score; a real one-word answer does.
    for (const duck of ['pass', 'No.', 'no comment', '...', '?!', 'idk']) {
      expect(evasive(duck)).toBe(true)
      expect(judgedOf(null, 'truth', duck).verdict).toBe('dodged')
      expect(judgedOf(null, 'dare', duck).verdict).toBe('chickened')
    }
    expect(evasive('Heights.')).toBe(false)
    // Nothing but punctuation never scores, whatever the judge said.
    expect(judgedOf({ line: 'Sure.', verdict: 'honest', fair: 'yes' }, 'truth', '...').verdict).toBe('dodged')
  })

  it('holds the remark of a girl watching to the same limit and heat', () => {
    const terms = table(['Ana', 'Bea'], 1, 2)
    const cue = remarkCue(terms, turn({ asker: 2, reply: 'you, obviously', verdict: 'dodged' }))
    expect(cue).toContain('"you, obviously"')
    expect(cue).toContain('never sexually explicit')
    expect(cue).toContain('flirty')
    expect(cue).toContain('never lifts that limit')
  })

  it('tells every round the table is adults, that a stake lifts nothing, and how each girl plays', () => {
    const terms: Terms = { ...table(['Ana', 'Bea'], 1), manner: [mannerOf(5, 'teases, fearless.'), mannerOf(1, '')] }
    for (const plan of [poseRound(terms, [], 'truth'), chooseRound(terms, [turn({ asker: 2 })])]) {
      expect(plan.brief).toContain('Everyone at the table is an adult.')
      expect(plan.brief).toContain('never lifts that limit')
      expect(plan.brief).toContain('by how she has been with him')
      expect(plan.brief).toContain('Ana is bold and quick at this game')
      expect(plan.brief).toContain('teases, fearless. Bea is cautious at this game')
    }
    expect(poseRound(table(['Ana']), [], 'truth').brief).not.toContain('How each plays')
  })

  it('keeps what the model writes and what the reader types to one line of fair length', () => {
    const long = `${'A sentence here. '.repeat(30)}`
    const cut = clipped(long)
    expect(cut.length).toBeLessThanOrEqual(300)
    expect(cut.endsWith('here.')).toBe(true)
    const unbroken = clipped('word '.repeat(100).replace(/ /g, ', '))
    expect(unbroken.length).toBeLessThanOrEqual(300)
    expect(unbroken.endsWith('…')).toBe(true)
    expect(clipped('x'.repeat(400)).length).toBe(300)
    expect(clipped('Short\n one.')).toBe('Short one.')
    expect(posedOf({ prompt: long }, 'truth', 2, []).length).toBeLessThanOrEqual(300)
    expect(chosenOf({ choice: 'dare', line: long }).line.length).toBeLessThanOrEqual(300)
    expect(answerHeard({ line: long, action: long, outcome: 'done', fair: 'yes' }, 'dare')?.deed.length).toBeLessThanOrEqual(300)
    expect(typedOf('  one\n\ntwo\r\n three  ')).toBe('one two three')
    expect(typedOf('y'.repeat(500)).length).toBe(240)
    expect(typedOf(' \n ')).toBe('')
  })

  it('offers no stock dare that outlasts the moment', () => {
    for (const dare of stock('dare', 3, [], 50)) {
      expect(dare).not.toMatch(/next turn|rest of the game/i)
    }
  })

  it('opens at heat 4 to what a scene allows, with her own say and the game kept where they are', () => {
    expect(heatOf(4)).toBe(4)
    const terms = table(['Ana'], 1, 4)
    const plans = [
      poseRound(terms, [], 'dare'),
      judgeRound(terms, [], 'dare', 'Sing.', 'I sing'),
      chooseRound(terms, [turn({})]),
      answerRound(terms, [turn({})], 'dare', 'Sing.')
    ]
    for (const plan of plans) {
      expect(plan.brief).toContain('Heat is 4 of 4')
      expect(plan.brief).toContain('may be sexually explicit')
      expect(plan.brief).toContain('only as far as she really would with him')
      expect(plan.brief).toContain('anyone may back out of anything')
      expect(plan.brief).toContain('Everyone at the table is an adult.')
      expect(plan.brief).toContain('never lifts that limit')
      expect(plan.brief).not.toContain('never sexually explicit')
    }
    expect(remarkCue(terms, turn({}))).toContain('may be sexually explicit')
    // Its stand-ins stop at bold: nothing past that is written in ahead of the model.
    expect(stock('dare', 4, [], 50)).toEqual(stock('dare', 3, [], 50))
    expect(stock('truth', 4, [], 50)).toEqual(stock('truth', 3, [], 50))
  })

  it('keeps every other heat to the party limit, word for word, and says it of 3', () => {
    for (const heat of [1, 2, 3] as const) {
      const brief = poseRound(table(['Ana'], 1, heat), [], 'dare').brief
      expect(brief).toContain(`Heat is ${heat} of 3,`)
      expect(brief).toContain(
        'Whatever the heat, everything asked, dared, said and done stays within what adults playing this at a party, in company, would really say and do: never sexually explicit in word or deed, no undressing, and nothing physical beyond a kiss.'
      )
      expect(brief).not.toContain('may be sexually explicit')
    }
  })
})
