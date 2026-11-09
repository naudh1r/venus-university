/**
 * The small panels Prompt Studio opens over itself: a preset's name, one block's settings and
 * text, the step a file import goes through before it is kept, one variable's value, a find and
 * replace across the preset, and a game section's example. Each holds its own draft and answers
 * with Cancel or its primary; none writes until the primary.
 */
import { useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { countMatches, presetWithReplacement } from '../../shared/presets/glossary'
import {
  CLASS_CATALOG_RANGES,
  DEFAULT_CLASS_CATALOG,
  studioPromptsToKeep,
  type ClassCatalogEdits,
  type ClassCatalogKey
} from '../../shared/presets/studioPrompts'
import type { Preset, PresetBlock } from '../../shared/presets/types'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  SelectField,
  TextField,
  TitleTab,
  useModalShell,
  veilIn,
  type ScreenTheme
} from '@vx/modkit/renderer'
import '../vu_styles/PromptStudio.css'

/** The deepest a depth block may stand, and the longest XML tag one may wear. */
const DEPTH_MAX = 99
const TAG_MAX = 40

interface FormFrameProps {
  id: string
  theme: ScreenTheme
  title: string
  /** The primary's words. */
  confirm: string
  onConfirm: () => void
  onClose: () => void
  /** The panel's size: a line of fields, or a block's own text. */
  wide?: boolean
  /** False for a panel that only shows something, whose primary is the one way out. */
  cancel?: boolean
  children: ReactNode
}

/** One quiet pill, at the end of a row or in an action bar. */
export function StudioPill({
  id,
  word,
  onClick
}: {
  id: string
  word: string
  onClick: () => void
}): JSX.Element {
  return (
    <motion.button id={id} className="vu-pill" type="button" {...gestures(false, quietLift, quietPress)} onClick={onClick}>
      {word}
    </motion.button>
  )
}

