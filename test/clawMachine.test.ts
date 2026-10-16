import { describe, expect, it } from 'vitest'
import {
  AREA,
  HOME,
  LIFT_SHARE,
  LIMIT,
  accountOf,
  carryPoint,
  choicesOf,
  cueOf,
  goShown,
  goTold,
  holdChance,
  holdFor,
  layPile,
  luckOf,
  outcomeOf,
  pickAsk,
  pickToy,
  pinnedBy,
  reachOf,
  stopOf,
  takeGo,
  tierOf,
  wonIn,
  type Go,
  type Tier,
  type Toy
} from '../src/shared/minigameRules/clawMachine'
import { seededRand } from '../src/shared/minigameKit'

/** Claw Machine's rules: the pile, what the claw closes on, what it holds, and how a game ends. */

const never = (): number => {
  throw new Error('asked the dice')
}

const pile = (seed = 'a'): Toy[] => layPile(seededRand(seed))
const toy = (toys: readonly Toy[], id: string): Toy => toys.find((each) => each.id === id) as Toy
const over = (at: Toy): { x: number; z: number } => ({ x: at.x, z: at.z })

describe('the pile', () => {
  it('is the same for the same seed, a dozen toys on the floor, a bunny among them', () => {
    expect(pile('k')).toEqual(pile('k'))
    expect(pile('k')).not.toEqual(pile('m'))
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const toys = pile(seed)
      expect(toys).toHaveLength(12)
      expect(new Set(toys.map((each) => each.name)).size).toBe(12)
      expect(toys.some((each) => each.id === 'bunny')).toBe(true)
      for (const each of toys) {
        expect(each.x).toBeGreaterThanOrEqual(AREA.left)
        expect(each.x).toBeLessThanOrEqual(AREA.right)
        expect(each.z).toBeGreaterThanOrEqual(AREA.near)
        expect(each.z).toBeLessThanOrEqual(AREA.far)
      }
    }
  })

  it('has small easy toys, two big hard ones, and exactly one pinned under another', () => {
    const toys = pile()
    const tiers = toys.map(tierOf)
    expect(tiers.filter((tier) => tier === 'hard')).toHaveLength(2)
    expect(tiers.filter((tier) => tier === 'easy').length).toBeGreaterThanOrEqual(4)
    for (const each of toys) if (tierOf(each) === 'hard') expect(each.size).toBeGreaterThan(8)
    expect(toys.filter((each) => pinnedBy(toys, each))).toHaveLength(1)
  })
})

describe('the stops', () => {
  it('put the claw where each way was held to, and no further than its run', () => {
    expect(stopOf(0, 0)).toEqual({ x: HOME.x, z: HOME.z })
    expect(stopOf(60000, 60000)).toEqual({ x: LIMIT.x, z: LIMIT.z })
    const at = toy(pile(), 'bunny')
    const held = holdFor(at)
    const stop = stopOf(held.msX, held.msZ)
    expect(stop.x).toBeCloseTo(at.x)
    expect(stop.z).toBeCloseTo(at.z)
  })
})

