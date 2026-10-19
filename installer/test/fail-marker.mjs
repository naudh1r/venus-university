// Preloaded with --import: makes the marker's write (FAIL=write) or its rename (FAIL=rename) fail,
// as a full disk would, so the install's rollback can be watched.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const MARKER = 'venus-extracurriculars.json'
const injected = () => Object.assign(new Error('ENOSPC: no space left on device (injected)'), { code: 'ENOSPC' })
const { writeFile, rename } = fs.promises
if (process.env.FAIL === 'write') {
  fs.promises.writeFile = async (path, ...rest) => {
    if (String(path).includes(MARKER)) throw injected()
    return writeFile(path, ...rest)
  }
}
if (process.env.FAIL === 'rename') {
  fs.promises.rename = async (from, to) => {
    if (String(to).endsWith(MARKER)) throw injected()
    return rename(from, to)
  }
}
syncBuiltinESMExports()
