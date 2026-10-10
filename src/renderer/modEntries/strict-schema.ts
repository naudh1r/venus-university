import { registerHooks } from '../mods/hooks'
import { strictDmRequest, strictFeedRequest, strictLedgerRequest, strictSceneRequest } from '../mods/strictSchema/requests'
import { endEmptyScene, sceneBoundary } from '../mods/strictSchema/ending'

registerHooks('strict-schema', {
  sceneResult: endEmptyScene,
  sceneLines: sceneBoundary,
  requests: {
    scene: strictSceneRequest,
    ledger: strictLedgerRequest,
    dm: strictDmRequest,
    'slot-intro': strictFeedRequest
  }
})
