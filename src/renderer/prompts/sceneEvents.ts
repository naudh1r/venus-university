import type { SceneEventId } from '@shared/sceneEvents'
import { itemDefOf } from '@shared/shop'
import type { ReceivedGift, SceneEvent, Season, TimeSlot } from '@shared/types'
import { monthOf } from './gameDate'

/**
 * The words a scene's curveball and a girl's present are put to the writer in: one line each,
 * in the opening call's `YOUR TURN` alone.
 */

/** November through March, when it is the heating rather than the AC that breaks. */
const COLD_MONTHS: readonly number[] = [10, 11, 0, 1, 2]

/** When the event happens: the day half and the month it falls in. */
interface EventMoment {
  date: number
  time: TimeSlot
  season: Season
}

/** One event as a sentence, `who` the charKey of the girl it happens to. */
function eventSentence(id: SceneEventId, who: string, at: EventMoment): string {
  switch (id) {
    case 'herAsleep':
      return `${who} invited the reader over, but she's fast asleep when he gets there.`
    case 'herShowering':
      return `${who} is in the shower when the reader gets there.`
    case 'herMasturbating':
      return `The reader walks in on ${who} masturbating.`
    case 'herBug':
      return `There's a spider or some big bug in ${who}'s room when the reader gets there.`
    case 'herRomance':
      return `${who} has set up a romantic ${at.time === 1 ? 'evening' : 'afternoon'} for the reader.`
    case 'herLockedOut':
      return `${who} has locked herself out of her room and is stuck in the hall when the reader gets there.`
    case 'hisDrinks':
      return at.time === 1
        ? `${who} shows up with something to drink, or takeout if she doesn't drink.`
        : `${who} shows up with takeout for the two of them.`
    case 'hisLate':
      return `${who} shows up really late.`
    case 'hisUpset':
      return `${who} shows up upset after a really bad day.`
    case 'mealFire':
      return `The reader arrives to find that ${who} has started a small kitchen fire while cooking.`
    case 'mealMissingIngredient':
      return `Halfway through cooking, ${who} realizes she's missing an ingredient.`
    case 'mealInjury':
      return `The reader arrives to find that ${who} has hurt herself while she's cooking.`
    case 'mealDisaster':
      return `The meal ${who} cooks turns out terrible.`
    case 'strayCat':
      return 'A stray cat wanders into the scene.'
    case 'strayDog':
      return 'A stray dog wanders into the scene.'
    case 'lostChild':
      return "There's a lost child who can't find their parents."
    case 'heartAttack':
      return 'A stranger nearby collapses from a heart attack.'
    case 'lostWallet':
      return `${who} finds a lost wallet.`
    case 'hitOn':
      return `A stranger hits on ${who}.`
    case 'noUmbrella':
      return `${who} realizes she forgot her umbrella.`
    case 'drenched':
      return `${who} shows up soaked from the rain.`
    case 'noHomework':
      return `${who} forgot her homework for today's class.`
    case 'noMaterials':
      return `${who} forgot something she needs for today's class.`
    case 'asleepInClass':
      return `${who} dozes off in the middle of class.`
    case 'badGrade':
      return `${who} just got back a bad grade.`
    case 'lateToClass':
      return `${who} shows up very late to class.`
    case 'classCancelled':
      return 'The professor cancels class at the last second.'
    case 'peInjury':
      return `${who} hurts herself during class.`
    case 'peWardrobe':
      return `${who} has a wardrobe malfunction during class.`
    case 'periodAccident':
      return `${who} has a period accident.`
    case 'hungover':
      return `${who} is badly hungover, or if she doesn't drink, has a debilitating migraine.`
    case 'injury':
      return `${who} hurts herself somehow.`
    case 'wardrobe':
      return `${who} has a wardrobe malfunction.`
    case 'powerOut':
      return 'The power goes out.'
    case 'brokenAc':
      return COLD_MONTHS.includes(monthOf(at.date, at.season))
        ? "The heating is broken and it's freezing."
        : "The AC is broken and it's sweltering."
    case 'wifiOut':
      return 'The campus wifi goes down.'
    case 'lostPhone':
      return `${who} can't find her phone.`
    case 'hiccups':
      return `${who} gets the hiccups and can't stop.`
  }
}

/**
 * The opening's lines for the scene's curveball and her present, `keyOf` naming a girl the way
 * the cast block does; nothing for a girl no longer in the cast or an item no longer sold.
 */
export function openingEventLines(
  event: SceneEvent | undefined,
  gift: ReceivedGift | undefined,
  keyOf: (charId: string) => string | null,
  at: EventMoment
): string[] {
  const lines: string[] = []
  const who = event?.charId ? keyOf(event.charId) : ''
  if (event && who !== null) {
    lines.push(
      `Extra scene info: ${eventSentence(event.id, who, at)}`
    )
  }
  const giver = gift ? keyOf(gift.charId) : null
  const item = gift ? itemDefOf(gift.itemId) : undefined
  if (giver && item) {
    lines.push(
      `${giver} has a present for the reader: the ${item.name}. ${item.description}`
    )
  }
  return lines
}
