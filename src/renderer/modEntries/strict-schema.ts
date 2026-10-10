import { registerHooks } from '../mods/hooks'
import { strictDmRequest, strictFeedRequest, strictSceneRequest } from '../mods/strictSchema/requests'

registerHooks('strict-schema', {
  requests: {
    scene: strictSceneRequest,
    dm: strictDmRequest,
    'slot-intro': strictFeedRequest
  }
})
