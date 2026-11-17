/** Keep a character's private words in their own voice without inventing a replacement belief. */
export function firstPersonThought(raw:string,name:string):string|null {
 const original=raw.trim().replace(/^[“"]([\s\S]+)[”"]$/,'$1').trim()
 // Existing first-person references identify the speaker; an opening pronoun
 // describes somebody else and must not be repaired into the narrator.
 if(/^(?:she|he|they|her|his|their)\b/i.test(original)&&/\b(?:I|me|my|mine|myself)\b/i.test(original))return original
 let words=original
 const escape=(s:string):string=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 const names=[...new Set([name.trim(),name.trim().split(/\s+/)[0]])].filter(Boolean).sort((a,b)=>b.length-a.length).map(escape)
 const owner=names.length?`(?:${names.join('|')})`:null
 const verbs:Record<string,string>={
  believes:'believe', believe:'believe',
  thinks:'think', think:'think',
  feels:'feel', feel:'feel',
  fears:'fear', fear:'fear',
  worries:'worry', worry:'worry',
  knows:'know', know:'know',
  assumes:'assume', assume:'assume',
  expects:'expect', expect:'expect',
  needs:'need', need:'need',
  wants:'want', want:'want',
  has:'have', have:'have',
  is:'am', are:'am',
  was:'was', were:'was',
  can:'can', cannot:'cannot',
  will:'will', must:'must',
  should:'should',
 }
 const subject=owner?`(?:${owner}|she|he|they)`:'(?:she|he|they)'
 // Repair only unambiguous narrator openings. Pronouns elsewhere can refer to
 // somebody else in a memory and must retain their original meaning.
 words=words.replace(new RegExp(`^${subject}\\s+(${Object.keys(verbs).join('|')})\\b`,'i'),(_match,verb:string)=>`I ${verbs[verb.toLowerCase()]}`)
 if(owner)words=words.replace(new RegExp(`^${owner}['’]s\\s+`,'i'),'My ')
 const narratorLead=new RegExp(`^(?:${subject}\\b|her\\b|his\\b|their\\b)`,'i')
 if(narratorLead.test(words))return null
 // Names can also be ordinary words (May, Hope, Grace). Within a first-person
 // sentence, reject clear owner narration rather than every matching word.
 if(owner&&new RegExp(`\\b${owner}(?:['’]s\\b|\\s+(?:${Object.keys(verbs).join('|')})\\b)`).test(words))return null
 if(!/\b(?:I|me|my|mine|myself)\b/i.test(words))return null
 // A repaired opening with ambiguous remaining third-person references is safer
 // to skip than to reinterpret. A direct first-person challenge can be used instead.
 if(words!==original&&/\b(?:she|her|hers|herself|he|him|his|himself|they|them|their|theirs|themself|themselves)\b/i.test(words))return null
 return words
}
