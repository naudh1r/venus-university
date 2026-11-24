import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { join } from 'node:path'
import type { CompanionPoint, PointerRect } from '../../shared/companionPointer'

let worker: ChildProcessWithoutNullStreams | null = null, sequence = 0
let idle: ReturnType<typeof setTimeout> | undefined
const pending = new Map<number, { done: (rect: PointerRect | null) => void }>()
/** One small Windows helper compiles the interop once and serves bounded geometry queries. */
function getWorker(): ChildProcessWithoutNullStreams {
  if (worker) return worker
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VenusPointWindow {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out Rect rect, int size);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
}
'@
[void][VenusPointWindow]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
while ($null -ne ($line = [Console]::ReadLine())) {
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    $hwnd = [IntPtr]::new([long]$request.hwnd)
    $result = $null
    if ([VenusPointWindow]::IsWindowVisible($hwnd) -and ![VenusPointWindow]::IsIconic($hwnd)) {
      $rect = New-Object VenusPointWindow+Rect
      $ok = [VenusPointWindow]::DwmGetWindowAttribute($hwnd,9,[ref]$rect,16) -eq 0
      if (!$ok) { $ok = [VenusPointWindow]::GetWindowRect($hwnd,[ref]$rect) }
      $width = $rect.Right-$rect.Left; $height = $rect.Bottom-$rect.Top
      if ($ok -and $width -gt 0 -and $height -gt 0) {
        if ($null -ne $request.point) {
          $position = New-Object VenusPointWindow+Point
          $position.X = [int][Math]::Round($rect.Left + $request.point.x * ($width-1))
          $position.Y = [int][Math]::Round($rect.Top + $request.point.y * ($height-1))
          $ok = [VenusPointWindow]::GetAncestor([VenusPointWindow]::WindowFromPoint($position),2) -eq $hwnd
        }
        if ($ok) { $result = @{x=$rect.Left;y=$rect.Top;width=$width;height=$height} }
      }
    }
    [Console]::WriteLine((@{id=$request.id;rect=$result} | ConvertTo-Json -Compress))
  } catch { if ($null -ne $request) { [Console]::WriteLine((@{id=$request.id;rect=$null} | ConvertTo-Json -Compress)) } }
}
`
  const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'pipe' })
  worker = child
  let buffer = ''
  const failed = () => {
    if (worker !== child) return
    worker = null; child.kill()
    for (const entry of [...pending.values()]) entry.done(null)
  }
  child.on('error', failed); child.on('exit', failed); child.stdin.on('error', failed)
  child.stderr.on('data', () => {})
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    if (buffer.length > 16384) { failed(); return }
    let end: number
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1)
      try {
        const reply = JSON.parse(line) as { id: number; rect: PointerRect | null }
        const rect = reply.rect
        pending.get(reply.id)?.done(rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0 ? rect : null)
      } catch { /* Ignore a helper diagnostic, never treat it as geometry. */ }
    }
  })
  return child
}
export function stopCompanionWindowBounds(): void {
  clearTimeout(idle)
  const child = worker; worker = null; child?.kill()
  for (const entry of [...pending.values()]) entry.done(null)
}
export function companionWindowBounds(id: string, point?: CompanionPoint): Promise<PointerRect | null> {
  const match = /^window:([0-9]{1,19}):[01]$/.exec(id)
  if (process.platform !== 'win32' || !match || BigInt(match[1]) > 9223372036854775807n || pending.size >= 8) return Promise.resolve(null)
  if (point && (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return Promise.resolve(null)
  const child = getWorker(), key = ++sequence
  clearTimeout(idle)
  return new Promise(resolve => {
    const timer = setTimeout(() => { pending.get(key)?.done(null); stopCompanionWindowBounds() }, 5000)
    pending.set(key, { done: rect => {
      clearTimeout(timer); pending.delete(key); resolve(rect)
      if (!pending.size) { clearTimeout(idle); idle = setTimeout(stopCompanionWindowBounds, 30000); idle.unref() }
    } })
    child.stdin.write(JSON.stringify({ id: key, hwnd: match[1], point }) + '\n')
  })
}
