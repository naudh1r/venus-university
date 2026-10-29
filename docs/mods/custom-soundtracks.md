# Custom soundtracks

Custom soundtracks is a self-contained, default-on `anytime` mod, ID `custom-soundtracks`.
It needs the shared Mods framework, but does not depend on renaming, Plot Twist, Story Memory,
SQLite, City Life, or any particular character or save. This guide describes the current community source implementation, including Echo encounter cues.

## Player behavior

Enable **Custom soundtracks** in **Mods**, then open **Settings → Custom soundtracks**.
Choose a game track and import an MP3, OGG or WAV file. Changes save immediately; the parent
Settings form's Cancel button does not undo them. Files must be nonempty, at most 50 MiB
(labelled 50 MB in the UI), and decode to at most 20 minutes. Codec support depends on the
browser/Electron build. A failed selection leaves the old assignment in place.

The thirteen slots are title, weekday day/night, weekend day/night, ending, the four venue
styles (electronic, lo-fi, pop and rock), and three Breaking Through the Silence cues
(dungeon, questions and victory). These are soundtrack cues already present in the
game, not additional location rules. Weather, other ambience and effects stay with their
existing cues. Imported title/landing/ending tracks use the Music volume; venue songs use
Ambience and the native venue treatment. Music still follows the game's scene transitions.

Replacement tracks loop by default. **Loop replacement** can instead play a track once per
cue entry. A finished track stays finished through ordinary UI/store updates and changes to
unrelated slots; leaving the cue and returning allows it to play again. Changing that slot's
file or loop setting restarts it. A custom title follows menu visits rather than the stock
title's once-per-session rule. A one-shot custom title ends quietly; it is not cut off by the
stock title's thirty-second run-out. **Current cue** identifies the requested cue even after
a play-once recording finishes, rather than claiming that sound is still playing.

Preview plays the first ten seconds (repeating a shorter recording) through the slot's native
volume group. **Stop preview**, closing the panel, changing slots, changing assignments or
toggling the mod stops it. Preview temporarily silences background music and ambience, including fading tracks, while
keeping the preview on its normal volume group. Stop, timeout, cancellation and load failure
restore the current background mix. The underlying game tracks continue their clocks silently,
so stopping a preview does not restart a song or revive a finished play-once cue. Venue
previews are clear, without the venue's in-world filtering.

**Restore original** clears that slot's assignment. **Clean up unused imports**, after
confirmation, deletes only unassigned imported copies. It never deletes the original file
the player selected, keeps files shared by another slot, and ignores unrelated filenames.
Turning the mod off restores native cue behavior and keeps all imported files and choices.
No saved playthrough is rewritten and no AI prompt or token budget is involved.

## Source map

The renderer entry registers `settingsSection`. Its lazily loaded `SoundtrackSettings` component owns the existing button and `SoundtracksModal`, including the open/close state. Settings passes its day/night theme and backup/restore busy state through the generic outlet; it no longer imports the mod, stores its open state, or mounts its panel directly. Disabling the mod removes the contribution and runs the modal's existing preview cleanup while retaining imported tracks and assignments. The button's label, placement, styling and busy guard stay the same.

The settings UI and desktop backup contribution use the kit. Audio cue resolution, file storage
and the typed native/web bridge remain on their existing paths. Browser backups retain their
existing transaction integration and legacy export format while accepting the new desktop format.

| File | Responsibility |
| --- | --- |
| `src/shared/soundtracks.ts` | Mod definition, thirteen slots, bridge types, limits, legacy map parsing, backup integrity |
| `src/shared/soundtrackLibrary.ts` | Serialized mutations, temporary selection tokens, shared native/web rules |
| `src/shared/modEntries/custom-soundtracks.ts` | Registers the independent switch, without `requires` |
| `src/renderer/modEntries/custom-soundtracks.ts`, `views/SoundtrackSettings.tsx` | Registers the settings contribution and owns its button/panel state |
| `src/main/services/soundtrackService.ts` | Native file storage, bounded reads, SHA-256 and atomic writes |
| `src/main/services/soundtrackBackup.ts` | Mod-owned required backup export, preparation and legacy migration |
| `src/main/ipc.ts` | Native file dialog and seven typed soundtrack handlers |
| `src/preload/api.d.ts`, `src/preload/index.ts` | Typed renderer bridge |
| `src/web/soundtracks.ts`, `src/web/bridge.ts` | Browser file picker and IndexedDB storage behind the same API |
| `src/web/db/open.ts` | Current database version 12; soundtrackMeta and soundtrackFiles retain the two additive soundtrack stores |
| `src/renderer/stores/soundtrackStore.ts` | Import/decode/commit actions, busy state, errors and assignment state |
| `src/renderer/stores/soundtrackAudio.ts` | Separate bounded decoded cache, stale-load fencing and fallback |
| `src/renderer/stores/audioEngine.ts` | Replacement buffer resolution, looping, one-shot completion, refresh and preview |
| `src/renderer/stores/audioStore.ts` | Watches changed assignments/mod switch and connects them to native cues |
| `src/renderer/stores/soundscape.ts` | Optional custom title behavior; stock behavior when inactive |
| `src/renderer/views/AppSettingsModal.tsx` | Generic settings-section outlet; the mod owns its button and panel |
| `src/renderer/views/SoundtracksModal.tsx` | Native controls, picker, preview, restore, cleanup confirmation |
| `src/renderer/vu_styles/Soundtracks.css` | Day/night panel, bounded body, fixed footer and scrollbar spacing |
| `src/shared/backup.ts`, `src/web/backup.ts` | Legacy archive classification and browser backup compatibility; desktop backup service calls generic parts only |
| `test/soundtracks.test.ts` | Ownership, expiry, failure recovery, limits, cleanup and invalid backups |
| `test/soundtrackStorage.test.ts` | Real temporary files, old maps, browser migration and cross-backend snapshots |
| `test/soundtrackAudio.test.ts`, `test/soundscape.test.ts` | Playback clocks, off/on, play-once, fallback and stale loads |

