import { assignEchoes } from '../../shared/echo'
import { useGameStore } from './gameStore'

/** Shared by Echo's lifecycle and manager without importing its hook registration. */
export function ensureEchoes(): void {
  const g = useGameStore.getState()
  if (!g.playthroughId || g.replaying || g.createdScene) return
  const exEcho = assignEchoes(g.exEcho,g.playthroughId,g.characters,`${g.playerFirstName} ${g.playerLastName}`,g.bio)
  if (JSON.stringify(exEcho) !== JSON.stringify(g.exEcho)) useGameStore.setState({ exEcho })
}
