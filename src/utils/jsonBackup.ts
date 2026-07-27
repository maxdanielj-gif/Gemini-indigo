import { downloadFile } from './downloadFile';

/**
 * Turns an exportData() payload into a downloaded .json file on the device.
 * Used by both the Auto JSON Backup timer and the manual "Save Backup File
 * Now" button, so the two stay in sync if the format or naming ever changes.
 *
 * Each call produces a new, timestamped file (e.g.
 * indigo_auto_backup_2026-07-26T14-30-05.json) rather than overwriting a
 * fixed filename — intentional, so a bad/incomplete snapshot never clobbers
 * a good earlier one still sitting in Downloads.
 */
export async function downloadJsonBackupFile(data: any): Promise<string> {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `indigo_auto_backup_${ts}.json`;
  // downloadFile() only auto-revokes object URLs it fetches itself (the
  // cross-origin path); for a blob: URL we already own, it just triggers the
  // click and returns immediately. Revoking right away can race the browser
  // reading the blob on some Android builds, so give it a beat first —
  // matches the pattern used elsewhere in the app (e.g. handleExport).
  await downloadFile(objectUrl, filename);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  return filename;
}
