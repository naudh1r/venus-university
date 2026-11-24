# Community mod QA follow-up — October 14, 2026

## Review split

Base-game backup preflight, safe ZIP replacement and ordinary texting request ownership have been extracted into separate core and upstream branches. Their original mixed-mod regressions remain in the Echo integration. #57 now contains only the community-mod fixes; prior validation totals below describe the pre-split combined work. Regeneration context and mod reply hooks remain here. See qa-base-game-split-2026-10-14.md for the branch mapping and updated checks.

This follow-up addresses all six issue groups in the supplied DOTS second-pass evidence. It is based on community main at `494fb91`, which already includes Story Memory Light (#52). It does not include the Echo/Reckoning implementation from #53.

## Fixes

1. **The Hare & Quill:** delayed replies apply an issue-level update to the latest newsletter state after waiting for a save checkpoint. Observations, discoveries, read markers and unrelated issues survive. Removed, answered or full discussions reject stale batches. The native save lane still rejects a change while queued. Semester carry reads ordinary name knowledge from the outgoing character records, even if the mod was disabled when the name became known.
2. **Text Regeneration:** normal replies and replacements share the same prompt-state builder: Character Dynamics, plans, Story Memory, Breakthrough history and the usual location/roster data. Accepted, persisted replacements dispatch the existing Photo Feature hook. Failed saves, rejected plans, blocks and stale loads do not dispatch it. Photo name reservation also rechecks the loaded save and target message before attaching or rendering anything.
3. **City Life / enrollment:** map fillers apply the location-availability rule. Enrollment persists the playthrough mod selection that generated its semester; the registrar, retries and final record use that snapshot. An explicit empty list stays empty. Legacy enrollments without a snapshot retain City Life dependencies required by their already-generated jobs and haunts. No existing save is rewritten on read.
4. **Character Dynamics / orientation:** an already-met student gets an acquaintance opening. The scene respects the established past without assuming friendship or inventing a particular reunion. Unmet freshmen and upperclassmen retain their original introductions.
5. **Story Memory / slot opening:** recall includes the requested DM authors and public posters. Each private fact is explicitly restricted to DMs by authors who already know it; unrelated secrets, narrator-only recaps and poster-only private facts are omitted. Public facts remain available to public outputs. This is prompt scoping, not a guarantee about live-model compliance. Standard and Light budgets remain unchanged; SQLite and snapshot fallback produce the same scoped recall.
6. **Custom Soundtracks:** removing the custom title during gameplay settles the abandoned title state, so the next main menu can play native ambience. This covers a different transition from toggling the mod directly on the menu. Direct toggling, completed one-shot behavior and the previous Echo-branch preview fix are preserved.

## Verification

All tests use synthetic data and mocked providers; no paid API requests or personal saves were used.

- Main-only branch: all three TypeScript checks; 2,163 passing tests, one existing skip, 174 files; desktop and browser builds.
- Combined with Echo/Reckoning #53 at `686247f`: clean automatic application; all three TypeScript checks; 2,468 passing tests, one existing skip, 196 files; desktop and browser builds; eight installer tests.
- The combined run includes the supplied Echo-specific regeneration tests for earned growth with Character Dynamics both enabled and disabled. Those tests stay in the local combined-check fixture because community main has no Reckoning module yet.
- Nine checked-in regression files contain 40 tests derived from the supplied reproductions and additional checkpoint, failure, privacy, enrollment and audio cases. The original reproduction archive remains unchanged locally.

Vitest was run on Windows with two workers and a 30-second per-test timeout. This does not establish a fresh Linux pass or live narrative quality. The reported Linux path assertion was already present in community main; Venus Dev's upstream was not independently verified. The isolated checkout has no official character ZIPs and was not installed into a player's game.

After this PR merges, merge main into the Echo integration branch before its next review/build. The compatibility check does not itself modify or publish #53. The installed Echo Test copy and user saves are unchanged by this follow-up.

## Subsequent verification

The checks and branch status above describe the second pass. See [third/fourth-pass follow-up](qa-third-fourth-pass-2026-10-14.md) for the later fixes, combined validation and #53 dependency.
