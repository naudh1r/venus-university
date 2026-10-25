import { trainingSuggestions, trainingAvailable, pendingTraining } from '../minigames/training'
import { locationAvailable } from '@shared/cityLife'
import { locationDefOf } from '@shared/locations'
import { gameById, tunedGame } from '../minigames/prefs'
import {
  gamesOffered,
  MINI_GAMES,
  MINI_GAMES_LIST,
  SUGGEST_OFTEN,
  gamesNamed,
  gamesSuggested,
  type MiniGameDef
} from '@shared/minigames'
import { optionOn } from '@shared/mods'
import { charKeyOf, type Character } from '@shared/types'
import { MiniGamePanel } from '../minigames/MiniGamePanel'
import { PackPage } from '../minigames/PackPage'
import { MiniGameSeat } from '../minigames/MiniGameSeat'
import { agreedOf, withOffer, withGameHints, withInvitationField, type InviteChoice } from '../minigames/offer'
import { gameComponent } from '../minigames/play'
import { answerOf, withProposal, type Asked } from '../minigames/proposal'
import { clearMatch, keepInvitation, keptInvitation, sceneMiniGame, useTableStore } from '../minigames/session'
import { skillOf } from '../minigames/skill'
import { gameIsOn, nameOf } from '../minigames/table'
import { registerHooks } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { useModsStore } from '../stores/modsStore'
import { destinationOf, scenePlace } from '../minigames/place'
import { tableCanOpen } from '../minigames/screen'

// The exact catalogue supplied to this request, not a venue projected from unread reply lines.
let requestedOffer: { games: MiniGameDef[]; location: string | null; detailed: boolean; choices: InviteChoice[] } | null = null

/** The games a girl in this scene could be played at, each with a component to play it with. */
function gamesWith(cast: readonly Character[], location: string | null): MiniGameDef[] {
  if (cast.length === 0) return []
  const training = pendingTraining()
  return gamesOffered({ location: training?.location ?? location, girls: cast.length }, gameIsOn)
    .filter(game => !training || game.id === training.id)
    .filter((game) => game.players.max >= 1 && Boolean(gameComponent(game.id)))
    .map(tunedGame)
}

/** At most two real outings, rotated by slot. Never a full remote catalogue. */
function outingsWith(cast: readonly Character[], current: string | null, busy: boolean, keen: boolean): InviteChoice[] {
  if (busy || cast.length === 0 || pendingTraining()) return []
  const choices: InviteChoice[] = []
  const state = useGameStore.getState()
  for (const game of MINI_GAMES_LIST) {
    if (!gameIsOn(game.modId, game) || !gameComponent(game.id) || game.players.max < 1 || game.players.min > cast.length) continue
    const locations = game.locations?.filter(id => id !== current && locationAvailable(id) && locationDefOf(id) && gamesSuggested([tunedGame(game)], id, busy, keen).length > 0) ?? []
    const location = locations[(state.date + state.time) % locations.length]
    if (location) choices.push({ game: tunedGame(game), location })
  }
  const offset = choices.length ? (state.date * 2 + state.time) % choices.length : 0
  return [...choices.slice(offset), ...choices.slice(0, offset)].slice(0, 2)
}

/** What the reader did this turn, off the request's own line for it. */
function actionOf(user: string): string {
  const lines = user.split('\n').filter((line) => line.startsWith("Reader's action:"))
  return lines.at(-1)?.slice("Reader's action:".length) ?? ''
}

/** Whether the scene has something else going on, and whether he wants games to come up often. */
function sceneTerms(): { busy: boolean; keen: boolean } {
  const scene = useGameStore.getState()
  return {
    busy: Boolean(scene.sceneClass || scene.sceneJob || scene.sceneProject),
    keen: optionOn(useModsStore.getState().switches, MINI_GAMES, SUGGEST_OFTEN)
  }
}

/** The girls he asked who are still in the scene, as the proposal's turn names them. */
function askedOf(charIds: readonly string[], cast: readonly Character[]): Asked[] {
  return cast
    .filter((member) => charIds.includes(member.charId))
    .map((member) => ({
      charId: member.charId,
      key: charKeyOf(member.firstName, member.lastName),
      name: nameOf(member.charId)
    }))
}

/** They said yes: the table is theirs to sit at once the reply is read, and skill is judged now. */
function agree(
  game: MiniGameDef,
  characters: readonly Character[],
  stake: string,
  options: Record<string, number>,
  location?: string | null
): void {
  useTableStore
    .getState()
    .setAgreed({ gameId: game.id, charIds: characters.map((c) => c.charId), stake, options, location })
  // Judged while the reader reads the answer, so the table opens with everyone ready.
  for (const character of characters) void skillOf(character, game)
}

