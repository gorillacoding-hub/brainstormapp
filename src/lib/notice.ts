/** Tiny one-line message shown at the bottom of the screen. */
export const NOTICE_EVENT = "filament:notice";

export function notify(message: string) {
  window.dispatchEvent(new CustomEvent<string>(NOTICE_EVENT, { detail: message }));
}
