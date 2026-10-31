# Echoes

Echoes gives the reader and each student a named symbolic creature and one of 22 original aspects. Matching aspects increase new positive relationship progress by 25%; competing aspects reduce it by 25%. Existing memories and negative gains are unchanged. Aspect assignment is a local profile-cue classifier, not an AI personality assessment. Ability prices and narrative effects remain experimental.

Echo ships off by default (version 0.14.2). Enable it explicitly in Mods; saved switch choices are not reset.

## Setup and customization

The shared Echoes manager appears near the end of new-game setup, after course selection. It starts with aspects, names and creature suggestions drawn from each profile. Before the game begins, the reader and new students can freely change starting aspects, names, creature details, artwork and staging. Native New Game+ also opens this manager: new students can choose their aspects, while returning students and the reader keep their established aspects and the reader's spent change. Carried artwork, names and staging remain available. Accepted next-semester setup is saved with registration before writing the opening save, so a failed save can be retried or registration resumed. Setup does not automatically buy artwork; generation buttons use the configured provider.

During play, open Echoes from its scene sidebar icon between Calendar and Settings, or the corner controls between scenes. Only met students appear in the manager, gallery and batch-generation list. Unmet students keep their assigned identities privately until introduced. Existing playthroughs do not repeat enrollment.

After starting, students' aspects are locked and the reader has one aspect change. Names and visual creature descriptions remain editable for everyone. The name and creature dice generate local suggestions for free. Save changes before generating artwork: the chosen name, species and description shape its appearance. Regenerating artwork preserves the saved name and aspect. Why this type? is marked as a spoiler and explains the relevant backstory/personality cues, including weak-evidence cases.

Save all settings, beside Generate all missing in the footer, commits the selected owner’s pending name, creature details, placement, visibility, motion and shared opacity in one save. During enrollment it also saves an editable starting aspect. The reader’s once-only mid-play aspect change remains its own explicit action. Individual Save buttons are still available. Switching Echoes with pending edits asks whether to Save and switch, Discard and switch, or Stay here. A failed save keeps the current Echo and its draft open; Escape dismisses only this warning. Discard also resets any unsaved shared-opacity change. Draft fields follow the selected owner and save session before the menu renders, so switching untouched Echoes does not briefly flash an unsaved warning or enable Save. Saving one field refreshes only that field, preserving other pending edits.

The manager uses the game's typography, paper-shadow buttons and day/night palette. New-game setup always uses a plain light background. The artwork gallery has a separate Echoes section.

The reader's aspect selectors show the highlighted aspect's ability name, short explanation, spirit cost and affected characters directly underneath. Girls do not use abilities: their setup selectors instead show the matching aspect (+25%), competing aspect (−25%) and neutral matchups, based on the reader's Echo and affecting new positive relationship progress. Previews update before saving; the reader's ability preview also appears during the one later change and through the gallery. Browsing does not save a choice or use that change.

## Artwork providers and transparency

Gemini or the configured image API is the default. Mods → Echo → Local Megaten artwork selects an optional Echo-only ComfyUI workflow. A LoRA cannot be attached to the Gemini API: it is used only by that local workflow. Other image features keep their own provider settings. Only the reader's missing artwork gets an automatic first-menu attempt; student generation is explicit. Upload accepts existing artwork and Download exports the finished PNG.

Desktop and browser API generation use local ISNet subject segmentation through IMG.LY background-removal 1.7.0 and ONNX Runtime Web 1.21.0. Gemini does not require ComfyUI or Python. First use downloads roughly 100 MB of model/runtime resources from the pinned resource host; later requests can reuse the cache. Images are not uploaded to that host. Initialization completes before a paid image request. If the model/runtime cannot load, the panel explains the first-use download, asks the player to check their connection and retry Generate artwork, and confirms that no paid request was made and existing artwork is unchanged. Generated originals are retained before segmentation so a failed cutout does not discard the paid source. White-edge refinement is restricted to suitable light backgrounds instead of deleting dark body pixels.

The desktop runs segmentation in a hidden sandboxed renderer without a preload/filesystem bridge. Cancellation closes its worker/window. Browser custom endpoints must permit CORS. Provider, network and cache availability still affect generation; transparency quality is not guaranteed for every image.

Generation reserves its cancellable job before reading settings, on desktop and browser. Stop/Close during that read or preparation prevents a provider request; a second job is refused until the first settles. Desktop cancellation also checks the requesting window's ownership. A request already sent to the provider may still be chargeable. The bundled software notices and model license open as read-only in-game dialogs, including offline, without permitting arbitrary file links.

Whole-game backups include all retained finished Echo artwork, including images used by historical saves. There is no separate 4,096-image manifest cutoff; combined collections can be exported and restored subject to the existing whole-archive import limits (16,384 entries, 8 GiB) and per-image validation. This change does not delete old images or recovery originals. Recovery originals remain local and outside backups.

The optional local workflow uses the ComfyUI server and checkpoint selected in Settings, plus Megaten_Style.safetensors on that server. It supports both game-managed ComfyUI and the player's external server in 0.5.0. Choose an SDXL checkpoint compatible with the LoRA; Nova Anime XL is the shipped default. The server and model choices are captured once for each job. External generation does not require a separate game-managed Python or checkpoint installation.

For game-managed ComfyUI, Set up local artwork → Install local art models explicitly downloads missing originals (Nova Anime XL, about 6.9 GB, and Megaten Style, 218 MB), checks pinned sizes and hashes, reuses matching files and refuses to overwrite a different version. Downloads can be cancelled; manual installation remains available. For an external server, install the LoRA in that server's models/loras directory yourself; the managed installer is hidden and its service rejects external-server requests. ComfyUI still validates the game's required nodes and model selections. LoRA strength is 0.7 with the workflow's SDXL encoder configuration. Weights are not bundled in Git. See the [separate asset notices](echo-asset-licenses.md).

