import { trainingSuggestions, trainingAvailable, pendingTraining } from '../minigames/training'
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
import { agreedOf, withOffer, withGameHints, withInvitationField } from '../minigames/offer'
import { gameComponent } from '../minigames/play'
import { answerOf, withProposal, type Asked } from '../minigames/proposal'
import { keepInvitation, keptInvitation, useTableStore } from '../minigames/session'
import { skillOf } from '../minigames/skill'
import { gameIsOn, nameOf } from '../minigames/table'
import { registerHooks } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { useModsStore } from '../stores/modsStore'
import { destinationOf, scenePlace } from '../minigames/place'

// The exact catalogue supplied to this request, not a venue projected from unread reply lines.
let requestedOffer: { games: MiniGameDef[]; location: string | null; detailed: boolean } | null = null

/** The games a girl in this scene could be played at, each with a component to play it with. */
function gamesWith(cast: readonly Character[], location: string | null): MiniGameDef[] {
  if (cast.length === 0) return []
  const training = pendingTraining()
  return gamesOffered({ location: training?.location ?? location, girls: cast.length }, gameIsOn)
    .filter(game => !training || game.id === training.id)
    .filter((game) => game.players.max >= 1 && Boolean(gameComponent(game.id)))
    .map(tunedGame)
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
      // Only the games a girl may bring up here are on it, and any his action names: the rest
      // are his to ask for from the table.
      const current = scenePlace()
      const invitation = keptInvitation()
      const action = actionOf(request.user)
      const destination = gamesNamed(MINI_GAMES_LIST, action).length ? destinationOf(action) : null
      const location = destination ?? current
      const { busy, keen } = sceneTerms()
      const here = gamesWith(ctx.cast, location)
      const suggested = gamesSuggested(here, location, busy, keen)
      const named = gamesNamed(here, actionOf(request.user))
      const pending = invitation?.location === current ? here.filter(game => game.id === invitation.gameId) : []
      const detailed = named.length > 0 || pending.length > 0
      const games = named.length ? named : pending.length ? pending : destination && destination !== current ? [] : suggested
      if (games.length === 0) return request
      requestedOffer = { games, location, detailed }
      if (!detailed) return withGameHints(request, games, location, busy, keen)
      const contextual = pending.length && !named.length
        ? { ...request, user: request.user + `\nUnanswered invitation: ${pending[0].name}. The reader may accept, refuse, ask a question or change topic; judge their actual words.` }
        : request
      return withInvitationField(withOffer(contextual, games, ctx.cast, location, busy, keen, location !== current), games)
    }
  },

  afterSceneReply: ({ reply, cast, ending }) => {
    const offered = requestedOffer
    requestedOffer = null
    const table = useTableStore.getState()
    table.setPlayed(null)
    keepInvitation(null)
    const invited = !ending && offered?.games.find(game => game.id === reply.minigameInvite && gameIsOn(game.modId, game))
    if (invited) keepInvitation({ gameId: invited.id, location: offered?.location ?? null })
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
    if (ending || !offered?.detailed) return
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
    useTableStore.getState().setProposal(null)
    useTableStore.getState().dropAgreed()
    useTableStore.getState().setPlayed(null)
  }
})

// In development a change to this file, or to anything it imports that is not a component, runs
// it again, and registering again stacks a second seat and a second set of hooks on the first.
// The page is reloaded instead, so there is only ever the one registration.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
