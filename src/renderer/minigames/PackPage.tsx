import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { locationDefOf, ROOM_LOCATION } from '@shared/locations'
import {
  listed,
  MINI_GAMES_LIST,
  playersWords,
  type GameOption,
  type MiniGameDef,
  type SuggestRate
} from '@shared/minigames'
import { SelectField } from '../components/SelectField'
import type { ModDetailProps } from '../mods/hooks'
import { gestures, quietLift, quietPress, rowLift, rowPress } from '../views/motion'
import { tunedGame, usePrefsStore } from './prefs'
import { ReportButton } from './ReportButton'
import '../vu_styles/MiniGames.css'

/**
 * A pack's page on the Mods screen, drawn by the framework from what each game says of itself,
 * so a pack writes no screen of its own. First the pack's games, each with its switch; then, for
 * the one picked, what it is, where and with whom it is played, how, and how the player would
 * rather it went.
 */

/** Where a game is played, in the places' own names. A place this build lacks is not named. */
function placesWords(game: MiniGameDef): string {
  if (!game.locations) return 'anywhere'
  const names = game.locations.flatMap((id) =>
    id === ROOM_LOCATION ? ['your room'] : (locationDefOf(id)?.label ?? [])
  )
  const elsewhere = game.locations.length - names.length
  if (names.length === 0) return 'at places another mod adds'
  return `${listed(names)}${elsewhere > 0 ? ', and at places another mod adds' : ''}`
}

