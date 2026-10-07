import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assertPublicationRequest } from '../../scripts/windows-release-policy.mjs';

const sha = 'a'.repeat(40);
const env = { GITHUB_ACTIONS: 'true', CI: 'true', GITHUB_REPOSITORY: 'KingGogusV/Project-PDF-reader-',
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: sha };
const event = { inputs: { publish: 'true', expected_source_sha: sha } };

test('publication accepts only an explicit source-matched main dispatch', () => {
  for (const publish of [true, 'true']) {
    assert.doesNotThrow(() => assertPublicationRequest(env, { inputs: { publish, expected_source_sha: sha } }));
  }
});

test('pushes and pull requests cannot publish even with publication inputs', () => {
  for (const GITHUB_EVENT_NAME of ['push', 'pull_request', 'pull_request_target', 'workflow_run', 'schedule']) {
    assert.throws(() => assertPublicationRequest({ ...env, GITHUB_EVENT_NAME }, event), /explicit workflow_dispatch/);
  }
});

test('verification-only dispatches and malformed opt-in values cannot publish', () => {
  for (const publish of [undefined, false, 'false', '', 'TRUE', 1, '1', {}, []]) {
    assert.throws(() => assertPublicationRequest(env, { inputs: { publish, expected_source_sha: sha } }), /not explicitly selected/);
  }
  for (const value of [undefined, null, {}, { inputs: null }]) {
    assert.throws(() => assertPublicationRequest(env, value), /not explicitly selected/);
  }
});

test('publication rejects wrong branches, repositories and non-CI contexts', () => {
  for (const patch of [{ GITHUB_REF: 'refs/heads/test/windows-upgrade-preservation' }, { GITHUB_REF: 'refs/tags/v0.1.1-preview.1' },
    { GITHUB_REPOSITORY: 'another/repository' }, { GITHUB_ACTIONS: 'false' }, { CI: '' }]) {
    assert.throws(() => assertPublicationRequest({ ...env, ...patch }, event), /explicit workflow_dispatch/);
  }
});

test('publication rejects missing, shortened, malformed or stale source confirmation', () => {
  for (const expected_source_sha of [undefined, '', sha.slice(0, 7), 'b'.repeat(40), sha + '\n']) {
    assert.throws(() => assertPublicationRequest(env, { inputs: { publish: true, expected_source_sha } }), /expected source SHA/);
  }
  for (const GITHUB_SHA of ['', 'a'.repeat(39), 'g'.repeat(40)]) {
    assert.throws(() => assertPublicationRequest({ ...env, GITHUB_SHA }, { inputs: { publish: true, expected_source_sha: GITHUB_SHA } }), /expected source SHA/);
  }
});

test('publisher CLI refuses automatic/default/stale requests before any network access', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'folio-publication-policy-'));
  try {
    const payload = join(directory, 'event.json');
    const networkTrap = join(directory, 'network-trap.mjs');
    await writeFile(networkTrap, "globalThis.fetch = () => { throw new Error('UNEXPECTED_NETWORK_ACCESS'); };\n");
    for (const request of [
      { name: 'push', inputs: event.inputs, error: /explicit workflow_dispatch/ },
      { name: 'pull_request', inputs: event.inputs, error: /explicit workflow_dispatch/ },
      { name: 'workflow_dispatch', inputs: {}, error: /not explicitly selected/ },
      { name: 'workflow_dispatch', inputs: { publish: true, expected_source_sha: 'b'.repeat(40) }, error: /expected source SHA/ },
    ]) {
      await writeFile(payload, JSON.stringify({ inputs: request.inputs }));
      const result = spawnSync(process.execPath, ['--import', pathToFileURL(networkTrap).href, 'scripts/windows-release.mjs', 'publish'], {
        cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, ...env, GITHUB_EVENT_NAME: request.name, GITHUB_EVENT_PATH: payload, GITHUB_TOKEN: 'synthetic-unused-token' },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.match(result.stderr, request.error);
      assert.doesNotMatch(result.stderr, /UNEXPECTED_NETWORK_ACCESS/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('explicit publication refuses a conflicting immutable tag before other API calls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'folio-publication-tag-'));
  try {
    const payload = join(directory, 'event.json');
    const mock = join(directory, 'tag-conflict.mjs');
    await writeFile(payload, JSON.stringify(event));
    await writeFile(mock, `globalThis.fetch = async (url, options) => {
      if (url !== 'https://api.github.com/repos/KingGogusV/Project-PDF-reader-/git/ref/tags/v0.1.1-preview.1' ||
          (options.method && options.method !== 'GET')) throw new Error('UNEXPECTED_API_CALL');
      return new Response(JSON.stringify({ object: { type: 'commit', sha: '${'b'.repeat(40)}' } }));
    };\n`);
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(mock).href, 'scripts/windows-release.mjs', 'publish'], {
      cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, ...env, GITHUB_EVENT_PATH: payload, GITHUB_TOKEN: 'synthetic-unused-token' },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Release tag does not identify the verified source commit/);
    assert.doesNotMatch(result.stderr, /UNEXPECTED_API_CALL/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
