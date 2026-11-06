import { photoInvocations } from '../photoIpc'
import { photoRoute } from '../photoProtocol'

/** The same exports an installed Photo main.js provides. */
export function photoMainEntry() {
  return { invoke: photoInvocations(), protocols: [{ route: 'photos', handle: photoRoute }] }
}