describe('a go', () => {
  it('holds a toy grabbed dead centre when the roll is under its grip, and takes it off the pile', () => {
    const toys = pile()
    const duck = toy(toys, 'duckling')
    const go = takeGo(toys, over(duck), () => 0.5)
    expect(go.kind).toBe('catch')
    expect(go.chance).toBeCloseTo(duck.grip)
    expect(go.pile).toHaveLength(11)
    expect(go.pile.some((each) => each.id === 'duckling')).toBe(false)
    // The same grab on a big one, with the same roll, slips.
    expect(takeGo(toys, over(toy(toys, 'whale')), () => 0.5).kind).toBe('slip')
  })

  it('drops a toy that slips somewhere new on the floor, further back the nearer it came to holding', () => {
    const toys = pile()
    const whale = toy(toys, 'whale')
    const nearly = takeGo(toys, over(whale), () => whale.grip + 0.01)
    const badly = takeGo(toys, over(whale), () => 0.999)
    expect(nearly.kind).toBe('slip')
    expect(nearly.slipAt).toBeGreaterThan(LIFT_SHARE)
    expect(badly.slipAt).toBeLessThan(LIFT_SHARE)
    expect(nearly.pile).toHaveLength(12)
    const moved = toy(nearly.pile, 'whale')
    expect(moved).toMatchObject(nearly.landed as object)
    expect(moved.x).toBeLessThan(whale.x)
    expect(moved.x).toBeGreaterThanOrEqual(AREA.left)
  })

  it('holds worse the further off centre the grab, and not at all outside the reach', () => {
    const bunny = toy(pile(), 'bunny')
    expect(holdChance(bunny, 0)).toBe(bunny.grip)
    expect(holdChance(bunny, 0.5)).toBeLessThan(holdChance(bunny, 0.1))
    expect(holdChance(bunny, 1)).toBeLessThan(bunny.grip / 2)
    const alone = [bunny]
    const edge = takeGo(alone, { x: bunny.x + reachOf(bunny) * 0.95, z: bunny.z }, () => 0.3)
    expect(edge.kind).toBe('slip')
    expect(takeGo(alone, over(bunny), () => 0.3).kind).toBe('catch')
  })

  it('knocks a toy aside on a near miss, and touches nothing on a wide one, with no roll taken', () => {
    const bunny = { ...toy(pile(), 'bunny'), x: 50, z: 30 }
    const near = takeGo([bunny], { x: 50 - reachOf(bunny) - 2, z: 30 }, never)
    expect(near.kind).toBe('nudge')
    expect(toy(near.pile, 'bunny').x).toBeGreaterThan(50)
    const wide = takeGo([bunny], { x: 20, z: 30 }, never)
    expect(wide.kind).toBe('miss')
    expect(wide.pile).toEqual([bunny])
    expect(wide.aimed?.id).toBe('bunny')
  })

  it('cannot take the pinned toy until the one across it is gone', () => {
    const toys = pile()
    const buried = toys.find((each) => pinnedBy(toys, each)) as Toy
    const top = pinnedBy(toys, buried) as Toy
    // On the far side of it from the toy on top, the claw is over the pinned one alone.
    const side = Math.sign(buried.x - top.x) || 1
    const go = takeGo(toys, { x: buried.x + side * reachOf(buried) * 0.9, z: buried.z }, never)
    expect(go.kind).toBe('pinned')
    expect(go.top?.id).toBe(top.id)
    expect(go.pile).toHaveLength(12)
    // Over the pair, it is the one on top that comes.
    const first = takeGo(toys, over(top), () => 0)
    expect(first.aimed?.id).toBe(top.id)
    expect(first.kind).toBe('catch')
    const then = takeGo(first.pile, over(buried), () => 0)
    expect(then.kind).toBe('catch')
    expect(then.aimed?.id).toBe(buried.id)
  })

  it('is the same go for the same seed and the same stops', () => {
    const play = (): Go[] => {
      const rand = seededRand('same')
      let toys = layPile(rand)
      const goes: Go[] = []
      for (const [msX, msZ] of [[1500, 900], [2100, 1400], [800, 1900], [1200, 600]]) {
        const go = takeGo(toys, stopOf(msX, msZ), rand)
        goes.push(go)
        toys = go.pile
      }
      return goes
    }
    expect(play()).toEqual(play())
  })

  it('carries what it holds straight up and then across to the chute', () => {
    const stop = { x: 60, z: 30 }
    expect(carryPoint(stop, 0)).toEqual({ x: 60, z: 30, up: 0 })
    expect(carryPoint(stop, LIFT_SHARE)).toEqual({ x: 60, z: 30, up: 1 })
    expect(carryPoint(stop, 1)).toEqual({ x: HOME.x, z: HOME.z, up: 1 })
  })
})

