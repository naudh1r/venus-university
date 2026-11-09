import AIR_HOCKEY from '@shared/minigameEntries/air-hockey'
import { AirHockey } from '../minigames/games/AirHockey'
import PARADISO from '@shared/minigameEntries/paradiso'
import { Paradiso } from '../minigames/games/Paradiso'
import POOL from '@shared/minigameEntries/pool'
import { Pool } from '../minigames/games/Pool'
import BOWLING from '@shared/minigameEntries/bowling'
import { Bowling } from '../minigames/games/Bowling'
import SKEE_BALL from '@shared/minigameEntries/skee-ball'
import { SkeeBall } from '../minigames/games/SkeeBall'
import HOOP_SHOT from '@shared/minigameEntries/hoop-shot'
import { HoopShot } from '../minigames/games/HoopShot'
import WHACK_A_BUN from '@shared/minigameEntries/whack-a-bun'
import { WhackABun } from '../minigames/games/WhackABun'
import CLAW_MACHINE from '@shared/minigameEntries/claw-machine'
import { ClawMachine } from '../minigames/games/ClawMachine'
import { registerGame } from '../minigames/kit'

registerGame(AIR_HOCKEY.id, AirHockey)
registerGame(PARADISO.id, Paradiso)
registerGame(POOL.id, Pool)
registerGame(BOWLING.id, Bowling)
registerGame(SKEE_BALL.id, SkeeBall)
registerGame(HOOP_SHOT.id, HoopShot)
registerGame(WHACK_A_BUN.id, WhackABun)
registerGame(CLAW_MACHINE.id, ClawMachine)
