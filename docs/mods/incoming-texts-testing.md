# Incoming Texts — manual test results

Date: October 12, 2026. Tester: **sav**.
Test package: **0.1.0-incoming-texts-test.1**, for Venus University 0.4.0.
These are tester-reported gameplay observations, separate from the automated tests.

| Test | Reported result |
| --- | --- |
| Mods menu on/off switch | Works as expected. |
| Generate an incoming text | Checking Incoming text and entering a direction produces the character's message. |
| Generate an incoming photo | Character sends a photo successfully. |
| Generate an invitation | Character invites the reader, with the normal Yes/No prompt. |
| Ordinary reply after incoming text | Works as expected; normal texting resumes. |
| Persistence after restart | A generated selfie and the accompanying pending invitation remain. The writing direction does not appear in the conversation. |
| Regenerate an incoming text | Not available, as intended. |
| Regenerate a subsequent normal reply | Confirmed available in a separate simple greeting exchange: incoming hello, player replies hello, character's follow-up can be regenerated. |
| Regeneration in an invitation-related exchange | Not available in the reported exchange. Consistent with the existing invitation protections; the exact blocking condition was not captured. |
| Unsent direction when leaving for Mods | Opening Mods requires closing the texting interface. Closing it clears the draft and resets the checkbox. The proposed live-toggle-with-draft test is therefore not reachable through normal navigation; the actual navigation behavior is confirmed. |
| Switching character chats | Clears unsent directions. |
| Unavailable character | Incoming text checkbox is present but cannot be used, as intended. |
| Accept invitation | Yes presents Begin hangout. This observation confirms the acceptance prompt, not completion of the resulting scene. |
| Decline invitation | No removes the prompt and permits normal texting; it does not start or prompt a hangout. |

## Regeneration interpretation

The existing Text Regeneration rules exclude a conversation with a pending
invitation, a reply immediately following an invitation, and a turn whose saved
checkpoint marks it non-regenerable. The invitation-related result above fits
these restrictions. The tester's separate ordinary greeting confirms regeneration
can resume after an incoming turn. No change to the regeneration rules is proposed.

## Remaining coverage

No defect was reported in these checks. A naturally failed live request followed
by Retry has not been reported; failure/retry and cancellation have automated
coverage. Manual blocking/epilogue checks, the regeneration-off-then-on scenario
after reload, and completing a hangout scene were not separately reported.
No exact model identifier or detailed runtime configuration was recorded for this
test session. These results do not claim exhaustive gameplay coverage.
