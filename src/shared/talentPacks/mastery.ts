import type { TalentPack } from '../talentTypes'

const pack = {
  id:'mastery', name:'Campus abilities', author:'Maestro Leeds', trees:[],
  skills:[
    {id:'brain.eureka',tree:'brain',chain:'Ability',capstone:true,name:'Eureka!',costs:[60],prerequisitesAny:[{id:'brain.notes',rank:1},{id:'brain.cram',rank:1},{id:'brain.polish',rank:3}],
      description:"Choose an assigned project. Your next completed work session on it gives triple progress. Once per week; replaces Cram and Work Smarter for that session.",effects:{'brain.eureka.unlock':[1]}},
    {id:'heart.anticipation',tree:'charm',chain:'Ability',capstone:true,name:'Leave Them Wanting More',costs:[70],prerequisitesAny:[{id:'heart.spark',rank:3},{id:'heart.grace',rank:2},{id:'heart.gift',rank:2}],
      description:"Leave a romantic meeting on a high note. A warm goodbye can create Anticipation, giving one positive moment at your next meeting +25% affection. Once per week.",effects:{'heart.anticipation.unlock':[1]}},
    {id:'heart.silver-lining',tree:'heart',chain:'Ability',capstone:true,name:'Silver Lining',costs:[70],prerequisitesAny:[{id:'heart.ease',rank:2},{id:'heart.work',rank:1},{id:'heart.feet',rank:1}],
      description:'Turn an awkward or tense exchange into an opening with warmth, wit and a little humility. Choose someone present and steer the conversation back in your favor. One generated reply per week; failed generation keeps your use. Existing facts and boundaries still apply.',effects:{'heart.silver-lining.unlock':[1]}},
    {id:'body.dancer',tree:'body',chain:'Ability',capstone:true,name:'Dancer',costs:[15,20,25],prerequisitesAny:[{id:'body.partner',rank:1},{id:'body.shift',rank:1},{id:'body.mild',rank:2}],
      description:"Rank I: dance with confidence. Rank II: lead a willing partner. Rank III: improvise advanced moves. Dance reactions still depend on the person and the situation.",effects:{'body.dancer.unlock':[1,2,3]}},
    {id:'money.eye',tree:'money',chain:'Ability',capstone:true,name:'Eye for Value',costs:[60],prerequisitesAny:[{id:'reliable',rank:2},{id:'regular',rank:2},{id:'interest',rank:3}],
      description:"Reveal the best affordable gift for a known character across all BunnyShop stores. Highlights gifts she will love before gifts she will like, skips repeats, and favors the cheaper option when reactions tie.",effects:{'money.eye.unlock':[1]}},
    {id:'echoes.borrowed',tree:'echoes',chain:'Ability',capstone:true,name:'Borrowed Voice',costs:[80],prerequisitesAny:[{id:'neutral',rank:2},{id:'spark',rank:2},{id:'breath',rank:2}],requires:['echo','breakthrough'],
      notes:['Echo abilities must be enabled to borrow one.'],
      description:"Borrow a trusted companion's Echo ability once per week while they are with you. Your own aspect stays the same. Pay the usual spirit cost from your chosen target's meter.",effects:{'echoes.borrowed.unlock':[1]}}
  ]
} as const satisfies TalentPack
export default pack
