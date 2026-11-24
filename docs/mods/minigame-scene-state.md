# Mini-game invitations and saves (experimental)

An NPC can suggest an outing as well as a game at the current venue. Ordinary scene requests receive at most two rotating, available game/venue pairs in addition to the small local catalogue. Busy class/work scenes do not receive outing suggestions. The model reports an invitation as `minigameInvite: { game, location }`; the engine accepts only a pair included in that request. A subsequent “okay” supplies the chosen game's full context and destination. Consent still precedes travel and launch still waits for reached playback.

Invitations, participants, venue, stake and selected options are now part of `scene.mods.miniGame` in the normal save file, the scene's slot for mod data. New scenes clear them, old saves without the field remain valid, and restoring an earlier save restores that save's own invitation. The old localStorage invitation/agreement keys are no longer read. Unfinished invitations from those older builds may need to be asked again.

Saving during a match saves its setup, not scores or individual moves. Loading restarts that match with the same participants and options. Random deals and rolls may differ. This applies to solo and group games. The Save Game panel explains the restart behavior. Leaving a table with Not now, or one whose screen fails, before the first move lets the match go, so it does not reopen and a later save does not restart it. If the pack is disabled, the game will not open until available again; absence of a participant prevents seating that participant.

As soon as a game reports its result, that outcome is checkpointed. Loading a completed match continues its aftermath rather than restarting. Results are persisted before the narration request. Duplicate callbacks do not dispatch duplicate aftermath requests in a running session. Failed narration uses the normal retry flow. Saving a result awards no stats and adds no reward path.

No extra invitation-detection calls are made. Short ordinary-turn context includes a small outing shortlist; full rules/options are reserved for the selected game. A recovered result can retry its aftermath call; it does not replay gameplay.

Playtest: ask for an outing from a cafe; accept, refuse, or ask a follow-up; reload after the NPC invitation; save midway through a solo or multiplayer match; load to restart; then save after the result and check that only aftermath resumes. Real-model invitation and consent adherence still needs in-game testing.
