import type {ModDef} from '@vx/modkit/shared'
const mod:ModDef={id:'screen-companion',name:'Share Your Laptop',author:'Community',version:'0.1.0',hooks: [
    'invoke',
    'scenePlay',
    'main:completeModStructured',
    'main:createDesktopSurface',
    'main:hasExpressionArt',
    'main:modDataPath',
    'main:modIsOn',
    'main:readJsonFile',
    'main:writeAtomicJson',
    'renderer:canRecordSceneTurn',
    'renderer:hasDesktopSurfaces',
    'renderer:invoke',
    'renderer:modIsOn',
    'renderer:openSceneExchange',
    'renderer:registerHooks',
    'renderer:sceneExchangeContext',
    'renderer:showError',
    'renderer:spriteUrl',
    'renderer:subscribeSceneTurns',
    'shared:appError'
  ],requires:['scene-notes'],scope:'anytime',defaultOn:false,blurb:'Share a screen or window with someone in your scene: gaming, coaching, studying, or anything together.',offNote:'Stops screen capture and closes the desktop companion. Your scene conversation stays.'}
export default mod
