# Let a mod read its DM reply fields while they stream

## What this adds

- **`lead` on a `dm` prompt addition.** A mod that sets `lead: true` has its schema fields placed ahead of the reply's own `messages`, `summary` and `blocked`, with `required` in the same order. Additions without `lead` keep their current place.
- **`dmReplyLead`,** a renderer event hook. It hands a mod the leading fields the moment they've streamed in, before her first text lands.
  - It fires once per reply.
  - It never fires for an abandoned reply, or for a reply that doesn't start with lead fields.
  - It isn't called for a regenerated reply, which doesn't stream.
- **`createDmLeadReader`** in `textingStream.ts` reads the top-level prefix once the `"messages"` key appears. It returns nothing if `messages` comes first or the prefix doesn't parse.

The finished reply stays authoritative: `afterDmReply` is called exactly as before, and a mod is expected to check its early fields against it.

## Why

Photo Feature wants a DM photo to start rendering as soon as she decides to send one, instead of after her texts have finished typing out, which is often 5–15 seconds of render time lost. Its photo fields have to stream ahead of her messages, and the mod needs to hear about them then. No existing hook fires between a reply arriving and her bubbles finishing.

## Nothing changes unless a mod opts in

With no mod setting `lead`, the schema is unchanged, the reader finds no lead fields, `dmReplyLead` is never called, and every request is byte-identical to before.

## Changes

- `packages/modkit/src/renderer/hooks.ts`: the `lead` flag, the `dmReplyLead` hook type and dispatcher (each mod's call is wrapped like `afterSceneReply`'s), and `promptFields`/`promptRequired` with an optional `'lead' | 'trailing'` part.
- `packages/modkit/src/shared/hookTable.ts`: the `dmReplyLead` row, `since: '0.7.0'`.
- `packages/modkit/src/host/renderer.ts`: the dispatcher export.
- `src/renderer/prompts/textingPrompt.ts`: `textingSchema` builds lead fields, then the native ones, then the trailing ones.
- `src/renderer/stores/textingStream.ts`: `createDmLeadReader`.
- `src/renderer/stores/textingLoop.ts`: the delta handler feeds the reader after its existing group and abandonment checks, ahead of message extraction.
- `MODDING.md`, the kit `CHANGELOG.md`, and the API reports (`npm run report`).

## Tests

- `test/textingLead.test.ts`:
  - lead fields come back first and only once, including a quoted `"messages"` inside a value;
  - nothing when `messages` comes first;
  - a key split across deltas;
  - nothing for an unparseable prefix.
- `test/kit/contract.test.ts`: the hook's identity row.
- `npm run typecheck` passes; the kit, texting, `textingLead` and `switchedOn` tests pass; `report:check` is up to date.

## Merging

This PR is one commit on top of #240. It merges cleanly into `core`, and into `main` for the automatic core-to-main sync.
