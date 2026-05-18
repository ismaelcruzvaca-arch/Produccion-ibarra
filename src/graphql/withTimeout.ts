/**
 * Promise timeout wrapper for network resilience.
 *
 * Pattern: Promise.race + setTimeout
 * Why:
 * - nhost.graphql.request() has no built-in timeout
 * - Without this, unresponsive Nhost freezes the entire app (silent hang)
 * - Clean, composable: wrap any promise, not just Nhost calls
 *
 * Offline-first guarantee:
 * - If Nhost doesn't respond in TIMEout_MS, the promise rejects
 * - Downstream catch blocks fire → fallback data loads → UI stays usable
 *
 * Design decision: Promise.race instead of AbortController
 * - AbortController requires the underlying fetch to support abort signals
 * - nhost.graphql.request() is a client abstraction — we don't control its fetch
 * - Promise.race works universally regardless of the promise implementation
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`La solicitud no respondió en ${ms / 1000} segundos`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout.
 * Rejects with `TimeoutError` if the promise doesn't settle within `ms`.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = setTimeout(() => reject(new TimeoutError(ms)), ms);
      // Unref for test environments so the timer doesn't keep the process alive
      if (typeof id === 'object' && 'unref' in id) {
        (id as NodeJS.Timeout).unref();
      }
    }),
  ]);
}
