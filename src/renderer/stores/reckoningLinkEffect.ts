import { create } from 'zustand'

export const LINK_GLITCH_MS=1200
/** A live activation cue only: never serialized or reconstructed from a loaded encounter. */
export const useReckoningLinkEffect=create<{pulse:{id:string;playthroughId:string;loads:number;until:number}|null}>(()=>({pulse:null}))
