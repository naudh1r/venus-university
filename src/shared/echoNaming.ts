import type { EchoState } from './echo'

// Consonant-ended roots and bridges meet vowel-led endings. Mix shorter names
// with longer ceremonial sounds, without titles, English compounds or numbers.
const MYTH_ROOTS = [
  'Ael','Aeth','Aur','Azr','Bael','Bel','Cael','Cal',
  'Cyr','Daem','Draz','Eir','El','Eld','Elyr','Fael',
  'Fyr','Gael','Gal','Hael','Hel','Ilyr','Is','Ith',
  'Jael','Kael','Kal','Kyr','Lael','Lyr','Mael','Mal',
  'Myr','Nael','Ner','Nyx','Olyr','Or','Oth','Phael',
  'Pyr','Qir','Rael','Rhaz','Sael','Ser','Shael','Syl',
  'Tael','Tal','Thal','Thyr','Ul','Vael','Val','Vel',
  'Vyr','Xal','Xael','Zel','Ys','Zael','Zeph','Zyr'
] as const
const MYTH_BRIDGES = [
  'a','ad','al','an','ar','as','av','e',
  'ed','el','en','er','es','eth','ev','i',
  'il','in','ir','is','ith','iv','o','ol',
  'on','or','oth','ov','u','ul','un','ath'
] as const
const MYTH_ENDINGS = [
  'a','ae','ai','ael','aeth','ain','anor','anth',
  'ara','aris','ath','athiel','ava','axis','ean','el',
  'elis','en','enya','erion','eth','ethra','ia','ian',
  'iel','ion','ira','is','ith','iva','on','ora',
  'orin','oryn','oth','ouros','ua','uin','um','yra',
  'yr','yss','yth','ythe','une','ura','us','yx'
] as const

function nameRandom(seed:string):()=>number {
  let n=2166136261
  for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619)
  return ()=>{
    n=(n+0x6d2b79f5)|0
    let t=Math.imul(n^(n>>>15),n|1)
    t^=t+Math.imul(t^(t>>>7),t|61)
    return (t^(t>>>14))>>>0
  }
}

/** Shared by fresh assignments and dice. Keeps old saved names intact. */
export function mythicalEchoName(seed:string,used:ReadonlySet<string>):string {
  const random=nameRandom(seed)
  const join=(root:string,bridge:string,end:string):string=>(root+bridge+end).replace(/([aeiou])\1+/gi,'$1')
  const available=(name:string):boolean=>!used.has(name.toLowerCase())&&!/^(.{2,})\1$/i.test(name)
  for(let attempt=0;attempt<128;attempt++){
    const root=MYTH_ROOTS[random()%MYTH_ROOTS.length]
    const bridge=random()%4===0?'':MYTH_BRIDGES[random()%MYTH_BRIDGES.length]
    const name=join(root,bridge,MYTH_ENDINGS[random()%MYTH_ENDINGS.length])
    if(available(name))return name
  }
  // A heavily used save still receives a name, rather than a numbered duplicate.
  const total=MYTH_ROOTS.length*(MYTH_BRIDGES.length+1)*MYTH_ENDINGS.length,start=random()%total
  for(let offset=0;offset<total;offset++){
    let index=(start+offset)%total
    const end=MYTH_ENDINGS[index%MYTH_ENDINGS.length];index=Math.floor(index/MYTH_ENDINGS.length)
    const bridge=index%(MYTH_BRIDGES.length+1);index=Math.floor(index/(MYTH_BRIDGES.length+1))
    const name=join(MYTH_ROOTS[index],bridge?MYTH_BRIDGES[bridge-1]:'',end)
    if(available(name))return name
  }
  throw Error('Every suggested name has been used. Enter a name of your own.')
}

/** A free, local draft. Nothing is saved or regenerated until the player chooses to do so. */
export function suggestEchoName(state:EchoState,owner:string,seed:string,draft='',creatureType?:string):string {
  const identity=owner==='player'?state.player:state.girls[owner]
  if(!identity)throw Error('Choose an Echo to name.')
  const type=creatureType?.trim()||identity.creature?.type||String(identity.motif)
  const used=new Set([...state.usedNames,state.player?.name,...Object.values(state.girls).map(e=>e.name),draft].filter(Boolean).map(s=>s!.trim().toLowerCase()))
  return mythicalEchoName(`${seed}|${identity.aspect}|${type.toLowerCase()}`,used)
}

