import { afterEach, expect, it } from 'vitest'
import { restoreApi, stubApi, character } from './fixtures'

afterEach(restoreApi)
it('keeps browser carry empty and generation refused with Photo’s note', async () => {
  stubApi({ platform: 'web', jobs: { onProgress: () => () => {} }, mods: {
    invokeStart: async () => ({ ok: false, error: { code: 'DESKTOP_ONLY',
      message: 'Available in the Desktop Version', detail: 'mod.invoke' } })
  } })
  const { photoInvoke } = await import('../src/renderer/stores/photoInvoke')
  expect(await photoInvoke('carry', ['1', '2'])).toEqual({ ok: true, data: undefined })
  expect(await photoInvoke('generate', ['1', character(), 'everyday', 'At the cafe', 'sarah_chat_001.png']))
    .toEqual({ ok: false, error: { code: 'DESKTOP_ONLY',
      message: 'The browser build cannot render pictures; the desktop build can.', detail: 'mod.invoke' } })
})