## Storage and compatibility

Desktop storage deliberately retains the earlier mod's layout:

```text
data/ex-music/tracks.json
data/ex-music/<sha256>.mp3   (or .ogg / .wav)
```

`tracks.json` is a raw object keyed by one of the thirteen cue IDs. For example:

```ts
{
  title: { file: '<64 lowercase hex characters>.wav', name: 'my-song.wav', loop: true }
}
```

Old assignments without `loop` default to true. Existing valid maps need no conversion when
the new build uses the same data directory. The port does not search for or copy data from a
different installation. Paths always derive from the game's existing `getDataPath()`.
The map is validated before mutation: malformed JSON or unexpected slots are reported and
left alone, not silently replaced with an empty map. Hash-named files deduplicate identical
imports; assigning one recording to multiple slots does not require multiple disk copies.

The browser uses `soundtrackMeta` (key `tracks`) and `soundtrackFiles` (filename → Blob) in the
existing IndexedDB database. Version 8 creates missing stores and preserves prior rows from
versions 5, 6 and 7. A
write of the files and their assignment map is one transaction. Browser quota failures return
through the usual error bridge; the previous committed map remains usable. Browser data is
origin-specific. A desktop folder cannot automatically become browser data: use a backup.

**Browser rollback:** once an origin's database reaches version 8, an older build that opens
it at version 7 or below cannot open it. To turn this feature off, use its switch and keep
the additive database schema. Back up data before trying a different build. Do not solve a
version mismatch by deleting an existing database or lowering its recorded schema version.

## Import transaction and integrity

1. Native IPC opens the OS picker; the renderer never supplies a filesystem path. The browser
   uses its own local file picker. The original file is read, never moved or edited.
2. A bounded read rejects empty or oversized files. The library copies the bytes, hashes them,
   and creates a single-use random token bound to the requesting native webContents ID. Tokens
   expire after 60 seconds; cancellation or a new pick invalidates the old one.
3. The renderer decodes the selected bytes using Chromium's audio decoder and checks duration.
   It sends the slot, token and duration, not an arbitrary destination or replacement bytes.
4. The serialized commit checks the switch again, validates slot/duration/token/owner, and
   persists the imported file before the new map. Native writes use the game's atomic-write
   helpers; browser writes use one transaction. A failed native map write can leave an
   unassigned hash-named copy, which cleanup can reclaim, but preserves the old assignment.
5. Only success updates the renderer map. Revision checks keep an older list response from
   overwriting a newer successful edit. Changes are global music preferences, outside saves.

Duration validation is performed by the renderer decoder, not a native media parser. The
50 MiB bound applies before reading/decoding, and decoded duration is checked again during
playback. A SHA-256 check detects damaged or mismatched stored bytes; it is not a signature
establishing who authored a track. Codec decoding remains Chromium's responsibility.

## Playback integration

The port extends the existing Web Audio engine rather than replacing its buses or starting
an unrelated background player. `bufferFor` first asks the custom resolver for an eligible,
enabled assignment; otherwise it uses the original cache. Successfully decoded replacement
buffers are marked separately so stock fallback uses stock loop/end rules.

Changing a slot invalidates only that slot's custom cache and restarts only channels currently
requesting that slot. Switching the feature clears the custom caches and refreshes relevant
music/venue channels without reporting the outgoing copy as a natural song ending. This
prevents the stock menu title from being marked finished when the mod is toggled. Its
normal once-per-session and end-of-track rules are unchanged. Per-slot revisions reject decode completions from older assignments;
the engine's existing channel tokens reject sources belonging to older cues. A separate
snippet token prevents a preview from appearing after the player has closed its panel.

Custom cache retention is bounded to 128 MiB of decoded samples, separately from stock audio.
A recording larger than that can play but is not retained for later use. This is a cache
limit, not a hard process-memory ceiling: decoder work, active sources, fade tails, original
audio and previews also consume memory. Long stereo recordings can be much larger decoded
than their compressed file size; use short loops where practical.

If an assigned recording is missing, corrupt or undecodable, that slot falls back to original
music and the panel reports the problem. The failed assignment stays recorded so it can be
fixed. Reopening the panel reloads assignments and retries failed slots; changing an assignment
also clears error state. Original missing recordings retain the engine's existing warning and
silent-cue behavior. Disabling the mod does not delete an assignment to hide a failure.

