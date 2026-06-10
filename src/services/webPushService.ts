/**
 * Web Push Service
 *
 * Handles push notification subscriptions using the standard Web Push API
 * (VAPID). This replaces Firebase Cloud Messaging entirely — no Google
 * account or Firebase project required.
 *
 * How it works:
 *   1. The server exposes its VAPID public key at /api/vapid-public-key
 *   2. The browser subscribes via the Service Worker's pushManager
 *   3. The subscription object (endpoint + encryption keys) is sent to
 *      the server, which stores it per-user and uses web-push to send
 *      notifications when needed
 */

/** Convert a URL-safe base64 VAPID key to the Uint8Array format that
 *  pushManager.subscribe() requires. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export interface PushSetupResult {
  success: boolean;
  endpoint?: string;   // stored as the "token" equivalent
  message: string;
}

/**
 * Request notification permission, subscribe to Web Push, and register
 * the subscription with the server.
 *
 * @param userId  The user's sync ID — needed so the server can look up
 *                the subscription when it wants to send a notification.
 */
export const requestNotificationPermission = async (
  userId?: string
): Promise<PushSetupResult> => {
  // Web Push requires a service worker and a secure context (HTTPS or localhost)
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      success: false,
      message: "Push notifications are not supported in this browser.",
    };
  }

  if (typeof Notification === "undefined") {
    return { success: false, message: "Notification API not available." };
  }

  // Request permission if not already decided
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      success: false,
      message:
        permission === "denied"
          ? "Notification permission denied. Enable it in your browser settings and try again."
          : "Notification permission was not granted.",
    };
  }

  try {
    // Fetch the server's VAPID public key
    const keyRes = await fetch("/api/vapid-public-key");
    if (!keyRes.ok) {
      const err = await keyRes.json().catch(() => ({}));
      return {
        success: false,
        message: err.error || "Push notifications are not configured on the server yet.",
      };
    }
    const { publicKey } = await keyRes.json();

    // Subscribe via the registered Service Worker
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,  // required — push must always show a notification
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send the subscription to the server for storage
    if (userId) {
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), userId }),
      });
    }

    return {
      success: true,
      endpoint: subscription.endpoint,
      message: "Push notifications enabled successfully.",
    };
  } catch (error: any) {
    console.error("Web Push subscription error:", error);
    return {
      success: false,
      message: `Failed to set up push notifications: ${error.message || "Unknown error"}`,
    };
  }
};

/**
 * Foreground message handler — listens for ServiceWorker messages so
 * that if a push arrives while the app is open, we can show a toast
 * instead of (or in addition to) the system notification.
 *
 * Returns an unsubscribe function.
 */
export const onForegroundMessage = (
  callback: (payload: { title?: string; body?: string }) => void
): (() => void) => {
  if (!("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    // The service worker can forward push payloads to the page via postMessage
    if (event.data?.type === "PUSH_RECEIVED") {
      callback({
        title: event.data.title,
        body: event.data.body,
      });
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
};
