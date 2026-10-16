import { describe, expect, it } from 'vitest'
import CAT_PAIRS from '../src/shared/minigameEntries/cat-pairs'
import {
  catDue,
  catMoved,
  catPick,
  catSwap,
  catVisits,
  cleared,
  faceDown,
  gameAccount,
  gameOutcome,
  gameSummary,
  herFirst,
  herSecond,
  isOver,
  judge,
  newGame,
  observe,
  pairCounts,
  playTurn,
  seeded,
  turnsMade,
  type Game,
  type Memory,
  type Skill
} from '../src/shared/minigameRules/catPairs'
import { MINI_GAMES, MINI_GAMES_LIST, gamesOffered, settledOptions } from '../src/shared/minigames'

/** Cat Pairs' rules: the deal, turns and scoring, the cat's swaps, and how she plays from memory. */

const never = (): number => {
  throw new Error('guessed')
}

/** A table with the cards in a known order: cat `i` lies at places `2i` and `2i + 1`. */
function laid(seats: number, pairs: number, visits: number[] = []): Game {
  const cards = Array.from({ length: pairs * 2 }, (_, at) => Math.floor(at / 2))
  return {
    ...newGame(seats, pairs, false, seeded(1)),
    cards,
    visits
  }
}

/** The places of each cat's two cards. */
function placesOf(game: Game): Map<number, number[]> {
  const places = new Map<number, number[]>()
  game.cards.forEach((cat, at) => places.set(cat, [...(places.get(cat) ?? []), at]))
  return places
}

/** A whole game played by girls of the given skills in every seat, from one seed. */
function playedOut(skills: Skill[], pairs: number, cats: boolean, seed: number): Game {
  const rand = seeded(seed)
  let game = newGame(skills.length, pairs, cats, rand)
  let memories: Memory[] = skills.map(() => [])
  const see = (at: number): void => {
    memories = memories.map((memory, i) => observe(memory, at, game.cards[at], skills[i], rand))
  }
  for (let guard = 0; !isOver(game) && guard < 5000; guard++) {
    const seat = game.turn
    const first = herFirst(game, memories[seat], rand)
    see(first)
    const second = herSecond(game, memories[seat], first, skills[seat], rand)
    see(second)
    game = playTurn(game, first, second)
    const made = turnsMade(game).at(-1)!
    if (made.run > 0) memories = memories.map((memory) => cleared(memory, [first, second]))
    else if (catDue(game)) {
      const [a, b] = catPick(game, rand)
      memories = memories.map((memory, i) => catMoved(memory, a, b, skills[i], rand))
      game = catSwap(game, a, b)
    }
  }
  return game
}