registerHooks(MINI_GAMES, {
  statActivities: trainingSuggestions,
  slotActivityAvailable: trainingAvailable,
  scenePlay: { Seat: MiniGameSeat, Panel: MiniGamePanel },
  // A pack's page on the Mods screen: its games, and each one's own page.
  modDetail: (mod) => (MINI_GAMES_LIST.some((game) => game.modId === mod.id) ? PackPage : undefined),

  prompts: {
    // What a game just played has to say, on the one turn that reports it.
    scene: {
      lines: (ctx) => {
        const { played } = useTableStore.getState()
        return played && (played.next || ctx.query.includes(played.text))
          ? ['', ...played.brief, '']
          : []
      }
    }
  },

  requests: {
    scene: (request, ctx) => {
      requestedOffer = null
      // The turn that carries the reader's own proposal asks for her answer to it and nothing
      // else: its words are in what the request was built from, so a turn retried or rewound
      // never picks up a stale one.
      const { proposal } = useTableStore.getState()
      if (proposal && ctx.query.includes(proposal.text)) {
        const game = gameById(proposal.gameId)
        const asked = askedOf(proposal.charIds, ctx.cast)
        return game && asked.length > 0 ? withProposal(request, game, asked, scenePlace()) : request
      }
      // Every other turn the reader takes with a girl carries the standing offer. A scene's
      // closing is not one: it has no action of his, and nothing more is going to be played.
      if (!request.user.includes("Reader's action:")) return request
      // Nor is a screen with no seat to open a table from (the orientation, a created scene):
      // agreed there, a game would never start, and she would be set up for it turn after turn.
      if (!tableCanOpen(useGameStore.getState())) return request
      // Only the games a girl may bring up here are on it, and any his action names: the rest
      // are his to ask for from the table.
      const current = scenePlace()
      const invitation = keptInvitation()
      const action = actionOf(request.user)
      const destination = gamesNamed(MINI_GAMES_LIST, action).length ? destinationOf(action) : null
      const namedAnywhere = gamesNamed(MINI_GAMES_LIST, action)
      const followsInvite = invitation && (!namedAnywhere.length || namedAnywhere.some(game => game.id === invitation.gameId))
      const location = destination ?? (followsInvite ? invitation.location : current)
      const { busy, keen } = sceneTerms()
      const here = gamesWith(ctx.cast, location)
      const suggested = gamesSuggested(here, location, busy, keen)
      const named = gamesNamed(here, actionOf(request.user))
      const pending = invitation && invitation.location === location ? here.filter(game => game.id === invitation.gameId) : []
      const detailed = named.length > 0 || pending.length > 0
      const games = named.length ? named : pending.length ? pending : destination && destination !== current ? [] : suggested
      const outings = detailed ? [] : outingsWith(ctx.cast, current, busy, keen)
      if (games.length === 0 && outings.length === 0) return request
      const choices = [...games.map(game => ({ game, location })), ...outings]
      requestedOffer = { games, location, detailed, choices }
      if (!detailed) return withGameHints(request, games, location, busy, keen, outings)
      const contextual = pending.length && !named.length
        ? { ...request, user: request.user + `\nUnanswered invitation: ${pending[0].name}. The reader may accept, refuse, ask a question or change topic; judge their actual words.` }
        : request
      return withInvitationField(withOffer(contextual, games, ctx.cast, location, busy, keen, location !== current), games, choices)
    }
  },

  afterSceneReply: ({ reply, cast, ending }) => {
    const offered = requestedOffer
    requestedOffer = null
    const table = useTableStore.getState()
    table.setPlayed(null)
    if (sceneMiniGame()?.match?.status === 'result') clearMatch()
    keepInvitation(null)
    const invitation = reply.minigameInvite as { game?: unknown; location?: unknown } | undefined
    const invited = !ending && offered?.choices.find(choice => choice.game.id === invitation?.game &&
      (choice.location ?? '') === invitation?.location && gameIsOn(choice.game.modId, choice.game) &&
      (!choice.location || locationAvailable(choice.location)))
    if (invited) keepInvitation({ gameId: invited.game.id, location: invited.location })
    const { proposal } = table
    table.setProposal(null)

    if (proposal) {
      const game = gameById(proposal.gameId)
      if (!game) return
      // A girl who has left since is not asked; a yes from a scene that then ended is no game.
      const { accepted, charIds, stake, options } = answerOf(
        reply,
        game,
        askedOf(proposal.charIds, cast)
      )
      const characters = cast.filter((member) => charIds.includes(member.charId))
      if (accepted && !ending && characters.length > 0) agree(game, characters, stake, options)
      return
    }

    // No proposal of his own was out: the two of them may still have agreed in the scene.
    if (ending || !offered?.detailed || !tableCanOpen(useGameStore.getState())) return
    // The reply can only name a game its request offered: the field allows no other.
    const agreed = agreedOf(reply, offered?.games.filter(game => gameIsOn(game.modId, game)) ?? [], cast)
    if (agreed) agree(agreed.game, agreed.characters, agreed.stake, agreed.options, offered?.location)
  },

  // A turn the reader takes instead lets an agreed game go; his own proposal is not that turn.
  playerActs: () => useTableStore.getState().setAgreed(null),
  // Nothing in hand belongs to the game being entered. Its scene is not loaded yet, so whether
  // she had just agreed at the point it stands on is asked later, by the seat, at the reader's turn.
  gameEntered: () => {
    requestedOffer = null
    useTableStore.setState({ active: false })
    useTableStore.getState().setProposal(null)
    useTableStore.getState().dropAgreed()
    useTableStore.getState().setPlayed(null)
  },

  // A save taken at a table starts its match over; one taken after it goes on from the result.
  saveNote: (scene) => {
    const status = scene.miniGame?.match?.status
    if (status === 'playing') return 'Loading this save restarts the mini-game with the same players and settings.'
    return status === 'result' ? 'The mini-game result is saved. Loading continues after the match.' : null
  }
})

// In development a change to this file, or to anything it imports that is not a component, runs
// it again, and registering again stacks a second seat and a second set of hooks on the first.
// The page is reloaded instead, so there is only ever the one registration.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
