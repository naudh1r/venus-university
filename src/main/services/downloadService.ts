import { createHash, type Hash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, rename, rm, stat } from 'fs/promises'
import { dirname } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { appError, messageOf } from '@shared/errors'

/** Progress emitted while a file downloads. */
export interface DownloadProgress {
  bytesDone: number
  /** Absent when the server sends no `content-length`. */
  bytesTotal?: number
  /** 0-100; absent when the total is unknown. */
  percent?: number
}

export interface DownloadOptions {
  url: string
  /** Final path. Bytes land at `{destPath}.partial` until the transfer completes. */
  destPath: string
  /** Rejects the download if the finished size differs; unset where the size is unknown. */
  expectedBytes?: number
  /** Cuts off the stream as soon as it exceeds this many bytes. */
  maxBytes?: number
  /** Case-insensitive hex SHA256, verified from the same pass as the write; unset where there is none. */
  expectedSha256?: string
  headers?: Record<string, string>
  onProgress?: (progress: DownloadProgress) => void
  signal?: AbortSignal
  fetch?: typeof fetch
  /** Validates every redirect before following it. */
  httpsOnlyRedirects?: boolean
}

export interface DownloadOutcome {
  bytes: number
  /** Lowercase hex SHA256 of the downloaded content. */
  sha256: string
}

/** Query parameters that carry a credential rather than an address. */
const SECRET_PARAMS = [
  'token',
  'key',
  'api_key',
  'apikey',
  'access_token',
  'sig',
  'jwt',
  'X-Amz-Signature',
  'X-Amz-Credential',
  'X-Amz-Security-Token'
]

/** The URL with any credential-bearing query value blanked. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const name of SECRET_PARAMS) {
      if (parsed.searchParams.has(name)) parsed.searchParams.set(name, 'REDACTED')
    }
    return parsed.toString()
  } catch {
    // Not a URL we can parse; redact textually rather than pass it through.
    return url.replace(new RegExp(`([?&](?:${SECRET_PARAMS.join('|')})=)[^&]*`, 'gi'), '$1REDACTED')
  }
}

/** Refuses any address that is not https, an unparseable one included. */
function assertHttps(url: string, original = url): void {
  let parsed: URL | undefined
  try {
    parsed = new URL(url)
  } catch {
    parsed = undefined
  }
  if (parsed?.protocol !== 'https:' || parsed.username || parsed.password) {
    throw appError('DOWNLOAD_SCHEME', 'That download address is not a credential-free HTTPS URL.', redactUrl(original))
  }
}

async function openDownload(options: DownloadOptions): Promise<Response> {
  const { url, headers, signal, httpsOnlyRedirects, fetch: fetcher = fetch } = options
  if (!httpsOnlyRedirects) return fetcher(url, { headers, signal, redirect: 'follow' })
  let address = url
  for (let hops = 0; ; hops++) {
    assertHttps(address, url)
    const response = await fetcher(address, { headers, signal, redirect: 'manual' })
    if (response.url) assertHttps(response.url, url)
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    void response.body?.cancel().catch(() => {})
    const location = response.headers.get('location')
    if (!location || hops >= 5) throw appError('DOWNLOAD_REDIRECT', 'The download redirect could not be followed.', redactUrl(url))
    address = new URL(location, address).href
  }
}

/**
 * The `data` handler both streaming passes attach: it hashes every chunk and reports progress at
 * most once per ~1 MiB, so a 7 GB file doesn't flood IPC with events. `bytesDone` reads the total.
 */
function progressListener(
  hash: Hash,
  bytesTotal: number | undefined,
  onProgress?: (progress: DownloadProgress) => void
): { listener: (chunk: Buffer) => void; bytesDone: () => number } {
  let bytesDone = 0
  let lastReported = 0

  return {
    listener: (chunk: Buffer) => {
      hash.update(chunk)
      bytesDone += chunk.length
      if (onProgress && bytesDone - lastReported >= 1_048_576) {
        lastReported = bytesDone
        onProgress({
          bytesDone,
          bytesTotal,
          percent: bytesTotal ? Math.min(100, (bytesDone / bytesTotal) * 100) : undefined
        })
      }
    },
    bytesDone: () => bytesDone
  }
}

/**
 * Downloads with progress, streaming to `.partial` before an atomic rename; it hashes during
 * the write to avoid a second multi-GB pass, and checks the size and hash the caller named.
 */
