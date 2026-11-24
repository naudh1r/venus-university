import { preload, removeBackground, type Config } from '@imgly/background-removal'

// Versioned model/runtime assets: about 100 MB, browser-cached, with no artwork upload.
const config: Config = {
  publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
  model: 'isnet_fp16', device: 'cpu', proxyToWorker: false,
  output: { format: 'image/png' }
}
self.onmessage = async (event: MessageEvent<{ id: number; png?: Uint8Array }>) => {
  const { id, png } = event.data
  try {
    await preload(config)
    const bytes = png ? new Uint8Array(await (await removeBackground(new Blob([new Uint8Array(png)], { type: 'image/png' }), config)).arrayBuffer()) : undefined
    self.postMessage({ id, bytes })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Background removal failed.' })
  }
}