const CREATURE_ADJECTIVES = [
  'Opalescent', 'Antlered', 'Armored', 'Crystalline', 'Moonlit', 'Ember-veined',
  'Feathered', 'Coral-crowned', 'Jade-scaled', 'Silver-maned', 'Gilded', 'Moss-grown',
  'Iridescent', 'Storm-touched', 'Ivory-horned', 'Rose-thorned', 'Prismatic', 'Copper-plated',
  'Velvet-winged', 'Frost-crested', 'Sun-touched', 'Pearlescent', 'Rune-carved', 'Amethyst-eyed'
] as const
const CREATURE_TYPES = [
  'dragon', 'wyvern', 'griffin', 'basilisk', 'chimera', 'manticore', 'phoenix', 'hydra',
  'gargoyle', 'golem', 'leviathan', 'drake', 'kirin', 'sphinx', 'hippogriff', 'cockatrice',
  'serpent spirit', 'wolf guardian', 'stag spirit', 'moth guardian', 'fox spirit', 'crane spirit',
  'lion guardian', 'raven spirit', 'tiger spirit', 'owl guardian', 'koi dragon', 'mantis spirit',
  'turtle guardian', 'ram spirit', 'scorpion guardian', 'salamander spirit'
] as const

/** Local draft only; rerolling avoids the current field without changing any saved identity. */
export function suggestEchoCreature(seed:string,draft=''):string {
  let n=2166136261
  for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619)
  n>>>=0
  const combinations=CREATURE_ADJECTIVES.length*CREATURE_TYPES.length
  for(let offset=0;offset<combinations;offset++){
    const index=(n+offset)%combinations
    const suggestion=`${CREATURE_ADJECTIVES[index%CREATURE_ADJECTIVES.length]} ${CREATURE_TYPES[Math.floor(index/CREATURE_ADJECTIVES.length)]}`
    if(suggestion.toLowerCase()!==draft.trim().toLowerCase())return suggestion
  }
  return 'Opalescent dragon'
}

const NAME_IMAGERY: readonly [RegExp,string][] = [
  [/frost|ice|snow|rime|glaci/,'icy crystalline details, pale cool colors, and a breath of frost'],
  [/blaze|ember|cinder|flame|hearth|ash/,'warm ember colors, glowing markings, and flame-like tufts'],
  [/moon|lunar|night|dusk|shade|veil|hush/,'a moonlit palette, crescent shapes, and soft shadow markings'],
  [/star|comet|nova|sky|cloud/,'celestial markings, airy shapes, and a bright comet-like glow'],
  [/sun|dawn|gold|honey|glow/,'sunrise colors, radiant accents, and warm gold'],
  [/storm|thunder|volt|spark|gale/,'lightning-like markings, energetic tufts, and windswept shapes'],
  [/moss|fern|willow|root|oak|thorn|briar|bloom|rose/,'leaf, flower, bark, or thorn details that suit the specific name'],
  [/tide|ripple|river|coral|pearl/,'aquatic shapes, pearlescent accents, and wave-like markings'],
  [/opal|prism|glass|shard|crystal|gem|ruby/,'faceted surfaces and luminous gemstone details'],
  [/stone|iron|granite|flint|copper|aegis/,'sturdy plates and mineral or metallic accents'],
  [/wing|plume|feather|moth|flutter/,'a distinctive wing or feather silhouette'],
  [/fang|talon|claw|razor/,'a readable tooth or claw motif in an expressive creature design'],
  [/paw|fox|whisk|tail/,'expressive beast paws, whiskers, or a distinctive tail silhouette'],
  [/rune|relic|sage/,'subtle ancient ornament expressed as shapes, without readable text']
]

/** Name-derived art direction is independent of the immutable aspect and existing artwork. */
export function echoNameVisualCues(name:string):string {
  const cues=NAME_IMAGERY.filter(([pattern])=>pattern.test(name.toLowerCase())).slice(0,4).map(([,cue])=>cue)
  return cues.length ? cues.join(', ') : /[aeiouy]$/i.test(name.trim()) ? 'graceful flowing silhouette' : 'bold angular silhouette'
}
export function echoNameArtDirection(name:string):string {
  const cues=NAME_IMAGERY.filter(([pattern])=>pattern.test(name.toLowerCase())).slice(0,4).map(([,cue])=>cue)
  return cues.length
    ? `The chosen name suggests ${cues.join('; ')}. Use those ideas as visible design details, blended with the Echo's aspect and the owner's story.`
    : 'Use the sound and mood of this chosen name to shape the creature: soft and flowing names can suggest rounded, graceful forms; sharp, forceful names can suggest angular, bold forms. Treat this as an artistic interpretation, not a claim about the name’s real-world meaning.'
}
