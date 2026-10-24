import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useDismissLayer } from './useModalShell'
import { tonedEmoji, useEmojiPrefs } from '../stores/emojiPrefs'
import { gestures, quietLift, quietPress } from '../views/motion'
import '../vu_styles/PopList.css'
import '../vu_styles/EmojiPicker.css'

/** One emoji as the catalogue lists it: the glyph, its name, and a 1 where it takes a tone. */
type Entry = [string, string, 1?]
type Catalogue = Record<string, Entry[]>

/** The tabs, in the catalogue's own order, each with its icon; recent comes first. */
const TABS: Array<{ id: string; label: string; icon: JSX.Element }> = [
  {
    id: 'recent',
    label: 'Recent',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    )
  },
  {
    id: 'smileys',
    label: 'Smileys',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </>
    )
  },
  {
    id: 'people',
    label: 'People',
    icon: (
      <>
        <path d="M18 11V6a2 2 0 0 0-4 0" />
        <path d="M14 10V4a2 2 0 0 0-4 0v2" />
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </>
    )
  },
  {
    id: 'nature',
    label: 'Animals and nature',
    icon: (
      <>
        <circle cx="11" cy="4" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="20" cy="16" r="2" />
        <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
      </>
    )
  },
  {
    id: 'food',
    label: 'Food and drink',
    icon: (
      <>
        <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
        <path d="M10 2c1 .5 2 2 2 5" />
      </>
    )
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: (
      <>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </>
    )
  },
  {
    id: 'travel',
    label: 'Travel and places',
    icon: (
      <>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </>
    )
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: (
      <>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </>
    )
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    )
  }
]

/** The hand the tone button shows, and each tone is offered on. */
const TONE_HAND = '✋'

/**
 * Each emoji the grid has shown, drawn once by the system's own emoji font into a small picture.
 * A grid of pictures scrolls cheaply; a grid of colour glyphs is redrawn glyph by glyph, which
 * Windows does slowly enough to stutter.
 */
const pictures = new Map<string, string>()

/** The picture's side, about twice the size it is shown, so a zoomed stage keeps it sharp. */
const PICTURE_SIDE = 64

let canvas: HTMLCanvasElement | null = null

