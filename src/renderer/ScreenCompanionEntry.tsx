import {type SceneSeatProps} from '@vx/modkit/renderer'
import {useSyncExternalStore} from 'react'
import {subscribeSceneTurns,hasDesktopSurfaces} from '@vx/modkit/renderer'
import {canShareLaptop,openScreenCompanion} from './stores/screenCompanion'
export function LaptopSeat({Seat,visible}:SceneSeatProps){const allowed=useSyncExternalStore(subscribeSceneTurns,canShareLaptop);return <Seat label="Share your laptop" state={!visible||!hasDesktopSurfaces()?'gone':allowed?'shown':'dim'} onClick={()=>{if(allowed)void openScreenCompanion()}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 17V5h14v12M2 17h20l-2 3H4Z"/></svg></Seat>}
