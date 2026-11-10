import { expect, it } from 'vitest'
import { rapidFps, rapidCallout, companionReactionDelay } from '../src/shared/screenCompanion'
it('reserves rapid behavior for the explicit one-second FPS option', () => {
  expect(rapidFps('fps', 1)).toBe(true)
  for (const mode of ['gaming', 'hangout', 'study'] as const) expect(rapidFps(mode, 1)).toBe(false)
  expect(rapidFps('fps', 5)).toBe(false)
})
it('subtracts work from the one-second cadence, without catch-up bursts after a slow reply', () => {
  expect(companionReactionDelay('fps', 1, 350)).toBe(650)
  expect(companionReactionDelay('fps', 1, 1800)).toBe(0)
  expect(companionReactionDelay('fps', 5, 1800)).toBe(5000)
})
it('keeps a short callout intact and bounds unexpectedly verbose model output', () => {
  expect(rapidCallout('Stay behind cover.')).toBe('Stay behind cover.')
  expect(rapidCallout('Watch left! Let me explain the whole strategy.')).toBe('Watch left!')
  for (const text of ['one two three four five six seven eight nine ten', 'abcdefghij '.repeat(10), 'x'.repeat(300)]) {
    const short = rapidCallout(text)
    expect(short.length).toBeLessThanOrEqual(72)
    expect(short.split(/\s+/).length).toBeLessThanOrEqual(8)
  }
})