/** Draws one glyph and hands its picture on once encoded, which Chromium does off the page's thread. */
function drawPicture(glyph: string, done: (picture: string) => void): void {
  canvas ??= document.createElement('canvas')
  canvas.width = PICTURE_SIDE
  canvas.height = PICTURE_SIDE
  const ink = canvas.getContext('2d')
  if (!ink) return
  ink.clearRect(0, 0, PICTURE_SIDE, PICTURE_SIDE)
  ink.font = `${PICTURE_SIDE * 0.8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  ink.textAlign = 'center'
  ink.textBaseline = 'alphabetic'
  // Centred on the glyph's own ink rather than the font's line.
  const size = ink.measureText(glyph)
  const top = size.actualBoundingBoxAscent
  const bottom = size.actualBoundingBoxDescent
  ink.fillText(glyph, PICTURE_SIDE / 2, PICTURE_SIDE / 2 + (top - bottom) / 2)
  // The bitmap is copied at the call, so the canvas is free for the next glyph at once.
  canvas.toBlob((blob) => {
    if (blob) done(URL.createObjectURL(blob))
  })
}

/**
 * How long a frame spends drawing pictures, in milliseconds: a fast machine draws many in it and a
 * slow one a few, and neither drops a frame for it.
 */
const DRAWING_A_FRAME = 4

/** The grid's columns, and each row's height in pixels, as `EmojiPicker.css` lays them out. */
const COLUMNS = 8
const ROW = 42

/** Rows the grid shows at once, and the rows kept on either side so a quick scroll finds them. */
const ROWS_SHOWN = 7
const ROWS_SPARE = 3

/** Glyphs being drawn, so a tab opened twice in quick succession does not draw one twice. */
const drawing = new Set<string>()

/** Loaded the first time a picker opens, so a phone nobody types emoji on never carries it. */
let catalogue: Promise<Catalogue> | null = null
function loadCatalogue(): Promise<Catalogue> {
  catalogue ??= import('./emojiData.json').then((module) => module.default as unknown as Catalogue)
  return catalogue
}

function Icon({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/**
 * The smiley that opens the emoji panel over a composer, as a messenger's does: every emoji in
 * tabs, the ones he used last first, a search and one skin tone for every hand and person. A
 * pick goes to `onPick` toned and the panel stays open for the next; Escape, a right-click or a
 * press outside it closes it.
 */
export function EmojiButton({
  dead = false,
  onPick
}: {
  dead?: boolean
  onPick: (emoji: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const shut = !open || dead
  useDismissLayer(() => setOpen(false), !shut)

  // A press anywhere outside the button and its panel closes it.
  useEffect(() => {
    if (shut) return
    const away = (event: MouseEvent): void => {
      const target = event.target as Node
      if (event.button !== 0 || root.current?.contains(target) || layer.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    window.addEventListener('mousedown', away, true)
    return () => window.removeEventListener('mousedown', away, true)
  }, [shut])

  // The panel stands on the stage itself, over the smiley's corner, so no box it sits in can clip
  // it; it is placed again whenever anything under it scrolls or the window resizes.
  const stage = document.getElementById('root')
  useLayoutEffect(() => {
    if (shut || !stage) return
    const place = (): void => {
      const button = root.current?.getBoundingClientRect()
      const panel = layer.current
      if (!button || !panel) return
      const box = stage.getBoundingClientRect()
      // The browser build zooms the stage rather than the page: a rect over the stage's own width.
      const scale = box.width / stage.offsetWidth || 1
      panel.style.setProperty('right', `${(box.right - button.right) / scale}px`)
      panel.style.setProperty('bottom', `${(box.bottom - button.top) / scale + 10}px`)
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [shut, stage])
  // A portal inherits nothing, so it wears the half of the day the smiley stands in.
  const theme = root.current?.closest('[data-theme]')?.getAttribute('data-theme') ?? undefined

  return (
    <div className="vu-emoji" ref={root}>
      <motion.button
        type="button"
        className={`vu-square vu-emoji-open${open && !dead ? ' vu-emoji-open--on' : ''}`}
        aria-label="Emoji"
        aria-expanded={!shut}
        disabled={dead}
        {...gestures(dead, quietLift, quietPress)}
        // The field being typed in keeps its caret through the press.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((was) => !was)}
      >
        <Icon>{TABS[1].icon}</Icon>
      </motion.button>
      {!shut &&
        stage &&
        createPortal(
          <div className="vu-emoji-layer" ref={layer} data-theme={theme}>
            <EmojiPanel onPick={onPick} />
          </div>,
          stage
        )}
    </div>
  )
}

function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }): JSX.Element {
  const [all, setAll] = useState<Catalogue | null>(null)
  const recent = useEmojiPrefs((s) => s.recent)
  const tone = useEmojiPrefs((s) => s.tone)
  const [tab, setTab] = useState('recent')
  const [query, setQuery] = useState('')
  const [toning, setToning] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  // The first row scrolled into view: only the rows around it are on the page.
  const [topRow, setTopRow] = useState(0)

  useEffect(() => {
    let live = true
    void loadCatalogue().then((loaded) => live && setAll(loaded))
    return () => {
      live = false
    }
  }, [])

  // Every listed emoji by its glyph, so a recent one knows its name and whether it takes a tone.
  const byGlyph = useMemo(
    () => new Map(Object.values(all ?? {}).flat().map((entry) => [entry[0], entry])),
    [all]
  )

  const words = query.trim().toLowerCase()
  // Worked out once a tab or a search, not on every redraw.
  const shown = useMemo<Entry[]>(() => {
    if (!all) return []
    if (words) {
      return [...byGlyph.values()].filter(
        ([, name]) => name.split(' ').some((word) => word.startsWith(words)) || name.startsWith(words)
      )
    }
    if (tab === 'recent') return recent.map((glyph) => byGlyph.get(glyph) ?? [glyph, glyph])
    return all[tab] ?? []
  }, [all, byGlyph, words, tab, recent])

  // The rows around the one in view, whatever the tab's length; the rest stand as empty height.
  const rows = Math.ceil(shown.length / COLUMNS)
  const firstRow = Math.max(0, topRow - ROWS_SPARE)
  const lastRow = Math.min(rows, topRow + ROWS_SHOWN + ROWS_SPARE)
  const onPage = useMemo(
    () => shown.slice(firstRow * COLUMNS, lastRow * COLUMNS),
    [shown, firstRow, lastRow]
  )

  // Whatever is on the page that has no picture yet is drawn in the order shown, a frame's worth
  // at a time; until then a cell shows the glyph itself.
  const [, setDrawn] = useState(0)
  useEffect(() => {
    const owed = [
      ...new Set(onPage.map(([glyph, , toneable]) => (toneable ? tonedEmoji(glyph, tone) : glyph)))
    ].filter((glyph) => !pictures.has(glyph) && !drawing.has(glyph))
    if (owed.length === 0) return
    let live = true
    let frame = 0
    // Pictures arriving within a frame are shown together, in one redraw.
    let showing = 0
    const arrived = (): void => {
      if (!live || showing) return
      showing = requestAnimationFrame(() => {
        showing = 0
        setDrawn((n) => n + 1)
      })
    }
    const step = (): void => {
      const until = performance.now() + DRAWING_A_FRAME
      while (owed.length > 0 && performance.now() < until) {
        const glyph = owed.shift() as string
        drawing.add(glyph)
        drawPicture(glyph, (picture) => {
          pictures.set(glyph, picture)
          drawing.delete(glyph)
          arrived()
        })
      }
      if (owed.length > 0) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      live = false
      cancelAnimationFrame(frame)
      cancelAnimationFrame(showing)
    }
  }, [onPage, tone])

  // A new tab or search starts at the top of the grid.
  useEffect(() => {
    grid.current?.scrollTo({ top: 0 })
    setTopRow(0)
  }, [tab, words])

  // Read at the click, so the cells are handed one function for the panel's whole life.
  const picked = useRef(onPick)
  picked.current = onPick
  const pick = useCallback(([glyph, , toneable]: Entry): void => {
    useEmojiPrefs.getState().used(glyph)
    picked.current(toneable ? tonedEmoji(glyph, useEmojiPrefs.getState().tone) : glyph)
  }, [])

  return (
    <div className="vu-pop vu-emoji-pop" role="dialog" aria-label="Emoji">
      <div className="vu-emoji-head">
        <input
          className="vu-input vu-emoji-search"
          value={query}
          placeholder="Search emoji"
          aria-label="Search emoji"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Nothing typed here sends the message or turns the scene behind the phone.
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              if (shown[0]) pick(shown[0])
            }
          }}
        />
        <motion.button
          type="button"
          className={`vu-emoji-tone${toning ? ' vu-emoji-tone--on' : ''}`}
          aria-label="Skin tone"
          aria-expanded={toning}
          {...gestures(false, quietLift, quietPress)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setToning((was) => !was)}
        >
          {tonedEmoji(TONE_HAND, tone)}
        </motion.button>
      </div>

      {toning ? (
        <div className="vu-emoji-tones" role="radiogroup" aria-label="Skin tone">
          {[null, 0, 1, 2, 3, 4].map((one) => (
            <motion.button
              key={String(one)}
              type="button"
              role="radio"
              aria-checked={tone === one}
              className={`vu-emoji-cell${tone === one ? ' vu-emoji-cell--on' : ''}`}
              {...gestures(false, quietLift, quietPress)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                useEmojiPrefs.getState().setTone(one)
                setToning(false)
              }}
            >
              {tonedEmoji(TONE_HAND, one)}
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="vu-emoji-tabs" role="tablist">
          {TABS.map((one) => (
            <motion.button
              key={one.id}
              type="button"
              role="tab"
              aria-label={one.label}
              aria-selected={!words && tab === one.id}
              className={`vu-emoji-tab${!words && tab === one.id ? ' vu-emoji-tab--on' : ''}`}
              {...gestures(false, quietLift, quietPress)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTab(one.id)
                setQuery('')
              }}
            >
              <Icon>{one.icon}</Icon>
            </motion.button>
          ))}
        </div>
      )}

      <div className="vu-emoji-scroll">
        <div
          className="vu-emoji-grid"
          ref={grid}
          // Rows change as the grid passes each one, not on every pixel of the scroll.
          onScroll={(e) => setTopRow(Math.floor(e.currentTarget.scrollTop / ROW))}
        >
          {firstRow > 0 && <div className="vu-emoji-gap" style={{ height: firstRow * ROW }} />}
          {onPage.map((entry) => (
            <EmojiCell
              key={entry[0]}
              entry={entry}
              tone={entry[2] ? tone : null}
              picture={pictures.get(entry[2] ? tonedEmoji(entry[0], tone) : entry[0])}
              onPick={pick}
            />
          ))}
          {lastRow < rows && (
            <div className="vu-emoji-gap" style={{ height: (rows - lastRow) * ROW }} />
          )}
          {all && shown.length === 0 && <p className="vu-empty vu-empty--flush">No emoji found</p>}
        </div>
        <div className="vu-scroll-fade" />
      </div>
    </div>
  )
}

/** One emoji in the grid, redrawn only when its own tone or picture changes. */
const EmojiCell = memo(function EmojiCell({
  entry,
  tone,
  picture,
  onPick
}: {
  entry: Entry
  tone: number | null
  /** The glyph drawn as a picture, once it has been; the glyph itself until then. */
  picture: string | undefined
  onPick: (entry: Entry) => void
}): JSX.Element {
  return (
    <button
      type="button"
      className="vu-emoji-cell"
      aria-label={entry[1]}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(entry)}
    >
      {picture ? (
        <img className="vu-emoji-pic" src={picture} alt="" draggable={false} />
      ) : (
        tonedEmoji(entry[0], tone)
      )}
    </button>
  )
})
