import { TALENT_EFFECTS, type TalentDef, type TalentPack, type TalentTreeDef } from './talentTypes'

/** Reject broken packs at startup, before an invalid cost or dependency can touch a save. */
export function compileTalentPacks(packs: readonly TalentPack[]): {trees:TalentTreeDef[];skills:TalentDef[]} {
  const ids=new Set<string>(), treeIds=new Set<string>(), packIds=new Set<string>()
  const trees:TalentTreeDef[]=[], skills:TalentDef[]=[]
  const validId=(id:string)=>/^[a-z][a-z0-9.-]{0,79}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id)
  for(const pack of packs) {
    if(!validId(pack.id)||packIds.has(pack.id))throw Error(`Duplicate or invalid talent pack: ${pack.id}`)
    packIds.add(pack.id)
    for(const tree of pack.trees) {
      if(!validId(tree.id)||treeIds.has(tree.id)||!tree.name.trim())throw Error(`Duplicate or invalid talent tree: ${tree.id}`)
      treeIds.add(tree.id);trees.push(tree)
    }
    for(const skill of pack.skills) {
      if(!validId(skill.id)||ids.has(skill.id)||!skill.name.trim()||!skill.chain.trim())throw Error(`Duplicate or invalid skill: ${skill.id}`)
      if(!skill.costs.length||skill.costs.length>10||skill.costs.some(n=>!Number.isSafeInteger(n)||n<=0||n>1000000))throw Error(`Invalid skill prices: ${skill.id}`)
      if(skill.shared!==undefined&&typeof skill.shared!=='boolean'||skill.shared&&skill.capstone)throw Error(`Invalid shared placement: ${skill.id}`)
      for(const [key,values] of Object.entries(skill.effects??{})) {
        const known=TALENT_EFFECTS.includes(key as typeof TALENT_EFFECTS[number])||(key.includes('.')&&validId(key))
        if(!known||!Array.isArray(values)||values.length!==skill.costs.length||values.some(n=>!Number.isFinite(n)||n<0))throw Error(`Invalid effect ${key}: ${skill.id}`)
      }
      ids.add(skill.id);skills.push(skill)
    }
  }
  for(const skill of skills) {
    if(!treeIds.has(skill.tree))throw Error(`Missing tree for ${skill.id}`)
    if(skill.prerequisitesAny?.length===0)throw Error(`Empty alternative prerequisites for ${skill.id}`)
    if(skill.capstone&&skills.some(other=>other!==skill&&other.capstone&&other.tree===skill.tree))throw Error(`Multiple capstone abilities in ${skill.tree}`)
    for(const p of [...skill.prerequisites??[],...skill.prerequisitesAny??[]]) {
      const parent=skills.find(s=>s.id===p.id)
      if(!parent||!Number.isInteger(p.rank)||p.rank<1||p.rank>parent.costs.length)throw Error(`Invalid prerequisite for ${skill.id}`)
    }
  }
  const done=new Set<string>(), visiting=new Set<string>()
  function visit(skill:TalentDef):void {
    if(visiting.has(skill.id))throw Error(`Circular talent prerequisite: ${skill.id}`)
    if(done.has(skill.id))return
    visiting.add(skill.id)
    for(const p of [...skill.prerequisites??[],...skill.prerequisitesAny??[]])visit(skills.find(s=>s.id===p.id)!)
    visiting.delete(skill.id);done.add(skill.id)
  }
  skills.forEach(visit)
  return {trees,skills}
}
const packs=import.meta.glob<TalentPack>('./talentPacks/*.ts',{eager:true,import:'default'})
export const TALENT_PACKS=Object.keys(packs).sort().map(key=>packs[key])
const catalog=compileTalentPacks(TALENT_PACKS)
export const TALENT_TREES=catalog.trees
export const TALENTS=catalog.skills
