import { ECHO_ASPECTS, type EchoAspect } from './echoAspects'

export interface EchoReasonExample {
  source: 'Backstory' | 'Personality' | 'Bio'
  quote: string
  connection: string
  supportsType: boolean
}
export interface EchoProfilePart { label: string; text: string; weight: number }

const VOICE:Record<EchoAspect,{intro:string;link:string}>={
  horizonbound:{intro:'Horizonbound fits someone who needs room to explore and is always wondering what comes next.',link:'That pull toward something new is what gives Horizonbound its restless spirit.'},
  stoneward:{intro:'Stoneward fits someone others can lean on: steady, responsible, and willing to hold things together.',link:'Showing up and taking responsibility is the heart of Stoneward.'},
  sparkweaver:{intro:'Sparkweaver fits someone who wants to make things, try ideas, and see what might work.',link:'That curiosity and urge to create are what Sparkweaver is all about.'},
  lorekeeper:{intro:'Lorekeeper fits someone who finds value in what people have learned and passed down.',link:'Learning from the past and keeping its lessons alive is a very Lorekeeper quality.'},
  veilkeeper:{intro:'Veilkeeper fits someone who notices more than they let on and keeps part of themselves private.',link:'That watchful, private side is why Veilkeeper feels like a good fit.'},
  daylark:{intro:'Daylark fits someone whose warmth and energy tend to spill into the room around them.',link:'That open, lively side is what Daylark brings out.'},
  hearthwarden:{intro:'Hearthwarden fits someone who makes other people feel cared for and safe.',link:'That care for others is the heart of Hearthwarden: making sure someone has a place to feel safe.'},
  wildspark:{intro:'Wildspark fits someone who follows their desires and wants to live on their own terms.',link:'That appetite for life gives Wildspark its fire.'},
  heartthread:{intro:'Heartthread fits someone who puts a lot of themselves into the people they love.',link:'That need for closeness is what ties this to Heartthread.'},
  quietdrift:{intro:'Quietdrift fits someone who needs space to think and a life that still feels like their own.',link:'That independent streak is where Quietdrift fits.'},
  trailblazer:{intro:'Trailblazer fits someone who wants to get somewhere and is willing to work for it.',link:'That drive to move forward is what Trailblazer is built around.'},
  dreamglass:{intro:'Dreamglass fits someone with a rich inner world who sees possibilities other people might miss.',link:'That imaginative side gives Dreamglass its shape.'},
  ironbloom:{intro:'Ironbloom fits someone with a quiet kind of strength: patient, resilient, and hard to wear down.',link:'That steady strength is what makes Ironbloom feel right.'},
  riftcaller:{intro:'Riftcaller fits someone who pushes back when something feels wrong or too restrictive.',link:'That refusal to simply accept things is the spark behind Riftcaller.'},
  tidewalker:{intro:'Tidewalker fits someone who can change course without losing their footing.',link:'Finding a way through change is what Tidewalker does best.'},
  oathkeeper:{intro:'Oathkeeper fits someone who takes their promises and principles seriously.',link:'That sense of what matters, and the wish to stand by it, belongs with Oathkeeper.'},
  farwatcher:{intro:'Farwatcher fits someone who likes to understand the situation before making a move.',link:'That habit of thinking ahead is what Farwatcher captures.'},
  stormchaser:{intro:'Stormchaser fits someone who follows an impulse and is willing to take a chance.',link:'That attraction to risk and excitement is what gives Stormchaser its energy.'},
  ashwing:{intro:'Ashwing fits someone drawn to a fresh start and the chance to become someone new.',link:'That wish to begin again is the heart of Ashwing.'},
  rootsong:{intro:'Rootsong fits someone whose home, community, or familiar bonds matter deeply.',link:'That sense of belonging is what Rootsong holds onto.'},
  dawnmender:{intro:'Dawnmender fits someone who still sees room for healing, forgiveness, or another chance.',link:'That hope for things to get better is what Dawnmender represents.'},
  thornheart:{intro:'Thornheart fits someone who protects themselves carefully because trust does not come easily.',link:'That guarded side is what Thornheart captures. It does not mean someone has to stay that way.'}
}

/** Match the same explicit cues used by the assignment, excluding simple negations. */
export function echoProfileCues(value:string,words:string):string[]{
  const tokens=value.toLowerCase().replaceAll('’',"'").match(/[a-z]+(?:-[a-z]+)?/g)??[]
  return [...new Set(words.split(' '))].filter(cue=>tokens.some((token,i)=>{
    const match=token===cue||(cue.length>=5&&token.startsWith(cue)&&/^(s|es|ed|ing|ness|ly)$/.test(token.slice(cue.length)))
    return match&&!tokens.slice(Math.max(0,i-3),i).some(t=>['not','never','isn','isnt','wasn','wasnt','without'].includes(t))
  }))
}

/** Quotes are taken from the saved profile, never invented by the explanation. */
export function explainEchoAspect(id:EchoAspect,parts:EchoProfilePart[],chosen=false):{reason:string;reasonExamples:EchoReasonExample[];reasonVersion:2}{
  const aspect=ECHO_ASPECTS.find(a=>a.id===id)!
  const examples:EchoReasonExample[]=[]
  for(const label of ['backstory','personality','bio']){
    const part=parts.find(p=>p.label===label)
    if(!part?.text.trim())continue
    const sentences=(part.text.match(/[^.!?\n]+(?:[.!?]+["”']?|$)/g)??[part.text]).map(s=>s.trim()).filter(Boolean)
    const scored=sentences.map((sentence,index)=>({sentence,index,cues:echoProfileCues(sentence,aspect.words)}))
    const matching=scored.filter(s=>s.cues.length).sort((a,b)=>b.cues.length-a.cues.length||a.index-b.index)
    // Backstory is shown first; if it has no direct cue, present context without pretending it proves a fit.
    const picks=matching.length?matching.slice(0,label==='backstory'?2:1):label==='backstory'?scored.slice(0,1):[]
    for(const pick of picks){
      const supportsType=pick.cues.length>0
      // Keep a verbatim excerpt around the relevant cue when a sentence is unusually long.
      let quote=pick.sentence
      if(quote.length>440){
        const anchor=supportsType?quote.toLowerCase().indexOf(pick.cues[0]):0
        const start=Math.max(0,anchor-100),end=Math.min(quote.length,start+420)
        quote=(start?'…':'')+quote.slice(start,end)+(end<quote.length?'…':'')
      }
      examples.push({source:label==='backstory'?'Backstory':label==='bio'?'Bio':'Personality',quote,supportsType,
        connection:supportsType
          ? VOICE[id].link
          : `This gives a little background. On its own, it doesn’t tell us much about why ${aspect.name} fits.`})
    }
  }
  const supports=examples.filter(e=>e.supportsType)
  let reason=VOICE[id].intro+' '
  if(chosen)reason+='This one was your choice. Here are the parts of your story that might speak to it.'
  else if(supports.some(e=>e.source==='Backstory'))reason+='You can see a little of that in the moments below.'
  else if(supports.length)reason+=parts.some(p=>p.label==='backstory')?'The fit is easier to see in her personality than in her past.':'The details below are what point your Echo in this direction.'
  else reason+='This is a loose fit; there isn’t much in the available story that points toward it.'
  return {reason,reasonExamples:examples.slice(0,4),reasonVersion:2}
}
