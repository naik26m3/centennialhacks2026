// Sound preference persists across reloads in localStorage — deliberately
// separate from the session-scoped app state in sessionStorage
// (lib/context/greenlight-context.tsx), since a sound choice is a durable
// user preference, not part of one analysis session.
//
// Exposed as a tiny external store (subscribe/getSnapshot) rather than a
// plain read function so useGreenlightAudio can consume it via
// useSyncExternalStore — the ESLint-enforced alternative to reading external
// mutable state in a useEffect + setState (react-hooks/set-state-in-effect).
// Unlike the app's main session state (see greenlight-context.tsx for why
// that one still uses the manual-effect pattern instead), nothing here gates
// a redirect decision on an ancestor's value, so there's no equivalent
// ordering hazard.

const STORAGE_KEY = "greenlight:audio-muted";

const listeners = new Set<() => void>();

// Default is sound ON (spec §23 — "have the product ready with sound
// enabled after the first user interaction"); only an explicit prior toggle
// overrides that.
export function getMutePreferenceSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function getServerMutePreferenceSnapshot(): boolean {
  return false;
}

export function subscribeMutePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveMutePreference(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    // storage unavailable — preference just won't persist across reloads
  }
  listeners.forEach((listener) => listener());
}
