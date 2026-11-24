# Incoming Texts

By **sav** · Version **0.1.0**

Ask a character to initiate a Bunnyboard conversation by describing what she sends.
Your direction goes to the configured AI as writing instructions; it is not posted
as a message from the reader.

## Use

1. Enable **Incoming Texts** in **Mods** (enabled by default).
2. Open an available character's chat and select **Incoming text**.
3. Describe her message, for example: `Winter apologizes for leaving me waiting at the restaurant yesterday.`
4. Select **Generate**, or press Enter. Shift+Enter adds a line break.
5. Read her messages and reply normally. Incoming mode resets after sending.

Switching between normal and incoming mode clears the current draft so directions
cannot accidentally be sent as dialogue. Turning the mod off clears an incoming
draft and hides the control. Texts already received remain. A request already
started can finish or be retried with the switch off.

## Examples

- Start a conversation without writing an opening message yourself: `She texts me to ask how my exam went.`
- Continue a story beat: `Winter apologizes about last night and explains why she left.`
- With Photo Feature enabled and configured: `She sends me a selfie from the campus cafe.`

The model still interprets the direction using the character and game context;
an exact response or picture is not guaranteed. This is a player-triggered action,
not a timer or a system that sends messages automatically in the background.

## Compatibility

- Existing saves need no conversion. Generated messages and summaries use the usual
  conversation storage; the direction itself is not stored as a chat message or save field.
- The direction is sent to the configured text model as part of its request. Summary
  exclusion is a prompt instruction, not a filter on model output.
- Normal chat availability still applies: a scene, classes/work, blocking, and the
  graduation epilogue prevent incoming requests just as they prevent ordinary texting.
  Bot and employer chats are excluded.
- A direction cannot accept or decline a hangout. A new invitation from her still
  requires your answer; an existing standing invitation is preserved.
- Photo Feature is optional. Incoming Texts keeps its prompt and delivery hooks;
  photos require that mod's own settings and working image backend. No image generator
  is bundled here.
- In the combined package, Text Regeneration continues to work for normal replies.
  Incoming texts cannot be regenerated. Start another incoming request instead.
  Its existing invitation restrictions still apply to normal replies around a hangout invitation.

## Implementation and review

The mod registers as `incoming-texts`, scope `anytime`, with no required mods.
It adds a composer control and a guarded incoming entry point to the existing
texting loop. The request builder omits the pending player message and supplies
the direction separately. Delivery, streaming, retry, summary handling, and mod
hooks use the existing path. The hangout classifier receives no player message,
and its player-initiated flag is ignored for incoming turns.

No new dependencies, IPC endpoints, background jobs, or additional model calls
are introduced. Photos retain their existing generation costs.

The standalone branch is based on `core`; the integration branch combines it
with the package's `main`. The integration marks incoming bubbles with a distinct
reply origin so Text Regeneration cannot absorb them into a previous reply,
including after loading a save or enabling regeneration later.

Review checks: normal send and incoming send; empty direction; off switch;
disabled/blocked/busy threads; new and standing invitations; failure/retry and
cancellation; save/reload; photo hooks; normal versus incoming regeneration;
keyboard controls and the four supported viewport sizes.

Tester-reported gameplay results are recorded in [the manual test report](incoming-texts-testing.md).
