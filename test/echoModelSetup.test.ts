import { beforeEach, expect, it, vi } from 'vitest'
import { ECHO_LOCAL_MODELS } from '@shared/echoModels'
const mocks = vi.hoisted(() => ({ stat: vi.fn(), hash: vi.fn(), download: vi.fn(), license: vi.fn(), write: vi.fn(), mkdir: vi.fn(), target: vi.fn() }))
vi.mock('fs/promises', () => ({ stat: mocks.stat, readFile: mocks.license, writeFile: mocks.write, mkdir: mocks.mkdir }))
vi.mock('../src/main/paths', () => ({ getComfyPythonPath: () => 'python', getComfyModelFilePath: (dir: string, file: string) => `${dir}/${file}` }))
vi.mock('../src/main/services/downloadService', () => ({ hashFile: mocks.hash, downloadFile: mocks.download }))
vi.mock('../src/main/services/comfyService', () => ({ resolveTarget: mocks.target }))
import { installEchoModels } from '../src/main/services/echoModelSetup'
beforeEach(() => { vi.resetAllMocks(); mocks.target.mockResolvedValue({source:'managed'}); mocks.license.mockResolvedValue('Model license'); mocks.stat.mockImplementation(async path => {
  if (path === 'python') return { isFile: () => true }
  throw Object.assign(Error('missing'), { code: 'ENOENT' })
}) })
it('does not download managed models while an external server is selected', async () => {
  mocks.target.mockResolvedValue({source:'external'})
  await expect(installEchoModels(new AbortController().signal)).rejects.toThrow('Your ComfyUI server')
  expect(mocks.stat).not.toHaveBeenCalled()
  expect(mocks.download).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
it('downloads pinned originals with hash, size and cancellation checks', async () => {
  const signal = new AbortController().signal
  await installEchoModels(signal)
  expect(mocks.download).toHaveBeenCalledTimes(2)
  expect(mocks.write).toHaveBeenCalledWith('loras/Megaten_Style.safetensors.LICENSE.txt', 'Model license', 'utf8')
  for (const model of ECHO_LOCAL_MODELS) expect(mocks.download).toHaveBeenCalledWith({ url: model.url, destPath: `${model.destDir}/${model.destFile}`, expectedBytes: model.bytes, expectedSha256: model.sha256, signal })
})
it('reuses matching models but never overwrites an unknown existing file', async () => {
  mocks.stat.mockResolvedValue({ isFile: () => true })
  for (const model of ECHO_LOCAL_MODELS) mocks.hash.mockResolvedValueOnce({ bytes: model.bytes, sha256: model.sha256.toLowerCase() })
  await installEchoModels(new AbortController().signal)
  expect(mocks.download).not.toHaveBeenCalled()
  mocks.hash.mockResolvedValue({ bytes: 5, sha256: 'different' })
  await expect(installEchoModels(new AbortController().signal)).rejects.toThrow('not overwritten')
})
it('requires the existing ComfyUI setup and stops before the next model when cancelled', async () => {
  mocks.stat.mockRejectedValueOnce(Error('missing'))
  await expect(installEchoModels(new AbortController().signal)).rejects.toThrow('Setup')
  expect(mocks.download).not.toHaveBeenCalled()
  const controller = new AbortController()
  mocks.download.mockImplementationOnce(async () => { controller.abort(); controller.signal.throwIfAborted() })
  await expect(installEchoModels(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.download).toHaveBeenCalledTimes(1)
})
