import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { ROOM_VARIANTS } from '@shared/room'
import { allBackgrounds, roomBgIdOf } from '@shared/types'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { roomUrl, useCharacterStore } from '../stores/characterStore'
import { useAssetStore } from '../stores/assetStore'
import { UNKNOWN_NAME, useGameStore } from '../stores/gameStore'
import { bgThumbUrl } from './bgAssets'
import type { ScreenTheme } from './clockTheme'
import { DoorIcon, SkyIcon } from './screenIcons'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  spin,
  toggleLift,
  veilIn
} from './motion'
import '../vu_styles/BgPicker.css'

/** Which shelf of backgrounds the grid is showing. */
type BgTab = 'interior' | 'exterior' | 'rooms'

const TAB_MARK = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
} as const

function BedIcon(): JSX.Element {
  return (
    <svg {...TAB_MARK}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 21v-3" />
      <path d="M21 21v-3" />
      <path d="M3 13V7a2 2 0 0 1 2-2h4" />
    </svg>
  )
}

/** The three shelves, in rail order — the old file's `TabDef`s. */
const TABS: ReadonlyArray<{ id: BgTab; word: string; Mark: () => JSX.Element }> = [
  { id: 'interior', word: 'INTERIOR', Mark: DoorIcon },
  { id: 'exterior', word: 'EXTERIOR', Mark: SkyIcon },
  { id: 'rooms', word: 'CHARACTER ROOMS', Mark: BedIcon }
]

/** One thumbnail: the bg id it sets, the image to draw, and what to call it. */
interface BgTile {
  id: string
  src: string | null
  label: string
}

export interface BgPickerProps {
  /** The panel's own theme. */
  theme: ScreenTheme
  /** Which half of the day the tiles show each place in. */
  half: 'day' | 'night'
  /** Whether the tiles show each place's rain render, where it has one. */
  wet: boolean
  title: string
  /** What the dialog is called to a screen reader. */
  label: string
  /** The tile ringed as the one in force; null is none. */
  picked: string | null
  /** A tile was pressed, the ringed one included. */
  onPick: (id: string) => void
  /** A tile the caller's terms will not take, drawn dead. */
  dead?: (id: string) => boolean
  /** What stands above the shelves. */
  header?: ReactNode
  onClose: () => void
}

/** Where the scene is set, in the player's own hands, each place drawn under the slot's sky. */
export function BgModal({
  theme,
  wet,
  onClose
}: {
  theme: ScreenTheme
  /** Whether the slot is wet, so each place shows the rain render the stage would. */
  wet: boolean
  onClose: () => void
}): JSX.Element {
  const bg = useGameStore((s) => s.bg)
  const bgOverride = useGameStore((s) => s.bgOverride)
  const setBgOverride = useGameStore((s) => s.setBgOverride)
  const shown = bgOverride ?? bg

  return (
    <BgPicker
      theme={theme}
      half={theme}
      wet={wet}
      title="Change BG"
      label="Where the scene is set"
      picked={shown}
      // Pressing the one already on screen hands the choice back to the scene.
      onPick={(id) => setBgOverride(id === shown ? null : id)}
      onClose={onClose}
    />
  )
}

/**
 * Every place a picture may be set in, shelf by shelf — the listed backgrounds by kind and the
 * roster's rooms — as a grid of 16:9 tiles, the picked one ringed.
 */
export function BgPicker({
  theme,
  half,
  wet,
  title,
  label,
  picked,
  onPick,
  dead,
  header,
  onClose
}: BgPickerProps): JSX.Element | null {
  const characters = useGameStore((s) => s.characters)
  const charInfo = useGameStore((s) => s.charInfo)
  const backgrounds = useAssetStore((s) => s.backgrounds)
  const spriteVersion = useCharacterStore((s) => s.spriteVersion)

  const [tab, setTab] = useState<BgTab>('interior')
  // Which of the roster have both room images on disk — `gameStore.roomReady`
  // answers for the scene's cast only.
  const [rooms, setRooms] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadRoomStatus = useCharacterStore.getState().loadRoomStatus
    void Promise.all(
      Object.values(characters).map(async (character) => {
        const room = await loadRoomStatus(character.charId)
        const ready = room !== null && ROOM_VARIANTS.every((variant) => room[variant])
        return [character.charId, ready] as const
      })
    ).then((pairs) => {
      if (!cancelled) setRooms(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [characters])

  const tiles = useMemo<BgTile[]>(() => {
    if (tab === 'rooms') {
      if (!rooms) return []
      // A room id a listed background answers to is that background, on its own shelf.
      const listed = new Set(allBackgrounds(backgrounds))
      return Object.values(characters)
        .filter((character) => rooms[character.charId] && !listed.has(roomBgIdOf(character)))
        .map((character) => ({
          id: roomBgIdOf(character),
          src: roomUrl(character.charId, half, spriteVersion[character.charId] ?? 0),
          // Masked as the Cast Modal masks a name.
          label: charInfo[character.charId]?.nameKnown ? character.firstName : UNKNOWN_NAME
        }))
    }
    return backgrounds[tab].map((base) => ({
      id: base,
      src: bgThumbUrl(base, half, wet),
      label: base.replace(/_/g, ' ')
    }))
  }, [tab, rooms, characters, charInfo, backgrounds, half, wet, spriteVersion])

  const { host, overlayProps } = useModalShell(onClose)
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
      <motion.div
        className="vu-bgpick vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        variants={panelUnderTab}
      >
        <TitleTab>{title}</TitleTab>

        {header}

        <div className="vu-bgpick-body">
          <div className="vu-bgpick-rail">
            {TABS.map((entry) => {
              const on = entry.id === tab
              return (
                <motion.button
                  key={entry.id}
                  className={`vu-tile vu-bgpick-tile vu-paper${on ? ' vu-bgpick-tile--on' : ''}`}
                  type="button"
                  aria-label={entry.word}
                  aria-pressed={on}
                  {...gestures(false, on ? toggleLift : lift, press)}
                  onClick={() => setTab(entry.id)}
                >
                  <entry.Mark />
                  <span className="vu-bgpick-tile-word">{entry.word}</span>
                </motion.button>
              )
            })}
          </div>

          <div className="vu-bgpick-scroll">
            {tab === 'rooms' && !rooms ? (
              <div className="vu-bgpick-wait">
                <motion.span className="vu-ring" animate={spin} />
                <span className="vu-bgpick-wait-label">LOOKING FOR ROOMS…</span>
              </div>
            ) : tiles.length === 0 ? (
              <p className="vu-empty">Nothing to show here.</p>
            ) : (
              <ul className="vu-gallery-grid vu-bgpick-grid">
                {tiles.map((tile) => {
                  const on = tile.id === picked
                  const off = dead?.(tile.id) === true
                  const empty = tile.src === null ? ' vu-gallery-cell--empty' : ''
                  return (
                    <li key={tile.id} className="vu-gallery-item">
                      <motion.button
                        type="button"
                        className={`vu-gallery-cell${empty}${on ? ' vu-bgpick-cell--on' : ''}`}
                        aria-pressed={on}
                        disabled={off}
                        {...gestures(off, quietLift, quietPress)}
                        onClick={() => onPick(tile.id)}
                      >
                        {tile.src ? (
                          <img className="vu-gallery-img" src={tile.src} alt="" decoding="async" />
                        ) : (
                          <span className="vu-gallery-empty">NOT GENERATED</span>
                        )}
                      </motion.button>
                      <span className="vu-gallery-caption">{tile.label}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="vu-foot">
          <motion.button
            id="bgpick-close"
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
