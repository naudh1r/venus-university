import {invoke,modIsOn} from '@vx/modkit/renderer'
import type {GameCompanionApi,CompanionPoll} from '../shared/screenCompanion'
export function companionGameApi(sceneId:string):GameCompanionApi{return {
 open:(context,id,document)=>invoke('screen-companion','open',[context,id,document]),
 document:(id,document,context)=>invoke('screen-companion','document',[id,document,context]),
 detach:id=>invoke('screen-companion','detach',[id]),
 acknowledge:(id,turn,accepted)=>invoke('screen-companion','ack',[id,turn,accepted]),
 onTurn:(listener,checkpoint)=>{let active=true,pending=false,lastCheckpoint:number|undefined;const timer=setInterval(()=>{if(!active||pending||!modIsOn('screen-companion'))return;pending=true;void invoke<CompanionPoll>('screen-companion','poll',[sceneId]).then(r=>{if(active&&r.ok){if(lastCheckpoint!==undefined&&lastCheckpoint!==r.data.checkpoint)checkpoint?.();lastCheckpoint=r.data.checkpoint;if(r.data.turn)listener(r.data.turn)}}).finally(()=>{pending=false})},200);return()=>{active=false;clearInterval(timer)}}
}}