describe('the result', () => {
  it('is won with her toy, a draw with another, lost with nothing, and only played alone', () => {
    const toys = pile()
    const frog = takeGo(toys, over(toy(toys, 'frog')), () => 0)
    const miss = takeGo(toys, { x: HOME.x, z: 0 }, never)
    expect(wonIn([miss, frog]).map((each) => each.id)).toEqual(['frog'])
    expect(outcomeOf([miss, frog], 'frog')).toBe('won')
    expect(outcomeOf([miss, frog], 'bunny')).toBe('draw')
    expect(outcomeOf([miss], 'bunny')).toBe('lost')
    expect(outcomeOf([frog], null)).toBe('played')
  })
})

describe('an ordinary reader', () => {
  /** Each free toy gone for once in each of many cabinets, both stops out by up to 60 ms. */
  function rates(): Record<Tier, number> {
    const rand = seededRand('balance')
    const tried: Record<Tier, number> = { easy: 0, fair: 0, hard: 0 }
    const caught: Record<Tier, number> = { easy: 0, fair: 0, hard: 0 }
    for (let cabinet = 0; cabinet < 400; cabinet++) {
      const toys = layPile(rand)
      for (const each of toys) {
        if (pinnedBy(toys, each)) continue
        const held = holdFor(each)
        const stop = stopOf(held.msX + (rand() * 2 - 1) * 60, held.msZ + (rand() * 2 - 1) * 60)
        const go = takeGo(toys, stop, rand)
        tried[tierOf(each)]++
        if (go.kind === 'catch' && go.aimed?.id === each.id) caught[tierOf(each)]++
      }
    }
    return { easy: caught.easy / tried.easy, fair: caught.fair / tried.fair, hard: caught.hard / tried.hard }
  }

  it('lands an easy toy on most goes and a big one about one go in four', () => {
    const got = rates()
    expect(got.easy).toBeGreaterThan(0.7)
    expect(got.easy).toBeLessThan(0.92)
    expect(got.fair).toBeGreaterThan(0.4)
    expect(got.fair).toBeLessThan(0.7)
    expect(got.hard).toBeGreaterThan(0.18)
    expect(got.hard).toBeLessThan(0.32)
  })
})

describe('the toy she wants', () => {
  it('is never the pinned one with fewer than three goes, asked or chosen for her', () => {
    const rand = seededRand('choices')
    for (let cabinet = 0; cabinet < 200; cabinet++) {
      const toys = layPile(rand)
      const buried = toys.find((each) => pinnedBy(toys, each)) as Toy
      for (const tries of [1, 2]) {
        expect(choicesOf(toys, tries)).toHaveLength(11)
        expect(pickAsk('Lia', toys, tries).names).not.toContain(buried.name)
        expect(pickAsk('Lia', toys, tries).brief).not.toContain('pinned')
        for (let pick = 0; pick < 30; pick++) expect(pickToy(toys, rand, tries).id).not.toBe(buried.id)
      }
      expect(choicesOf(toys, 3)).toHaveLength(12)
    }
    // The last of the stream is still a toy.
    expect(pickToy(pile(), () => 0.9999, 1)).toBeDefined()
    expect(pickToy(pile(), () => 0.9999)).toBeDefined()
  })

  it('is told in the brief to lie under another where the pinned one may be chosen', () => {
    const toys = pile()
    const buried = toys.find((each) => pinnedBy(toys, each)) as Toy
    const top = pinnedBy(toys, buried) as Toy
    const asked = pickAsk('Lia', toys, 3)
    expect(asked.names).toContain(buried.name)
    expect(asked.brief).toContain(`The ${buried.name} lies pinned under the ${top.name}`)
    expect(asked.brief).toContain(asked.names.join(', '))
  })
})

