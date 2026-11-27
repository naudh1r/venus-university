# After Hours 0.7.4 — sent and read ticks

| Branch | Commits |
| --- | --- |
| `naudh1r-core` | `5a0ddc76` receipt hook and first rendering, `dc4335dd` bare corner glyphs, `1ff457d1` inline spacer, `bf478929` last-word wrapping |
| `mod/after-hours-kit` | `4875846a` first core merge, `005c89f3` opt-in and 0.7.4 docs, `1e2abe9a` corner and spacer merge, `9f6c33ec` final-word merge |

## Core changes

| File | Change | Default |
| --- | --- | --- |
| `packages/modkit/src/renderer/hooks.ts`, `packages/modkit/src/shared/hookTable.ts`, `packages/modkit/src/host/renderer.ts` | `readReceipts` is an `any` renderer hook. An enabled true opts in, and a throwing handler is logged and skipped. | With no opt-in, the thread passes no receipt props and draws no ticks. |
| `src/shared/chatVisibility.ts` | `readPlayerIds` walks the shown list backward. It marks player IDs only after it encounters a later contact message. System messages and the typing indicator do not count. | Called only when the hook is on. No receipt state is stored. |
| `src/renderer/views/BunnyboardModal.tsx` | The thread derives one set from the existing rendered list per render and gives a boolean to each memoized player bubble. The SVG has the label “Sent” or “Read”. Bare and attachment-only messages have no ticks. | Bubbles without ticks have the original spacing, including with the mod off. |
| `src/renderer/components/TextSpots.tsx` | Native text groups the last word with the spacer. A long word may wrap inside that group while its final grapheme and spacer stay together. A mod's inline text renderer still draws the original message, with a joined space after its output and a break fallback only for an orphaned spacer. | The regular `SentText` path is used when no tick is drawn. |
| `src/renderer/vu_styles/Bunnyboard.css` | The first correction pinned bare glyphs to the corner. The second restored normal padding with an inline spacer and enlarged the marks to the font's cap height. The final correction binds the spacer to the text instead of letting it take a line of its own. | Padding, maximum width and corner radii match with receipts on or off. |
| `src/renderer/vu_styles/tokens.css` | Adds `--vu-read: #4e79a8` by day and `#8fb0d4` by night, independent of the Brain stat token. The sent glyph uses the existing `--vu-text-muted`. | Only receipt glyphs use the new role. |
| `MODDING.md`, kit Unreleased changelog and API reports, `test/kit/contract.test.ts` | Documents and verifies the hook surface. | The kit version stays 0.7.0. |

The phone derives `messages` from `shownMessages(conversation.messages, shownClock)`, with the game date and half as the fallback when the opened chat clock is absent. A held reply has its due slot on the message stamp, so a reply beyond the opened clock stays out of the rendered list and the receipt calculation. When the first contact bubble is in the list, the earlier player messages turn read in the same render. Typing dots are drawn separately. The pure tests cover system-only tails, multiple sends followed by one reply and visibility before and at the held reply's due slot.

After Hours answers the hook with true and offers no extra option. Its version is 0.7.4, still for game 0.9.2.

## Visual review

The final screenshot uses the outgoing bubble CSS and SVG markup in Chromium for the same three messages, “ok”, and “I can bring the drinks tonight.” in day and night. The last example wraps “tonight.” onto the second line beside its ticks, with no tick-only line. All four padding values and both right corner radii matched a bubble without ticks in each theme. The top-right radius was 21.23 pixels and the bottom-right radius was zero. The receipt has no background, border, radius or shadow. The empty spacer is hidden from assistive technology and the SVG retains the Sent or Read label. The blue ticks sit directly on the wine or pink bubble. Approximate contrast against the bubble is 1.59:1 by day and 1.05:1 by night, so they are particularly subtle at night. The requested colors were kept. The screenshot was sent in the review conversation.

In the Chromium fixture, native text preserved the clipboard string, including in samples with emoji, punctuation, a URL and 120 lengths of unbroken text. The same layout probe checked 123 synthetic mod-rendered inline samples and found no orphaned spacer or overflow after the fallback. These were layout fixtures, not a live in-game text exchange or a check of installed text mods. The visibility unit tests cover the transition when a held reply becomes visible. The build used the sparse checkout without bundled character archives.

## Checks

| Check | Core final | After Hours final |
| --- | --- | --- |
| Clean install | `npm ci` installed 434 packages | Same lockfile and clean dependency tree |
| Typecheck | Pass | Pass |
| Kit API report check | Pass | Pass |
| Unit suite | 2,911 passed, 4 skipped, 1 known failure | 2,930 passed, 4 skipped, 1 known failure |
| Desktop build | Pass | Pass |

The only unit failure on either final branch was the existing Linux `getComfyOutputFilePath` assertion. The bundled archive helper was made executable in the temporary clean install, so the archive suites passed. The kit version, lockfile and mod boundary allowlist did not change.
