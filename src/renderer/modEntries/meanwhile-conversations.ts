// Carry registration follows catalogue loading and runs even while switched off.
import '../../shared/meanwhileCarry'
import { MEANWHILE_MOD } from '../../shared/meanwhile'
import { MeanwhilePage } from '../views/MeanwhileModal'
import { MeanwhileIcon } from '../components/BunnyboardFeatureIcons'
import { registerHooks } from '@vx/modkit/renderer'

registerHooks(MEANWHILE_MOD, { bunnyboardPage: { id: 'meanwhile', word: 'MEANWHILE', Mark: MeanwhileIcon, Page: MeanwhilePage } })
