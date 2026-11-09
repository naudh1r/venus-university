import { useGameStore } from '../src/renderer/stores/gameStore'
import { enterReckoningDungeon } from '../src/renderer/stores/reckoningDungeon'
import { unlockReckoningDungeon } from '../src/renderer/stores/reckoning'
export async function enterTestDungeon(id='a'):Promise<void> {
 await unlockReckoningDungeon(id)
 // Finish the scene, then enter through nighttime free roam.
 const game=useGameStore.getState()
 useGameStore.setState({time:1,awaitingInput:true,pendingLines:[],currentLine:game.currentSceneTranscript.at(-1)!,sceneLog:game.currentSceneTranscript,currentSceneTranscript:[],sceneSummary:null,sceneEnding:false})
 await enterReckoningDungeon()
 // Also exercise compatibility with older inside-dungeon saves that retain the invoking scene.
 // Rewind tests use that transcript; fresh entry itself must never bypass the travel gate.
 useGameStore.setState({currentSceneTranscript:[...game.currentSceneTranscript,{speaker:'',text:'The ordinary conversation continues.'}],sceneSummary:game.sceneSummary})
}
