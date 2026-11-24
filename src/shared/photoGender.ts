import type { Character } from '@vx/modkit/shared'

export type PhotoGender = 'female' | 'male'

const PRONOUNS = {
  female: {
    they: 'she',
    them: 'her',
    their: 'her',
    theirs: 'hers',
    themself: 'herself',
    They: 'She',
    Them: 'Her',
    Their: 'Her',
    Theirs: 'Hers',
    Themself: 'Herself'
  },
  male: {
    they: 'he',
    them: 'him',
    their: 'his',
    theirs: 'his',
    themself: 'himself',
    They: 'He',
    Them: 'Him',
    Their: 'His',
    Theirs: 'His',
    Themself: 'Himself'
  }
} as const

export function genderOf(character?: Pick<Character, 'gender'> | null): PhotoGender {
  return character?.gender === 'male' ? 'male' : 'female'
}

export function pronounsOf(character?: Pick<Character, 'gender'> | null) {
  return PRONOUNS[genderOf(character)]
}

export function fillPronouns(template: string, gender: PhotoGender): string {
  const words = PRONOUNS[gender]
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.hasOwn(words, key) ? words[key as keyof typeof words] : token
  )
}

/** Shared caption cues use one spelling; the caption sent to the image model stays untouched. */
export function photoRuleText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bhimself\b/g, 'herself')
    .replace(/\b(?:his|him)\b/g, 'her')
    .replace(/\bhe\b/g, 'she')
}

export function photoSubject(character: Pick<Character, 'gender'>): string[] {
  return genderOf(character) === 'male'
    ? ['1boy', 'male_focus', 'mature_male']
    : ['1girl', 'mature_female']
}

/** Positive anatomy from a saved appearance cannot override the character's gender. */
export function genderedTags(tags: readonly string[], gender: PhotoGender): string[] {
  return tags.filter((tag) => {
    const plain = tag
      .replace(/^\((.*):[\d.]+\)$/, '$1')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
    if (gender === 'male') {
      return (
        !/^(?:\d+girls?|multiple_girls|female|mature_female|muscular_female|tall_female|female_pubic_hair|curvy)$/.test(
          plain
        ) &&
        !/(?:^|_)(?:breasts?|pussy|vagina|vaginal|clitoris|areolae?|female_ejaculation)(?:_|$)/.test(
          plain
        )
      )
    }
    return (
      !/^(?:\d+boys?|multiple_boys|male_focus|mature_male|muscular_male|tall_male|male_pubic_hair|pectorals)$/.test(
        plain
      ) && !/(?:^|_)(?:penis|testicles)(?:_|$)/.test(plain)
    )
  })
}
