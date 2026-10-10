import { registerHooks } from '../mods/hooks'
import { strictDmRequest, strictFeedRequest, strictSceneRequest } from '../mods/strictSchema/requests'
import { endEmptyScene } from '../mods/strictSchema/ending'

registerHooks('strict-schema', {
  sceneResult: endEmptyScene,
  requests: {
    scene: strictSceneRequest,
    dm: strictDmRequest,
    'slot-intro': strictFeedRequest
  }
})
