export const MINUTES_IDLE_MS = 15 * 60 * 1000;
export const MINUTES_EXPIRED_MESSAGE =
  "Your session expired due to inactivity. Please sign in again.";
export const MINUTES_UNAVAILABLE_MESSAGE =
  "Sign-in is temporarily unavailable. Try again in a moment.";
export const MINUTES_ACTIVITY_STORAGE_KEY = "ym_minutes_activity";
export const MINUTES_LOGOUT_STORAGE_KEY = "ym_minutes_idle_logout";
export const MINUTES_EXPIRED_NOTICE_KEY = "ym_minutes_expired_notice";

export function idleDeadline(lastActivity: number) {
  return lastActivity + MINUTES_IDLE_MS;
}

export function isIdleExpired(lastActivity: number, now: number) {
  return !Number.isFinite(lastActivity) || now - lastActivity >= MINUTES_IDLE_MS;
}

export function publishMinutesLock() {
  localStorage.setItem(
    MINUTES_LOGOUT_STORAGE_KEY,
    JSON.stringify({ at: Date.now(), reason: "lock" }),
  );
  localStorage.removeItem(MINUTES_ACTIVITY_STORAGE_KEY);
  sessionStorage.removeItem(MINUTES_EXPIRED_NOTICE_KEY);
}
