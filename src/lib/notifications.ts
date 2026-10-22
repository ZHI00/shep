import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification as sendNativeNotification,
} from "@tauri-apps/plugin-notification";
import { getUnreadSessionCount, useTerminalStore } from "../stores/useTerminalStore";

let permissionGranted = false;
let initialized = false;

export async function initNotifications() {
  if (initialized) return;
  initialized = true;

  const appWindow = getCurrentWindow();
  if (navigator.userAgent.includes("Mac")) {
    let previousCount = -1;
    let pendingBadge = Promise.resolve();
    const syncBadge = () => {
      const count = getUnreadSessionCount(useTerminalStore.getState());
      if (count === previousCount) return;
      previousCount = count;
      // Serialize native writes so an older count cannot overwrite a newer one.
      pendingBadge = pendingBadge
        .then(() => appWindow.setBadgeCount(count || undefined))
        .catch((error) => {
          previousCount = -1;
          if (import.meta.env.DEV) console.error("[shep] dock badge error:", error);
        });
    };
    useTerminalStore.subscribe(syncBadge);
    syncBadge();
  }

  try {
    let focusChanged = false;
    await appWindow.onFocusChanged(({ payload }) => {
      focusChanged = true;
      useTerminalStore.getState().setWindowFocused(payload);
    });
    const focused = await appWindow.isFocused();
    // A focus event during the query is newer than the query's snapshot.
    if (!focusChanged) useTerminalStore.getState().setWindowFocused(focused);
  } catch (error) {
    if (import.meta.env.DEV) console.error("[shep] window focus error:", error);
  }

  try {
    permissionGranted = await isPermissionGranted();
  } catch (error) {
    if (import.meta.env.DEV) console.error("[shep] notification permission error:", error);
  }
}

async function ensureNotificationPermission() {
  if (permissionGranted) return true;

  const permission = await requestPermission();
  permissionGranted = permission === "granted";
  return permissionGranted;
}

export async function notifyAgent(ptyId: number, message: string) {
  useTerminalStore.getState().setTabBell(ptyId, message);

  if (useTerminalStore.getState().windowFocused) {
    return;
  }

  try {
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;
    sendNativeNotification({ title: "Shep", body: message });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[shep] notification error:", error);
    }
  }
}
