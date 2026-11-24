/** Original symbolic aspects. Oppositions describe competing priorities, not good and evil. */
export const ECHO_ASPECTS = [
  { id:'horizonbound', name:'Horizonbound', meaning:'Curiosity, freedom, and undiscovered possibilities', opposite:'stoneward', words:'curious adventurous adventure explore travel freedom spontaneous wander discover independent', color:'#e8b88b' },
  { id:'stoneward', name:'Stoneward', meaning:'Responsibility, structure, and steadfast protection', opposite:'horizonbound', words:'responsible structure disciplined discipline organized order dependable dutiful duty protect leader', color:'#efa284' },
  { id:'sparkweaver', name:'Sparkweaver', meaning:'Inventiveness and making the impossible tangible', opposite:'lorekeeper', words:'invent creative innovative engineer science technology experiment ingenious curious design', color:'#c89fff' },
  { id:'lorekeeper', name:'Lorekeeper', meaning:'Inherited wisdom and the value of proven paths', opposite:'sparkweaver', words:'tradition traditional history mentor teach knowledge scholar study heritage wisdom ritual', color:'#d8bd85' },
  { id:'veilkeeper', name:'Veilkeeper', meaning:'Discretion, intuition, and a carefully guarded inner world', opposite:'daylark', words:'reserved private secret discreet intuitive mysterious guarded observant perceptive quiet subtle', color:'#9da9ff' },
  { id:'daylark', name:'Daylark', meaning:'Openhearted joy and the courage to be seen', opposite:'veilkeeper', words:'happy cheerful outgoing playful sunny exuberant extrovert extroverted sociable bubbly expressive', color:'#f4d67d' },
  { id:'hearthwarden', name:'Hearthwarden', meaning:'Nurturing others and creating a place of safety', opposite:'wildspark', words:'nurture nurturing caring caregiver warm compassionate supportive family gentle comfort kindness selfless', color:'#ebb3c6' },
  { id:'wildspark', name:'Wildspark', meaning:'Personal desire and living without permission', opposite:'hearthwarden', words:'passionate desire daring sensual hedonist indulgent pleasure bold restless uninhibited selfish', color:'#dd8daf' },
  { id:'heartthread', name:'Heartthread', meaning:'Devotion, intimacy, and choosing connection', opposite:'quietdrift', words:'romantic romance love affectionate devoted intimate relationship attachment loyal loving connection', color:'#ff9caf' },
  { id:'quietdrift', name:'Quietdrift', meaning:'Solitude and the freedom to belong to yourself', opposite:'heartthread', words:'solitary solitude loner alone introvert introverted independent detached self-sufficient reclusive introspective', color:'#bdc4df' },
  { id:'trailblazer', name:'Trailblazer', meaning:'Ambition expressed through decisive action', opposite:'dreamglass', words:'ambitious athlete athletic competitive compete driven ambitious achievement determined practical goal success', color:'#a7cefa' },
  { id:'dreamglass', name:'Dreamglass', meaning:'Imagination and possibilities beyond the practical', opposite:'trailblazer', words:'imagination imaginative dreamy dream artist artistic fantasy whimsical idealistic poetic sensitive', color:'#bcb0ee' },
  { id:'ironbloom', name:'Ironbloom', meaning:'Patient courage and strength that does not need to shout', opposite:'riftcaller', words:'brave courage courageous resilient perseverance patient endurance steady gentle stoic composed', color:'#efc572' },
  { id:'riftcaller', name:'Riftcaller', meaning:'Challenging limits and confronting broken systems', opposite:'ironbloom', words:'rebellious rebel disrupt radical outspoken confront defiant protest challenge fierce confrontational', color:'#eda593' },
  { id:'tidewalker', name:'Tidewalker', meaning:'Adaptability and finding a way through uncertainty', opposite:'oathkeeper', words:'adapt adaptable flexible change improvisation resourceful easygoing relaxed compromise opportunistic', color:'#a6ddd3' },
  { id:'oathkeeper', name:'Oathkeeper', meaning:'Conviction and promises held despite their cost', opposite:'tidewalker', words:'fair honest justice principled principle integrity truth ethical promise conviction stubborn', color:'#b6d8d1' },
  { id:'farwatcher', name:'Farwatcher', meaning:'Deliberation and seeing consequences before acting', opposite:'stormchaser', words:'thoughtful analytical cautious careful deliberate strategic plan perspective philosophical patient measured', color:'#c5b6eb' },
  { id:'stormchaser', name:'Stormchaser', meaning:'Instinct, risk, and the thrill of the immediate', opposite:'farwatcher', words:'impulsive rash reckless risk thrill impatient impulsive daring impatient adrenaline thrill-seeking', color:'#e8ce9a' },
  { id:'ashwing', name:'Ashwing', meaning:'Reinvention and the courage to leave an old life behind', opposite:'rootsong', words:'transform transformation reinvent reinvention rebirth rebuild renewal escape restart survivor starting-over', color:'#c5abd7' },
  { id:'rootsong', name:'Rootsong', meaning:'Belonging and the bonds that connect a life to its home', opposite:'ashwing', words:'community home roots belonging hometown neighbor tradition family heritage friendship familiar', color:'#a9d7ba' },
  { id:'dawnmender', name:'Dawnmender', meaning:'Healing, forgiveness, and faith in second chances', opposite:'thornheart', words:'hope hopeful optimistic forgive forgiveness heal healing reconcile forgiving acceptance redemption peace', color:'#a5dbef' },
  { id:'thornheart', name:'Thornheart', meaning:'Self-protection shaped by wounds that still matter', opposite:'dawnmender', words:'resentful bitter grudge distrust mistrust betrayed betrayal suspicious wounded cynical defensive unforgiving', color:'#d8a1bd' }
] as const
export type EchoAspect = typeof ECHO_ASPECTS[number]['id']
/** Read-only migration aliases for saves from the first local experiment. Never shown in the UI. */
export const LEGACY_ECHO_ASPECTS: Record<string,EchoAspect> = {
  fool:'horizonbound',magician:'sparkweaver',priestess:'veilkeeper',empress:'hearthwarden',emperor:'stoneward',
  hierophant:'lorekeeper',lovers:'heartthread',chariot:'trailblazer',strength:'ironbloom',hermit:'quietdrift',
  wheel:'tidewalker',justice:'oathkeeper',hanged:'farwatcher',death:'ashwing',temperance:'dawnmender',
  devil:'wildspark',tower:'riftcaller',star:'dawnmender',moon:'dreamglass',sun:'daylark',judgement:'dawnmender',world:'rootsong'
}
