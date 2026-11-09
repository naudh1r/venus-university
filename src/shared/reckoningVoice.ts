/** Keep her private words in her own voice without inventing a replacement belief. */
export function firstPersonThought(raw:string,name:string):string|null {
 const original=raw.trim().replace(/^[“"]([\s\S]+)[”"]$/,'$1').trim()
 let words=original
 const escape=(s:string):string=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 const names=[...new Set([name.trim(),name.trim().split(/\s+/)[0]])].filter(Boolean).sort((a,b)=>b.length-a.length).map(escape)
 const owner=names.length?`(?:${names.join('|')})`:null
 const verbs:Record<string,string>={believes:'believe',thinks:'think',feels:'feel',fears:'fear',worries:'worry',knows:'know',assumes:'assume',expects:'expect',needs:'need',wants:'want',has:'have',is:'am',was:'was',can:'can',cannot:'cannot',will:'will',must:'must',should:'should'}
 const subject=owner?`(?:${owner}|she)`:'she'
 // Only unambiguous narrator openings are repaired. Never globally swap she/her:
 // those might refer to somebody else in a memory, and "her" may be object or possessive.
 words=words.replace(new RegExp(`^${subject}\\s+(${Object.keys(verbs).join('|')})\\b`,'i'),(_match,verb:string)=>`I ${verbs[verb.toLowerCase()]}`)
 if(owner)words=words.replace(new RegExp(`^${owner}['’]s\\s+`,'i'),'My ')
 const narratorLead=new RegExp(`^(?:${subject}\\b|her\\b)`,'i')
 if(narratorLead.test(words))return null
 // Names can also be ordinary words (May, Hope, Grace). Within a first-person
 // sentence, reject clear owner narration rather than every matching word.
 if(owner&&new RegExp(`\\b${owner}(?:['’]s\\b|\\s+(?:${Object.keys(verbs).join('|')})\\b)`).test(words))return null
 if(!/\b(?:I|me|my|mine|myself)\b/i.test(words))return null
 // A repaired opening with ambiguous remaining third-person references is safer
 // to skip than to reinterpret. A direct first-person challenge can be used instead.
 if(words!==original&&/\b(?:she|her|hers|herself)\b/i.test(words))return null
 return words
}
