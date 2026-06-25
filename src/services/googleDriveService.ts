// ── Google Drive gallery backup/restore service ──────────────────────────────
// Uses Google Identity Services (GIS) token model + gapi client.
// All operations run in the browser — no server-side code needed.
// The backup is stored as a single JSON file in Drive's hidden appDataFolder.

const CLIENT_ID = '490905726047-si6vqv015lql359vq20tqs1r4h26jc1k.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'indigo_gallery_backup.json';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let gapiLoaded = false;
let gisLoaded = false;
let tokenClient: any = null;
let currentToken: string | null = null;

// ── Load gapi and GIS scripts ─────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureGapi(): Promise<void> {
  if (gapiLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => (window as any).gapi.load('client', resolve));
  await (window as any).gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  gapiLoaded = true;
}

async function ensureGis(): Promise<void> {
  if (gisLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gisLoaded = true;
}

// ── Get a fresh access token ──────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  await ensureGapi();
  await ensureGis();

  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          currentToken = resp.access_token;
          (window as any).gapi.client.setToken({ access_token: resp.access_token });
          resolve(resp.access_token);
        },
      });
    }
    // If we have a token that isn't expired, reuse it
    const existing = (window as any).gapi.client.getToken();
    if (existing?.access_token) {
      currentToken = existing.access_token;
      resolve(existing.access_token);
      return;
    }
    // Otherwise prompt (shows Google account picker the first time)
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// ── Find existing backup file ID ──────────────────────────────────────────────
async function findBackupFileId(): Promise<string | null> {
  const resp = await (window as any).gapi.client.drive.files.list({
    spaces: 'appDataFolder',
    fields: 'files(id, name)',
    q: `name = '${BACKUP_FILENAME}'`,
  });
  const files = resp.result.files || [];
  return files.length > 0 ? files[0].id : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GalleryBackupItem {
  id: string;
  type: string;
  mediaType: string;
  url: string;
  prompt: string;
  timestamp: number;
  personaId?: string;
}

/**
 * Backs up the gallery to Google Drive appDataFolder.
 * Creates the file if it doesn't exist, overwrites if it does.
 * Returns the number of images backed up.
 */
export async function driveBackupGallery(
  gallery: GalleryBackupItem[],
  onProgress?: (step: string) => void,
): Promise<number> {
  onProgress?.('Signing in to Google Drive…');
  await getAccessToken();

  // For http URLs, fetch and convert to base64 so the backup is self-contained
  onProgress?.('Preparing images…');
  const items: GalleryBackupItem[] = [];
  for (const item of gallery) {
    if (item.url.startsWith('data:') || item.url.startsWith('blob:')) {
      items.push(item);
    } else if (item.url.startsWith('http')) {
      try {
        const r = await fetch(item.url);
        if (!r.ok) { items.push(item); continue; } // keep original URL if fetch fails
        const blob = await r.blob();
        const b64 = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(blob);
        });
        items.push({ ...item, url: b64 });
      } catch {
        items.push(item); // keep original on error
      }
    } else {
      items.push(item);
    }
  }

  onProgress?.('Uploading to Google Drive…');
  const body = JSON.stringify({ version: 1, backedUpAt: Date.now(), items });
  const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json', parents: ['appDataFolder'] };

  const existingId = await findBackupFileId();

  if (existingId) {
    // Update existing file (PATCH)
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    const r = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${currentToken}` }, body: form },
    );
    if (!r.ok) throw new Error(`Drive upload failed: ${r.status} ${await r.text()}`);
  } else {
    // Create new file
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    const r = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` }, body: form },
    );
    if (!r.ok) throw new Error(`Drive upload failed: ${r.status} ${await r.text()}`);
  }

  return items.length;
}

/**
 * Restores gallery images from Google Drive.
 * Returns the restored items array, or null if no backup found.
 */
export async function driveRestoreGallery(
  onProgress?: (step: string) => void,
): Promise<GalleryBackupItem[] | null> {
  onProgress?.('Signing in to Google Drive…');
  await getAccessToken();

  onProgress?.('Looking for backup…');
  const fileId = await findBackupFileId();
  if (!fileId) return null;

  onProgress?.('Downloading backup…');
  // Use gapi client to read — avoids CORS issue with direct fetch of content
  const resp = await (window as any).gapi.client.drive.files.get({
    fileId,
    alt: 'media',
  });

  const parsed = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.result;
  if (!parsed?.items || !Array.isArray(parsed.items)) {
    throw new Error('Backup file format not recognised.');
  }

  return parsed.items as GalleryBackupItem[];
}

/**
 * Signs the user out of Drive (clears the token).
 * The next backup/restore will prompt for sign-in again.
 */
export function driveSignOut(): void {
  if (currentToken) {
    (window as any).google?.accounts?.oauth2?.revoke(currentToken, () => {});
  }
  (window as any).gapi?.client?.setToken(null);
  currentToken = null;
  tokenClient = null;
}
