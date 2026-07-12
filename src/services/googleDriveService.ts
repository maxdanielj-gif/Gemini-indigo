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
 * Backs up the gallery to Google Drive appDataFolder as a single JSON file.
 *
 * Items are supplied one at a time by an async generator (typically read
 * straight from IndexedDB) and streamed to Drive using a resumable upload —
 * so the phone never holds more than ~one image plus one upload chunk in
 * memory, no matter how large the gallery is. The old approach
 * (JSON.stringify the entire gallery into one giant string) crashed the tab
 * once the gallery outgrew the browser's memory budget.
 *
 * Returns the number of images backed up.
 */
export async function driveBackupGallery(
  loadItems: () => AsyncIterable<GalleryBackupItem>,
  onProgress?: (step: string) => void,
): Promise<number> {
  onProgress?.('Signing in to Google Drive…');
  const token = await getAccessToken();

  onProgress?.('Preparing upload…');
  const existingId = await findBackupFileId();

  // ── Open a resumable upload session ──
  const sessionResp = existingId
    ? await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=resumable`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' }),
      })
    : await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json', parents: ['appDataFolder'] }),
      });
  if (!sessionResp.ok) throw new Error(`Drive upload failed to start: ${sessionResp.status} ${await sessionResp.text().catch(() => '')}`);
  const sessionUri = sessionResp.headers.get('Location') || sessionResp.headers.get('location');
  if (!sessionUri) throw new Error('Drive did not return an upload session. Please try again.');

  // ── Stream the JSON body in 4 MB chunks (must be multiples of 256 KiB) ──
  const encoder = new TextEncoder();
  const CHUNK = 4 * 1024 * 1024;
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let offset = 0;

  const takeBytes = (n: number): Uint8Array => {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      const head = pending[0];
      const need = n - filled;
      if (head.length <= need) {
        out.set(head, filled);
        filled += head.length;
        pending.shift();
      } else {
        out.set(head.subarray(0, need), filled);
        pending[0] = head.subarray(need);
        filled += need;
      }
    }
    pendingBytes -= n;
    return out;
  };

  const putChunk = async (bytes: Uint8Array, isLast: boolean): Promise<void> => {
    const total = isLast ? String(offset + bytes.length) : '*';
    const resp = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Range': bytes.length > 0
          ? `bytes ${offset}-${offset + bytes.length - 1}/${total}`
          : `bytes */${total}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes as unknown as BodyInit,
    });
    // 308 = "keep going"; 200/201 = final chunk accepted
    if (resp.status !== 308 && !resp.ok) {
      throw new Error(`Drive upload failed at ${Math.round(offset / 1024 / 1024)} MB: ${resp.status} ${await resp.text().catch(() => '')}`);
    }
    offset += bytes.length;
  };

  const push = async (text: string): Promise<void> => {
    const bytes = encoder.encode(text);
    pending.push(bytes);
    pendingBytes += bytes.length;
    while (pendingBytes >= CHUNK) {
      await putChunk(takeBytes(CHUNK), false);
    }
  };

  // ── Body ──
  await push(`{"version":1,"backedUpAt":${Date.now()},"items":[`);
  let count = 0;
  for await (const raw of loadItems()) {
    let item = raw;
    // For http URLs, fetch and convert to base64 so the backup is self-contained
    if (item.url?.startsWith('http')) {
      try {
        const r = await fetch(item.url);
        if (r.ok) {
          const blob = await r.blob();
          const b64 = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          });
          item = { ...item, url: b64 };
        }
      } catch { /* keep original URL on error */ }
    }
    await push((count > 0 ? ',' : '') + JSON.stringify(item));
    count++;
    onProgress?.(`Uploading image ${count}…`);
  }
  await push(']}');

  // Flush the remainder as the final chunk (any size is allowed for the last one)
  const rest = pendingBytes > 0 ? takeBytes(pendingBytes) : new Uint8Array(0);
  await putChunk(rest, true);

  return count;
}

/**
 * Restores gallery images from Google Drive.
 *
 * The backup is a single JSON file that can contain the *entire* gallery as
 * base64 — easily hundreds of MB. The old implementation downloaded the whole
 * file into one giant string and JSON.parse()d it, which briefly holds 2-3
 * copies of everything in memory and reliably crashes the tab on phones
 * ("Aw, Snap!"). This version streams the download and peels one image object
 * out of the JSON at a time, so peak memory is roughly ONE image, not the
 * whole gallery.
 *
 * - If `onItem` is provided, each image is handed to it as soon as it has
 *   been parsed and is then released; the function returns an empty array
 *   (use your own counter in the callback). Returns null if no backup exists.
 * - If `onItem` is omitted, behaves like before and returns the full array
 *   (only safe for small galleries — prefer passing onItem).
 */