export async function downloadFile(options: DownloadOptions): Promise<DownloadOutcome> {
  const { url, destPath, expectedBytes, expectedSha256, maxBytes, onProgress, signal } = options
  const partialPath = `${destPath}.partial`
  const safeUrl = redactUrl(url)

  assertHttps(url)

  await mkdir(dirname(destPath), { recursive: true })
  // No resume: an earlier partial is discarded.
  await rm(partialPath, { force: true })

  let response: Response
  try {
    response = await openDownload(options)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err &&
        (err.code === 'DOWNLOAD_SCHEME' || err.code === 'DOWNLOAD_REDIRECT')) throw err
    throw appError('DOWNLOAD_NETWORK', `Could not reach ${safeUrl}.`, options.httpsOnlyRedirects ? undefined : messageOf(err))
  }

  // The fetch follows redirects, so the address the bytes actually come from is checked too.
  if (response.url || !options.httpsOnlyRedirects) assertHttps(response.url, url)

  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    // 4xx other than 408/429 is a wrong request, not the network.
    const permanent =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408 &&
      response.status !== 429

    throw appError(
      response.status === 401 || response.status === 403
        ? 'DOWNLOAD_UNAUTHORIZED'
        : permanent
          ? 'DOWNLOAD_HTTP_PERMANENT'
          : 'DOWNLOAD_HTTP',
      options.httpsOnlyRedirects ? `Download failed with HTTP ${response.status}.`
        : `Download failed with HTTP ${response.status} ${response.statusText}.`,
      safeUrl
    )
  }
  if (!response.body) {
    throw appError('DOWNLOAD_EMPTY', 'The server returned an empty response body.', safeUrl)
  }

  const lengthHeader = response.headers.get('content-length')
  const bytesTotal = lengthHeader ? Number(lengthHeader) : expectedBytes
  const tooLarge = () => appError('DOWNLOAD_SIZE_LIMIT', 'The download exceeds its size limit.', safeUrl)
  if (maxBytes !== undefined && Number(lengthHeader) > maxBytes) {
    void response.body.cancel().catch(() => {})
    throw tooLarge()
  }
  const hash = createHash('sha256')

  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
  const progress = progressListener(hash, bytesTotal, onProgress)
  const measured = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      if (maxBytes !== undefined && progress.bytesDone() + chunk.length > maxBytes) {
        done(Object.assign(new Error('Download exceeded size limit'), { code: 'DOWNLOAD_SIZE_LIMIT' }))
        return
      }
      progress.listener(chunk)
      done(null, chunk)
    }
  })

  try {
    await pipeline(source, measured, createWriteStream(partialPath), { signal })
  } catch (err) {
    await rm(partialPath, { force: true })
    if (err && typeof err === 'object' && 'code' in err && err.code === 'DOWNLOAD_SIZE_LIMIT') throw tooLarge()
    throw appError(
      signal?.aborted ? 'DOWNLOAD_ABORTED' : 'DOWNLOAD_STREAM',
      signal?.aborted ? 'Download was cancelled.' : 'The download was interrupted.',
      options.httpsOnlyRedirects ? safeUrl : messageOf(err)
    )
  }

  const sha256 = hash.digest('hex')
  const actualBytes = (await stat(partialPath)).size

  if (expectedBytes !== undefined && actualBytes !== expectedBytes) {
    await rm(partialPath, { force: true })
    throw appError(
      'DOWNLOAD_SIZE_MISMATCH',
      'The downloaded file is the wrong size.',
      `Expected ${expectedBytes} bytes, received ${actualBytes} from ${safeUrl}.`
    )
  }

  if (expectedSha256 !== undefined && sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    await rm(partialPath, { force: true })
    throw appError(
      'DOWNLOAD_HASH_MISMATCH',
      'The downloaded file failed its integrity check.',
      `Expected SHA256 ${expectedSha256.toLowerCase()}, computed ${sha256} for ${safeUrl}.`
    )
  }

  await rm(destPath, { force: true })
  await rename(partialPath, destPath)

  onProgress?.({ bytesDone: actualBytes, bytesTotal: actualBytes, percent: 100 })
  return { bytes: actualBytes, sha256 }
}

/** SHA256 of a file already on disk, streamed — the on-demand verification tier. */
export async function hashFile(
  path: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadOutcome> {
  const bytesTotal = (await stat(path)).size
  const hash = createHash('sha256')

  const source = createReadStream(path)
  const { listener, bytesDone } = progressListener(hash, bytesTotal, onProgress)
  source.on('data', listener)

  try {
    // A sink is needed to drain the stream; the `data` handler above does the work.
    await pipeline(source, async (chunks) => {
      for await (const _chunk of chunks) void _chunk
    })
  } catch (err) {
    throw appError('MODEL_FILE_UNREADABLE', 'Could not read the file to verify it.', messageOf(err))
  }

  onProgress?.({ bytesDone: bytesDone(), bytesTotal, percent: 100 })
  return { bytes: bytesDone(), sha256: hash.digest('hex') }
}
