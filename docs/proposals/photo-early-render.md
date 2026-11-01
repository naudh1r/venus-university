# Brief: Photo Feature — start a DM photo's render as soon as its flag streams in

**Fork only.** This changes core, so it never goes to the org. Two branches, both pushed to `origin` only. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Don't edit any guide, and don't touch `mod/photo-kit-switch`.

1. **`core/dm-reply-lead`**, from `origin/main`: the **Core** section only, in one commit. Not a single Photo file changes on it, and it builds and passes on its own: no mod uses `lead` or `dmReplyLead` yet.
2. **`mod/photo-1.6.0-early-render-vu0.6.0`**, from `origin/mod/photo-1.6.0-redraw-vu0.6.0`: merge `core/dm-reply-lead` into it (a merge commit, no rebase), then the **Photo** section as one commit on top. No core file changes in that commit.

## The flow

1. Her reply is one call, as today. The photo fields (`sendPhoto`, `photoPrompt`, `photoTier`) come **first** in its JSON, before `messages`.
2. As soon as those fields have streamed in, core hands them to Photo. Photo settles the photo, reserves the name and starts the render.
3. Her texts stream in and type out as bubbles, unchanged.
4. When the bubbles are done, `afterDmReply` attaches the photo to her last text, as today. It's pending, or already landed if the render finished during the typing.

Prompt wording is unchanged. Only the field order and the timing change.

## Core (fork only)

1. **Field order.**
   - Add `lead?: boolean` to `PromptAddition` (`packages/modkit/src/renderer/hooks.ts`), with a comment: for `dm` only, place these fields ahead of the reply's own.
   - Give `promptFields` / `promptRequired` (`src/renderer/mods/hooks.ts`) a way to return lead and trailing fields separately.
   - `textingSchema` (`src/renderer/prompts/textingPrompt.ts`) builds its properties as lead mod fields, then `messages`, `summary` and `blocked`, then the trailing mod fields. `required` follows the same order.
   - Gemini keeps the schema's order (`responseJsonSchema`); no provider work is needed. A quick look at the log on the first test is enough.
2. **Reading the lead fields mid-stream.**
   - Add a pure reader beside `createTextExtractor`. It's fed the same deltas, and returns the top-level fields that precede `messages` once the `"messages"` key appears. Parse the prefix as JSON, closing the object. It returns them once; it returns nothing if `messages` comes first or the prefix doesn't parse.
   - Give it a small test: lead fields first, `messages` first, a split across deltas, and an unparseable prefix. It feeds a render, not the save, so keep it to those four cases.
3. **The hook.**
   - Add `dmReplyLead?: (ctx: { charId; character; lead: Readonly<Record<string, unknown>> }) => void` to `ModHooks`, with its caller in `src/renderer/mods/hooks.ts`. Wrap each mod's call in try/catch, as `afterSceneReply` does.
   - In `textingLoop.ts`'s delta handler, call it once per turn, the moment the reader returns the lead fields, and only if the turn hasn't been abandoned.

## Photo

- **Register the dm fields as lead:** `prompts.dm` in `photo-feature.ts` gets `lead: true`. The `slot-reach-outs` fields stay as they are, since reach-outs don't stream.
- **`dmReplyLead`:**
  - Run `sendPhoto`'s settle, using the same `allowedPhotoTier` inputs, then reserve a `chat` name and start the render.
  - Keep `{ charId, file, tier, scene, render promise, playthroughId, loads }` in a module map in `photoTurn.ts`, one per `charId`.
  - Don't touch the save yet: there's no message to hang it on.
- **`afterDmReply` → `sendPhoto`:**
  - If an early render exists for this `charId`, belongs to the live playthrough and load, and the reply's `photoPrompt` and `sendPhoto` still agree with it, hang `{ tier, scene, file, pending: true }` on her last text, save, and let the existing settle logic follow the **already-running** render. Reuse `drawMessagePhoto`'s settle and patience logic, but await the stored promise instead of calling `renderPhoto` again.
  - If the render has already landed, the photo is saved without `pending`.
  - With no early render, fall back to today's path unchanged. That covers a model that put the fields last, and a regenerated reply.
- **Reach-outs keep today's path.** `afterReachOut` calls `sendPhoto` without ever looking at the early-render map. Give `sendPhoto` an explicit flag for that, so a girl texting first can never pick up a render left over from a DM.
- **Stale early renders.** Clear an early render that never got attached, because the reply failed, was blocked or abandoned, or a load or new game happened. Do it on the next `dmReplyLead` or `afterDmReply` for that girl, and on `gameEntered`. Once its render settles, `drop` its file and sidecar, but only if no message in the save points at that file.
- **Changelog:** add one bullet to `## 1.6.0` in the page's voice: her photo starts drawing as soon as she decides to send it, while she's still typing.

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new reader test. The allowlist is unchanged: Photo reaches the hook through `@vx/modkit/renderer`.
- By hand:
  - Ask for a photo: the log shows the render starting before her first bubble, and the photo lands on her last text.
  - With a model or endpoint that ignores the order, the photo still arrives as before.
  - Block, start a scene, or load mid-reply after the render started: no file is left behind and no stray bubble appears.
  - Reroll and redraw still work on the early-rendered photo.
