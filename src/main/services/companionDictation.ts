import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import { appError } from '@vx/modkit/shared'

/** Opens the OS voice-typing surface only over the message window the user selected. */
export async function openWindowsDictation(win: BrowserWindow): Promise<void> {
  if (process.platform !== 'win32') throw appError('COMPANION_VOICE', 'Use your operating system’s dictation shortcut in the message box.')
  const handle = win.getNativeWindowHandle()
  const hwnd = handle.length === 8 ? handle.readBigUInt64LE().toString() : String(handle.readUInt32LE())
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VenusVoiceKeys {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
}
'@
$deadline = [DateTime]::UtcNow.AddSeconds(3)
do {
  $held = @(16,17,18,91,92) | Where-Object { ([VenusVoiceKeys]::GetAsyncKeyState($_) -band 0x8000) -ne 0 }
  if ($held.Count -eq 0) { break }
  Start-Sleep -Milliseconds 30
} while ([DateTime]::UtcNow -lt $deadline)
if ($held.Count -ne 0 -or [VenusVoiceKeys]::GetForegroundWindow().ToInt64() -ne ${hwnd}) { exit 2 }
try {
  [VenusVoiceKeys]::keybd_event(91,0,0,[UIntPtr]::Zero)
  [VenusVoiceKeys]::keybd_event(72,0,0,[UIntPtr]::Zero)
} finally {
  [VenusVoiceKeys]::keybd_event(72,0,2,[UIntPtr]::Zero)
  [VenusVoiceKeys]::keybd_event(91,0,2,[UIntPtr]::Zero)
}
`
  const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  await new Promise<void>((resolve, reject) => {
    execFile(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 12000, maxBuffer: 4096 }, error => {
        if (error) reject(appError('COMPANION_VOICE', 'Click the message box and press Windows+H to start voice typing. Keep this window focused.'))
        else resolve()
      })
  })
}