describe('a go at the pinned toy', () => {
  it('closes on the toy across it, and is told as a go at the pinned one, in every pile', () => {
    const rand = seededRand('meant')
    for (let cabinet = 0; cabinet < 2000; cabinet++) {
      const toys = layPile(rand)
      const buried = toys.find((each) => pinnedBy(toys, each)) as Toy
      const top = pinnedBy(toys, buried) as Toy
      const go = takeGo(toys, over(buried), () => 0)
      expect(go.kind).toBe('catch')
      expect(go.aimed?.id).toBe(top.id)
      expect(go.meant?.id).toBe(buried.id)
      expect(go.top?.id).toBe(top.id)
    }
  })

  it('says he went for the pinned toy and the claw took the one on top', () => {
    const toys = pile()
    const buried = toys.find((each) => pinnedBy(toys, each)) as Toy
    const top = pinnedBy(toys, buried) as Toy
    const caught = takeGo(toys, over(buried), () => 0)
    const slipped = takeGo(toys, over(buried), () => 0.999)
    for (const go of [caught, slipped]) {
      const line = accountOf('Lia', buried, [go], 3)[2]
      expect(line).toContain(`he went for the ${buried.name}, which is under the ${top.name}, and stopped dead on; the claw took the ${top.name} instead`)
      expect(goTold(go, buried.id)).toContain(`comes down over the ${buried.name}, but the ${top.name} lies across it`)
      expect(goTold(go, buried.id)).not.toContain('too far')
      expect(cueOf(go, 'Lia', buried, [go], 2).text).toContain(`He was going for the ${buried.name}, the toy Lia said she wanted`)
    }
    expect(luckOf(slipped)).not.toContain('his own doing')
    // A go at the toy on top itself is told as it always was.
    const plain = takeGo(toys, over(top), () => 0)
    expect(plain.meant).toBeNull()
    expect(accountOf('Lia', buried, [plain], 3)[2]).toContain(`he went for the ${top.name} and stopped dead on`)
  })
})

describe('whose doing a slip was', () => {
  it('is his centring only where that cost more than the toy\'s own grip did', () => {
    const toys = pile()
    const whale = { ...toy(toys, 'whale'), x: 50, z: 30 }
    const duck = { ...toy(toys, 'duckling'), x: 50, z: 30 }
    const wide = (at: Toy): Go => takeGo([at], { x: at.x + reachOf(at) * 0.7, z: at.z }, () => 0.999)
    const onWhale = wide(whale)
    expect(onWhale.kind).toBe('slip')
    expect(onWhale.off).toBeGreaterThan(0.6)
    expect(luckOf(onWhale)).not.toContain('his own doing')
    expect(luckOf(onWhale)).toContain('about 25 times in 100')
    expect(luckOf(onWhale)).toContain(`about ${Math.round(onWhale.chance * 100)} times in 100`)
    expect(luckOf(wide(duck))).toContain('his own doing')
    expect(luckOf(takeGo([duck], over(duck), () => 0.999))).toContain('plain bad luck')
  })
})

describe('what the front shows of a go', () => {
  it('says in a few words what the claw did, and whether it was the toy she wanted', () => {
    const toys = pile()
    const duck = toy(toys, 'duckling')
    const whale = toy(toys, 'whale')
    const caught = takeGo(toys, over(duck), () => 0.5)
    expect(goShown(caught, null)).toBe('Won the duckling!')
    expect(goShown(caught, 'duckling')).toBe('Won the duckling she wanted!')
    expect(goShown(caught, 'whale')).toBe('Won the duckling!')
    expect(goShown(takeGo(toys, over(whale), () => 0.5), null)).toBe('The big whale slipped free')
    expect(goShown(takeGo(toys, { x: HOME.x, z: HOME.z }, never), null)).toMatch(/^Missed/)
    // Short enough for the machine's front, whatever the toy.
    for (const each of toys) expect(`Go 5: ${goShown({ ...caught, aimed: each }, each.id)}`.length).toBeLessThanOrEqual(40)
  })
})
