/**
 * The scene prompt's lines under `strictSchema` that are said in words rather than in the
 * schema. Kept out of `scenePrompt` so the build's own prompt carries a spread at each place one
 * goes, and nothing else.
 */

/**
 * Where the background goes. Some endpoints answer with `bg` beside `lines` rather than on the
 * first line; the sanitizer reads that as the opening background, and this asks for the shape it
 * would rather not have to repair.
 */
export const STRICT_BG_PLACEMENT = 'Never put "bg" beside "lines".'

/**
 * The consequence of not hiding, said outright. "Use hide: on the line a character stops being in
 * the scene" is the duty; this is what happens when it is skipped — a scene that ends on an empty
 * room with somebody still drawn in it.
 */
export const STRICT_STAYS_SHOWN =
  'Whoever is not hidden is still standing there for the rest of the scene, in every line, wherever it has moved to. A character nobody hid does not leave on her own.'

/**
 * When to change a sprite. "Whenever it makes sense" is permission, and a cheap model takes it as
 * permission to leave the first sprite on for the whole scene.
 */
export const STRICT_SPRITE_CHANGE =
  'Every "show:" must be paired with a "sprite:" in the same actions array. Afterwards, change a character\'s sprite whenever what she is feeling changes — a face that never moves is a face nobody is reading.'

/**
 * The continuation's ending instruction. "Send end_scene" reads as a token to emit rather than a
 * flag to raise, and one model wrote it as a line of narration on the reply where the last girl
 * walked out — leaving the reader alone on the stage and asked what he would like to do next.
 */
export const STRICT_END_SCENE_LINES = [
  'However, if the scene feels like it\'s drawing to a close, invent an excuse for the characters to need/want to part ways, and set the "end_scene" field to true.',
  'Never write end_scene as the text of a line. It is a field beside "lines", not something a line says.',
  'If the last character present leaves, the scene is over: set "end_scene" to true on that same reply, or the reader is left alone with nobody to talk to.'
]
