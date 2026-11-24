import { describe, expect, it } from 'vitest'
import { applyPreset, type PresetContext, type PresetInput } from '../src/shared/presets/assemble'
import { gamePartBlock, nativeDefaultPreset, sectionOf } from '../src/shared/presets/gameParts'
import type { GameMarker, GamePart, Preset, PresetBlock } from '../src/shared/presets/types'

/**
 * Applying a preset to a scene request: the default preset leaves both strings alone, parts are
 * found again in strings a mod has edited, and the preset's blocks land where its order says.
 */

const ctx: PresetContext = { user: 'Sam', char: 'Ada', group: 'Ada', rand: () => 0 }

const SYSTEM_PARTS: GamePart[] = [
  { id: 'persona', role: 'system', text: 'PERSONA' },
  { id: 'jsonRules', role: 'system', text: 'RULES\nmore rules' },
  { id: 'setting', role: 'system', text: 'SETTING\nthe quad' }
]
const USER_PARTS: GamePart[] = [
  { id: 'reader', role: 'user', text: 'READER {{user}}' },
  { id: 'cast', role: 'user', text: 'CAST' },
  { id: 'now', role: 'user', text: 'NOW' },
  { id: 'storySoFar', role: 'user', text: 'STORY' },
  { id: 'sceneSoFar', role: 'user', text: 'SCENE' },
  { id: 'yourTurn', role: 'user', text: 'TURN' }
]
const SYSTEM = 'PERSONA\n\nRULES\nmore rules\n\nSETTING\nthe quad'
const USER = 'READER {{user}}\nCAST\nNOW\nSTORY\nSCENE\nTURN'
const SCHEMA = { name: 'scene', schema: { type: 'object', additionalProperties: false, required: ['lines'], properties: { lines: { type: 'array' }, summary: { type: 'string' } } } }

function input(over: Partial<PresetInput> = {}): PresetInput {
  return { system: SYSTEM, user: USER, schema: SCHEMA, parts: [...SYSTEM_PARTS, ...USER_PARTS], ...over }
}

function block(id: string, content: string, over: Partial<PresetBlock> = {}): PresetBlock {
  return { id, name: id, role: 'system', enabled: true, position: 'ordered', depth: 0, content, ...over }
}

/** The shipped rows with `extra` rows spliced in after the named part. */
function preset(extra: Record<string, PresetBlock[]>, over: Partial<Preset> = {}): Preset {
  const blocks = nativeDefaultPreset('p').blocks.flatMap((b) => [b, ...(extra[b.marker as string] ?? [])])
  return { ...nativeDefaultPreset('p'), id: 'p', name: 'p', source: 'sillytavern', blocks, ...over }
}

function reorder(markers: GameMarker[], extra: PresetBlock[] = []): PresetBlock[] {
  return [...markers.map((m) => gamePartBlock(m)), ...extra]
}

describe('the default preset', () => {
  it('returns both strings byte for byte, with and without parts, and only adds vars to the schema', () => {
    const def = nativeDefaultPreset('default')
    for (const request of [input(), input({ parts: undefined })]) {
      const out = applyPreset(request, def, {}, ctx)
      expect(out.system).toBe(SYSTEM)
      expect(out.user).toBe(USER)
      expect(Object.keys(out.schema.schema.properties as object)).toEqual(['lines', 'summary', 'vars'])
    }
  })

  it('keeps every byte when a mod edited the strings after the parts were built', () => {
    const system = '\n  MOD HEAD\n\nPERSONA\n\nRULES\nmore rules\n\nMOD MID\n\nSETTING\nthe quad\n\nMOD TAIL\n'
    const user = 'RECALL ONE\n\nREADER {{user}}\nCAST\n- a mod line\nNOW\nSTORY\nSCENE\nTURN\n\nMOD LAST  \n'
    const out = applyPreset(input({ system, user }), nativeDefaultPreset('d'), {}, ctx)
    expect(out.system).toBe(system)
    expect(out.user).toBe(user)
  })

  it('does not touch the original schema', () => {
    const before = JSON.stringify(SCHEMA)
    applyPreset(input(), nativeDefaultPreset('d'), {}, ctx)
    expect(JSON.stringify(SCHEMA)).toBe(before)
  })
})