## Staging and abilities

Each owner has X/Y, scale, optional visibility override, floating motion and speed controls. Save placement applies the preview; closing an unsaved draft leaves the scene unchanged. Visibility is opacity, not background removal: it fades the entire already-cut-out creature. Shared visibility defaults to 30%; per-owner values and Hide on stage take priority. Each girl also has a Show her Echo on stage switch: it hides only her staged Echo in ordinary scenes, the Unspoken Void and the question screen, while retaining artwork, identity and abilities. Old saves default to visible. Floating cycles range from 3–20 seconds, default to a gentle 14-second drift with half the former sway, and respect reduced motion. Saved cycle speeds are preserved.

During Breaking Through the Silence, the reader's Echo defaults to a large, faint left backdrop (X 25, Y 600, scale 2.39, 18% visibility). Saved overrides win. The girl's Echo appears opposite it, mirrored from the reader's placement. Her dungeon portrait controls do not move the question-screen portrait. The reader's Stage panel also exposes the saved glitch-effects option; it remains accessible through Mods when Echoes is disabled.

Every aspect has a one-exchange ability costing 25, 50 or 75 spirit. Activations use a fixed action with no free-text ability box. Normal Breakthrough retains its custom action and 100-spirit cost, and works with Echoes disabled. See the complete [ability catalog and pricing](echo-breakthrough.md). These effects guide the scene model; they do not guarantee success, force relationship points, or remove character boundaries.

## Screen hooks

Echo's rail and landing buttons register through `railButton` and `landingTool`.
`gameModals` opens the existing manager under `echo`; the host supplies its theme,
crossing state and close callback. The original manager still handles draft edits,
artwork cancellation and save/session guards. The buttons are absent in Scene Creator
and replays, and switching Echo off closes its open manager and releases game input.
The screen entry loads lazily, so gameplay registration does not initialize the manager.

The stage aura continues through `portraitOverlay`, independently of Photo Feature.
`photosPageSection` remains an optional gallery contribution. Enrollment, stage
placement, artwork, abilities and saved data retain their existing implementations.
`EchoIcon.tsx` owns the original SVG; `screenIcons.tsx` re-exports it for existing
consumers such as Campus Talents. GameView still calls `ensureEchoes` for enabled-save
initialization; that gameplay/state migration remains separate from these screen hooks.

## Saves, backups and source map

### Screen-hook integration

Echo registers `portraitOverlay` and `photosPageSection` from its renderer mod entry. The native portrait and Photos page render the generic `ModSlot` outlets; they no longer mount Echo directly at those two locations. The portrait contribution reuses `EchoAura`, including the saved placement, opacity, floating motion, owner visibility, and replay/created-scene gates. The optional Photos contribution reuses the existing gallery and manager with the page's theme. Neither hook requires Photo Feature, and switching Echo off removes both contributions without erasing its saved data.

`renderer/stores/echoAssignments.ts` holds the shared assignment helper used by the entry, manager and game view, avoiding a manager-to-entry import cycle. The manager now opens through the screen hooks above; new-game setup, Reckoning staging and the contact-specific gallery retain their existing paths. This is a partial migration, not a standalone downloadable Echo package. Gameplay/state, contact-gallery, kit, asset and main-process dependencies still need to be migrated before Echo can ship separately.

Echo identity, locks, staging and affinity markers are validated in the exEcho save extension. Native New Game+ carries them through modCarry; turning the mod off preserves the data. Whole-game desktop/browser backups include finished Echo artwork and reject conflicting immutable image IDs. Loose save JSON does not embed image bytes or recovery originals. This tree has no separate single-playthrough export.

Unheard Soul artwork is a separate character image, not an Echo replacement. Its desktop editor offers the configured image API or Local ComfyUI with her neutral portrait as a reference, independently of the Echo creature's Megaten artwork option. Its character export/import/duplicate and whole-game backup support are described in [Breaking Through the Silence](reckoning.md). The browser supports ordinary Echo artwork but currently uses the inverted normal portrait for Unheard Souls; their custom image editor and portable extension are desktop-only.

| Source | Responsibility |
| --- | --- |
| shared/echoAspects, echoReasons, echoNaming, echo, echoStage, echoSetup | Catalog, profile defaults, validation, naming, placement and enrollment rules |
| shared/continuedModSetup | Accepted newcomer choices applied to the native next-semester save |
| shared/modEntries/echo and renderer/modEntries/echo | Discovery, settings, lifecycle and semester carry |
| renderer/views/EchoPanel and NewGameView | Shared manager, gallery/stage and late enrollment step |
| main/services/echoService, echoCutout and renderer/art/echoCutout | Desktop generation, storage and isolated segmentation |
| web/echoArtwork | Browser artwork and provider adapter |
| shared/echoBreakthrough and renderer/prompts/echoBreakthroughPrompt | Exhaustive abilities and bounded one-turn instructions |

Current validation and remaining release checks are in [echo-validation.md](echo-validation.md). The internal IDs remain echo and reckoning for compatibility with existing saves and settings.


## Fifth-pass persistence and context checks

Closing the Echo manager before Save starts discards the draft. Once storage acknowledges a dispatched Save, the live Echo and next autosave retain that edit even if the manager has closed. A load/reset or different playthrough still blocks stale completion, and failed writes leave live state unchanged.
