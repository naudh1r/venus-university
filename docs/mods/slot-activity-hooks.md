# Experimental slot activity hooks

This branch adds generic, optional hooks for interactive Improve Stats activities. Core does not import any game pack. No activity appears unless an enabled provider registers one.

`statActivities(stat)` supplies landing alternatives with an owner, ID, display label, location and stat. `slotActivityAvailable(offer)` revalidates a selection at commit and on recovery. Offers may be chosen alongside the existing ordinary activities. Obligations retain their existing priority. A preset location uses the normal encounter casting path.

The selected metadata is saved in `SceneState.activity`. Pending activities hold the opening before the scene ends, including a scene with no cast. Ordinary scene playback permissions are unchanged. The provider opens its own surface after the opening is read and the normal input decision point is reached.

Providers call `finishSlotActivity(owner, id, completed, result)` once after returning input to the scene. Only the matching pending activity can settle. The engine saves the result before requesting aftermath narration. A recovered settled activity resumes its closing instead of reopening play. A missing or disabled provider ends the activity without a completion reward.

The existing slot boundary applies rewards: one selected stat, +2 in a scene without company or +1 with company, replacing the ledger's training award. Sickness, class and work rules retain priority. No points are awarded at game completion itself. An abandoned or pending activity pays no training reward. Hangouts without committed activity metadata retain their existing ledger rewards.

The provider must keep a technical failure pending and offer retry or abandonment. Reloading pending play may restart the activity; save/resume within an individual game is outside this hook. Reloading a completed result cannot pay it twice: the normal slot-boundary transaction is the only award path.
