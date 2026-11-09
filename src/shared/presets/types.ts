import {
  GLOBAL_TEXT_IDS,
  SCENE_TEXT_IDS,
  type PromptPart,
  type PromptPartId,
  type SceneSpot,
  type SceneTextId,
  type TextEdits
} from '@vx/modkit/shared'

/**
 * Prompt Studio presets: the shapes of an imported or native preset and the game's own coarse
 * prompt parts it arranges. The ids of the text blocks and the scene spots are the game's own.
 */

export { GLOBAL_TEXT_IDS, SCENE_TEXT_IDS }
export type { GlobalTextId, SceneSpot, SceneSpotTag, SceneTextId, TextBlockId, TextEdits } from '@vx/modkit/shared'

/** The Prompt Studio mod's id. */
export const PROMPT_STUDIO_MOD = 'prompt-studio'

/** The parts a preset may reorder or disable, in the order a scene call builds them: the game's own, and the story recall main adds. */
export const GAME_MARKERS = [
  'persona',
  'jsonRules',
  'setting',
  'reader',
  'cast',
  'now',
  'class',
  'lorebook',
  'modLines',
  'storyRecall',
  'storySoFar',
  'sceneSoFar',
  'yourTurn'
] as const satisfies readonly (PromptPartId | 'storyRecall')[]
export type GameMarker = (typeof GAME_MARKERS)[number]

/** Parts a preset can neither disable nor move out of `system`: the reply contract. */
export const PROTECTED_MARKERS: readonly GameMarker[] = ['jsonRules']

/** The parts the builders put in `system`; every other part goes in `user`. */
export const SYSTEM_MARKERS: readonly GameMarker[] = ['persona', 'jsonRules', 'setting']

/** One game part as a scene builder emits it, its text already carrying any edits. */
export interface GamePart extends PromptPart {
  id: GameMarker
}

export type PresetSource = 'sillytavern' | 'marinara' | 'native'

/** One row of a preset: either a game part (`marker` set, `content` unused) or text of the preset's own. */
export interface PresetBlock {
  id: string
  name: string
  role: 'system' | 'user' | 'assistant'
  enabled: boolean
  /** `ordered` sits where the row stands; `depth` sits that many parts back from the end of `user`. */
  position: 'ordered' | 'depth'
  depth: number
  /** Wraps the content in `<tag>…</tag>` when set. */
  wrapXml?: string
  marker?: GameMarker
  content: string
  /** Why the importer turned this block off, shown beside it. */
  conflict?: string
}

/** A SillyTavern regex script, kept for reference and never run while disabled. */
export interface RegexScript {
  name: string
  find: string
  replace: string
  enabled: boolean
}

/** The samplers a preset may set for scene calls on a custom endpoint. */
export interface PresetSampling {
  temperature?: number
  topP?: number
  topK?: number
  repetitionPenalty?: number
}

export interface Preset {
  id: string
  name: string
  source: PresetSource
  blocks: PresetBlock[]
  overrides?: TextEdits<SceneTextId>
  /** Drops the game's `persona` part in favour of the block named by `mainBlockId`. */
  mainReplacesPersona?: boolean
  mainBlockId?: string
  sampling?: PresetSampling
  regex?: RegexScript[]
  notes?: string
}

/** The names a preset's `{{user}}`, `{{char}}` and `{{group}}` macros fill in. */
export interface PresetNames {
  user: string
  /** The first cast girl's given name, or empty with nobody cast. */
  char: string
  /** Every cast girl's given name, joined with ", ". */
  group: string
}

/** What the window tags a scene call with, for main to apply the active preset by. */
export interface PresetRequest {
  spot: SceneSpot
  playthroughId: string
  /** The save's variables as they stood before this call. */
  vars: Record<string, string>
  names: PresetNames
}

/** One preset as the list shows it. */
export interface PresetSummary {
  id: string
  name: string
  source: PresetSource
}

/** Every stored preset's summary, and which one is in force. */
export interface PresetListing {
  active: string
  presets: PresetSummary[]
}

/** A preset read from a file, not yet kept, and what the import left behind. */
export interface PresetImport {
  preset: Preset
  warnings: string[]
}

/** One variable change the model asks for in a scene reply's `vars`. */
export interface VarOp {
  name: string
  op: 'set' | 'add' | 'append'
  value: string
}
