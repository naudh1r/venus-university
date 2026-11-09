/**
 * Prompt Studio: the presets that arrange a scene's request, the fixed text of the game's
 * prompts, the save's preset variables and a preview of the next scene's request. Every change
 * is written as it is confirmed, so the panel holds nothing unsaved of its own.
 */
import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import {
  CheckField,
  ChevronIcon,
  ConfirmModal,
  defaultBlockText,
  gestures,
  isNewGameBlock,
  lift,
  panelUnderTab,
  PlusIcon,
  press,
  PROMPT_BLOCKS,
  quietLift,
  quietPress,
  rowPress,
  TextEditModal,
  TitleTab,
  toggleLift,
  useGameFacts,
  useLessNsfwText,
  useModalShell,
  useSafePoint,
  useScenePersona,
  veilIn,
  type PromptBlock,
  type ScreenTheme
} from '@vx/modkit/renderer'
import { atSectionEnd, BLOCK_SECTIONS, bySection, sectionOf, type BlockSection } from '../../shared/presets/gameParts'
import { presetMacros, type MacroUse } from '../../shared/presets/glossary'
import { hasDynamicMacros } from '../../shared/presets/macros'
import { planPresetRequest, presetRequestOf } from '../../shared/presets/request'
import { studioPromptsToKeep, withBlockText, type ClassCatalogEdits } from '../../shared/presets/studioPrompts'
import {
  PROTECTED_MARKERS,
  type GameMarker,
  type GlobalTextId,
  type Preset,
  type PresetBlock,
  type PresetSource,
  type PresetSummary,
  type SceneTextId
} from '../../shared/presets/types'
import { presetVars as presetVarsField } from '../stores/promptStudioVars'
import { usePromptStudioStore } from '../stores/promptStudioStore'
import { GripIcon } from './PromptStudioIcons'
import {
  CatalogSizesModal,
  PresetBlockModal,
  PresetImportModal,
  PresetNameModal,
  VariableModal,
  PartExampleModal,
  FindReplaceModal,
  StudioPill
} from './PromptStudioModals'
import { useStudioBackup } from './PromptStudioBackup'
import '../vu_styles/PromptStudio.css'

type TabId = 'presets' | 'blocks' | 'glossary' | 'scene' | 'other' | 'newgame' | 'variables' | 'preview'

/** Each tab's word, the one line over its page, and whether the page works on the active preset. */
const TABS: readonly { id: TabId; word: string; intro: string; preset?: true }[] = [
  {
    id: 'presets',
    word: 'Presets',
    intro:
      'A preset arranges what the writer is sent for a scene. Import one from SillyTavern or Marinara, or stay on the built-in Default. Only scenes use it: texting and everything else keep the game\'s own order.'
  },
  {
    id: 'blocks',
    word: 'Blocks',
    intro:
      "The order the writer reads a scene's request in. Game rows are the game's own sections: move them or turn them off, but they stay.",
    preset: true
  },
  {
    id: 'glossary',
    word: 'Glossary',
    intro:
      "Every {{…}} macro this preset writes, and what it becomes when a scene is sent. Only the preset's own blocks are filled in.",
    preset: true
  },
  {
    id: 'scene',
    word: 'Scene text',
    intro: "The writer's instructions for scenes. They belong to this preset, so another preset brings its own.",
    preset: true
  },
  {
    id: 'other',
    word: 'Other prompts',
    intro: "The writer's instructions for everything outside a scene. Every preset shares them."
  },
  {
    id: 'newgame',
    word: 'New Game',
    intro:
      "The instructions for building a new game's classes, student profiles, calendar events and secrets. A new semester uses them too. They can only be changed from the main menu."
  },
  {
    id: 'variables',
    word: 'Variables',
    intro:
      'What a preset remembers from turn to turn, kept with this game. The writer may update them with each reply.'
  },
  {
    id: 'preview',
    word: 'Preview',
    intro: 'The last scene request, as this preset would send it now. Rolls and random picks change on every call.',
    preset: true
  }
]

/** The New Game page's groups, in the order it lists them. */
const NEW_GAME_GROUPS: readonly { group: PromptBlock['group']; word: string }[] = [
  { group: 'newgame.classes', word: 'Classes' },
  { group: 'newgame.profiles', word: 'Profiles' },
  { group: 'newgame.occasions', word: 'Occasions' },
  { group: 'newgame.secrets', word: 'Secrets' }
]

/** What each source is called beside a preset's name. */
const SOURCE_WORDS: Record<PresetSource, string> = {
  sillytavern: 'SillyTavern',
  marinara: 'Marinara',
  native: 'Built in'
}

