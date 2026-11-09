import type { ModDef } from '@vx/modkit/shared'
const mod: ModDef = {
  id: 'scene-notes', name: 'Scene Notes', author: 'Maestro Leeds', version: '0.1.0',
  library: true, scope: 'anytime', defaultOn: true,
  hooks: [
    'gameModals',
    'scenePlay',
    'sceneField',
    'promptState.scene',
    'prompts.scene',
    'renderer:TitleTab',
    'renderer:currentRun',
    'renderer:openPanel',
    'renderer:panelUnderTab',
    'renderer:registerHooks',
    'renderer:runStale',
    'renderer:scene',
    'renderer:sceneField',
    'renderer:useModalShell',
    'renderer:useScene',
    'renderer:veilIn'
  ],
  blurb: 'One scene document shared by studying and laptop conversations.'
}
export default mod