describe('schema', () => {
  it('adds an optional vars list last, without item bounds', () => {
    const { schema } = applyPreset(input(), nativeDefaultPreset('d'), {}, ctx)
    const props = schema.schema.properties as Record<string, { items?: Record<string, unknown> }>
    expect(Object.keys(props).at(-1)).toBe('vars')
    expect(schema.schema.required).toEqual(['lines'])
    expect(props.vars.items).not.toHaveProperty('maxItems')
    expect(schema.schema).not.toHaveProperty('maxItems')
  })
})

describe('placement', () => {
  it('puts a block after the part it follows, in the side its role names', () => {
    const p = preset({ jsonRules: [block('s', 'SYS BLOCK')], cast: [block('u', 'USER BLOCK', { role: 'user' })] })
    const out = applyPreset(input(), p, {}, ctx)
    expect(out.system).toBe('PERSONA\n\nRULES\nmore rules\n\nSYS BLOCK\n\nSETTING\nthe quad')
    expect(out.user).toBe('READER {{user}}\nCAST\n\nUSER BLOCK\n\nNOW\nSTORY\nSCENE\nTURN')
  })

  it('reorders parts by the preset and drops a disabled one with the mod text pinned after it', () => {
    const p = preset({})
    p.blocks = reorder(['persona', 'jsonRules', 'setting', 'cast', 'reader', 'now', 'storySoFar', 'sceneSoFar', 'yourTurn'])
    p.blocks.find((b) => b.marker === 'now')!.enabled = false
    const user = 'READER {{user}}\nCAST\nNOW\nmod after now\nSTORY\nSCENE\nTURN'
    const out = applyPreset(input({ user }), p, {}, ctx)
    expect(out.user).toBe('CAST\nREADER {{user}}\nSTORY\nSCENE\nTURN')
  })

  it('keeps a mod\'s text after the part it followed when parts move', () => {
    const p = preset({})
    p.blocks = reorder(['persona', 'jsonRules', 'setting', 'cast', 'reader', 'now', 'storySoFar', 'sceneSoFar', 'yourTurn'])
    const user = 'READER {{user}}\nmod after reader\nCAST\nNOW\nSTORY\nSCENE\nTURN'
    const out = applyPreset(input({ user }), p, {}, ctx)
    expect(out.user).toBe('CAST\nREADER {{user}}\nmod after reader\nNOW\nSTORY\nSCENE\nTURN')
  })

  it('never disables or moves out the reply rules', () => {
    const p = preset({})
    p.blocks.find((b) => b.marker === 'jsonRules')!.enabled = false
    expect(applyPreset(input(), p, {}, ctx).system).toBe(SYSTEM)
  })

  it('places depth blocks around the player\'s turn: 0 after it, 1 before it', () => {
    const p = preset({
      sceneSoFar: [
        block('d0', 'AFTER', { position: 'depth', depth: 0, role: 'user' }),
        block('d1', 'BEFORE', { position: 'depth', depth: 1, role: 'user' })
      ]
    })
    expect(applyPreset(input(), p, {}, ctx).user).toBe('READER {{user}}\nCAST\nNOW\nSTORY\nSCENE\n\nBEFORE\n\nTURN\n\nAFTER')
  })

  it('wraps in an XML tag and labels an assistant block', () => {
    const p = preset({
      setting: [
        block('w', 'wrapped', { wrapXml: 'my tag' }),
        block('a', 'said this', { role: 'assistant', position: 'depth', depth: 0 })
      ]
    })
    const out = applyPreset(input(), p, {}, ctx)
    expect(out.system.endsWith('<my_tag>\nwrapped\n</my_tag>')).toBe(true)
    expect(out.user.endsWith('[assistant]\nsaid this')).toBe(true)
  })

  it('leaves out a disabled block and one that resolves to nothing', () => {
    const p = preset({ persona: [block('off', 'X', { enabled: false }), block('nil', '{{// only a note}}{{trim}}')] })
    expect(applyPreset(input(), p, {}, ctx).system).toBe(SYSTEM)
  })
})