/** What each of the game's own sections is called on its row, and what it carries. */
const GAME_ROWS: Record<GameMarker, { word: string; hint: string }> = {
  persona: {
    word: 'Game: writer persona',
    hint: 'Who the writer is and how a scene should read. A solo scene sends the solo persona here instead.'
  },
  jsonRules: {
    word: 'Game: reply rules',
    hint: 'The shape every reply must take, and the backgrounds, outfits and CGs it may name. Always sent.'
  },
  setting: { word: 'Game: setting', hint: 'The world every scene is set in: Venus University and the city of Veridan.' },
  reader: { word: 'Game: the reader', hint: 'Who the reader is, and his timetable.' },
  cast: {
    word: 'Game: cast',
    hint: 'Each girl in the scene: who she is, how she feels about the reader, what she remembers and what she has told him.'
  },
  now: {
    word: 'Game: date and time',
    hint: 'The date, the hour and the weather, the background, and who is on screen in what.'
  },
  class: {
    word: 'Game: class',
    hint: 'The class the scene is sitting in and what this meeting covers. Sent only during a class.'
  },
  lorebook: {
    word: 'Game: lorebook',
    hint: 'Background the turn calls for: people named who are not in the scene, classes, earlier days mentioned and the slot\'s rumor.'
  },
  modLines: { word: 'Game: mod notes', hint: 'Lines other mods add to a scene. Sent only when a mod has something to add.' },
  storyRecall: {
    word: 'Game: story recall',
    hint: 'What the Story Memory mod recalls from earlier scenes. Sent only while that mod is on.'
  },
  storySoFar: {
    word: 'Game: story so far',
    hint: 'A running summary of this scene\'s earlier turns, once there is one.'
  },
  sceneSoFar: {
    word: 'Game: scene so far',
    hint: 'The latest stretch of this scene word for word: the reader\'s actions and the replies to them.'
  },
  yourTurn: {
    word: "Game: this turn's instructions",
    hint: 'What the writer is asked to do this turn, ending with what the reader does. Its fixed lines are under Scene text.'
  }
}

/** What each macro the game fills in becomes when a scene is sent. */
const MACRO_MEANINGS: Readonly<Record<string, string>> = {
  user: "The reader's first name.",
  char: 'The first girl in the scene. Only one name when several girls are there, and empty in a solo scene.',
  group: 'Every girl in the scene, joined with commas. Empty in a solo scene.',
  setvar: 'Sets a variable, and writes nothing in its place.',
  getvar: "Writes a variable's value, or the default given after its name.",
  addvar: 'Adds to a variable: a number to a number, otherwise text onto the end.',
  incvar: 'Raises a variable by one and writes the new value.',
  decvar: 'Lowers a variable by one and writes the new value.',
  roll: 'Rolls dice, such as 1d20, and writes the total. A new roll on every call.',
  random: 'Picks one of the options it lists. A new pick on every call.',
  trim: 'Removes itself and the line breaks around it.'
}

/** What a macro the game does not fill in becomes. */
const UNKNOWN_MACRO = "The game doesn't fill this one in, so it is sent as written."

/** Where a macro is written: the preset's blocks, and scene text, where nothing is filled in. */
function whereUsed(use: MacroUse): string {
  const blocks = use.blocks === 1 ? '1 block' : `${use.blocks} blocks`
  const texts = use.sceneTexts === 1 ? '1 scene text' : `${use.sceneTexts} scene texts`
  if (use.sceneTexts === 0) return `In ${blocks}.`
  if (use.blocks === 0) return `In ${texts}, where it is sent as written.`
  return `In ${blocks}, and in ${texts}, where it is sent as written.`
}

/** A fresh block, ready for its name and text. */
function newBlock(): PresetBlock {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: 'system',
    enabled: true,
    position: 'ordered',
    depth: 0,
    content: ''
  }
}

/** What heads each list on the Blocks page. */
const SECTION_WORDS: Record<BlockSection, string> = {
  system: 'System',
  user: 'User',
  depth: 'Near the end'
}

/** Where a preset block lands, for the rows whose list alone does not say. */
function whereSent(block: PresetBlock): string | undefined {
  const assistant = block.role === 'assistant'
  if (block.position !== 'depth') return assistant ? "Assistant: sent with the scene's request, marked [assistant]." : undefined
  if (block.role === 'system') return "System: at the end of the writer's instructions."
  const back = block.depth === 0 ? 'at the very end' : block.depth === 1 ? '1 section back' : `${block.depth} sections back`
  return assistant ? `Assistant: ${back}, marked [assistant].` : `User: ${back}.`
}

