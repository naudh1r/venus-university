import { describe, expect, it } from 'vitest'
import { hasDynamicMacros, resolveMacros, type MacroContext } from '../src/shared/presets/macros'

/** The macro resolver: nesting, one shared variable map in order, and text it does not know left alone. */

function ctx(vars: Record<string, string> = {}, rand: () => number = () => 0): MacroContext {
  return { vars, user: 'Sam', char: 'Ada', group: 'Ada, Bea', rand }
}

describe('resolveMacros', () => {
  it('resolves nested macros innermost first', () => {
    const c = ctx({ who: 'Ada' })
    expect(resolveMacros('{{setvar::mood::{{getvar::who}} sulks}}{{getvar::mood}}', c)).toBe('Ada sulks')
    expect(c.vars).toEqual({ who: 'Ada', mood: 'Ada sulks' })
  })

  it('reads a variable as it stood at that point in the text', () => {
    expect(
      resolveMacros('{{getvar::n::none}}|{{setvar::n::1}}{{getvar::n}}|{{incvar::n}}|{{addvar::n::5}}{{getvar::n}}|{{decvar::n}}', ctx())
    ).toBe('none|1|2|7|6')
  })

  it('shares one map across blocks resolved in turn', () => {
    const c = ctx()
    resolveMacros('{{setvar::x::A}}', c)
    expect(resolveMacros('{{getvar::x}}{{getvar::y::fallback}}', c)).toBe('Afallback')
  })

  it('leaves a macro it does not know as written, even around a known one', () => {
    expect(resolveMacros('{{lastMessage}} {{foo::{{user}}}}', ctx())).toBe('{{lastMessage}} {{foo::Sam}}')
  })

  it('does not resolve what a variable holds', () => {
    const c = ctx({ v: '{{setvar::boom::1}}' })
    expect(resolveMacros('{{getvar::v}}', c)).toBe('{{setvar::boom::1}}')
    expect(c.vars).toEqual({ v: '{{setvar::boom::1}}' })
  })

  it('removes comments and takes the line breaks around trim with it', () => {
    expect(resolveMacros('a{{// a note}}b\n\n{{trim}}\nc', ctx())).toBe('abc')
  })

  it('rolls dice with a modifier from the injected generator', () => {
    expect(resolveMacros('{{roll::2d6+3}}', ctx({}, () => 0.999))).toBe('15')
    expect(resolveMacros('{{roll::1d20}}', ctx({}, () => 0))).toBe('1')
    expect(resolveMacros('{{roll::banana}}', ctx())).toBe('{{roll::banana}}')
  })

  it('picks one of the random options', () => {
    expect(resolveMacros('{{random::a::b::c}}', ctx({}, () => 0.5))).toBe('b')
    expect(resolveMacros('{{random:x,y}}', ctx({}, () => 0.99))).toBe('y')
  })

  it('fills in the names', () => {
    expect(resolveMacros('{{user}} meets {{char}} ({{group}})', ctx())).toBe('Sam meets Ada (Ada, Bea)')
  })
})

describe('hasDynamicMacros', () => {
  it('flags anything whose output can change, and nothing else', () => {
    expect(hasDynamicMacros('{{user}} {{char}} {{group}} {{// note}}{{trim}}')).toBe(false)
    expect(hasDynamicMacros('plain text')).toBe(false)
    expect(hasDynamicMacros('{{user}} {{getvar::x}}')).toBe(true)
    expect(hasDynamicMacros('{{random::a::b}}')).toBe(true)
  })
})
