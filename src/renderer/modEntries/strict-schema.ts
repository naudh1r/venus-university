import { registerHooks } from '../mods/hooks'
import { strictPhotoDmBase } from '../mods/strictSchema/photoDm'
import { strictDmRequest, strictFeedRequest, strictLedgerRequest, strictSceneRequest } from '../mods/strictSchema/requests'
import { endEmptyScene, sceneBoundary } from '../mods/strictSchema/ending'
import { strictHangoutRequest } from '../mods/strictSchema/hangoutPolicy'
import { strictHangoutAnswer, strictHangoutOfferAllowed, strictHangoutResult } from '../mods/strictSchema/hangouts'

registerHooks('strict-schema', {
  dmBasePrompt: strictPhotoDmBase,
  sceneResult: endEmptyScene,
  sceneLines: sceneBoundary,
  hangoutAnswer: strictHangoutAnswer,
  hangoutResult: strictHangoutResult,
  hangoutOfferAllowed: strictHangoutOfferAllowed,
  requests: {
    scene: strictSceneRequest,
    ledger: strictLedgerRequest,
    'text-ledger': strictLedgerRequest,
    'hangout-classifier': strictHangoutRequest,
    dm: strictDmRequest,
    'slot-intro': strictFeedRequest
  }
})
