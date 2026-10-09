import { useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { cgLabelOf, customCgLabelOf, customCgSlotNumber } from '@shared/customCgs'
import { CUSTOM_OUTFIT_NAME_MAX, customOutfitName } from '@shared/outfits'
import { afterOf, CUSTOM_CG_SLOTS } from '@shared/positions'
import type { CustomCgSlot, Position } from '@shared/types'
import { DeleteX } from '../components/DeleteX'
import { RenameBox } from '../components/RenameBox'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import {
  cgTargetFor,
  liveTaskFor,
  readyCustomCgs,
  spriteUrl,
  stagedOf,
  useCharacterStore,
  useSpriteVersion
} from '../stores/characterStore'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  revealed,
  rowPress,
  spin,
  toggleLift,
  veilIn,
  yielded
} from './motion'
import { PencilIcon, PlusIcon } from './screenIcons'
import '../vu_styles/ImageGallery.css'
import '../vu_styles/CustomCgs.css'

/** One control a card raises over its picture: the pill's words and what a click on it does. */
interface CardAction {
  /** Tells the card's controls apart, so a focus that one of them held can be let go of. */
  key: 'cancel' | 'regenerate' | 'generate' | 'edit'
  pill: ReactNode
  /** What the control is called to a screen reader, naming the CG the pill's words do not. */
  ariaLabel: string
  onAct: () => void
}

/** Everything one card of the panel draws. */
interface CardProps {
  /** The picture's URL, or `null` for a gap. */
  src: string | null
  /** The controls a hover or a focus raises, centred on the picture; none for a plain card. */
  actions: readonly CardAction[]
  /** Work on the image is under way, so its one pill stays up rather than waiting on a hover. */
  held: boolean
  /** The plus that writes an empty slot, standing in the gap where the word would. */
  add?: { id: string; dead: boolean; onAdd: () => void }
  /** Throws the whole pair away; absent where the card offers no ✕. */
  remove?: { label: string; onDelete: () => void }
  caption: ReactNode
}

/** The pill's ring and word while work on its image is under way. */
function Busy(): JSX.Element {
  return (
    <>
      <motion.span className="vu-ring" animate={spin} />
      Cancel
    </>
  )
}

/**
 * One image of a pair under its caption, and whatever the player may do to it: a cell that
 * offers one control is that control, one that offers several stands their pills over the
 * picture as siblings of it, and the ✕ rides the corner. One hover drives every reveal.
 */
function CgCard({ src, actions, held, add, remove, caption }: CardProps): JSX.Element {
  const [hovered, setHovered] = useState(false)
  // The pill holding the focus, read only while that pill is still offered: one that leaves
  // the card under the focus reports no blur.
  const [focusedKey, setFocusedKey] = useState<CardAction['key'] | null>(null)
  const focused = actions.some((action) => action.key === focusedKey)
  const raised = held || hovered || focused
  const empty = src === null ? ' vu-gallery-cell--empty' : ''

  // A gap's word gives way to a pill raised over it, which would otherwise sit on top of it.
  const picture =
    src === null ? (
      <motion.span
        className="vu-gallery-empty"
        variants={actions.length > 0 ? yielded : undefined}
        initial={false}
      >
        NOT GENERATED
      </motion.span>
    ) : (
      <img className="vu-gallery-img" src={src} alt="" />
    )

  // Each form of the cell is keyed apart, so a cell that changes form mounts afresh rather
  // than carrying one form's motion state into the next.
  let cell: JSX.Element
  if (add) {
    cell = (
      <motion.button
        key="add"
        id={add.id}
        className="vu-gallery-cell vu-gallery-cell--empty vu-customcg-add"
        type="button"
        aria-label="Create custom CG"
        disabled={add.dead}
        {...gestures(add.dead, quietLift, quietPress)}
        onClick={add.onAdd}
      >
        <PlusIcon size={40} />
      </motion.button>
    )
  } else if (actions.length === 1) {
    const [action] = actions
    cell = (
      <motion.button
        key="one"
        className={`vu-gallery-cell${empty}`}
        type="button"
        aria-label={action.ariaLabel}
        animate={raised ? 'shown' : 'hidden'}
        whileFocus="shown"
        whileTap={rowPress}
        onClick={action.onAct}
      >
        {picture}
        {/* Variants rather than a `whileHover`, so focusing the cell reveals the pill inside
            it; `initial={false}` or it flashes on mount before tucking away. */}
        <motion.span className="vu-pic-action" variants={revealed} initial={false}>
          {action.pill}
        </motion.span>
      </motion.button>
    )
  } else if (actions.length > 1) {
    cell = (
      <motion.div
        key="many"
        className={`vu-gallery-cell${empty}`}
        animate={raised ? 'shown' : 'hidden'}
      >
        {picture}
        <div className="vu-customcg-pills">
          {actions.map((action) => (
            <motion.button
              key={action.key}
              className="vu-pic-action"
              type="button"
              aria-label={action.ariaLabel}
              variants={revealed}
              initial={false}
              {...gestures(false, toggleLift, quietPress)}
              onFocus={() => setFocusedKey(action.key)}
              onBlur={() => setFocusedKey((now) => (now === action.key ? null : now))}
              onClick={action.onAct}
            >
              {action.pill}
            </motion.button>
          ))}
        </div>
      </motion.div>
    )
  } else {
    cell = (
      <div key="plain" className={`vu-gallery-cell${empty}`}>
        {picture}
      </div>
    )
  }

  return (
    <motion.li
      className={`vu-gallery-item${remove ? ' vu-gallery-item--removable' : ''}`}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {cell}
      {remove && (
        <DeleteX
          className="vu-x vu-gallery-x"
          hovered={hovered || focused}
          label={remove.label}
          onDelete={remove.onDelete}
        />
      )}
      {caption}
    </motion.li>
  )
}

