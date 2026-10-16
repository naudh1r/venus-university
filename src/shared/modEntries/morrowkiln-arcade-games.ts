import { packMod } from "../minigameKit";
import AIR_HOCKEY from "../minigameEntries/air-hockey";
import PARADISO from "../minigameEntries/paradiso";
import POOL from "../minigameEntries/pool";
import BOWLING from "../minigameEntries/bowling";
import SKEE_BALL from "../minigameEntries/skee-ball";
import HOOP_SHOT from "../minigameEntries/hoop-shot";
import WHACK_A_BUN from "../minigameEntries/whack-a-bun";
import CLAW_MACHINE from "../minigameEntries/claw-machine";

/** A pack: one mod bringing several games, each with a switch of its own among the options. */
export default packMod({
  id: "morrowkiln-arcade-games",
  name: '[MK] Arcade & Bar Games',
  author: "morrowkiln",
  version: "0.1.0-beta",
  blurb: "What the arcade, the bar and the bowling alley are for.",
  games: [
    AIR_HOCKEY,
    PARADISO,
    POOL,
    BOWLING,
    SKEE_BALL,
    HOOP_SHOT,
    WHACK_A_BUN,
    CLAW_MACHINE,
  ],
});