/** The blocks in the order `ids` names; any it does not name follow, in their own order. */
function inOrder(blocks: readonly PresetBlock[], ids: readonly string[]): PresetBlock[] {
  const at = new Map(ids.map((id, index) => [id, index]))
  return [...blocks].sort((a, b) => (at.get(a.id) ?? ids.length) - (at.get(b.id) ?? ids.length))
}

interface BlockItemProps {
  id: string
  className: string
  onDrop: () => void
  children: ReactNode
}

/**
 * A Blocks row dragged by its grip alone, so the rest of the row keeps its clicks. The grip is
 * the pointer's way to move a row; the steps beside it are the keyboard's.
 */
function BlockItem({ id, className, onDrop, children }: BlockItemProps): JSX.Element {
  const controls = useDragControls()
  return (
    <Reorder.Item
      as="li"
      value={id}
      className={className}
      layout="position"
      dragListener={false}
      dragControls={controls}
      transition={rowPress.transition}
      onDragEnd={onDrop}
    >
      <span className="vu-studio-grip" data-cursor="move" aria-hidden="true" onPointerDown={(event) => controls.start(event)}>
        <GripIcon />
      </span>
      {children}
    </Reorder.Item>
  )
}

/** The preset's main block, where it names one that is still there. */
function mainBlockOf(preset: Preset): PresetBlock | undefined {
  return preset.mainBlockId ? preset.blocks.find((block) => block.id === preset.mainBlockId) : undefined
}

/** A preset with one text block's edit set, or cleared where `value` is undefined; an empty map is dropped. */
function withSceneText(preset: Preset, id: SceneTextId, value: string | undefined): Preset {
  const { overrides, ...rest } = preset
  const next = { ...overrides }
  if (value === undefined) delete next[id]
  else next[id] = value
  return Object.keys(next).length > 0 ? { ...rest, overrides: next } : rest
}

export interface PromptStudioModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

