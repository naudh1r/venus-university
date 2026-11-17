import { beforeAll, describe, it, expect, vi } from 'vitest'

// The kit's renderer entry loads the game's stores; these tests take each name from its own module.
vi.mock('@vx/modkit/renderer', async () => (await import('./fixtures/miniGamesKit')).miniGamesKit())
vi.mock('../src/renderer/stores/gameLoop', () => ({ submitAction: vi.fn(), takeTurnFromReply: vi.fn(() => false) }))
import { destinationOf } from '../src/renderer/minigames/place'
import { withOffer, agreedOf } from '../src/renderer/minigames/offer'
import DARTS from '../src/shared/minigameEntries/darts'
import type { Character, StructuredRequest } from '../src/shared/types'
import { miniGamesReady } from './fixtures/miniGamesKit'

// Waits for the modules the kit mock loads late, which would otherwise outlive these tests.
beforeAll(miniGamesReady)
const cast = [{charId:'a',firstName:'Ana',lastName:'Seo'}, {charId:'b',firstName:'Bea',lastName:'Seo'}] as Character[]
const request = {user:"Reader's action: darts at pino cola lounge?",schema:{name:'scene',schema:{properties:{},required:[]}}} as unknown as StructuredRequest

describe('destination invitation',()=>{
 it('recognizes explicit venue names without guessing a venue from game words',()=>{
  expect(destinationOf('how about some darts match at pino cola lounge?')).toBe('pino_cola_lounge')
  expect(destinationOf('darts at Pino-Cola?')).toBe('pino_cola_lounge')
  expect(destinationOf('a race?')).toBeNull()
  expect(destinationOf('Pino-Cola or BTB Arcade?')).toBeNull()
 })
 it('gets consent before travel and stops before gameplay',()=>{
  const out=withOffer(request,[DARTS],cast,'pino_cola_lounge',false,false,true)
  expect(out.user).toContain('Get agreement first')
  expect(out.user).toContain('correct background')
  expect(out.user).not.toContain('where the scene already is')
  expect(agreedOf({minigame:{play:'darts',with:{ana_seo:'in',bea_seo:'out'}}},[DARTS],cast)?.characters.map(c=>c.charId)).toEqual(['a'])
  expect(agreedOf({minigame:{play:'',with:{ana_seo:'out',bea_seo:'out'}}},[DARTS],cast)).toBeNull()
 })
})
