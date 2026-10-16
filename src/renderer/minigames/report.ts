import { BUILD, modById } from '@shared/mods'
import type { MiniGameDef } from '@shared/minigames'
import { faultOf } from './faults'

/**
 * What a player copies to report a problem with a game: enough for its author to see what was
 * running and how, without anyone describing it from memory. No names, stakes or story: only
 * the game, how it was set and, at a table, how it stood.
 */
export interface ReportOf {
  game: MiniGameDef
  /** At the table: how many girls were playing, and the options the game was played with. */
  girls?: number
  options?: Readonly<Record<string, number>>
  /** The game's own account of how it stood, at the table. */
  account?: readonly string[]
}

/** The report as text. `modsOn` names the mods that are on, with their versions. */
export function reportText({ game, girls, options, account }: ReportOf, modsOn = ''): string {
  const pack = modById(game.modId)
  const fault = faultOf(game.id)
  const text =
    game.stepped === undefined
      ? 'keeps its own time'
      : game.stepped
        ? 'waits for the player'
        : 'moves on by itself'
  return [
    `Mini-game report: ${game.name} (${game.id})`,
    `Pack: ${pack ? `${pack.name} ${pack.version}` : game.modId}`,
    `Build: ${BUILD.name} ${BUILD.version}${modsOn ? `; mods on: ${modsOn}` : ''}`,
    `Text: ${text}; play-by-play ${game.playByPlay ? 'on' : 'off'}`,
    ...(girls !== undefined ? [`Girls playing: ${girls}`] : []),
    ...(options && Object.keys(options).length > 0
      ? [`Options: ${Object.entries(options).map(([id, value]) => `${id} ${value}`).join(', ')}`]
      : []),
    ...(account && account.length > 0 ? ['How it stood:', ...account.map((line) => `  ${line}`)] : []),
    ...(fault ? [`Last fault (${fault.at}):`, fault.message] : []),
    'What happened (your words):'
  ].join('\n')
}
