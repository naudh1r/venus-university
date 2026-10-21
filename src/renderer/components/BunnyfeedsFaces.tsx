import { useId, useMemo, type CSSProperties, type JSX, type ReactNode } from 'react'
import { hashString, seededRand } from '@shared/hash'
import { BUNNYFEEDS } from '@shared/bunnyfeeds'
import type { OptionPreviewProps } from '../mods/hooks'
import { useModOption } from '../stores/modsStore'
import '../vu_styles/Bunnyfeeds.css'

/** How a follower's face is drawn, as the Mods screen's "Faces of other students" picks it. */
export type FaceStyle = 'gradient' | 'identicon' | 'shapes' | 'monogram' | 'mixed'

/** The styles a face can actually be drawn in; "mixed" picks one of these per handle. */
const DRAWN_STYLES = ['gradient', 'identicon', 'shapes', 'monogram'] as const

/** The colours a follower's face is drawn in, three picked off her handle. */
const FOLLOWER_INKS = [
  '--vu-accent',
  '--vu-good',
  '--vu-warn',
  '--vu-danger',
  '--vu-stat-brain'
] as const

/** A stream of numbers in [0, 1) read off a handle, the same every time for the same one. */
function rollsOf(handle: string): () => number {
  let state = hashString(handle) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
}

/** Three different colours off the handle, the first the one her face is washed in. */
function inksOf(roll: () => number): string[] {
  const inks = [...FOLLOWER_INKS]
  for (let i = inks.length - 1; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1))
    ;[inks[i], inks[j]] = [inks[j], inks[i]]
  }
  return inks.slice(0, 3)
}

/** A mirrored five-by-five pattern: the left three columns drawn, the right two mirroring them. */
function identicon(roll: () => number): ReactNode {
  const cells = Array.from({ length: 15 }, () => roll() < 0.5)
  // Too sparse to read as anything: filled out down the middle.
  if (cells.filter(Boolean).length < 5) for (const at of [2, 7, 12]) cells[at] = true
  return cells.flatMap((on, i) => {
    if (!on) return []
    const col = i % 3
    const row = Math.floor(i / 3)
    return (col === 2 ? [2] : [col, 4 - col]).map((at) => (
      <rect
        key={`${row}:${at}`}
        className="vu-bf-ink1"
        x={7.5 + at * 7}
        y={19 + row * 7}
        width={7}
        height={7}
      />
    ))
  })
}

/** Two blurred blobs of colour, like a photo out of focus. */
function gradient(roll: () => number, filter: string): ReactNode {
  return (
    <>
      <defs>
        <filter id={filter} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <g filter={`url(#${filter})`}>
        <circle className="vu-bf-ink1" cx={10 + roll() * 30} cy={18 + roll() * 28} r={15 + roll() * 7} />
        <circle className="vu-bf-ink2" cx={10 + roll() * 30} cy={24 + roll() * 26} r={12 + roll() * 7} />
      </g>
    </>
  )
}

/** Two or three overlapping shapes: circles, rounded squares, triangles and half-discs. */
function shapes(roll: () => number): ReactNode {
  const count = 2 + Math.floor(roll() * 2)
  return Array.from({ length: count }, (_, i) => {
    const ink = `vu-bf-ink${i + 1}`
    const x = 10 + roll() * 30
    const y = 18 + roll() * 30
    const size = 12 + roll() * 14
    const turn = `rotate(${Math.floor(roll() * 90)} ${x} ${y})`
    const kind = Math.floor(roll() * 4)
    const half = size / 2
    if (kind === 0) return <circle key={i} className={ink} cx={x} cy={y} r={size / 1.6} />
    if (kind === 1) {
      return (
        <rect
          key={i}
          className={ink}
          x={x - half}
          y={y - half}
          width={size}
          height={size}
          rx={size / 4}
          transform={turn}
        />
      )
    }
    if (kind === 2) {
      const points = `${x},${y - size / 1.4} ${x + size / 1.4},${y + size / 1.6} ${x - size / 1.4},${y + size / 1.6}`
      return <polygon key={i} className={ink} points={points} transform={turn} />
    }
    const r = size / 1.4
    return <path key={i} className={ink} d={`M${x - r} ${y} a${r} ${r} 0 0 1 ${r * 2} 0z`} transform={turn} />
  })
}

