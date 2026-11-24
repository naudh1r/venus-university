// Carry registration follows catalogue loading and runs even while switched off.
import '../../shared/characterDynamicsCarry'
import { CHARACTER_DYNAMICS_MOD } from '../../shared/characterDynamics'
import { registerHooks } from '@vx/modkit/renderer'
import { characterDynamicsLines, withCharacterDynamics } from '../prompts/characterDynamics'

registerHooks(CHARACTER_DYNAMICS_MOD, {
  prompts: {
    scene: { lines: ({ cast, state }) => characterDynamicsLines(cast, state.exCharacterDynamics) },
    dm: { lines: ({ character, state }) => characterDynamicsLines([character], state.exCharacterDynamics) }
  },
  requests: {
    ledger: (request, { state }) => state.exCharacterDynamics ? {
      ...request,
      user: `${request.user}\n\nCharacter Dynamics starting backgrounds describe history before this playthrough, not new scene events. Award relationship milestones and emotional memories only for what actually happened in this scene; do not award them for recalling an old relationship or grievance.`
    } : request,
    'slot-intro': (request, { input }) => withCharacterDynamics(request,
      [...input.askers, ...input.breakups, ...input.posters].map(person => person.character),
      input.exCharacterDynamics)
  }
})
