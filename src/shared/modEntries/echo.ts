import type { ModDef } from '@vx/modkit/shared'
import { ECHO_BREAKTHROUGH_OPTION } from '../echoBreakthrough'
const mod: ModDef = {
  id: 'echo', name: 'Echo', author: 'Maestro Leeds', version: '0.14.2', scope: 'anytime', defaultOn: false,
  blurb: 'Named ethereal companions shaped by character profiles, with matching and competing bonds. API artwork downloads a background-removal model on first use.',
  offNote: 'Keeps your Echo choices, type lock and artwork; hides companions and disables affinity effects.',
  options: [{id:'megaten-art',label:'Local Megaten artwork',default:false,
    hint:'Off by default: use Gemini or the image API in Settings, with local background removal. First use downloads about 100 MB from IMG.LY; images stay on your device. Turn on for ComfyUI and the Megaten style LoRA instead. Echo only; existing images stay unchanged.'},
    {id:ECHO_BREAKTHROUGH_OPTION,label:'Echo Breakthrough abilities',default:true,
      hint:'Every player Echo aspect has a one-exchange ability costing 25, 50 or 75 spirit by conversational influence. Requires Breakthrough. Normal Breakthrough stays at 100.'}]
}
export default mod