## Backup format and restoration

The outer backup schema stays at 1. Desktop exports use a mod-owned entry:

```ts
mods['custom-soundtracks'] = {
  version: '1.1.0',
  json: { v: 1, tracks: /* assignment map, or null when export is disabled */ },
  files: ['<sha256>.wav']
}
```

Its recordings sit in `mods/custom-soundtracks/`. The browser still exports the older
`exMusic` assignment map and `exMusic/<sha256>.<ext>` files. Both backends read both formats,
so backups can travel in either direction. Old maps without `loop` still mean looping.
The new metadata takes precedence if an archive also carries stale `exMusic` fields; an
unsupported version fails preflight rather than falling back to the old data. Missing metadata
beside new-format files is rejected too.

Exports include assigned recordings, not unused imports or original source paths. They include
user filenames and user-selected audio: backups are personal data, not mod packages.

The Custom soundtracks switch also controls backup exports on desktop and browser. When
off, no recordings or assignment map are exported. Desktop writes `tracks: null` and an empty
file list to distinguish intentional omission from an empty assignment map. Browser exports
omit `exMusic`. Imported tracks and assignments stay in local storage. When on, backups include
the assigned music; an empty assignment map is an explicit request to restore original music.

Earlier VE builds that only understand `exMusic` cannot restore the new desktop music share.
Use the matching build on the destination. The unmodded game's compatibility with mod archive
folders is not guaranteed. Keep the source backup until restoration has been verified.

Imports validate all referenced soundtrack names, byte limits and hashes **before changing
game data**. A missing extension leaves the current music library alone; an explicit empty
map restores original music assignments. Restoring music also works with the feature off.
Browser restore includes the map and files in the same transaction as the rest of the backup,
and shares the library's mutation queue. Desktop registers `requiredBackupPart` when its
native service loads. Export reads a verified snapshot; failure aborts before replacing an
existing ZIP. Preparation checks every named recording before core changes any live data;
commit restores the library after core has restored its share. Imports work with the mod off.
Desktop restore remains a sequence of writes, not an all-files transaction. An unrelated disk failure
partway through native restore can leave a partial overall restore, as in the base service.
Always keep the original backup until a restore is verified. The app reloads after success,
so hydrated settings, cached music and other stores restart from the restored data together.

## Porting again

Keep the stable mod ID and the storage/backup keys. When the target game changes, inspect
`AUDIO_FILES` first: every `SOUNDTRACK_LABELS` key must still be a real music/venue cue. Follow
native changes in `bufferFor`, `begin`, `armEnd`, the snippet path and the audio-store
subscriptions. Preserve one-shot completion and per-slot invalidation; repeatedly resetting
the cue defeats play-once even when `source.loop` is false. Keep the title override gated.

Next check the bridge interface, native handler convention, backup entry classifier and the
current IndexedDB schema version. This build uses version 12. Merge future database changes
with all existing stores and choose a version greater than either build's existing version
when an upgrade is needed, so existing players receive the new stores too.
Preserve existing rows and test upgrades from both official and modded schemas. Keep a
separate soundtrack modal and the native gesture helpers when integrating Settings.

Run type checks, the full tests, desktop and browser builds, then UI/audio tests with a short
generated WAV. Verify a short title loops past its duration, play-once remains finished,
unrelated edits do not restart it, disabling falls back, preview stops on close, and corrupt
backups are rejected before writes. Exercise day/night at 16:9 and 4:3. See the [technical handoff](../maestro-technical-guide.md) and the dated verification record
in the portable bundle for results and remaining playtest boundaries.

The replacement library distributes no player-imported tracks, saves, conversations or credentials.
The shared game separately includes the community encounter music credited in
[the asset notice](echo-asset-licenses.md). Importing replacements adds no remote downloads,
telemetry or AI calls.

## Framework registration

- `src/shared/modEntries/custom-soundtracks.ts` supplies its existing mod definition.
- `src/renderer/modEntries/custom-soundtracks.ts` supplies the `settingsSection` contribution.
- `src/main/services/soundtrackService.ts` registers its mod-owned adapter through
  `requiredBackupPart`. A future standalone manifest must declare `main:requiredBackupPart`;
  the generic `main:backupPart` capability alone does not guarantee complete exports.
- Native IPC currently imports the service at startup. This is a bundled-mod migration, not
  the standalone `main.js`/generic IPC move-out. Browser storage integration is also still direct.

The stable IDs, defaults, dependencies, save fields and gameplay behavior are unchanged. Native character notes, scene-creator saves and calendar replays remain separate base-game features. Merge framework updates from `core` into this mod branch; resolve conflicts with `main` on a separate `integrate/custom-soundtracks` branch.

## October 14 load follow-up

Canceling a picker or completing a cleanup with no assignment change no longer discards a pending initial soundtrack load. A successful assignment change still invalidates stale results. This is separate from the earlier title-theme transition and preview playback fixes; those are preserved in the combined Echo build.
