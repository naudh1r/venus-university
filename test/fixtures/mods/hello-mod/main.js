// Hand-written as `vxmod build` would emit it: one CommonJS file. The `on` route answers what the
// main process makes of this mod's switch, for a check that main's rule knows an installed mod.
const { sharedModOn } = require('@vx/modkit/shared')
module.exports = {
  invoke: {
    echo: (context, ...args) => ({ id: context.id, signal: context.signal instanceof AbortSignal, args }),
    fail: () => { throw { code: 'FIXTURE_INVOKE', message: 'fixture failed', detail: __dirname } },
    wait: (context) => new Promise(resolve => context.signal.addEventListener('abort', () => resolve('late'), { once: true }))
  },
  protocols: [
    { route: 'ping', handle: () => 'ok' },
    { route: 'on', handle: () => String(sharedModOn('hello-mod')) }
  ]
}
