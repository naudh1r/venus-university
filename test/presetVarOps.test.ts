import { describe, expect, it } from 'vitest'
import { applyVarOps, MAX_OPS_PER_REPLY, MAX_VARS, MAX_VAR_NAME, MAX_VAR_VALUE } from '../src/shared/presets/varOps'

/** The variable ops a scene reply carries: what they do to a save's variables and what is refused. */

describe('applyVarOps', () => {
  it('sets, adds and appends in order without touching the input', () => {
    const before = { gold: '10', note: 'a' }
    const { vars, warnings } = applyVarOps(before, [
      { name: 'gold', op: 'add', value: '5' },
      { name: 'gold', op: 'add', value: '-2.5' },
      { name: 'note', op: 'append', value: 'b' },
      { name: 'mood', op: 'set', value: 'calm' }
    ])
    expect(vars).toEqual({ gold: '12.5', note: 'ab', mood: 'calm' })
    expect(warnings).toEqual([])
    expect(before).toEqual({ gold: '10', note: 'a' })
  })

  it('starts an add from 0 when the variable is missing or not a number, and refuses a non-numeric amount', () => {
    const { vars, warnings } = applyVarOps({ word: 'hi' }, [
      { name: 'fresh', op: 'add', value: '3' },
      { name: 'word', op: 'add', value: '2' },
      { name: 'fresh', op: 'add', value: 'lots' }
    ])
    expect(vars).toEqual({ fresh: '3', word: '2' })
    expect(warnings).toHaveLength(1)
  })

  it('drops a malformed op with a warning and keeps the rest', () => {
    const { vars, warnings } = applyVarOps({}, [
      null,
      'set',
      { name: '', op: 'set', value: 'x' },
      { name: 'a', op: 'multiply', value: '2' },
      { name: 'b', op: 'set' },
      { name: 'n', op: 'set', value: 4 },
      { name: 'ok', op: 'set', value: 'yes' }
    ])
    expect(vars).toEqual({ n: '4', ok: 'yes' })
    expect(warnings).toHaveLength(5)
  })

  it('ignores a reply whose vars is not a list', () => {
    expect(applyVarOps({ a: '1' }, { name: 'a' })).toEqual({ vars: { a: '1' }, warnings: ['vars was not a list; ignored'] })
    expect(applyVarOps({ a: '1' }, undefined)).toEqual({ vars: { a: '1' }, warnings: [] })
  })

  it('caps name length, value length, ops per reply and variables held', () => {
    const long = applyVarOps({}, [
      { name: 'x'.repeat(MAX_VAR_NAME + 1), op: 'set', value: '1' },
      { name: 'v', op: 'set', value: 'y'.repeat(MAX_VAR_VALUE + 50) }
    ])
    expect(Object.keys(long.vars)).toEqual(['v'])
    expect(long.vars.v).toHaveLength(MAX_VAR_VALUE)

    const many = applyVarOps(
      {},
      Array.from({ length: MAX_OPS_PER_REPLY + 5 }, (_, i) => ({ name: `k${i}`, op: 'set', value: '1' }))
    )
    expect(Object.keys(many.vars)).toHaveLength(MAX_OPS_PER_REPLY)

    const full = Object.fromEntries(Array.from({ length: MAX_VARS }, (_, i) => [`k${i}`, '1']))
    const over = applyVarOps(full, [
      { name: 'extra', op: 'set', value: '1' },
      { name: 'k0', op: 'set', value: '2' }
    ])
    expect(over.vars.extra).toBeUndefined()
    expect(over.vars.k0).toBe('2')
  })

  it('keeps a name like __proto__ as an ordinary key', () => {
    const { vars } = applyVarOps({}, [{ name: '__proto__', op: 'set', value: 'x' }])
    expect(Object.getPrototypeOf(vars)).toBe(Object.prototype)
    expect(Object.keys(vars)).toEqual(['__proto__'])
  })
})
