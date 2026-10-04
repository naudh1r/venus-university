import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE_MODELS, imageModelsOf, withImageModels } from '../src/shared/imageModels'

type Workflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>

const graph = (name: string): Workflow =>
  JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'workflows', name), 'utf-8')) as Workflow

const PICK = { checkpoint: 'other.safetensors', lora: 'style.safetensors', strength: 0.6, trigger: 'trig' }

describe('imageModelsOf', () => {
  it("is this branch's models where nothing was picked", () => {
    expect(imageModelsOf(undefined)).toEqual(DEFAULT_IMAGE_MODELS)
    expect(imageModelsOf({})).toEqual(DEFAULT_IMAGE_MODELS)
  })

  it('keeps an empty trigger, and holds the strength to the slider', () => {
    expect(imageModelsOf({ imageTrigger: '' }).trigger).toBe('')
    expect(imageModelsOf({ imageLoraStrength: 9 }).strength).toBe(2)
    expect(imageModelsOf({ imageLoraStrength: -1 }).strength).toBe(0)
  })
})

describe('withImageModels', () => {
  for (const name of [
    'characterBase.json',
    'characterCg.json',
    'characterExpression.json',
    'characterHands.json',
    'characterPhoto.json'
  ]) {
    it(`draws ${name} with the picked models`, () => {
      const out = withImageModels(graph(name), PICK)
      const nodes = Object.values(out)
      const loaders = nodes.filter((n) => n.class_type === 'CheckpointLoaderSimple')
      const loras = nodes.filter((n) => n.class_type === 'LoraLoader')
      expect(loaders.length).toBeGreaterThan(0)
      expect(loras.length).toBeGreaterThan(0)
      for (const n of loaders) expect(n.inputs.ckpt_name).toBe('other.safetensors')
      for (const n of loras) {
        expect(n.inputs.lora_name).toBe('style.safetensors')
        expect(n.inputs.strength_model).toBe(0.6)
        expect(n.inputs.strength_clip).toBe(0.6)
      }
    })
  }

  it('leads the positive prompts with the trigger, once, and leaves the negative alone', () => {
    const source = graph('characterPhoto.json')
    const out = withImageModels(withImageModels(source, PICK), PICK)
    const texts = (g: Workflow): string[] =>
      Object.values(g)
        .filter((n) => typeof n.inputs.text === 'string')
        .map((n) => n.inputs.text as string)
    const led = texts(out).filter((t) => t.startsWith('trig, '))
    expect(led.length).toBeGreaterThan(0)
    expect(texts(out).some((t) => t.startsWith('trig, trig'))).toBe(false)
    // The negative prompt is not led by it.
    expect(texts(out).some((t) => !t.startsWith('trig'))).toBe(true)
    // The graph it was given is untouched.
    expect(texts(source).some((t) => t.startsWith('trig'))).toBe(false)
  })

  it('adds no trigger when it is empty', () => {
    const out = withImageModels(graph('characterBase.json'), { ...PICK, trigger: '' })
    const texts = Object.values(out).map((n) => n.inputs.text).filter((t) => typeof t === 'string')
    expect(texts.every((t) => !(t as string).startsWith(', '))).toBe(true)
  })
})
