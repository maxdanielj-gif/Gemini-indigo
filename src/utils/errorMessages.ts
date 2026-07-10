/**
 * Turns raw JS/fetch error messages into something a person can actually act
 * on. Browsers throw very generic, low-level wording when a network request
 * never gets a response at all (as opposed to the server responding with an
 * error, which already gets a specific message elsewhere in this app):
 *
 *   Chrome/Edge : "Failed to fetch"
 *   Firefox     : "NetworkError when attempting to fetch resource"
 *   Safari      : "Load failed"
 *
 * These all mean the same thing — the request never reached the server, or
 * never got a response back — usually because of no internet connection, or
 * (very commonly on free-tier Render hosting) the server was asleep and slow
 * to wake up. This is a distinct failure mode from the app's own detailed
 * error messages (e.g. "Gemini blocked this prompt..."), which only appear
 * once a response has actually come back.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const isNetworkFailure =
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed|network request failed/i.test(raw);

  if (isNetworkFailure) {
    return "Couldn't reach the server. Check your internet connection — or if the app hasn't been used in a while, the server may still be waking up. Try again in a moment.";
  }

  return raw || "Something went wrong.";
}
