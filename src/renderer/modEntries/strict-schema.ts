import { registerHooks } from '../mods/hooks'
import { strictPhotoDmBase } from '../mods/strictSchema/photoDm'
import { strictDmRequest, strictFeedRequest, strictLedgerRequest, strictSceneRequest, strictQuizRequest } from '../mods/strictSchema/requests'
import { strictQuizResult } from '../mods/strictSchema/quiz'
import { endEmptyScene, sceneBoundary } from '../mods/strictSchema/ending'
import { strictHangoutRequest } from '../mods/strictSchema/hangoutPolicy'
import { strictHangoutAnswer, strictHangoutOfferAllowed, strictHangoutResult } from '../mods/strictSchema/hangouts'

registerHooks('strict-schema', {
  dmBasePrompt: strictPhotoDmBase,
  sceneResult: endEmptyScene,
  sceneLines: sceneBoundary,
  quizResult: strictQuizResult,
  hangoutAnswer: strictHangoutAnswer,
  hangoutResult: strictHangoutResult,
  hangoutOfferAllowed: strictHangoutOfferAllowed,
  requests: {
    scene: strictSceneRequest,
    ledger: strictLedgerRequest,
    'text-ledger': strictLedgerRequest,
    quiz: strictQuizRequest,
    'hangout-classifier': strictHangoutRequest,
    dm: strictDmRequest,
    'slot-intro': strictFeedRequest
  }
})