export function PromptStudioModal({ theme, onClose }: PromptStudioModalProps): JSX.Element | null {
  const presets = usePromptStudioStore((s) => s.presets)
  const activeId = usePromptStudioStore((s) => s.activeId)
  const active = usePromptStudioStore((s) => s.active)
  const prompts = usePromptStudioStore((s) => s.prompts)
  const lastSceneRequest = usePromptStudioStore((s) => s.lastSceneRequest)
  const lessNsfwText = useLessNsfwText()
  const scenePersona = useScenePersona()
  const { playthroughId, readerName } = useGameFacts()
  const presetVars = presetVarsField.use()
  // A safe point: no call in flight and nothing waiting to be filed, so an edit is not overwritten by a reply.
  const atDecision = useSafePoint() === 'open'

  const [tab, setTab] = useState<TabId>('presets')
  const [textEdit, setTextEdit] = useState<PromptBlock | null>(null)
  const [blockEdit, setBlockEdit] = useState<{ block: PresetBlock; isNew: boolean } | null>(null)
  const [blockDelete, setBlockDelete] = useState<PresetBlock | null>(null)
  const [renaming, setRenaming] = useState<PresetSummary | null>(null)
  const [presetDelete, setPresetDelete] = useState<PresetSummary | null>(null)
  const [importing, setImporting] = useState<{ preset: Preset; warnings: string[] } | null>(null)
  const [varEdit, setVarEdit] = useState<string | null>(null)
  const [varsReset, setVarsReset] = useState(false)
  const [partShown, setPartShown] = useState<GameMarker | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  // What the find and replace panel opens on, while it is open.
  const [findReplace, setFindReplace] = useState<string | null>(null)
  // The Blocks page's order by id while a row is dragged, until the drop is written.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const dragged = useRef<string[] | null>(null)
  // Holds off a second write while the first is in flight, so each reads the preset the last left.
  const writing = useRef(false)
  const picking = useRef(false)

  useEffect(() => {
    void usePromptStudioStore.getState().load()
  }, [])

  const { host, overlayProps } = useModalShell(onClose)
  const presetsBackup = useStudioBackup(theme, 'presets')
  const promptsBackup = useStudioBackup(theme, 'prompts')

  const hasGame = playthroughId !== null
  const tabs = TABS.filter((entry) => (entry.id !== 'variables' || hasGame) && (entry.id !== 'newgame' || !hasGame))
  const shown = tabs.find((entry) => entry.id === tab) ?? tabs[0]

  /** Writes the active preset as `change` leaves it. */
  async function commit(change: (preset: Preset) => Preset): Promise<void> {
    const current = usePromptStudioStore.getState().active
    if (!current || writing.current) return
    writing.current = true
    try {
      await usePromptStudioStore.getState().save(change(current))
    } finally {
      writing.current = false
    }
  }

  /** Reads a file the player picks, then opens the import step on it. */
  async function importFile(): Promise<void> {
    if (picking.current) return
    picking.current = true
    try {
      const result = await usePromptStudioStore.getState().importFile()
      if (result) setImporting(result)
    } finally {
      picking.current = false
    }
  }

  /** Moves one row a step within its list; the first and last rows of a list have nowhere further to go. */
  function move(id: string, by: -1 | 1): void {
    void commit((preset) => {
      const blocks = bySection(preset.blocks)
      const index = blocks.findIndex((block) => block.id === id)
      const to = index + by
      if (index < 0 || to < 0 || to >= blocks.length || sectionOf(blocks[to]) !== sectionOf(blocks[index])) return preset
      ;[blocks[index], blocks[to]] = [blocks[to], blocks[index]]
      return { ...preset, blocks }
    })
  }

  /** Holds one list's dragged order, the other lists standing as they are. */
  function reorder(section: BlockSection, order: string[]): void {
    const current = usePromptStudioStore.getState().active
    if (!current) return
    const rows = bySection(dragOrder ? inOrder(current.blocks, dragOrder) : current.blocks)
    const full = BLOCK_SECTIONS.flatMap((s) => (s === section ? order : rows.filter((b) => sectionOf(b) === s).map((b) => b.id)))
    dragged.current = full
    setDragOrder(full)
  }

  /** Writes the order a drag left; the rows go back where they were if the write is refused. */
  function drop(): void {
    const order = dragged.current
    dragged.current = null
    const current = usePromptStudioStore.getState().active
    if (!order || !current || order.every((id, index) => current.blocks[index]?.id === id)) {
      setDragOrder(null)
      return
    }
    void commit((preset) => ({ ...preset, blocks: inOrder(preset.blocks, order) })).finally(() => setDragOrder(null))
  }

  /** Writes one text block's edit to where its owner keeps it. */
  async function saveText(block: PromptBlock, value: string | undefined): Promise<boolean> {
    if (block.owner === 'scene') {
      const current = usePromptStudioStore.getState().active
      if (!current) return false
      return usePromptStudioStore.getState().save(withSceneText(current, block.id as SceneTextId, value))
    }
    const store = usePromptStudioStore.getState()
    return store.savePrompts(withBlockText(store.prompts, block.id as GlobalTextId, value))
  }

  /** Writes the class call's pool sizes. */
  function saveCatalog(sizes: ClassCatalogEdits): Promise<boolean> {
    const store = usePromptStudioStore.getState()
    return store.savePrompts(studioPromptsToKeep({ ...store.prompts, classCatalog: sizes }))
  }

  /** The stored edit of a text block, where there is one. */
  function editOf(block: PromptBlock): string | undefined {
    return block.owner === 'scene'
      ? active?.overrides?.[block.id as SceneTextId]
      : prompts.blocks?.[block.id as GlobalTextId]
  }

  /** The two texts the next scene would send, or null where no scene has been asked for yet. */
  const preview = useMemo(() => {
    if (!lastSceneRequest) return null
    const tag = lastSceneRequest.sceneSpot
    if (!tag || !active) return { system: lastSceneRequest.system, user: lastSceneRequest.user }
    const { request } = planPresetRequest(
      lastSceneRequest,
      presetRequestOf(tag, playthroughId, presetVars, readerName),
      active,
      () => 0.5
    )
    return { system: request.system, user: request.user }
  }, [lastSceneRequest, active, playthroughId, presetVars, readerName])

  if (!host) return null

  /** One quiet pill at the end of a row. */
  function pill(id: string, word: string, onClick: () => void): JSX.Element {
    return <StudioPill id={id} word={word} onClick={onClick} />
  }

  /** A page's lead line, over whatever scrolls. */
  function page(children: ReactNode): JSX.Element {
    return (
      <div className="vu-studio-page" id={`studio-page-${shown.id}`} role="tabpanel">
        {/* A page that changes the active preset names it first, so an edit never lands on the wrong one. */}
        {shown.preset && active && (
          <p className="vu-studio-current">
            <span className="vu-settings-heading">Editing</span>
            <span className="vu-studio-current-name">{active.name}</span>
          </p>
        )}
        <p className="vu-studio-intro">{shown.intro}</p>
        <div className="vu-scroll-box">
          {/* Measured with its scroll, so a dragged row lands true in a scrolled page. */}
          <motion.div className="vu-studio-scroll" layoutScroll>
            {children}
          </motion.div>
          <div className="vu-scroll-fade" />
        </div>
      </div>
    )
  }

  /** The Presets page. */
  function presetsPage(): JSX.Element {
    return page(
      <>
        <div className="vu-studio-actions">
          <motion.button
            id="studio-import"
            className="vu-pill"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => void importFile()}
          >
            <PlusIcon size={16} />
            Import preset
          </motion.button>
          {presetsBackup.actions}
        </div>
        {presets.length === 0 ? (
          <p className="vu-empty vu-empty--flush">Loading presets.</p>
        ) : (
          <ul className="vu-rows">
            {presets.map((entry) => {
              const on = entry.id === activeId
              return (
                <li key={entry.id} className="vu-row vu-studio-row">
                  <span className="vu-studio-body">
                    <span className="vu-studio-name">{entry.name}</span>
                    <span className="vu-studio-meta">{SOURCE_WORDS[entry.source]}</span>
                  </span>
                  {on && <span className="vu-studio-tag">Active</span>}
                  <span className="vu-studio-tools">
                    {!on &&
                      pill(`studio-activate-${entry.id}`, 'Make active', () =>
                        void usePromptStudioStore.getState().setActive(entry.id)
                      )}
                    {pill(`studio-rename-${entry.id}`, 'Rename', () => setRenaming(entry))}
                    {pill(`studio-duplicate-${entry.id}`, 'Duplicate', () =>
                      void usePromptStudioStore.getState().duplicate(entry.id)
                    )}
                    {pill(`studio-export-preset-${entry.id}`, 'Export', () => presetsBackup.exportPreset(entry.id))}
                    {presets.length > 1 &&
                      pill(`studio-delete-${entry.id}`, 'Delete', () => setPresetDelete(entry))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }

  /** One row of the Blocks page; `first` and `last` are its place in its own list. */
  function blockRow(preset: Preset, block: PresetBlock, first: boolean, last: boolean): JSX.Element {
    const marker = block.marker
    const replaced = marker === 'persona' && preset.mainReplacesPersona === true && mainBlockOf(preset) !== undefined
    const fixed = marker !== undefined && PROTECTED_MARKERS.includes(marker)
    const label = marker ? GAME_ROWS[marker].word : block.name
    const hint = marker ? GAME_ROWS[marker].hint : whereSent(block)
    // What the last scene sent under this row, where it sent anything.
    const example = marker ? lastSceneRequest?.parts?.find((part) => part.id === marker) : undefined
    const uncached = !marker && block.role === 'system' && block.enabled && hasDynamicMacros(block.content)

    return (
      <BlockItem
        key={block.id}
        id={block.id}
        className={`vu-row vu-studio-row vu-studio-row--block${replaced ? ' vu-studio-row--replaced' : ''}`}
        onDrop={drop}
      >
        <span className="vu-studio-moves">
          {!first ? (
            <motion.button
              className="vu-square vu-square--step vu-studio-up"
              type="button"
              aria-label={`Move ${label} up`}
              {...gestures(false, quietLift, quietPress)}
              onClick={() => move(block.id, -1)}
            >
              <ChevronIcon down />
            </motion.button>
          ) : (
            <span className="vu-studio-gap" />
          )}
          {!last && (
            <motion.button
              className="vu-square vu-square--step"
              type="button"
              aria-label={`Move ${label} down`}
              {...gestures(false, quietLift, quietPress)}
              onClick={() => move(block.id, 1)}
            >
              <ChevronIcon down />
            </motion.button>
          )}
        </span>
        <span className="vu-studio-body">
          {fixed ? (
            <>
              <span className="vu-studio-name">{label}</span>
              {hint && <span className="vu-studio-note">{hint}</span>}
            </>
          ) : (
            <CheckField
              id={`studio-block-${block.id}`}
              label={label}
              note={hint}
              checked={block.enabled}
              onChange={(enabled) =>
                void commit((current) => ({
                  ...current,
                  blocks: current.blocks.map((b) => (b.id === block.id ? { ...b, enabled } : b))
                }))
              }
            />
          )}
          {replaced && <span className="vu-studio-note">The main block is sent in its place.</span>}
          {block.conflict && (
            <span className="vu-studio-note">
              <span className="vu-studio-tag vu-studio-tag--warn">Conflict</span> {block.conflict}
            </span>
          )}
          {uncached && (
            <span className="vu-studio-note">
              <span className="vu-studio-tag vu-studio-tag--warn">Not cached</span> This text changes on every call,
              so the system prompt can't be cached. Moving it to the user role avoids that.
            </span>
          )}
        </span>
        {replaced && <span className="vu-studio-tag">Replaced</span>}
        <span className="vu-studio-tools">
          {marker && example && pill(`studio-example-${marker}`, 'Example', () => setPartShown(marker))}
          {(marker === 'persona' || marker === 'yourTurn') &&
            pill(`studio-text-${marker}`, 'Scene text', () => setTab('scene'))}
          {!marker && pill(`studio-edit-${block.id}`, 'Edit', () => setBlockEdit({ block, isNew: false }))}
          {!marker && pill(`studio-remove-${block.id}`, 'Delete', () => setBlockDelete(block))}
        </span>
      </BlockItem>
    )
  }

  /** The Blocks page. */
  function blocksPage(): JSX.Element {
    if (!active) return page(<p className="vu-empty vu-empty--flush">Loading presets.</p>)
    const main = mainBlockOf(active)
    const rows = bySection(dragOrder ? inOrder(active.blocks, dragOrder) : active.blocks)
    return page(
      <>
        <div className="vu-studio-actions">
          <motion.button
            id="studio-add-block"
            className="vu-pill"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => setBlockEdit({ block: newBlock(), isNew: true })}
          >
            <PlusIcon size={16} />
            Add block
          </motion.button>
          {pill('studio-find-replace', 'Find and replace', () => setFindReplace(''))}
        </div>
        {main && (
          <CheckField
            id="studio-main-replaces"
            label="Main block replaces the game persona"
            note={`Sends "${main.name}" in place of the game's own writer persona. Off sends both.`}
            checked={active.mainReplacesPersona === true}
            onChange={(on) => void commit((current) => ({ ...current, mainReplacesPersona: on }))}
          />
        )}
        {BLOCK_SECTIONS.map((section) => {
          const listed = rows.filter((block) => sectionOf(block) === section)
          return (
            <section key={section} className="vu-studio-group">
              <span className="vu-settings-heading">{SECTION_WORDS[section]}</span>
              {listed.length === 0 ? (
                <p className="vu-empty vu-empty--flush">No blocks sit near the end.</p>
              ) : (
                <Reorder.Group
                  as="ul"
                  axis="y"
                  className="vu-rows"
                  values={listed.map((block) => block.id)}
                  onReorder={(order: string[]) => reorder(section, order)}
                >
                  {listed.map((block, index) => blockRow(active, block, index === 0, index === listed.length - 1))}
                </Reorder.Group>
              )}
            </section>
          )
        })}
      </>
    )
  }

  /** The Glossary page: each macro the active preset writes, what it becomes, and where. */
  function glossaryPage(): JSX.Element {
    if (!active) return page(<p className="vu-empty vu-empty--flush">Loading presets.</p>)
    const uses = presetMacros(active)
    if (uses.length === 0) return page(<p className="vu-empty vu-empty--flush">This preset writes no macros.</p>)
    return page(
      <ul className="vu-rows">
        {uses.map((use) => (
          <li key={use.name} className="vu-row vu-studio-row">
            <span className="vu-studio-body">
              <span className="vu-studio-name vu-studio-macro">{`{{${use.name}}}`}</span>
              <span className="vu-studio-note">{MACRO_MEANINGS[use.name] ?? UNKNOWN_MACRO}</span>
              <span className="vu-studio-meta">{whereUsed(use)}</span>
              {use.vars.length > 0 && (
                <span className="vu-studio-meta">Variables: {use.vars.join(', ')}</span>
              )}
            </span>
            {use.bare && use.name !== 'trim' && (
              <span className="vu-studio-tools">
                {pill(`studio-glossary-replace-${use.name}`, 'Replace', () => setFindReplace(use.bare ?? ''))}
              </span>
            )}
          </li>
        ))}
      </ul>
    )
  }

  /** One row of a page of text blocks. */
  function textRow(block: PromptBlock): JSX.Element {
    return (
      <li key={block.id} className="vu-row vu-studio-row">
        <span className="vu-studio-body">
          <span className="vu-studio-name">{block.label}</span>
          <span className="vu-studio-meta">{block.hint}</span>
        </span>
        {editOf(block) !== undefined && <span className="vu-studio-tag">Edited</span>}
        <span className="vu-studio-tools">
          {pill(`studio-edit-text-${block.id}`, 'Edit', () => setTextEdit(block))}
        </span>
      </li>
    )
  }

  /** The Scene text and Other prompts pages: one row per editable block. */
  function textPage(owner: PromptBlock['owner']): JSX.Element {
    return page(
      <>
        {owner === 'global' && <div className="vu-studio-actions">{promptsBackup.actions}</div>}
        <ul className="vu-rows">
          {PROMPT_BLOCKS.filter((block) => block.owner === owner && !isNewGameBlock(block)).map(textRow)}
        </ul>
      </>
    )
  }

  /** The New Game page: each call's blocks under its own heading, and the class pool sizes. */
  function newGamePage(): JSX.Element {
    const sized = Object.keys(prompts.classCatalog ?? {}).length > 0
    return page(
      <>
        {NEW_GAME_GROUPS.map(({ group, word }) => (
          <section key={group} className="vu-studio-group">
            <span className="vu-settings-heading">{word}</span>
            <ul className="vu-rows">
              {PROMPT_BLOCKS.filter((block) => block.group === group).map(textRow)}
              {group === 'newgame.classes' && (
                <li className="vu-row vu-studio-row">
                  <span className="vu-studio-body">
                    <span className="vu-studio-name">Classes: catalog sizes</span>
                    <span className="vu-studio-meta">How many classes are asked for in each pool.</span>
                  </span>
                  {sized && <span className="vu-studio-tag">Edited</span>}
                  <span className="vu-studio-tools">
                    {pill('studio-edit-catalog', 'Edit', () => setCatalogOpen(true))}
                  </span>
                </li>
              )}
            </ul>
          </section>
        ))}
      </>
    )
  }

  /** The Variables page. */
  function variablesPage(): JSX.Element {
    const names = Object.keys(presetVars)
    return page(
      <>
        {atDecision && names.length > 0 && (
          <div className="vu-studio-actions">
            {pill('studio-vars-reset', 'Reset all', () => setVarsReset(true))}
          </div>
        )}
        {names.length === 0 ? (
          <p className="vu-empty vu-empty--flush">Nothing here yet. Variables show up once a preset sets them.</p>
        ) : (
          <ul className="vu-rows">
            {names.map((name) => (
              <li key={name} className="vu-row vu-studio-row">
                <span className="vu-studio-body">
                  <span className="vu-studio-name vu-studio-name--mono">{name}</span>
                  <span className="vu-studio-value">{presetVars[name]}</span>
                </span>
                {atDecision && (
                  <span className="vu-studio-tools">
                    {pill(`studio-var-edit-${name}`, 'Edit', () => setVarEdit(name))}
                    {pill(`studio-var-delete-${name}`, 'Delete', () => {
                      const { [name]: _gone, ...rest } = presetVarsField.read()
                      presetVarsField.set(rest)
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  /** The Preview page. */
  function previewPage(): JSX.Element {
    return page(
      preview ? (
        <>
          <label className="vu-field">
            <span className="vu-field-label">System</span>
            <textarea className="vu-input vu-input--multiline vu-studio-preview" readOnly value={preview.system} />
          </label>
          <label className="vu-field">
            <span className="vu-field-label">User</span>
            <textarea className="vu-input vu-input--multiline vu-studio-preview" readOnly value={preview.user} />
          </label>
        </>
      ) : (
        <p className="vu-empty vu-empty--flush">No scene yet. Play one and its request shows up here.</p>
      )
    )
  }

  const textDefault = textEdit ? defaultBlockText(textEdit.id, { lessNsfwText, scenePersona }) : ''
  const varName = varEdit !== null && varEdit in presetVars ? varEdit : null
  const partText = partShown ? lastSceneRequest?.parts?.find((part) => part.id === partShown)?.text : undefined

  return createPortal(
    <>
      <motion.div
        className="vu-veil"
        data-theme={theme}
        variants={veilIn}
        initial="hidden"
        animate="shown"
        exit="gone"
        {...overlayProps}
      >
        <motion.div
          id="prompt-studio-modal"
          className="vu-settings vu-settings--split vu-studio vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Prompt Studio"
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation()
          }}
        >
          <TitleTab>Prompt Studio</TitleTab>

          {/* The tabs stand in the panel's round end, as Settings' do. */}
          <div className="vu-palette vu-palette--column vu-settings-tabs vu-studio-tabs" role="tablist" aria-label="Prompt Studio">
            {tabs.map((entry) => {
              const on = shown.id === entry.id
              return (
                <motion.button
                  key={entry.id}
                  id={`studio-tab-${entry.id}`}
                  className={`vu-palette-btn${on ? ' vu-palette-btn--on' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`studio-page-${entry.id}`}
                  {...gestures(false, toggleLift, quietPress)}
                  onClick={() => setTab(entry.id)}
                >
                  {entry.word}
                </motion.button>
              )
            })}
          </div>

          <div className="vu-settings-pages">
            {shown.id === 'presets' && presetsPage()}
            {shown.id === 'blocks' && blocksPage()}
            {shown.id === 'glossary' && glossaryPage()}
            {shown.id === 'scene' && textPage('scene')}
            {shown.id === 'other' && textPage('global')}
            {shown.id === 'newgame' && newGamePage()}
            {shown.id === 'variables' && variablesPage()}
            {shown.id === 'preview' && previewPage()}
          </div>

          <div className="vu-foot">
            <motion.button
              id="studio-done"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              type="button"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Done
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Siblings of the veil and of each other, never its children: each leaves when this panel does. */}
      {presetsBackup.panel}
      {promptsBackup.panel}
      <AnimatePresence propagate>
        {textEdit && (
          <TextEditModal
            key="studio-text"
            theme={theme}
            id="studio-text-modal"
            idPrefix="studio-text"
            title={textEdit.label}
            label={textEdit.label}
            discardMessage="This text has not been saved."
            stored={editOf(textEdit) ?? textDefault}
            shipped={textDefault}
            allowEmpty={textDefault === ''}
            // Cleared back to the shipped text where the two now agree.
            save={(value) => saveText(textEdit, value === textDefault ? undefined : value)}
            onClose={() => setTextEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {catalogOpen && (
          <CatalogSizesModal
            key="studio-catalog"
            theme={theme}
            sizes={prompts.classCatalog ?? {}}
            onSave={saveCatalog}
            onClose={() => setCatalogOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {blockEdit && (
          <PresetBlockModal
            key="studio-block"
            theme={theme}
            block={blockEdit.block}
            isNew={blockEdit.isNew}
            onSave={(saved) =>
              void commit((current) => {
                const was = current.blocks.find((b) => b.id === saved.id)
                if (was && sectionOf(was) === sectionOf(saved)) {
                  return { ...current, blocks: bySection(current.blocks.map((b) => (b.id === saved.id ? saved : b))) }
                }
                // A new user block stands ahead of the game's own instructions; any other block goes last in its list.
                if (!was && sectionOf(saved) === 'user') {
                  const blocks = bySection(current.blocks)
                  const at = blocks.findIndex((b) => b.marker === 'yourTurn')
                  blocks.splice(at < 0 ? blocks.length : at, 0, saved)
                  return { ...current, blocks: bySection(blocks) }
                }
                return { ...current, blocks: atSectionEnd(current.blocks, saved) }
              })
            }
            onClose={() => setBlockEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {blockDelete && (
          <ConfirmModal
            key="studio-block-delete"
            id="studio-block-delete"
            theme={theme}
            title="Delete block?"
            message={`"${blockDelete.name}" and its text are removed from this preset.`}
            confirmText="Delete block"
            cancelText="Keep it"
            onConfirm={() => {
              const gone = blockDelete.id
              setBlockDelete(null)
              void commit((current) => ({
                ...current,
                blocks: current.blocks.filter((b) => b.id !== gone),
                ...(current.mainBlockId === gone
                  ? { mainBlockId: undefined, mainReplacesPersona: undefined }
                  : {})
              }))
            }}
            onCancel={() => setBlockDelete(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {renaming && (
          <PresetNameModal
            key="studio-rename"
            theme={theme}
            name={renaming.name}
            onSave={(name) => void usePromptStudioStore.getState().rename(renaming.id, name)}
            onClose={() => setRenaming(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {presetDelete && (
          <ConfirmModal
            key="studio-preset-delete"
            id="studio-preset-delete"
            theme={theme}
            title="Delete preset?"
            message={`"${presetDelete.name}" is removed. Your saves are not touched.`}
            confirmText="Delete preset"
            cancelText="Keep it"
            onConfirm={() => {
              const gone = presetDelete.id
              setPresetDelete(null)
              void usePromptStudioStore.getState().remove(gone)
            }}
            onCancel={() => setPresetDelete(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {importing && (
          <PresetImportModal
            key="studio-import"
            theme={theme}
            preset={importing.preset}
            warnings={importing.warnings}
            onSave={(preset) => usePromptStudioStore.getState().save(preset)}
            onClose={() => setImporting(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {varName !== null && (
          <VariableModal
            key="studio-variable"
            theme={theme}
            name={varName}
            value={presetVars[varName] ?? ''}
            onSave={(value) => presetVarsField.set({ ...presetVarsField.read(), [varName]: value })}
            onClose={() => setVarEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {partShown && partText !== undefined && (
          <PartExampleModal
            key="studio-part-example"
            theme={theme}
            title={GAME_ROWS[partShown].word}
            hint={GAME_ROWS[partShown].hint}
            text={partText}
            onClose={() => setPartShown(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {findReplace !== null && active && (
          <FindReplaceModal
            key="studio-find-replace"
            theme={theme}
            preset={active}
            find={findReplace}
            onSave={(preset) => usePromptStudioStore.getState().save(preset)}
            onClose={() => setFindReplace(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {varsReset && (
          <ConfirmModal
            key="studio-vars-reset"
            id="studio-vars-reset"
            theme={theme}
            title="Reset variables?"
            message="Every variable is cleared, and the preset's own defaults take over. The change is kept with the next save."
            confirmText="Reset variables"
            cancelText="Keep them"
            onConfirm={() => {
              setVarsReset(false)
              presetVarsField.set({})
            }}
            onCancel={() => setVarsReset(false)}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
