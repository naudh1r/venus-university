import { minigameSceneLocation } from '@shared/minigames'
import { useGameStore } from '../stores/gameStore'

/** One read of the player's reached scene, shared by the HUD, invitations and game context. */
export function currentGameLocation(): string | null {
  const scene = useGameStore.getState()
  return minigameSceneLocation(scene.sceneLocation, scene.sceneLog)
}

export function useGameLocation(): string | null {
  return useGameStore((scene) => minigameSceneLocation(scene.sceneLocation, scene.sceneLog))
}