/** The frame the small panels share: veil, panel under its tab, body and the Cancel and primary foot. */
export function FormFrame({
  id,
  theme,
  title,
  confirm,
  onConfirm,
  onClose,
  wide = false,
  cancel = true,
  children
}: FormFrameProps): JSX.Element | null {
  // Dismissing is Cancel: nothing is written until the primary.
  const { host, overlayProps, primaryProps } = useModalShell(onClose, 'panel', onConfirm)
  if (!host) return null

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.form
        id={id}
        className={`vu-studio-form vu-paper${wide ? ' vu-studio-form--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        variants={panelUnderTab}
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
        // Enter in a field is the answer the foot gives, and nothing behind the panel hears it.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation()
        }}
        {...primaryProps}
      >
        <TitleTab>{title}</TitleTab>
        <div className="vu-studio-form-body">{children}</div>
        <div className="vu-foot">
          {cancel && (
            <motion.button
              id={`${id}-cancel`}
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={onClose}
            >
              Cancel
            </motion.button>
          )}
          <motion.button
            id={`${id}-confirm`}
            className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
            type="submit"
            {...gestures(false, lift, press)}
          >
            {confirm}
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    host
  )
}

export interface PresetNameModalProps {
  theme: ScreenTheme
  name: string
  /** Keeps the name; the panel closes whatever the write answers. */
  onSave: (name: string) => void
  onClose: () => void
}

/** A preset's name, asked for over the preset list. */
export function PresetNameModal({ theme, name, onSave, onClose }: PresetNameModalProps): JSX.Element | null {
  const [text, setText] = useState(name)

  return (
    <FormFrame
      id="preset-name"
      theme={theme}
      title="Rename preset"
      confirm="Rename"
      onClose={onClose}
      onConfirm={() => {
        onSave(text.trim() || name)
        onClose()
      }}
    >
      <TextField id="preset-name-text" label="Name" value={text} onChange={setText} placeholder={name} maxLength={80} autoFocus />
    </FormFrame>
  )
}

/** The three roles a block may speak in. */
const ROLE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'user', label: 'User' },
  { value: 'assistant', label: 'Assistant' }
]

/** Where a block stands. */
const POSITION_OPTIONS = [
  { value: 'ordered', label: 'In order' },
  { value: 'depth', label: 'Near the end' }
]

export interface PresetBlockModalProps {
  theme: ScreenTheme
  block: PresetBlock
  /** True for a block that is not yet in the preset. */
  isNew: boolean
  onSave: (block: PresetBlock) => void
  onClose: () => void
}

/** One preset block's name, role, place, tag and text. */
export function PresetBlockModal({ theme, block, isNew, onSave, onClose }: PresetBlockModalProps): JSX.Element | null {
  const [name, setName] = useState(block.name)
  const [role, setRole] = useState<string>(block.role)
  const [position, setPosition] = useState<string>(block.position)
  const [depthText, setDepthText] = useState(String(block.depth))
  const [tag, setTag] = useState(block.wrapXml ?? '')
  const [content, setContent] = useState(block.content)

  /** Builds the block from the fields, each one brought to a value the engine can use. */
  function submit(): void {
    const depth = Math.min(DEPTH_MAX, Math.max(0, Math.trunc(Number(depthText)) || 0))
    const wrapXml = tag.replace(/[^A-Za-z0-9_.-]/g, '')
    const { wrapXml: _wrapXml, ...rest } = block
    onSave({
      ...rest,
      name: name.trim() || 'Untitled block',
      role: role as PresetBlock['role'],
      position: position as PresetBlock['position'],
      depth,
      content,
      ...(wrapXml ? { wrapXml } : {})
    })
    onClose()
  }

  return (
    <FormFrame
      id="preset-block"
      theme={theme}
      title={isNew ? 'Add block' : 'Edit block'}
      confirm={isNew ? 'Add' : 'Save'}
      wide
      onClose={onClose}
      onConfirm={submit}
    >
      <TextField id="preset-block-name" label="Name" value={name} onChange={setName} placeholder="Untitled block" maxLength={80} autoFocus={isNew} />
      <div className="vu-studio-pair">
        <SelectField
          id="preset-block-role"
          label="Role"
          hint="System is part of the writer's own instructions. User is sent with the scene's request."
          value={role}
          options={ROLE_OPTIONS}
          onChange={setRole}
        />
        <SelectField
          id="preset-block-position"
          label="Position"
          hint="In order sits where its row stands. Near the end sits that many sections back from the end of the request."
          value={position}
          options={POSITION_OPTIONS}
          onChange={setPosition}
        />
      </div>
      <div className="vu-studio-pair">
        {position === 'depth' && (
          <TextField
            id="preset-block-depth"
            label="Sections back"
            hint="0 is the very end."
            value={depthText}
            onChange={setDepthText}
            placeholder="0"
            maxLength={2}
          />
        )}
        <TextField
          id="preset-block-tag"
          label="XML tag"
          hint="Wraps the text in a tag of this name. Leave it empty for none."
          value={tag}
          onChange={setTag}
          placeholder="none"
          maxLength={TAG_MAX}
        />
      </div>
      <TextField id="preset-block-content" label="Text" value={content} onChange={setContent} multiline autoGrow />
    </FormFrame>
  )
}

export interface PresetImportModalProps {
  theme: ScreenTheme
  preset: Preset
  warnings: string[]
  /** Keeps the preset. False when the write failed, which leaves the panel open. */
  onSave: (preset: Preset) => Promise<boolean>
  onClose: () => void
}

/** What an import found, and the one chance to rename or swap a word through it before it is kept. */
export function PresetImportModal({ theme, preset, warnings, onSave, onClose }: PresetImportModalProps): JSX.Element | null {
  const [name, setName] = useState(preset.name)
  const [find, setFind] = useState('')
  const [replacement, setReplacement] = useState('')
  const [busy, setBusy] = useState(false)

  const own = preset.blocks.filter((block) => !block.marker)

  /** Keeps the preset with the swap applied. */
  async function submit(): Promise<void> {
    if (busy) return
    setBusy(true)
    const swapped = presetWithReplacement(preset, find, replacement)
    const ok = await onSave({ ...swapped, name: name.trim() || preset.name })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <FormFrame
      id="preset-import"
      theme={theme}
      title="Import preset"
      confirm="Keep preset"
      wide
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <p className="vu-studio-note">
        {own.length === 1 ? '1 block' : `${own.length} blocks`} came in. You can change any of them afterward.
      </p>
      {warnings.length > 0 && (
        <ul className="vu-studio-warnings">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      <TextField id="preset-import-name" label="Name" value={name} onChange={setName} placeholder={preset.name} maxLength={80} />
      <p className="vu-studio-note">
        Presets often talk to a model by name. Swap it here and every block follows.
      </p>
      <div className="vu-studio-pair">
        <TextField
          id="preset-import-find"
          label="Find"
          value={find}
          onChange={setFind}
          placeholder="nothing"
        />
        <TextField id="preset-import-replace" label="Replace with" value={replacement} onChange={setReplacement} placeholder="nothing" />
      </div>
    </FormFrame>
  )
}

export interface VariableModalProps {
  theme: ScreenTheme
  name: string
  value: string
  onSave: (value: string) => void
  onClose: () => void
}

/** One variable's value, changed by hand. */
export function VariableModal({ theme, name, value, onSave, onClose }: VariableModalProps): JSX.Element | null {
  const [text, setText] = useState(value)

  return (
    <FormFrame
      id="preset-variable"
      theme={theme}
      title="Edit variable"
      confirm="Save"
      onClose={onClose}
      onConfirm={() => {
        onSave(text)
        onClose()
      }}
    >
      <TextField id="preset-variable-value" label={name} value={text} onChange={setText} multiline autoFocus />
    </FormFrame>
  )
}

/** What each class pool size is called, and what is said under it. */
const CATALOG_FIELDS: readonly { key: ClassCatalogKey; label: string; hint: string }[] = [
  {
    key: 'pe',
    label: 'Physical education classes',
    hint: 'From 1 to 20. A small pool can leave some students without a PE class.'
  },
  {
    key: 'filler',
    label: 'Humanities, arts and miscellaneous',
    hint: 'From 0 to 15 of each. 0 asks for none of that kind.'
  },
  { key: 'perMajor', label: 'Classes for each major', hint: 'From 1 to 8, for every major a student is given.' }
]

export interface CatalogSizesModalProps {
  theme: ScreenTheme
  /** The sizes in force; an absent one is the shipped size. */
  sizes: ClassCatalogEdits
  /** Keeps the sizes, each one that is left out reset to its shipped size. False when the write failed, which leaves the panel open. */
  onSave: (sizes: ClassCatalogEdits) => Promise<boolean>
  onClose: () => void
}

/** How many classes the catalog is asked for in each pool. */
export function CatalogSizesModal({ theme, sizes, onSave, onClose }: CatalogSizesModalProps): JSX.Element | null {
  const [texts, setTexts] = useState<Record<ClassCatalogKey, string>>({
    pe: sizes.pe === undefined ? '' : String(sizes.pe),
    filler: sizes.filler === undefined ? '' : String(sizes.filler),
    perMajor: sizes.perMajor === undefined ? '' : String(sizes.perMajor)
  })
  const [busy, setBusy] = useState(false)

  /** Keeps the sizes: a blank or shipped one is dropped, and the rest are brought into range. */
  async function submit(): Promise<void> {
    if (busy) return
    const typed: ClassCatalogEdits = {}
    for (const { key } of CATALOG_FIELDS) {
      const text = texts[key].trim()
      if (text !== '' && Number.isFinite(Number(text))) typed[key] = Number(text)
    }
    const kept = studioPromptsToKeep({ classCatalog: typed }).classCatalog ?? {}
    const changed: ClassCatalogEdits = {}
    for (const key of Object.keys(kept) as ClassCatalogKey[]) {
      if (kept[key] !== DEFAULT_CLASS_CATALOG[key]) changed[key] = kept[key]
    }
    setBusy(true)
    const ok = await onSave(changed)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <FormFrame
      id="catalog-sizes"
      theme={theme}
      title="Catalog sizes"
      confirm="Save"
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <p className="vu-studio-note">
        A bigger catalog is more for the writer to produce. It costs more output tokens, and a reply that runs too
        long can be cut off, which means retrying the start. Leave a field empty for the shipped size.
      </p>
      {CATALOG_FIELDS.map(({ key, label, hint }, index) => (
        <TextField
          key={key}
          id={`catalog-sizes-${key}`}
          label={label}
          hint={`${hint} Shipped: ${DEFAULT_CLASS_CATALOG[key]}.`}
          value={texts[key]}
          onChange={(value) => setTexts((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, '') }))}
          placeholder={String(DEFAULT_CLASS_CATALOG[key])}
          maxLength={String(CLASS_CATALOG_RANGES[key].max).length}
          autoFocus={index === 0}
        />
      ))}
    </FormFrame>
  )
}

export interface PartExampleModalProps {
  theme: ScreenTheme
  /** The row's name, which titles the panel. */
  title: string
  /** What the section carries, said over the example. */
  hint: string
  /** The section's text as the last scene sent it. */
  text: string
  onClose: () => void
}

/** One of the game's own sections as the last scene sent it, to read and not to change. */
export function PartExampleModal({ theme, title, hint, text, onClose }: PartExampleModalProps): JSX.Element | null {
  return (
    <FormFrame id="preset-part-example" theme={theme} title={title} confirm="Done" onClose={onClose} onConfirm={onClose} wide cancel={false}>
      <p className="vu-studio-note">{hint} This is what the last scene sent here.</p>
      <textarea
        id="preset-part-example-text"
        className="vu-input vu-input--multiline vu-studio-preview"
        aria-label={title}
        readOnly
        value={text}
      />
    </FormFrame>
  )
}

export interface FindReplaceModalProps {
  theme: ScreenTheme
  preset: Preset
  /** What Find opens on: a macro picked from the glossary, or nothing. */
  find: string
  /** Keeps the swapped preset. False when the write failed, which leaves the panel open. */
  onSave: (preset: Preset) => Promise<boolean>
  onClose: () => void
}

/** A swap of one piece of text for another across the preset's own blocks and its scene text. */
export function FindReplaceModal({ theme, preset, find: opening, onSave, onClose }: FindReplaceModalProps): JSX.Element | null {
  const [find, setFind] = useState(opening)
  const [replacement, setReplacement] = useState('')
  const [busy, setBusy] = useState(false)

  const matches = countMatches(preset, find)

  /** Keeps the preset with the swap applied; with nothing to swap it only closes. */
  async function submit(): Promise<void> {
    if (busy) return
    if (matches === 0) {
      onClose()
      return
    }
    setBusy(true)
    const ok = await onSave(presetWithReplacement(preset, find, replacement))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <FormFrame
      id="preset-find-replace"
      theme={theme}
      title="Find and replace"
      confirm="Replace"
      wide
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <p className="vu-studio-note">
        Swaps text across this preset&apos;s blocks and its scene text. The game&apos;s own sections are left alone.
      </p>
      <div className="vu-studio-pair">
        <TextField id="preset-find-text" label="Find" value={find} onChange={setFind} placeholder="nothing" autoFocus={opening === ''} />
        <TextField
          id="preset-replace-text"
          label="Replace with"
          value={replacement}
          onChange={setReplacement}
          placeholder="nothing"
          autoFocus={opening !== ''}
        />
      </div>
      <p className="vu-studio-note" aria-live="polite">
        {find === ''
          ? 'Type what to find.'
          : matches === 0
            ? 'No matches in this preset.'
            : matches === 1
              ? '1 match in this preset.'
              : `${matches} matches in this preset.`}
      </p>
    </FormFrame>
  )
}
