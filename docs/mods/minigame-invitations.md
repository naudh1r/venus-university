# Mini-game invitations and destination requests

Ordinary conversation gets a short catalogue of games available at the reached venue, their suggestion frequency, and one `minigameInvite` field. No game option enums or launch agreement object are sent on these turns. A reported invitation cannot launch a game.

A player action naming a game, or answering the previous NPC invitation, gets that game's rules, options and consent schema. Other games are omitted. Explicit destination names such as “darts at Pino-Cola” can supply destination context before travel; they do not change the actual scene location. Ambiguous or unrecognized venue names are not guessed. Requests without a named destination remain scoped to the reached venue.

Agreement comes before travel. The model is told to narrate arrival and setup, never the actual game. The agreement records its destination; both automatic opening and the manual panel check the reached location and available games. Only participating NPCs who agree are seated. Disabled games, refusals and scene endings cannot launch a match. Existing proposal-panel behavior remains.

Unanswered invitations are stored beside the save, scoped to playthrough, slot and the exact conversation prefix. They can supply context for the next reader action (including “okay”), but the model still judges whether the reply accepts, refuses or changes topic. A reply clears the invitation unless it explicitly leaves another invitation pending. An altered history or different slot invalidates it. No extra AI calls are added.

Measured ordinary-turn prompt text plus added field schema, all packs enabled, one NPC, normal suggestion settings:

| Venue | Before (characters) | After (characters) | Reduction |
| --- | ---: | ---: | ---: |
| Pino-Cola | 3,525 | 806 | 77% |
| BTB Arcade | 5,190 | 1,501 | 71% |
| Cat Cafe | 2,632 | 556 | 79% |

These are character counts, not provider token measurements. Selected-game turns carry more detail. Real-model testing should cover spontaneous invitations, short acceptance, rejection, two NPCs with only one accepting, and a cafe-to-Pino-Cola request.
