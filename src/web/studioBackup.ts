import { assertStudioBackupSize, assertStudioBackupText, type StudioBackupFile } from '@shared/presets/studioBackup'
import { offerDownload } from './download'
import { pickFile } from './transfer'

/** Prompt Studio's section backups on the browser build: offered through the download panel, read from the picker. */

/** `studioBackup.save` — offers the backup text for saving once it is sniffed as a studio backup; answers the name it is offered under. */
export async function saveStudioBackup(name: string, text: string): Promise<string> {
  assertStudioBackupText(text)
  return offerDownload(name, text, 'application/json')
}

/** `studioBackup.pick` — reads the file the player picks as text, with its name; null where nothing was picked. */
export async function pickStudioBackup(): Promise<StudioBackupFile | null> {
  const file = await pickFile('.json,application/json')
  if (!file) return null
  assertStudioBackupSize(file.size)
  return { text: await file.text(), fileName: file.name }
}