/**
 * A main CG's name under its picture, and the pencil beside it that swaps the name for a box at
 * its own size; a pair with no record has nothing to rename.
 */
function MainCaption({
  label,
  rename
}: {
  label: string
  rename?: { value: string; placeholder: string; onCommit: (name: string) => void }
}): JSX.Element {
  const [renaming, setRenaming] = useState(false)

  if (rename && renaming) {
    return (
      <div className="vu-customcg-caption">
        <RenameBox
          className="vu-input vu-customcg-rename"
          ariaLabel="CG name"
          value={rename.value}
          placeholder={rename.placeholder}
          max={CUSTOM_OUTFIT_NAME_MAX}
          onCommit={rename.onCommit}
          onDone={() => setRenaming(false)}
        />
      </div>
    )
  }
  return (
    <div className="vu-customcg-caption">
      <span className="vu-gallery-caption">{label}</span>
      {rename && (
        <motion.button
          className="vu-customcg-pencil"
          type="button"
          aria-label="Rename CG"
          {...gestures(false, quietLift, quietPress)}
          onClick={() => setRenaming(true)}
        >
          <PencilIcon />
        </motion.button>
      )}
    </div>
  )
}

export interface CustomCgsModalProps {
  charId: string
  /** Drawn by the screen that opened this — a portal inherits neither. */
  theme: 'day' | 'night'
  /** Whether a pair can be rendered now: the renderer there, her sprites in, the setting clear. */
  renderable: boolean
  /** Opens the form that makes a pair in an empty slot, behind the editor's dirty gate. */
  onCreate: (slot: CustomCgSlot) => void
  /** Renders whichever image of a pair is missing, from its record. */
  onFill: (slot: CustomCgSlot) => void
  /** Opens the tags both images of a pair are rendered again from. */
  onRegeneratePair: (slot: CustomCgSlot) => void
  /** Opens the tags a pair's after alone is rendered again from. */
  onRegenerateAfter: (slot: CustomCgSlot) => void
  /** Opens what the writer is told about a pair and the loops it plays. */
  onEdit: (slot: CustomCgSlot) => void
  /** Asks whether to throw a pair away. */
  onDelete: (slot: CustomCgSlot) => void
  onClose: () => void
}

/**
 * The player's own CG pairs: each slot's main CG over its `_after`, the plus in an empty slot,
 * and what a hover raises on the rest. Every confirm and form is the Edit modal's.
 */
