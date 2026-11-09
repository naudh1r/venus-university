/** Declarative extension points. Packs are compiled source modules, never downloaded scripts. */
export type TalentEffect = 'wageRate' | 'streakCash' | 'shopDiscount' | 'thirdPurchaseDiscount' |
  'savingsAccess' | 'savingsRate' | 'savingsCap' | 'matchingBonus' | 'competingRelief' |
  'neutralBonus' | 'spiritRate' | 'matchingSpirit' | 'echoDiscount' | `${string}.${string}`
export interface TalentDef {
  /** Stable and unique across packs. Prefix new ids with your pack id. */
  id: string
  tree: string
  chain: string
  name: string
  description: string
  /** Optional guidance for this skill only, displayed in its selected details. */
  notes?: readonly string[]
  costs: readonly number[]
  prerequisites?: readonly {id:string; rank:number}[]
  /** At least one of these ranks is required, in addition to all prerequisites above. */
  prerequisitesAny?: readonly {id:string; rank:number}[]
  /** One shared ability below the branches of a tree. */
  capstone?: boolean
  /** Available from the panel header, without taking a card slot in its home tree. */
  shared?: boolean
  requires?: readonly string[]
  /** Total effect at each rank, not an increment to add every time the save loads. */
  effects?: Partial<Record<TalentEffect, readonly number[]>>
}
export interface TalentTreeDef { id:string; name:string; description:string }
export interface TalentPack {
  id:string
  name:string
  author:string
  trees:readonly TalentTreeDef[]
  skills:readonly TalentDef[]
}
export const TALENT_EFFECTS: readonly TalentEffect[] = ['wageRate','streakCash','shopDiscount','thirdPurchaseDiscount','savingsAccess','savingsRate','savingsCap','matchingBonus','competingRelief','neutralBonus','spiritRate','matchingSpirit','echoDiscount']