const RATES: readonly { value: SuggestRate | ''; label: string }[] = [
  { value: '', label: 'As the game has it' },
  { value: 'often', label: 'Often' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never: only when you ask' }
]

/** What one value of an option is called: its own name, or the number. */
function valueName(option: GameOption, value: number): string {
  return option.values?.[value] ?? String(value)
}

/** Every way an option can be set, as a line: the named ones each by name, a plain range as one. */
function waysOf(option: GameOption): string {
  const usual = valueName(option, option.default)
  if (!option.values) return `Any number from ${option.min} to ${option.max}. Usually ${usual}.`
  const names = Array.from({ length: option.max - option.min + 1 }, (_, i) =>
    valueName(option, option.min + i)
  )
  return `${names.join(', ')}. Usually ${usual.charAt(0).toLowerCase()}${usual.slice(1)}.`
}

function sentence(text: string): string {
  const trimmed = text.trim()
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).replace(/\.$/, '')}.`
}

function GamePage({ game, onBack }: { game: MiniGameDef; onBack: () => void }): JSX.Element {
  const prefs = usePrefsStore((s) => s.byGame[game.id])
  const setPrefs = usePrefsStore((s) => s.set)
  // The page opens below the pack's own heading, in a pane that scrolls: it is brought to the
  // pane's top, so the way back and the game's name are the first things read.
  const page = useRef<HTMLDivElement>(null)
  useEffect(() => {
    page.current?.scrollIntoView({ block: 'start' })
  }, [])
  return (
    <div className="vu-minigame-page" ref={page}>
      <motion.button
        id="minigame-page-back"
        className="vu-pill vu-minigame-page-back"
        type="button"
        {...gestures(false, quietLift, quietPress)}
        onClick={onBack}
      >
        All games
      </motion.button>
      <h4 className="vu-minigame-page-name">
        <span aria-hidden="true">{game.icon}</span> {game.name}
      </h4>
      <p className="vu-mods-blurb">{sentence(game.blurb)}</p>
      <dl className="vu-minigame-facts">
        <dt>Played</dt>
        <dd>{sentence(playersWords(game))}</dd>
        <dt>Where</dt>
        <dd>{sentence(placesWords(game))}</dd>
        {game.controls && (
          <>
            <dt>Controls</dt>
            <dd>{game.controls}</dd>
          </>
        )}
      </dl>
      <ReportButton id={`minigame-page-report-${game.id}`} report={() => ({ game: tunedGame(game) })} />

      {(game.options ?? []).length > 0 && (
        <>
          <hr className="vu-rule" />
          <h4 className="vu-mods-label">Ways to play</h4>
          <p className="vu-mods-option-hint">
            Say which you want when you ask her, in your own words. She can ask for one too.
          </p>
          <dl className="vu-minigame-facts">
            {(game.options ?? []).map((option) => (
              <div key={option.id} className="vu-minigame-fact">
                <dt>{option.label ?? option.id}</dt>
                <dd>{waysOf(option)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <hr className="vu-rule" />
      <h4 className="vu-mods-label">How you like it</h4>
      {(game.options ?? []).map((option) => (
        <SelectField
          key={option.id}
          id={`minigame-pref-${game.id}-${option.id}`}
          label={option.label ?? sentence(option.describe)}
          hint="What a game starts from. Either of you can still ask for something else."
          value={String(prefs?.options?.[option.id] ?? '')}
          onChange={(value) => {
            const options = { ...(prefs?.options ?? {}) }
            if (value === '') delete options[option.id]
            else options[option.id] = Number(value)
            setPrefs(game.id, { ...prefs, options })
          }}
          options={[
            { value: '', label: `As the game has it (${valueName(option, option.default)})` },
            ...Array.from({ length: option.max - option.min + 1 }, (_, i) => ({
              value: String(option.min + i),
              label: valueName(option, option.min + i)
            }))
          ]}
        />
      ))}
      {game.stepped !== undefined && (
        <SelectField
          id={`minigame-pref-${game.id}-stepped`}
          label="The game's text"
          hint="Whether each line waits for you to move on, or the game keeps its own pace."
          value={prefs?.stepped === undefined ? '' : prefs.stepped ? 'yes' : 'no'}
          onChange={(value) =>
            setPrefs(game.id, {
              ...prefs,
              stepped: value === '' ? undefined : value === 'yes'
            })
          }
          options={[
            {
              value: '',
              label: `As the game has it (${game.stepped ? 'waits for you' : 'moves on by itself'})`
            },
            { value: 'yes', label: 'Waits for you' },
            { value: 'no', label: 'Moves on by itself' }
          ]}
        />
      )}
      {(game.aids ?? []).map((aid) => {
        const set = prefs?.aids?.[aid.id]
        return (
          <SelectField
            key={aid.id}
            id={`minigame-pref-${game.id}-aid-${aid.id}`}
            label={aid.label}
            hint={aid.describe}
            value={set === undefined ? '' : set ? 'yes' : 'no'}
            onChange={(value) => {
              const aids = { ...prefs?.aids }
              if (value === '') delete aids[aid.id]
              else aids[aid.id] = value === 'yes'
              setPrefs(game.id, {
                ...prefs,
                aids: Object.keys(aids).length > 0 ? aids : undefined
              })
            }}
            options={[
              { value: '', label: `As the game has it (${aid.on ? 'on' : 'off'})` },
              { value: 'yes', label: 'On' },
              { value: 'no', label: 'Off' }
            ]}
          />
        )
      })}
      <SelectField
        id={`minigame-pref-${game.id}-playbyplay`}
        label="Play-by-play in the text box"
        hint="Whether each move is also told in the dialogue box, or the box keeps to what people say."
        value={prefs?.playByPlay === undefined ? '' : prefs.playByPlay ? 'yes' : 'no'}
        onChange={(value) =>
          setPrefs(game.id, {
            ...prefs,
            playByPlay: value === '' ? undefined : value === 'yes'
          })
        }
        options={[
          {
            value: '',
            label: `As the game has it (${game.playByPlay ? 'every move told' : 'only what people say'})`
          },
          { value: 'yes', label: 'Every move told' },
          { value: 'no', label: 'Only what people say' }
        ]}
      />
      {game.players.max > 0 && (
        <SelectField
          id={`minigame-pref-${game.id}-suggest`}
          label="How readily a girl suggests it"
          hint="Wherever it is played. You can always ask her yourself."
          value={prefs?.suggest ?? ''}
          onChange={(value) =>
            setPrefs(game.id, { ...prefs, suggest: (value || undefined) as SuggestRate | undefined })
          }
          options={RATES}
        />
      )}
    </div>
  )
}

export function PackPage({ mod, Switch, optionOn, setOption }: ModDetailProps): JSX.Element {
  const games = MINI_GAMES_LIST.filter((game) => game.modId === mod.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = games.find((game) => game.id === openId)
  if (open) return <GamePage game={open} onBack={() => setOpenId(null)} />

  return (
    <>
      <h4 className="vu-mods-label">Games</h4>
      <ul className="vu-mods-options">
        {games.map((game) => {
          // A game the pack gives no switch is on with the pack.
          const switched = mod.options?.some((option) => option.id === game.id) ?? false
          return (
            <li key={game.id} className="vu-mods-option vu-minigame-entry">
              <motion.button
                id={`minigame-page-${game.id}`}
                className="vu-minigame-entry-pick"
                type="button"
                {...gestures(false, rowLift, rowPress)}
                onClick={() => setOpenId(game.id)}
              >
                <span className="vu-minigame-entry-icon" aria-hidden="true">
                  {game.icon}
                </span>
                <span className="vu-mods-option-text">
                  <span className="vu-mods-option-label">{game.name}</span>
                  <span className="vu-mods-option-hint">
                    {sentence(playersWords(game))} {sentence(placesWords(game))}
                  </span>
                </span>
              </motion.button>
              {switched && (
                <Switch
                  id={`minigame-switch-${game.id}`}
                  label={game.name}
                  on={optionOn(game.id)}
                  onChange={(on) => setOption(game.id, on)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
