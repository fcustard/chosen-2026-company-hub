import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fetchScriptFeed } from './script-feed.mjs';

const payload = { text: 'Master script' };
const ok = () => new Response(JSON.stringify(payload));

test('recovers from a timeout and throttling with bounded backoff', async () => {
  let attempts = 0;
  const delays = [], warnings = [];
  const result = await fetchScriptFeed('https://example.test/private-feed', {
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Accept, 'application/json');
      assert.ok(options.signal instanceof AbortSignal);
      attempts++;
      if (attempts === 1) throw new DOMException('Timed out', 'TimeoutError');
      if (attempts === 2) return new Response('', { status: 429 });
      return ok();
    },
    sleep: async ms => delays.push(ms),
    warn: message => warnings.push(message)
  });
  assert.deepEqual(result, payload);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [2000, 4000]);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every(message => !message.includes('private-feed')));
});

for (const status of [408, 429, 500, 502, 503, 504]) {
  test(`HTTP ${status} stops after three attempts`, async () => {
    let attempts = 0;
    await assert.rejects(fetchScriptFeed('unused', {
      fetchImpl: async () => { attempts++; return new Response('', { status }); },
      sleep: async () => {}, warn: () => {}
    }), error => error.retryable && error.message.includes('after 3 attempt(s)'));
    assert.equal(attempts, 3);
  });
}

for (const [name, response] of [
  ['authorization failure', () => new Response('private content', { status: 403 })],
  ['malformed JSON', () => new Response('private content')]
]) {
  test(`${name} fails immediately without leaking feed content`, async () => {
    let attempts = 0;
    await assert.rejects(fetchScriptFeed('unused', {
      fetchImpl: async () => { attempts++; return response(); },
      sleep: async () => assert.fail('must not retry'), warn: () => {}
    }), error => !error.retryable && !error.message.includes('private content'));
    assert.equal(attempts, 1);
  });
}

test('network failures retry, then recover', async () => {
  let attempts = 0;
  assert.deepEqual(await fetchScriptFeed('unused', {
    fetchImpl: async () => {
      if (++attempts < 3) throw new TypeError('fetch failed');
      return ok();
    }, sleep: async () => {}, warn: () => {}
  }), payload);
  assert.equal(attempts, 3);
});

for (const phase of ['headers', 'body']) {
  test(`deadline covers stalled ${phase} and retries the real HTTP request`, async () => {
    let attempts = 0;
    const server = createServer((_request, response) => {
      if (++attempts === 1) {
        if (phase === 'body') {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.write('{');
        }
        return; // Client must abort this connection.
      }
      response.end(JSON.stringify(payload));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      assert.deepEqual(await fetchScriptFeed(`http://127.0.0.1:${server.address().port}`, {
        timeoutMs: 500, sleep: async () => {}, warn: () => {}
      }), payload);
      assert.equal(attempts, 2);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}

test('CLI preserves existing scripts on failed direct publish and respects routine fallback', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'chosen-script-feed-'));
  const script = fileURLToPath(new URL('./sync-script-doc.mjs', import.meta.url));
  const data = path.join(root, 'data');
  mkdirSync(path.join(data, 'scenes'), { recursive: true });
  const original = new Map();
  const save = (file, value) => {
    const content = JSON.stringify(value);
    writeFileSync(file, content);
    original.set(file, content);
  };
  save(path.join(data, 'scripts.json'), Array.from({ length: 12 }, (_, i) => ({ scene: i + 1 })));
  for (let i = 1; i <= 12; i++) {
    save(path.join(data, 'scenes', `scene-${String(i).padStart(2, '0')}.json`), { scene: i });
  }
  const preload = path.join(root, 'mock-fetch.mjs');
  writeFileSync(preload, `globalThis.fetch = async () => process.env.TEST_BAD_JSON === 'true'
    ? new Response('invalid JSON') : new Response('', { status: 503 });`);
  const run = (event, badJson = false) => spawnSync(process.execPath,
    ['--import', pathToFileURL(preload).href, script], {
      cwd: root, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, SCRIPT_DOC_FEED_FILE: '', SCRIPT_DOC_FEED_URL: 'https://example.test',
        SCRIPT_DOC_SYNC_ALLOW_FETCH_FAILURE: 'true', GITHUB_EVENT_NAME: event,
        TEST_BAD_JSON: String(badJson) }
    });
  try {
    const direct = run('repository_dispatch');
    assert.equal(direct.status, 1, direct.error?.message || direct.stderr);
    assert.match(direct.stderr, /HTTP 503 after 3 attempt/);
    assert.doesNotMatch(direct.stderr, /Keeping the last published/);
    const routine = run('push');
    assert.equal(routine.status, 0, routine.stderr);
    assert.match(routine.stderr, /Keeping the last published/);
    const invalid = run('push', true);
    assert.equal(invalid.status, 1, invalid.stderr);
    for (const [file, content] of original) assert.equal(readFileSync(file, 'utf8'), content);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
