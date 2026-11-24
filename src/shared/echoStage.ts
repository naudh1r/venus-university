/** Offsets in the game's 1920 × 1080 stage coordinates, relative to its existing Echo position. */
export interface EchoStagePlacement { x:number; y:number; scale:number; visible?:boolean; opacity?:number; floating?:boolean; floatSeconds?:number }
export const ECHO_FLOAT_SECONDS_DEFAULT = 14
export const ECHO_STAGE_DEFAULT:Readonly<EchoStagePlacement>={x:0,y:0,scale:1}
/** Full-height reader Echo on the left of Reckoning, behind the dialog. */
export const PLAYER_ECHO_STAGE_DEFAULT:Readonly<EchoStagePlacement>={x:25,y:600,scale:2.39}
/** Resolve an unset placement without replacing a player's saved adjustments. */
export function resolveEchoStage(value:EchoStagePlacement|undefined,player=false):EchoStagePlacement {
  return normalizeEchoStage(value ?? (player ? PLAYER_ECHO_STAGE_DEFAULT : ECHO_STAGE_DEFAULT))
}
export const ECHO_STAGE_LIMITS={offset:600,minScale:0.25,maxScale:2.5} as const
/** The reader's reflection sits in the background; girls keep the shared stage visibility. */
export const PLAYER_ECHO_STAGE_OPACITY = .18
export function echoStageOpacity(value:unknown,shared:number,player=false):number {
  return normalizeEchoStage(value).opacity ?? (player ? PLAYER_ECHO_STAGE_OPACITY : shared)
}

export function normalizeEchoStage(value?:unknown):EchoStagePlacement {
  const v=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
  const bounded=(key:string,min:number,max:number,fallback:number):number=>{
    const n=v[key]
    return typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(min,Math.min(max,n))*100)/100:fallback
  }
  return {x:bounded('x',-600,600,0),y:bounded('y',-600,600,0),scale:bounded('scale',0.25,2.5,1),
    ...(typeof v.visible==='boolean'?{visible:v.visible}:{}),
    ...(typeof v.opacity==='number'&&Number.isFinite(v.opacity)?{opacity:bounded('opacity',.05,.8,.3)}:{}),
    ...(typeof v.floating==='boolean'?{floating:v.floating}:{}),
    ...(typeof v.floatSeconds==='number'&&Number.isFinite(v.floatSeconds)?{floatSeconds:bounded('floatSeconds',3,20,ECHO_FLOAT_SECONDS_DEFAULT)}:{})}
}

/** Preview and real stage share transform order and bottom-centre scaling. */
export function echoStageStyle(value?:unknown,preview=false):Record<string,string|number> {
  const p=normalizeEchoStage(value)
  return {
    '--echo-x':preview?`${p.x/19.2}%`:`${p.x}px`,
    '--echo-y':preview?`${p.y/10.8}%`:`${p.y}px`,
    '--echo-scale':p.scale,
    ...(preview?{'--echo-base-x':`${115/19.2}%`,'--echo-width':`${950/19.2}%`}:{})
  }
}
