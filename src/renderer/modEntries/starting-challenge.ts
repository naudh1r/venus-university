// Carry registration follows catalogue loading and runs even while switched off.
import '../../shared/startingChallengeCarry'
import { challengeStatFloor, STARTING_CHALLENGE_MOD } from '../../shared/startingChallenge'
import { registerHooks } from '@vx/modkit/renderer'
import { useGameStore } from '../stores/gameStore'

// The playthrough's saved floors remain fixed; the menu switch only chooses new games.
registerHooks(STARTING_CHALLENGE_MOD, {
  statFloor: key => challengeStatFloor(useGameStore.getState().exStartingChallenge, key)
})
