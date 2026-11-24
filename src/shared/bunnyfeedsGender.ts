import type { Character } from '@vx/modkit/shared'

/** The words a sentence about one character takes, by their gender; absent means female. */
export interface FeedPronouns {
  /** she / he */
  they: string
  /** She / He */
  They: string
  /** her / him */
  them: string
  /** her / his */
  their: string
  /** Her / His */
  Their: string
}

const FEMALE: FeedPronouns = { they: 'she', They: 'She', them: 'her', their: 'her', Their: 'Her' }
const MALE: FeedPronouns = { they: 'he', They: 'He', them: 'him', their: 'his', Their: 'His' }

/** A character's pronouns, read off their record. */
export function feedPronounsOf(character: Pick<Character, 'gender'> | null | undefined): FeedPronouns {
  return character?.gender === 'male' ? MALE : FEMALE
}