/** The first letter or digit of her handle, set large in the display face. */
function monogram(handle: string): ReactNode {
  const letter = handle.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '?'
  return (
    <text className="vu-bf-ink1" x={25} y={36} textAnchor="middle" dominantBaseline="central">
      {letter}
    </text>
  )
}

/** The style a handle is drawn in: the one picked, or under "mixed" one of them, kept per handle. */
function drawnStyleOf(handle: string, style: FaceStyle): (typeof DRAWN_STYLES)[number] {
  if (style !== 'mixed') return style
  return DRAWN_STYLES[Math.floor(seededRand(`${handle}#faces`)() * DRAWN_STYLES.length)]
}

/** The style an option of the "faces" group stands for; the gradient when none is picked. */
function styleOf(optionId: string | null): FaceStyle {
  if (optionId === 'faces-identicon') return 'identicon'
  if (optionId === 'faces-shapes') return 'shapes'
  if (optionId === 'faces-monogram') return 'monogram'
  if (optionId === 'faces-mixed') return 'mixed'
  return 'gradient'
}

/** The face style the Mods screen has picked for followers. */
function useFaceStyle(): FaceStyle {
  const identiconOn = useModOption(BUNNYFEEDS, 'faces-identicon')
  const shapesOn = useModOption(BUNNYFEEDS, 'faces-shapes')
  const monogramOn = useModOption(BUNNYFEEDS, 'faces-monogram')
  const mixedOn = useModOption(BUNNYFEEDS, 'faces-mixed')
  return styleOf(
    identiconOn
      ? 'faces-identicon'
      : shapesOn
        ? 'faces-shapes'
        : monogramOn
          ? 'faces-monogram'
          : mixedOn
            ? 'faces-mixed'
            : null
  )
}

/** One follower's face in a given style; `className` is the archway it stands in. */
function DrawnFace({
  handle,
  style: picked,
  className
}: {
  handle: string
  style: FaceStyle
  className: string
}): JSX.Element {
  const style = drawnStyleOf(handle, picked)
  const filter = `vu-bf-blur${useId().replace(/[^\w-]/g, '')}`
  const { inks, art } = useMemo(() => {
    const roll = rollsOf(handle)
    const picked = inksOf(roll)
    const drawn =
      style === 'identicon'
        ? identicon(roll)
        : style === 'shapes'
          ? shapes(roll)
          : style === 'monogram'
            ? monogram(handle)
            : gradient(roll, filter)
    return { inks: picked, art: drawn }
  }, [handle, style, filter])
  const colours = Object.fromEntries(inks.map((ink, i) => [`--bf-ink-${i + 1}`, `var(${ink})`]))
  return (
    <span className={`${className} vu-bf-face--${style}`} style={colours as CSSProperties} aria-hidden>
      <svg
        viewBox="0 0 50 60"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering={style === 'identicon' ? 'crispEdges' : undefined}
      >
        {art}
      </svg>
    </span>
  )
}

/**
 * A follower's face, drawn off her handle in the style the Mods screen picked, so she keeps the
 * same face wherever she turns up. Her colours are the theme's, so night redraws them.
 */
export function FollowerFace({ handle, className }: { handle: string; className: string }): JSX.Element {
  return <DrawnFace handle={handle} style={useFaceStyle()} className={className} />
}

/** A few followers the Mods screen shows each style on. */
const SAMPLES = ['quadwalker', 'anouk_amok', 'jill.stingray', 'Stridley', 'ophelia.exe']

/** The faces group's preview on the Mods screen: the sample followers in the picked style. */
export function FacesPreview({ optionId }: OptionPreviewProps): JSX.Element {
  const style = styleOf(optionId)
  return (
    <div className="vu-bf-faces-preview">
      {SAMPLES.map((handle) => (
        <span key={handle} className="vu-bf-faces-sample">
          <DrawnFace
            handle={handle}
            style={style}
            className="vu-arch vu-bb-face vu-bb-face--ring vu-bf-face vu-bf-face--md vu-bf-face--follower"
          />
          <DrawnFace
            handle={handle}
            style={style}
            className="vu-arch vu-bb-face vu-bf-face vu-bf-face--sm vu-bf-face--follower"
          />
        </span>
      ))}
    </div>
  )
}