describe('the main block', () => {
  const withMain = (over: Partial<Preset>): Preset => preset({ persona: [block('main', 'MAIN')] }, over)

  it('replaces the persona only when asked and only when the block exists', () => {
    expect(applyPreset(input(), withMain({}), {}, ctx).system.startsWith('PERSONA\n\nMAIN')).toBe(true)

    const replaced = applyPreset(input(), withMain({ mainReplacesPersona: true, mainBlockId: 'main' }), {}, ctx).system
    expect(replaced).toBe('MAIN\n\nRULES\nmore rules\n\nSETTING\nthe quad')

    const dangling = applyPreset(input(), preset({}, { mainReplacesPersona: true, mainBlockId: 'gone' }), {}, ctx).system
    expect(dangling).toBe(SYSTEM)
  })
})

describe('macros', () => {
  it('resolve in preset blocks only, sharing variables in order, and report the variables', () => {
    const p = preset({
      persona: [block('a', '{{setvar::mood::wry}}hello {{user}}')],
      setting: [block('b', 'mood is {{getvar::mood}}, {{char}}')]
    })
    const out = applyPreset(input(), p, { keep: '1' }, ctx)
    expect(out.system).toContain('PERSONA\n\nhello Sam\n\nRULES')
    expect(out.system).toContain('the quad\n\nmood is wry, Ada')
    expect(out.user).toContain('READER {{user}}')
    expect(out.vars).toEqual({ keep: '1', mood: 'wry' })
  })

  it('run system blocks first, so a row\'s place across sides changes nothing', () => {
    const userBlock = block('u', 'saw {{getvar::mood}}', { role: 'user' })
    const systemBlock = block('s', '{{setvar::mood::wry}}set')
    const grouped = preset({ setting: [systemBlock], now: [userBlock] })
    const userFirst = [...grouped.blocks.filter((b) => sectionOf(b) !== 'system'), ...grouped.blocks.filter((b) => sectionOf(b) === 'system')]
    const interleaved = { ...grouped, blocks: userFirst }
    const a = applyPreset(input(), grouped, {}, ctx)
    const b = applyPreset(input(), interleaved, {}, ctx)
    expect(b).toEqual(a)
    expect(a.user).toContain('saw wry')
  })

  it('does not run a disabled block\'s macros', () => {
    const p = preset({ persona: [block('a', '{{setvar::x::1}}hi', { enabled: false })] })
    expect(applyPreset(input(), p, {}, ctx).vars).toEqual({})
  })
})

describe('when the parts cannot be found', () => {
  const p = (): Preset => {
    const base = preset({ yourTurn: [block('post', 'AFTER', { role: 'user' })] })
    return { ...base, blocks: [block('pre', 'BEFORE'), ...base.blocks] }
  }

  it('arranges the two strings whole when there are no parts', () => {
    const out = applyPreset(input({ parts: undefined }), p(), {}, ctx)
    expect(out.system).toBe(`BEFORE\n\n${SYSTEM}`)
    expect(out.user).toBe(`${USER}\n\nAFTER`)
  })

  it('does the same when a part is missing from the final string', () => {
    const out = applyPreset(input({ user: 'something else entirely' }), p(), {}, ctx)
    expect(out.system).toBe(`BEFORE\n\n${SYSTEM}`)
    expect(out.user).toBe('something else entirely\n\nAFTER')
  })

  it('does the same when parts are out of order', () => {
    const swapped = [...SYSTEM_PARTS.slice().reverse(), ...USER_PARTS]
    const out = applyPreset(input({ parts: swapped }), nativeDefaultPreset('d'), {}, ctx)
    expect(out.system).toBe(SYSTEM)
    expect(out.user).toBe(USER)
  })
})