export function CustomCgsModal({
  charId,
  theme,
  renderable,
  onCreate,
  onFill,
  onRegeneratePair,
  onRegenerateAfter,
  onEdit,
  onDelete,
  onClose
}: CustomCgsModalProps): JSX.Element | null {
  const character = useCharacterStore((s) => s.characters[charId])
  const cgs = useCharacterStore((s) => s.cgs[charId])
  const progress = useCharacterStore((s) => s.progress[charId])
  const staged = useCharacterStore((s) => s.staged)
  const version = useSpriteVersion(charId)
  const cancelSet = useCharacterStore((s) => s.cancelSet)
  const writeCustomCg = useCharacterStore((s) => s.writeCustomCg)

  const { host, overlayProps } = useModalShell(onClose)
  if (!host || !character) return null

  const whole = readyCustomCgs(cgs).length

  /** The two cards one slot stands as: its main over its after. */
  const cardsOf = (slot: CustomCgSlot): { main: CardProps; after: CardProps } => {
    const after = afterOf(slot)
    const entry = character.customCgs?.[slot]
    const name = customCgLabelOf(character, slot)
    const afterName = cgLabelOf(character, after)
    // The pair's own bucket, queued or rendering, and a re-roll of its after on its own.
    const pairTask = liveTaskFor(progress, slot)
    const afterTask = liveTaskFor(progress, cgTargetFor(after))
    // While the pair is replaced, its cards show this run's staged images.
    const replacing = Boolean(pairTask?.staged)
    const present = replacing ? stagedOf(staged, charId, slot) : cgs
    const urlOf = (position: Position): string | null =>
      present?.[position] ? spriteUrl(charId, position, version, replacing) : null
    const onDisk = Boolean(cgs?.[slot] || cgs?.[after])

    const cancelPair: CardAction = {
      key: 'cancel',
      pill: <Busy />,
      ariaLabel: `Cancel ${name}`,
      onAct: () => void cancelSet(charId, slot)
    }
    // Only a record can be filled from or written to; a pair with no images has the plus.
    const generate = (label: string): CardAction[] =>
      renderable && entry
        ? [
            {
              key: 'generate',
              pill: 'Generate',
              ariaLabel: `Generate ${label}`,
              onAct: () => onFill(slot)
            }
          ]
        : []
    const edit: CardAction[] = entry
      ? [{ key: 'edit', pill: 'Edit', ariaLabel: `Edit ${name}`, onAct: () => onEdit(slot) }]
      : []
    // Nothing is thrown away from under a render, which the store would refuse.
    const remove =
      !pairTask && !afterTask && (entry || onDisk)
        ? { label: `Delete ${name}`, onDelete: () => onDelete(slot) }
        : undefined
    const caption = (
      <MainCaption
        label={name}
        rename={
          entry
            ? {
                value: customOutfitName(entry.name),
                placeholder: `Custom CG ${customCgSlotNumber(slot)}`,
                // A name left as it was writes nothing.
                onCommit: (typed) => {
                  if (customOutfitName(typed) === customOutfitName(entry.name)) return
                  void writeCustomCg(charId, slot, { name: typed })
                }
              }
            : undefined
        }
      />
    )
    const afterCaption = (
      <div className="vu-customcg-caption">
        <span className="vu-gallery-caption">{afterName}</span>
      </div>
    )

    if (pairTask) {
      return {
        main: { src: urlOf(slot), actions: [cancelPair], held: true, caption },
        after: { src: urlOf(after), actions: [cancelPair], held: true, caption: afterCaption }
      }
    }

    let main: CardProps
    if (!onDisk) {
      main = {
        src: null,
        actions: [],
        held: false,
        add: { id: `custom-cg-add-${slot}`, dead: !renderable, onAdd: () => onCreate(slot) },
        remove,
        caption
      }
    } else if (present?.[slot]) {
      const regenerate: CardAction[] = renderable
        ? [
            {
              key: 'regenerate',
              pill: 'Regenerate',
              ariaLabel: `Regenerate ${name}`,
              onAct: () => onRegeneratePair(slot)
            }
          ]
        : []
      main = { src: urlOf(slot), actions: [...regenerate, ...edit], held: false, remove, caption }
    } else {
      main = { src: null, actions: [...generate(name), ...edit], held: false, remove, caption }
    }

    let afterCard: CardProps
    if (afterTask) {
      afterCard = {
        src: urlOf(after),
        actions: [
          {
            key: 'cancel',
            pill: <Busy />,
            ariaLabel: `Cancel ${afterName}`,
            onAct: () => void cancelSet(charId, cgTargetFor(after))
          }
        ],
        held: true,
        caption: afterCaption
      }
    } else if (present?.[after]) {
      afterCard = {
        src: urlOf(after),
        actions: renderable
          ? [
              {
                key: 'regenerate',
                pill: 'Regenerate',
                ariaLabel: `Regenerate ${afterName}`,
                onAct: () => onRegenerateAfter(slot)
              }
            ]
          : [],
        held: false,
        caption: afterCaption
      }
    } else {
      // Its main is there to render it beside; with nothing at all it is a plain gap.
      afterCard = {
        src: null,
        actions: present?.[slot] ? generate(afterName) : [],
        held: false,
        caption: afterCaption
      }
    }

    return { main, after: afterCard }
  }

  const cards = CUSTOM_CG_SLOTS.map((slot) => ({ slot, ...cardsOf(slot) }))
  // The hint names the plus, so it stands only while a live one is on the panel.
  const addable = cards.some(({ main }) => main.add && !main.add.dead)

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
      <motion.div
        id="custom-cgs"
        className="vu-gallery vu-customcgs vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Custom CG"
        variants={panelUnderTab}
      >
        <TitleTab>Custom CG</TitleTab>

        <div className="vu-gallery-head">
          <span
            className={`vu-count vu-gallery-count vu-count--${whole === CUSTOM_CG_SLOTS.length ? 'good' : 'warn'}`}
          >
            {whole}/{CUSTOM_CG_SLOTS.length}
          </span>
          {addable && <span className="vu-hint">Click + to create a custom CG.</span>}
        </div>

        {/* The four mains across, each slot's after under its own main. */}
        <ul className="vu-gallery-grid">
          {cards.map(({ slot, main }) => (
            <CgCard key={slot} {...main} />
          ))}
          {cards.map(({ slot, after }) => (
            <CgCard key={afterOf(slot)} {...after} />
          ))}
        </ul>

        <div className="vu-foot">
          <motion.button
            id="custom-cgs-close"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={onClose}
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
