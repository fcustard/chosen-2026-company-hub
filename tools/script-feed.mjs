import { setTimeout as delay } from 'node:timers/promises';

export class ScriptFeedRequestError extends Error {
  constructor(message, retryable) {
    super(message);
    this.name = 'ScriptFeedRequestError';
    this.retryable = retryable;
  }
}

// Three 60-second requests plus 2/4-second backoff fit inside the 10-minute job.
// The deadline covers redirects and the entire response body, not just headers.
export async function fetchScriptFeed(url, {
  fetchImpl = fetch,
  timeoutMs = 60_000,
  sleep = delay,
  warn = console.warn
} = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let body;
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ScriptFeedRequestError(
          `Master Script feed returned HTTP ${response.status}`,
          response.status === 408 || response.status === 429 || response.status >= 500
        );
      }
      body = await response.text();
    } catch (error) {
      const failure = error instanceof ScriptFeedRequestError ? error :
        new ScriptFeedRequestError(
          `Master Script feed request failed (${error.name || 'network error'})`,
          ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name)
        );
      if (!failure.retryable || attempt === 3) {
        failure.message += ` after ${attempt} attempt(s).`;
        throw failure;
      }
      const backoffMs = attempt * 2_000;
      warn(`${failure.message}; retrying (${attempt + 1}/3) in ${backoffMs / 1000}s.`);
      await sleep(backoffMs);
      continue;
    }

    // Malformed or invalid feed content is not a temporary transport failure.
    try {
      return JSON.parse(body);
    } catch {
      throw new ScriptFeedRequestError('Master Script feed did not return valid JSON.', false);
    }
  }
}