describe('Cat Pairs', () => {
  it('lays every chosen cat on exactly two cards, for every size of game', () => {
    for (let pairs = 6; pairs <= 12; pairs++) {
      const game = newGame(2, pairs, true, seeded(pairs))
      expect(game.cards).toHaveLength(pairs * 2)
      const places = placesOf(game)
      expect(places.size).toBe(pairs)
      expect([...places.values()].every((at) => at.length === 2)).toBe(true)
      expect(game.visits.length).toBeGreaterThanOrEqual(2)
      expect(game.visits.every((due) => due >= 1 && due <= pairs - 3)).toBe(true)
    }
    expect(newGame(1, 8, false, seeded(3)).visits).toEqual([])
    expect(catVisits(12, seeded(4))).toHaveLength(3)
    // The same seed lays the same table.
    expect(newGame(3, 9, true, seeded(7))).toEqual(newGame(3, 9, true, seeded(7)))
  })

  it('gives a pair to whoever turned it and another go, and passes the turn on a miss', () => {
    for (const seats of [1, 2, 3, 4]) {
      let game = laid(seats, 6)
      game = playTurn(game, 0, 1)
      expect(game.turn).toBe(0)
      expect(game.run).toBe(1)
      expect(pairCounts(game)[0]).toBe(1)
      expect(game.taken.slice(0, 2)).toEqual([0, 0])
      game = playTurn(game, 2, 4)
      expect(game.turn).toBe(1 % seats)
      expect(game.run).toBe(0)
      expect(faceDown(game)).toHaveLength(10)
      // Round the table and back to the first seat.
      for (let seat = 1; seat < seats; seat++) game = playTurn(game, 2, 4)
      expect(game.turn).toBe(0)
      expect(game.turns).toBe(seats + 1)
    }
  })

  it('ends when the last pair is taken, and the outcome is the reader\'s', () => {
    let game = laid(3, 6)
    for (const first of [0, 2, 4]) game = playTurn(game, first, first + 1)
    game = playTurn(game, 6, 8)
    for (const first of [6, 8]) game = playTurn(game, first, first + 1)
    expect(isOver(game)).toBe(false)
    game = playTurn(game, 10, 11)
    expect(isOver(game)).toBe(true)
    expect(pairCounts(game)).toEqual([3, 3, 0])
    expect(gameOutcome([3, 3, 0])).toBe('draw')
    expect(gameOutcome([4, 3, 1, 0])).toBe('won')
    expect(gameOutcome([3, 4, 1])).toBe('lost')
    expect(gameOutcome([2, 3, 3])).toBe('lost')
    // Alone, a perfect game is one turn a pair.
    let solo = laid(1, 6)
    for (let first = 0; first < 12; first += 2) solo = playTurn(solo, first, first + 1)
    expect(isOver(solo)).toBe(true)
    expect(solo.turns).toBe(6)
    expect(pairCounts(solo)).toEqual([6])
  })

  it('tells memory from luck, and a card forgotten from one a cat moved', () => {
    let game = laid(2, 6, [0])
    expect(judge(game, 0, 1)).toBe('lucky')
    expect(judge(game, 0, 2)).toBe('miss')
    game = playTurn(game, 1, 2)
    // Card 1 has been shown: its partner found is memory, missed is forgetting.
    expect(judge(game, 0, 1)).toBe('memory')
    expect(judge(game, 0, 4)).toBe('forgot')
    // A cat moves the card that was seen: the miss is now the cat's doing.
    const swapped = catSwap(game, 1, 6)
    expect(judge(swapped, 0, 1)).toBe('cat')
    expect(judge(swapped, 0, 6)).toBe('memory')
    // Shown again in its new place, it is nobody's excuse.
    expect(judge(playTurn(swapped, 6, 8), 0, 4)).toBe('forgot')
    let last = laid(2, 6)
    for (let first = 0; first < 10; first += 2) last = playTurn(last, first, first + 1)
    expect(judge(last, 10, 11)).toBe('last')
  })

  it('keeps the table whole through a cat\'s swap, and sends the cat only between turns that allow it', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rand = seeded(seed)
      let game = newGame(2, 8, true, rand)
      game = playTurn(game, 0, 1)
      const before = placesOf(game)
      const taken = [...game.taken]
      const [a, b] = catPick(game, rand)
      expect(game.taken[a]).toBeNull()
      expect(game.taken[b]).toBeNull()
      expect(game.cards[a]).not.toBe(game.cards[b])
      // A card somebody has seen is the one it goes for.
      if (faceDown(game).some((at) => game.seen[at])) expect(game.seen[a]).toBe(true)
      const after = catSwap(game, a, b)
      expect(after.cards[a]).toBe(game.cards[b])
      expect(after.cards[b]).toBe(game.cards[a])
      expect([...after.cards].sort()).toEqual([...game.cards].sort())
      expect(after.taken).toEqual(taken)
      expect(after.seen[b]).toBe(game.seen[a])
      expect(after.visits).toHaveLength(game.visits.length - 1)
      expect([...placesOf(after).keys()].sort()).toEqual([...before.keys()].sort())
    }
    // Not before its mark, and not with too few cards left for a swap to matter.
    let game = laid(2, 6, [2])
    expect(catDue(game)).toBe(false)
    game = playTurn(playTurn(game, 0, 1), 2, 3)
    expect(catDue(game)).toBe(true)
    game = playTurn(playTurn(game, 4, 5), 6, 7)
    expect(faceDown(game)).toHaveLength(4)
    expect(catDue(game)).toBe(true)
    expect(catDue(playTurn(game, 8, 9))).toBe(false)
    expect(catDue(laid(2, 6))).toBe(false)
  })

  it('has her take a pair she holds without a guess, and find the partner of a card she turns', () => {
    const game = laid(2, 6)
    const memory: Memory = [
      { at: 4, cat: 2 },
      { at: 7, cat: 3 },
      { at: 5, cat: 2 }
    ]
    expect(herFirst(game, memory, never)).toBe(4)
    expect(herSecond(game, memory, 4, 5, never)).toBe(5)
    // Turning a new card whose partner she holds, she goes straight to it.
    expect(herSecond(game, memory, 6, 5, never)).toBe(7)
    // Holding no pair she turns a card she knows nothing of, and guesses away from what she knows.
    const one: Memory = [{ at: 7, cat: 3 }]
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      expect(herFirst(game, one, () => roll)).not.toBe(7)
      expect(herSecond(game, one, 0, 5, () => roll)).not.toBe(7)
      expect(herSecond(game, one, 0, 5, () => roll)).not.toBe(0)
    }
    // A weak player's mind can go blank on a card she holds; the best one's never does.
    expect(herSecond(game, memory, 6, 1, () => 0.99)).toBe(7)
    expect(herSecond(game, memory, 6, 1, () => 0)).not.toBe(7)
    // A pair already taken is no longer hers to go for.
    const gone = playTurn(game, 4, 5)
    expect(herFirst(gone, memory, () => 0)).not.toBe(4)
  })

  it('remembers more, for longer, and follows the cat better with skill', () => {
    const kept = (skill: Skill): number => {
      const rand = seeded(11)
      let memory: Memory = []
      for (let at = 0; at < 24; at++) memory = observe(memory, at, at, skill, rand)
      return memory.length
    }
    expect(kept(1)).toBeLessThanOrEqual(2)
    expect(kept(3)).toBeLessThanOrEqual(6)
    expect(kept(5)).toBeGreaterThan(18)
    expect(kept(1)).toBeLessThan(kept(3))
    // A card seen again and not kept is not held as what it used to be.
    expect(observe([{ at: 3, cat: 1 }], 3, 4, 2, () => 0.99)).toEqual([])
    expect(observe([{ at: 3, cat: 1 }], 3, 4, 2, () => 0)).toEqual([{ at: 3, cat: 4 }])
    const memory: Memory = [
      { at: 2, cat: 1 },
      { at: 9, cat: 4 }
    ]
    expect(catMoved(memory, 2, 9, 5, never)).toEqual([
      { at: 9, cat: 1 },
      { at: 2, cat: 4 }
    ])
    expect(catMoved(memory, 2, 9, 1, () => 0.5)).toEqual(memory)
    // Following a swap of a card she holds with one she never saw teaches her nothing new.
    expect(catMoved([{ at: 2, cat: 1 }], 2, 9, 5, never)).toEqual([{ at: 9, cat: 1 }])
    expect(cleared(memory, [2, 5])).toEqual([{ at: 9, cat: 4 }])
  })

  it('never has her go for a card on knowledge she could not have, swaps and all', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = seeded(seed)
      const skills: Skill[] = [1, 3, 5]
      let game = newGame(3, 12, true, rand)
      let memories: Memory[] = skills.map(() => [])
      // Every cat each place has ever been shown to hold or, by a swap, could be believed to.
      const shown = new Set<string>()
      const see = (at: number): void => {
        shown.add(`${at}:${game.cards[at]}`)
        memories = memories.map((memory, i) => observe(memory, at, game.cards[at], skills[i], rand))
      }
      for (let guard = 0; !isOver(game) && guard < 5000; guard++) {
        const seat = game.turn
        const first = herFirst(game, memories[seat], rand)
        see(first)
        const second = herSecond(game, memories[seat], first, skills[seat], rand)
        expect(second).not.toBe(first)
        expect(game.taken[first]).toBeNull()
        expect(game.taken[second]).toBeNull()
        see(second)
        game = playTurn(game, first, second)
        if (turnsMade(game).at(-1)!.run > 0) {
          memories = memories.map((memory) => cleared(memory, [first, second]))
        } else if (catDue(game)) {
          const [a, b] = catPick(game, rand)
          for (const key of [...shown]) {
            const [at, cat] = key.split(':').map(Number)
            if (at === a) shown.add(`${b}:${cat}`)
            if (at === b) shown.add(`${a}:${cat}`)
          }
          memories = memories.map((memory, i) => catMoved(memory, a, b, skills[i], rand))
          game = catSwap(game, a, b)
          // The one who always follows holds nothing false after the swap.
          for (const held of memories[2]) expect(game.cards[held.at]).toBe(held.cat)
        }
        // Whatever each holds, right or stale, was shown to the table at some time.
        for (const memory of memories) {
          for (const held of memory) expect(shown.has(`${held.at}:${held.cat}`)).toBe(true)
        }
      }
      expect(isOver(game)).toBe(true)
    }
  })

  it('clears a table alone in fewer turns the better she is, with and without the cat', () => {
    const mean = (skill: Skill, cats: boolean): number => {
      let turns = 0
      for (let seed = 1; seed <= 60; seed++) {
        const game = playedOut([skill], 8, cats, seed)
        expect(isOver(game)).toBe(true)
        turns += game.turns
      }
      return turns / 60
    }
    for (const cats of [false, true]) {
      const [one, two, three, four, five] = ([1, 2, 3, 4, 5] as Skill[]).map((skill) => mean(skill, cats))
      expect(two).toBeLessThan(one)
      expect(three).toBeLessThan(two)
      expect(four).toBeLessThan(three)
      expect(five).toBeLessThan(four)
      // The best is near the game a perfect memory plays; the worst is mostly guessing.
      expect(five).toBeLessThan(15)
      expect(one).toBeGreaterThan(25)
    }
  })

  it('has the better memory take more pairs at a full table, every pair going to somebody', () => {
    const won = [0, 0, 0, 0]
    for (let seed = 1; seed <= 80; seed++) {
      // The seats are turned round each game, so that going first favours nobody.
      const order = [0, 1, 2, 3].map((i) => (i + seed) % 4)
      const skills = order.map((i) => ([1, 5, 2, 4] as Skill[])[i])
      const game = playedOut(skills, 10, true, seed)
      const counts = pairCounts(game)
      expect(counts.reduce((a, b) => a + b, 0)).toBe(10)
      expect(turnsMade(game).filter((made) => made.run > 0)).toHaveLength(10)
      counts.forEach((count, seat) => (won[order[seat]] += count))
    }
    // By skill: 1, 5, 2, 4.
    expect(won[1]).toBeGreaterThan(won[3])
    expect(won[3]).toBeGreaterThan(won[2])
    expect(won[2]).toBeGreaterThan(won[0])
  })

  it('names everyone in the summary and the account, and says who won', () => {
    const names = ['Ana', 'Bea', 'Cy']
    for (let seed = 1; seed <= 12; seed++) {
      const game = playedOut([3, 2, 5, 1], 8, true, seed)
      const counts = pairCounts(game)
      const summary = gameSummary(names, counts, game.turns)
      const account = gameAccount(names, game, true).join('\n')
      for (const name of names) {
        expect(summary).toContain(name)
        expect(account).toContain(`${name} took`)
      }
      expect(account).toContain('The reader took')
      expect(account).toContain(`the reader ${counts[0]}, Ana ${counts[1]}, Bea ${counts[2]}, Cy ${counts[3]}`)
      const outcome = gameOutcome(counts)
      expect(summary).toContain(outcome === 'won' ? 'and win' : outcome === 'lost' ? 'and lose' : 'finish level')
      expect(account).toContain(outcome === 'draw' || counts.filter((c) => c === Math.max(...counts)).length > 1 ? 'shared first place' : 'won')
      // Every swap the cat made is told.
      const visits = game.log.filter((made) => made.kind === 'cat').length
      if (visits > 0) expect(account).toContain('café cat walked across the table')
    }
    expect(gameSummary(['Ana'], [5, 3], 20)).toContain('win, 5 pairs to Ana\'s 3')
    expect(gameSummary(['Ana', 'Bea'], [2, 3, 3], 20)).toContain('Ana and Bea share it')
    expect(gameSummary([], [8], 14)).toContain('14 turns')
    expect(gameAccount([], playedOut([4], 6, false, 2), false).join(' ')).not.toContain('café cat walked')
  })

  it('is offered only at the cat café and the tea room, alone or with up to three girls', () => {
    const def = MINI_GAMES_LIST.find((game) => game.id === 'cat-pairs')
    expect(def).toBe(CAT_PAIRS)
    const on = (): boolean => true
    const offered = (location: string | null, girls: number): boolean =>
      gamesOffered({ location, girls }, on, [CAT_PAIRS]).length === 1
    expect(offered('cat_cafe', 0)).toBe(true)
    expect(offered('cutetea', 3)).toBe(true)
    expect(offered('room', 1)).toBe(false)
    expect(offered(null, 1)).toBe(false)
    expect(gamesOffered({ location: 'cat_cafe', girls: 1 }, (id) => id !== CAT_PAIRS.modId, [CAT_PAIRS])).toEqual([])
    expect(CAT_PAIRS.players).toEqual({ min: 0, max: 3 })
    expect(MINI_GAMES).toBe('mini-games')
    expect(settledOptions(CAT_PAIRS, { pairs: 40, cats: 0 })).toEqual({ pairs: 9, cats: 0 })
    expect(settledOptions(CAT_PAIRS, {})).toEqual({ pairs: 9, cats: 1 })
  })
})
