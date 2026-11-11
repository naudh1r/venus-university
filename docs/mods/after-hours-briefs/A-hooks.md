# Brief A — core hooks `hangoutVerdict` and `chatsHeader`

**Repo:** `naudh1r/venus-university` · **branch:** `hooks/after-hours` (already on the org's `main`
b4ccf40c, `venus-extracurriculars/build`). Fetch the org's `main` first; if it has moved, merge it into
`hooks/after-hours` before starting. Do not touch `mod/after-hours`. Push only to `origin`
(`naudh1r/venus-university`), never to `venus-extracurriculars/build`. Open no pull request.

## Read first
- `CLAUDE.md`, `DESIGN_GUIDE.md` (sections 4–7), `MODDING.md` (Hook points), `packages/modkit/README.md`.
- `UI_STYLE_GUIDE.md` is not needed: neither hook draws anything of its own.
- The pattern to copy: how `conversationFoot` (a `slot`) and `sceneCut` / `sceneReplyLanded` (renderer
  hooks added in kit 0.7.0, commit 508f3ea2) were added: `packages/modkit/src/shared/hookTable.ts`,
  `packages/modkit/src/renderer/hooks.ts`, `packages/modkit/src/host/renderer.ts`, `packages/modkit/src/
  renderer/index.ts`, `packages/modkit/src/bridge/*`, `packages/modkit/CHANGELOG.md`,
  `packages/modkit/src/shared/version.ts`, `packages/modkit/api/*.api.md`, `MODDING.md`.

## Rules
- Never edit `DESIGN_GUIDE.md`, `UI_STYLE_GUIDE.md`, `README.md` or `TESTING_PLAN.md`.
- No mod code on this branch: core and the kit only. Nothing here names After Hours.
- Comments say what the code below does, never point at a guide, never history.
- Existing hooks and their arguments do not change.

## 1. `hangoutVerdict` (renderer, kind `pipeline`)

A mod may change or drop the texting classifier's verdict before it arms anything.

```ts
export interface HangoutVerdictCtx {
  charId: string
  /** Who sent the first text of this slot's thread: the reader, or her (a reach-out, an invitation, a reply). */
  startedBy: 'reader' | 'her'
  /** The exchange answers an invitation of hers still standing. */
  answeringInvite: boolean
}
hangoutVerdict?: (verdict: HangoutVerdict | null, ctx: HangoutVerdictCtx) => HangoutVerdict | null
```
- `HangoutVerdict` is the type `normalizeHangout` returns (`initiatedBy: 'player' | 'contact'`,
  `description`). Re-export it through the bridge so mods can type against it.
- **Where:** `src/renderer/stores/textingLoop.ts`, in `runReply`, the line
  `handleHangout(charId, await classifyHangout(character, conversation, sent, messages))` (`:724`).
  Classify, pass the verdict through the dispatcher, then hand the result to `handleHangout`. The
  settle on the next line (`settleAnsweredInvitation`) is unchanged.
- **`startedBy`:** among this slot's messages in her thread (`date` and `time` equal to the clock's),
  including the one just sent, the first whose `sender` is `'player'` → `'reader'`, `'contact'` →
  `'her'`. `'system'` lines are skipped. One small pure function in `src/shared` or beside the loop,
  reused if anything else needs it.
- **`answeringInvite`:** `sent !== null && invited !== null`, as `runReply` already reads them.
- Mods are asked in list order, each handed the last one's result; with no mod the verdict passes as is.
  A throwing handler is logged with its mod id and skipped, as the other pipelines do.
- Not asked by `regenerateTextReply` (`:828`), which already refuses any new hangout.

## 2. `chatsHeader` (renderer, kind `slot`)

A screen slot in the DM screen's left header, beside the **Chats** title.
- **Where:** `src/renderer/views/BunnyboardModal.tsx`, `ChatList`, inside
  `<div className="vu-title vu-bb-title">` after `<h2 className="vu-title-text">Chats</h2>` (`:642-645`).
- `<ModSlot slot="chatsHeader" props={{ theme }} />`. Pass `theme` (`'day' | 'night'`) the way the
  modal already has it; add the prop to `ChatList` if it is not there.
- Props type in `ScreenSlotProps`: `{ theme: 'day' | 'night' }`. It is drawn while the Chats list is.
- Each mod that is on draws in list order, in its own error boundary, as every slot does. No mod: no
  markup and no spacing.

## 3. The kit around them
- Rows in `HOOKS` with `since` set to the new kit version. Bump `KIT_VERSION` one minor (0.7.0 → 0.8.0)
  and add a `CHANGELOG.md` entry.
- Export what a mod imports (the types) from `@vx/modkit/renderer` through `src/bridge/renderer.ts`.
- Regenerate the API report: `cd packages/modkit && npm install && npm run report`, commit `api/*.api.md`
  and the rolled-up types, and check `npm run report:check` passes.
- `MODDING.md`: a row each in the hook-points table, and a short paragraph under it for
  `hangoutVerdict` (when it is asked, `startedBy`, `answeringInvite`, that `null` drops the verdict).

## 4. Tests
- `test/kit/contract.test.ts` and the hook-tie typecheck must pass: they hold the table, `ModHooks` and
  the dispatchers to each other.
- One test for the `startedBy` function only (it decides whether a hangout can arm): her reach-out then
  his reply is `'her'`; his first text is `'reader'`; a system line first is skipped; an earlier slot's
  messages are ignored. No test for the slot or for wording.

## 5. Done
- `npm run typecheck` and `npm test` pass.
- In the running app: texting a girl and agreeing to meet still arms **Begin hangout**; her invitation's
  Yes/No footer still shows; the Chats header looks exactly as before with no mod on.
- One commit on `hooks/after-hours`, author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no
  co-author lines, message in the repo's style (an imperative summary, e.g. "Let a mod drop a texting
  hangout verdict and draw in the Chats header"). Push to `origin hooks/after-hours`.
