/**
 * Reliably triggers a "Save file" download, including on Android Chrome.
 *
 * Why this is needed:
 * A plain `<a href="..." download>` only works when the browser considers the
 * link "downloadable" — which for most mobile browsers means the URL must be
 * same-origin, or a data:/blob: URL. If the URL points to another domain
 * (e.g. a WaveSpeed CDN link, or a Firebase Storage download URL), Android
 * Chrome silently ignores the `download` attribute and just navigates to /
 * opens the resource instead — which looks like "it just opens full screen".
 *
 * The fix is to fetch the bytes ourselves and hand the browser a local
 * blob: URL, which is always same-origin and always downloadable.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    // data: and blob: URLs are already local — no fetch needed.
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      triggerAnchorDownload(url, filename);
      return;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerAnchorDownload(objectUrl, filename);
    // Give the browser a moment to start the save before revoking.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch (err) {
    // Most likely a cross-origin server that doesn't allow us to fetch its
    // bytes directly (no CORS headers). We can't force a silent download in
    // that case — the best fallback is to open it so the user can long-press
    // → "Download image" / "Save image" themselves.
    console.warn('downloadFile: falling back to opening the file directly', err);
    window.open(url, '_blank');
  }
}

function triggerAnchorDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  // Intentionally no target="_blank" — that tells mobile browsers to open a
  // new view instead of downloading, which defeats the purpose here.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