export async function driveRestoreGallery(
  onProgress?: (step: string) => void,
  onItem?: (item: GalleryBackupItem, index: number) => Promise<void> | void,
): Promise<GalleryBackupItem[] | null> {
  onProgress?.('Signing in to Google Drive…');
  const token = await getAccessToken();

  onProgress?.('Looking for backup…');
  const fileId = await findBackupFileId();
  if (!fileId) return null;

  onProgress?.('Downloading backup…');

  // Stream the file with fetch (gapi cannot stream — it buffers the entire
  // response body as one string, which is exactly the memory bomb we're
  // avoiding). If the streaming fetch fails for any reason, fall back to the
  // old gapi whole-body path below so small galleries still restore.
  let resp: Response | null = null;
  try {
    resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    resp = null;
  }

  if (!resp || !resp.ok || !resp.body) {
    // Fallback: legacy non-streaming path (fine for small backups).
    const legacy = await (window as any).gapi.client.drive.files.get({ fileId, alt: 'media' });
    const parsed = typeof legacy.body === 'string' ? JSON.parse(legacy.body) : legacy.result;
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      throw new Error('Backup file format not recognised.');
    }
    if (!onItem) return parsed.items as GalleryBackupItem[];
    for (let i = 0; i < parsed.items.length; i++) await onItem(parsed.items[i], i);
    return [];
  }

  // ── Incremental scan of {"version":..,"backedUpAt":..,"items":[ {..}, {..} ]}
  // Tracks JSON string/escape state and brace depth so item boundaries are
  // found correctly even when prompts contain braces, quotes, or "items".
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  const collected: GalleryBackupItem[] = [];
  let delivered = 0;

  let buf = '';
  let phase: 'seekItems' | 'seekColon' | 'seekBracket' | 'inArray' | 'done' = 'seekItems';
  let depth = 0;            // current nesting depth ({ and [ increase, } and ] decrease)
  let arrayDepth = 0;       // depth *inside* the items array
  let inString = false;
  let escape = false;
  let expectingKey = false; // at depth 1: next string is an object key
  let capturingKey = false;
  let keyChars = '';
  let itemStart = -1;       // index in buf where the current item's '{' sits
  let pos = 0;              // scan position in buf — persists across chunks so
                            // large items aren't re-scanned on every chunk

  const deliver = async (raw: string) => {
    let item: GalleryBackupItem;
    try {
      item = JSON.parse(raw);
    } catch {
      throw new Error('Backup file appears to be corrupted (an image entry could not be read).');
    }
    delivered++;
    if (onItem) {
      await onItem(item, delivered - 1);
    } else {
      collected.push(item);
    }
    onProgress?.(`Downloaded image ${delivered}…`);
  };

  streamLoop:
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    while (pos < buf.length) {
      const c = buf[pos];

      if (inString) {
        if (escape) { escape = false; }
        else if (c === '\\') { escape = true; }
        else if (c === '"') {
          inString = false;
          if (capturingKey) {
            capturingKey = false;
            if (phase === 'seekItems' && keyChars === 'items') phase = 'seekColon';
          }
        } else if (capturingKey) {
          keyChars += c;
        }
        pos++;
        continue;
      }

      switch (c) {
        case '"':
          inString = true;
          if (phase === 'seekItems' && depth === 1 && expectingKey) {
            capturingKey = true;
            keyChars = '';
          }
          break;
        case '{':
          if (phase === 'seekBracket') phase = 'seekItems'; // "items" wasn't an array — keep looking
          if (phase === 'inArray' && depth === arrayDepth && itemStart === -1) {
            itemStart = pos;
          }
          depth++;
          expectingKey = true;
          break;
        case '[':
          if (phase === 'seekBracket') {
            phase = 'inArray';
            arrayDepth = depth + 1;
          }
          depth++;
          break;
        case '}':
          depth--;
          if (phase === 'inArray' && depth === arrayDepth && itemStart >= 0) {
            await deliver(buf.slice(itemStart, pos + 1));
            // Trim everything already consumed so buf never grows past
            // (largest single item + one network chunk).
            buf = buf.slice(pos + 1);
            pos = -1; // will be ++'d to 0
            itemStart = -1;
          }
          break;
        case ']':
          depth--;
          if (phase === 'inArray' && depth === arrayDepth - 1) {
            phase = 'done';
            break streamLoop;
          }
          break;
        case ':':
          if (phase === 'seekColon') phase = 'seekBracket';
          expectingKey = false;
          break;
        case ',':
          expectingKey = true;
          break;
        default:
          // Whitespace / numbers / literals — if we were mid-detection of the
          // items key sequence and hit something unexpected, reset detection.
          if ((phase === 'seekColon' || phase === 'seekBracket') && !/\s/.test(c)) {
            phase = 'seekItems';
          }
          break;
      }
      pos++;
    }

    // Between items nothing before the current item start is ever needed again.
    if (itemStart === -1) {
      buf = '';
      pos = 0;
    } else if (itemStart > 0) {
      buf = buf.slice(itemStart);
      pos -= itemStart;
      itemStart = 0;
    }
  }

  try { reader.cancel(); } catch { /* stream may already be closed */ }

  if (phase !== 'done') {
    if (delivered > 0) {
      throw new Error(`Backup download ended early — ${delivered} image(s) were restored before it stopped. Run restore again to retry.`);
    }
    throw new Error('Backup file format not recognised.');
  }

  return onItem ? [] : collected;
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
