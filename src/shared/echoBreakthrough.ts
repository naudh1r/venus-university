import type { EchoAspect } from './echoAspects'

/** Complete aspect catalog. Pure data so future ports only need the Breakthrough adapter. */
export const ECHO_BREAKTHROUGH_OPTION = 'breakthrough-abilities'
export const ECHO_BREAKTHROUGH_ABILITIES = {
  horizonbound: {
    cost:50,
    balance:"Opens a new direction without directly changing feelings.",
    name:'Open Horizon',
    summary:'See an overlooked possibility and create an opening for a new shared experience.',
    scope:'Selected character',
    action:'I look beyond our usual pattern and invite a new possibility between us.',
    instruction:'Reveal one overlooked but plausible opportunity in the current situation: a fresh way to connect, approach a problem, or suggest a shared experience. Anchor it in the established location, conversation and available people or activities. Make the opening concrete and available for the reader to accept or decline. Do not invent a guaranteed future, teleport the scene, fabricate resources, or make either person accept an invitation automatically.'
  },
  stoneward: {
    cost:25,
    balance:"Practical reassurance rather than emotional persuasion.",
    name:'Steady Ground',
    summary:'Turn uncertainty into a clear, dependable next step you can take together.',
    scope:'Selected character',
    action:'I offer to shoulder one practical responsibility and help us find solid ground.',
    instruction:'Create one concrete source of stability in this exchange: a manageable plan, a clear division of responsibility, or a practical precaution the reader can actually offer. Let the selected character assess it and decide her own part. Show how clarity makes the immediate situation less uncertain. Do not assume authority over her, invent resources, remove real dangers, or guarantee that a future promise will be kept.'
  },
  sparkweaver: {
    cost:25,
    balance:"A useful idea helps the situation more than it sways the person.",
    name:'Bright Invention',
    summary:'Find a clever new use for what is already at hand.',
    scope:'Selected character',
    action:'I put an unexpected idea on the table and invite her to help me try it.',
    instruction:'Offer a specific, inventive workaround for something in the current scene, using established surroundings, objects or skills. Let the reader and selected character try or refine the idea together. The breakthrough is a workable experiment rather than sudden mastery. Do not conjure equipment, grant technical knowledge they lack, skip the work, or declare an untested invention successful.'
  },
  lorekeeper: {
    cost:25,
    balance:"Advice offers perspective while leaving the conversation largely intact.",
    name:'Thread of Wisdom',
    summary:'Bring a useful lesson or familiar practice to bear on the present problem.',
    scope:'Selected character',
    action:'I look for a lesson worth keeping and ask how we might use it here.',
    instruction:'Connect the current situation to one established lesson, familiar practice or ordinary piece of knowledge the reader or selected character plausibly has. Make the lesson useful through a concrete suggestion, demonstration or question in this exchange. If no past lesson is established, use common knowledge or let her offer one voluntarily. Do not fabricate shared memories, hidden expertise or a tradition that demands obedience.'
  },
  veilkeeper: {
    cost:75,
    balance:"Revealing insight can substantially reframe an exchange.",
    name:'Read Between the Lines',
    summary:'Notice a revealing detail and gain an unusual intuition about the present situation.',
    scope:'Selected character',
    action:'I slow down and pay attention to what her words and reactions leave unsaid.',
    instruction:'Give the reader one specific, useful observation: a hesitation, contradiction, glance, tone, or environmental detail that clarifies this situation. Connect it to established scene evidence. Distinguish an intuition from a confirmed fact, and allow a natural way to test it through conversation. Do not invent secrets, reveal unrelated private backstory, grant omniscience, or describe someone else\'s unspoken thoughts as something the reader knows.'
  },
  daylark: {
    cost:50,
    balance:"A shared mood lift can loosen a conversation without forcing candor.",
    name:'Shared Sunshine',
    summary:'Brighten the room with a moment of sincere appreciation or shared delight.',
    scope:'Everyone present',
    action:'I point out something worth enjoying and invite everyone into the moment.',
    instruction:'Create a specific chance for shared delight among people actually present: an honest compliment, a harmless amusing observation, or appreciation of something already happening. Let different personalities respond differently, including quietly or cautiously. The opening should make participation feel welcome, not obligatory. Do not mock someone to entertain the group, erase grief or conflict, or force everyone into a cheerful mood.'
  },
  hearthwarden: {
    cost:25,
    balance:"Gentle comfort lowers pressure without asking for a change of heart.",
    name:'Safe Harbor',
    summary:'Offer practical comfort and a little room to feel at ease.',
    scope:'Selected character',
    action:'I notice what might make this easier for her and offer a small, practical kindness.',
    instruction:'Find one immediate, credible way to make the selected character more comfortable: an offered seat, a gentler pace, help with a task, or a choice about what happens next, as the scene permits. Show attentive care without demanding closeness in return. She may accept, adapt or decline. Do not declare a dangerous place safe, assume touch is welcome, compel disclosure, or treat kindness as a debt.'
  },
  wildspark: {
    cost:75,
    balance:"Greater candor across everyone present can shift the whole conversation.",
    name:'Unbound Moment',
    summary:'Loosen social inhibitions so everyone present becomes more candid and spontaneous.',
    scope:'Everyone present',
    action:'I take a playful risk and invite everyone here to speak a little more freely.',
    instruction:'For this response, ease social self-consciousness among the reader and people actually present. Let them speak more candidly or act more spontaneously than usual in ways that fit each individual. Include a tangible shift in the conversation; avoid identical reactions. This is a brief opening, not a personality rewrite. Keep judgment, willingness and boundaries intact; nobody is compelled to disclose a secret, consent, or pursue intimacy. Absent people are unaffected.'
  },
  heartthread: {
    cost:75,
    balance:"Mutual vulnerability creates a strong opening for emotional connection.",
    name:'Shared Understanding',
    summary:'Create an opening for honest vulnerability and a deeper, mutual connection.',
    scope:'Selected character',
    action:'I share something honest and try to understand what this moment feels like for her.',
    instruction:'Create a concrete moment of mutual understanding between the reader and the selected character. Let one express a feeling, need or concern and the other recognize it accurately. Use what their shared history and current trust make plausible; vulnerability can be small. Do not manufacture a shared memory, force affection or disclosure, erase a disagreement, or instantly change relationship status. Leave room for their own choices after this exchange.'
  },
  quietdrift: {
    cost:25,
    balance:"Space and silence ease pressure rather than drive an outcome.",
    name:'Room to Breathe',
    summary:'Ease the pressure to perform, explain yourself, or fill every silence.',
    scope:'Selected character',
    action:'I ease off the pressure and leave us room for a quiet, unhurried moment.',
    instruction:'Create a useful pause in the social demands of this exchange. Let the reader or selected character take a breath, set their own pace, or share comfortable silence without it being treated as rejection. Offer a concrete choice to continue, change the subject or take space. Do not automatically end the scene, make her leave, remove established obligations, or portray distance as guaranteed intimacy.'
  },
  trailblazer: {
    cost:50,
    balance:"Turns discussion into a concrete next action.",
    name:'First Step',
    summary:'Turn a shared intention into one meaningful step forward.',
    scope:'Selected character',
    action:'I stop circling the idea and offer a concrete first step we can take now.',
    instruction:'Move an established goal from talk toward one attainable action in the current exchange. Make the first step specific, use abilities and resources already available, and leave the selected character free to participate or suggest a different step. Show actual limited progress if the action is taken. Do not complete an entire project instantly, guarantee victory, award stats, or substitute the reader\'s goal for hers.'
  },
  dreamglass: {
    cost:50,
    balance:"An imaginative question can draw out aspirations and change the subject.",
    name:'What If',
    summary:'Use a vivid possibility to discover what you both might want.',
    scope:'Selected character',
    action:'I offer a playful what-if and ask what she would make of it.',
    instruction:'Open an imaginative but clearly hypothetical possibility connected to the current conversation. Use a vivid image, a creative scenario or a small shared invention to invite the selected character to express a wish or perspective she chooses to share. Keep imagined details distinct from the real scene. Do not invent memories, turn a fantasy into a commitment, reveal private thoughts without dialogue, or make hypothetical events actually happen.'
  },
  ironbloom: {
    cost:25,
    balance:"Steadiness supports the reader without strongly steering the other person.",
    name:'Unshaken',
    summary:'Meet a difficult moment with quiet courage and patient resolve.',
    scope:'Selected character',
    action:'I take a breath, stay present, and make one honest effort without pushing her.',
    instruction:'Give the reader a grounded opening to remain composed through a real awkwardness, setback or difficult feeling in this scene. Show quiet courage through one patient action or candid admission, making it possible to continue constructively with the selected character. If no setback exists, use the courage needed for a sincere next step rather than inventing conflict. Do not erase pain, make persistence override a refusal, or guarantee that endurance wins affection.'
  },
  riftcaller: {
    cost:75,
    balance:"Challenging the premise can turn a stuck conversation in a new direction.",
    name:'Break the Pattern',
    summary:'Challenge an unhelpful assumption and open a different way to respond.',
    scope:'Selected character',
    action:'I question the pattern we have fallen into and suggest that we try something different.',
    instruction:'Identify an assumption, unfair expectation or repetitive conversational pattern supported by what is actually happening. Give the reader a specific way to question it and offer an alternative, making room for the selected character to agree, disagree or redefine the problem. If no unfairness is established, challenge a harmless routine rather than inventing oppression. Do not manufacture a villain, humiliate her, force rebellion, or demolish a relationship in a single exchange.'
  },
  tidewalker: {
    cost:50,
    balance:"A workable compromise can redirect disagreement.",
    name:'Find the Current',
    summary:'Adjust gracefully when the moment does not go according to plan.',
    scope:'Selected character',
    action:'I take the situation as it is and offer another way forward that could suit us both.',
    instruction:'Use a real constraint, changed circumstance or difference in preferences to reveal a specific workable adjustment. Let the reader offer a small compromise or redirect that respects what each person wants, with the selected character choosing her response. If the moment is already smooth, show attentiveness to a preference she has expressed. Do not erase the constraint, make either person abandon a core value, or declare a compromise mutually accepted before it is discussed.'
  },
  oathkeeper: {
    cost:50,
    balance:"A credible commitment can shift how an intention is received.",
    name:'Word of Honor',
    summary:'Make your intentions credible through a clear promise and an honest first action.',
    scope:'Selected character',
    action:'I say exactly what I can stand behind and begin by doing what I can right now.',
    instruction:'Create an opportunity for the reader to demonstrate integrity with a specific, limited commitment or an honest clarification of what they can offer. Where possible, include a first action that can be witnessed now. Let the selected character judge the evidence for herself. Do not bind her to an oath, guarantee future conduct, excuse a past betrayal, or turn one promise into fully earned trust.'
  },
  farwatcher: {
    cost:50,
    balance:"Clear trade-offs can change a decision without granting certainty.",
    name:'Ripple Sight',
    summary:'See the likely trade-offs of your next move before you choose it.',
    scope:'Selected character',
    action:'I pause to consider where our next choice could lead and talk through the trade-off.',
    instruction:'Clarify two plausible near-term consequences of a choice already facing the reader and selected character. Ground them in known circumstances and present them as possibilities, not predictions. Give the reader an informed opening to ask, decide or plan with her in this exchange. Do not reveal future events, undisclosed plans or unspoken motives as facts, and do not decide the outcome for either person.'
  },
  stormchaser: {
    cost:50,
    balance:"A timely invitation can turn hesitation into a meaningful choice.",
    name:'Seize the Moment',
    summary:'Catch a fleeting opening with a bold, spontaneous move.',
    scope:'Selected character',
    action:'I take a chance on the opening in front of us and invite her along.',
    instruction:'Spot one time-sensitive but plausible opportunity already supported by the scene, and let the reader act on it with a modest spontaneous risk: a timely invitation, a candid remark or a chance to join an activity. Make the opening lively and concrete while allowing the selected character to accept or refuse. Do not fabricate a crisis, force physical intimacy, endanger people, or guarantee a reward for recklessness.'
  },
  ashwing: {
    cost:50,
    balance:"A new action can challenge expectations without erasing the past.",
    name:'Turn the Page',
    summary:'Show that an old pattern does not have to define your next choice.',
    scope:'Selected character',
    action:'I acknowledge the old pattern and choose one thing I want to do differently now.',
    instruction:'Give the reader a concrete chance to depart from a previously established habit, role or expectation through a new action in this exchange. If no such pattern is established, let the reader name a new direction without inventing a past failure. The selected character can notice the effort while retaining reasonable doubts. Do not erase history, rewrite personality, force her to grant a clean slate, or declare a permanent transformation complete.'
  },
  rootsong: {
    cost:25,
    balance:"A familiar point of belonging offers a modest social opening.",
    name:'Common Ground',
    summary:'Find a small point of belonging in a place, interest or shared ritual.',
    scope:'Selected character',
    action:'I look for something familiar we can share and make room for her to belong here.',
    instruction:'Draw on an established place, interest, community tie or familiar practice to create a specific moment of belonging between the reader and selected character. If there is no known shared history, invite a new small ritual or compare experiences through conversation instead of assuming a connection. Do not invent mutual acquaintances, shared childhoods, family knowledge, or a claim that either person owes loyalty to a group.'
  },
  dawnmender: {
    cost:75,
    balance:"Repairing hurt can change the direction of a difficult relationship conversation.",
    name:'First Mend',
    summary:'Open a path toward repair through acknowledgment and a small act of care.',
    scope:'Selected character',
    action:'I acknowledge what went wrong and ask what a small, honest step toward repair might look like.',
    instruction:'Find one grounded opening to repair an established misunderstanding, disappointment or hurt between the reader and selected character. Emphasize listening, specific accountability and a feasible reparative action. If no harm is established, address a real minor uncertainty gently without inventing wrongdoing. Let repair begin without requiring immediate forgiveness. Do not heal trauma instantly, absolve responsibility, erase consequences or force reconciliation.'
  },
  thornheart: {
    cost:50,
    balance:"A clear boundary can redirect the terms of an exchange.",
    name:'Draw the Line',
    summary:'Protect your dignity with a clear boundary and a choice about what comes next.',
    scope:'Selected character',
    action:'I say what I am comfortable with, listen to her limits, and make my next choice clear.',
    instruction:'Create an opening for the reader to state a specific personal limit or condition relevant to this exchange, without apology for having it. Let the selected character state or retain her own limits, and make the next available choice concrete: continue differently, decline, pause or step away. If there is no violation, clarify a preference rather than inventing hostility. Do not read malice into ordinary disagreement, coerce compliance, retaliate, or treat a boundary as control over another person.'
  }
} as const satisfies Record<EchoAspect,{cost:EchoSpiritCost;balance:string;name:string;summary:string;scope:'Selected character'|'Everyone present';action:string;instruction:string}>

export type EchoSpiritCost = 25 | 50 | 75
export const ECHO_INFLUENCE = {
  25:{label:'Light',instruction:'Keep the effect a small, useful opening: ease or support the exchange without a major change of heart.'},
  50:{label:'Medium',instruction:'Give the exchange a clear, grounded shift in direction or a concrete next choice, without settling the whole relationship.'},
  75:{label:'Strong',instruction:'Allow a meaningful turning point in this exchange when the established situation supports it. Strong influence still leaves every person free to choose.'}
} as const satisfies Record<EchoSpiritCost,{label:string;instruction:string}>

export type EchoBreakthroughAspect = keyof typeof ECHO_BREAKTHROUGH_ABILITIES
export function isEchoBreakthroughAspect(value:unknown):value is EchoBreakthroughAspect {
  return typeof value==='string' && Object.prototype.hasOwnProperty.call(ECHO_BREAKTHROUGH_ABILITIES,value)
}
export function echoBreakthroughAbility(aspect:unknown) {
  if(!isEchoBreakthroughAspect(aspect))return null
  const ability=ECHO_BREAKTHROUGH_ABILITIES[aspect]
  return {aspect,...ability,strength:ECHO_INFLUENCE[ability.cost].label}
}
