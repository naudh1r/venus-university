import { useState } from 'react'
import { motion } from 'motion/react'
import { abilityRank, TALENT_ABILITIES, valueSuggestions } from '../../shared/talentAbilities'
import { shopDefOf, type ItemDef } from '@shared/shop'
import { fullNameOf } from '@shared/types'
import { formatMoney } from '@shared/money'
import { useGameStore } from '../stores/gameStore'
import { gestures, quietLift, quietPress, useModOn } from '@vx/modkit/renderer'

/** Owned perk reveals the strongest affordable gift match for a known character. */
export function useTalentGiftAdvice(items:readonly ItemDef[]) {
  const g=useGameStore(),on=useModOn('campus-talents'),[selected,setSelected]=useState('')
  const enabled=on&&!!g.playthroughId&&!g.replaying&&!g.createdScene&&abilityRank(g.exTalents,TALENT_ABILITIES.value)>0
  const people=Object.keys(g.charInfo).filter(id=>g.characters[id]&&g.charInfo[id].nameKnown).map(id=>({id,name:fullNameOf(g.characters[id])}))
  const id=people.some(p=>p.id===selected)?selected:people[0]?.id
  const info=id?g.charInfo[id]:undefined
  const gifts=info?{...info,gifts:[...(info.gifts??[]),...g.sceneGifts.filter(gift=>gift.charId===id).map(gift=>gift.itemId)]}:undefined
  const best=enabled&&id?valueSuggestions(gifts,items,g.money,g.characters[id])[0]:undefined
  return {enabled,people,id,setSelected,best,name:people.find(p=>p.id===id)?.name}
}

export function TalentGiftSuggestions({advice,onPick}:{advice:ReturnType<typeof useTalentGiftAdvice>;onPick:(item:ItemDef)=>void}) {
  const {enabled,people,id,setSelected,best}=advice
  if(!enabled)return null
  return <section className="vu-shop-advice" aria-label="Eye for Value"><div><strong>Eye for Value</strong>
    {people.length>0&&<label>For<select aria-label="Gift suggestions for" value={id} onChange={e=>setSelected(e.target.value)}>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}</div>
    {best?<><div><strong>Best affordable gift</strong><motion.button className="vu-pill" type="button" {...gestures(false,quietLift,quietPress)} onClick={()=>onPick(best.item)}>Find {best.item.name} · {formatMoney(best.item.price)}</motion.button></div><p>{best.because} Available at {shopDefOf(best.item.shopId)?.name??best.item.shopId}. Compares all shops; equally good gifts favor the lower price.</p></>:<p>{people.length?'No suitable new gift fits your budget right now. Repeats and medicine are excluded.':'Meet someone and learn her name to find her best gift.'}</p>}
  </section>
}
