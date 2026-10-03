// Read-only artifact reuse for harness diagnosis. Never a release/publication gate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const repo = 'KingGogusV/Project-PDF-reader-';
assert.equal(process.env.GITHUB_REPOSITORY, repo);
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.CI, 'true');
const id = process.env.DIAGNOSTIC_ARTIFACT_ID;
const digest = process.env.DIAGNOSTIC_ARTIFACT_SHA256;
const source = process.env.DIAGNOSTIC_SOURCE_SHA;
const head = process.env.GITHUB_SHA;
assert.match(id || '', /^\d+$/);
for (const sha of [source, head]) assert.match(sha || '', /^[a-f0-9]{40}$/);
assert.match(digest || '', /^[a-f0-9]{64}$/);
async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Diagnostic artifact request failed: ${response.status}`);
  return response;
}
const artifact = await (await api(`/actions/artifacts/${id}`)).json();
assert.equal(artifact.expired, false);
assert.equal(artifact.workflow_run.head_sha, source);
assert.equal(artifact.workflow_run.repository_id, 1402448318);
assert.match(artifact.name, /^folio-unpublished-diagnostic-installer-\d+$/);
assert.equal(artifact.digest, `sha256:${digest}`);
assert.ok(artifact.size_in_bytes < 200 * 1024 * 1024);
const comparison = await (await api(`/compare/${source}...${head}`)).json();
assert.ok(['ahead', 'identical'].includes(comparison.status), 'Diagnostic source must be an ancestor.');
assert.ok(Array.isArray(comparison.files) && comparison.files.length < 300, 'Require complete comparison.');
const allowed = /^(?:tests\/native\/|\.github\/workflows\/|docs\/|scripts\/native-diagnostic\.mjs$|(?:PROJECT|ARCHITECTURE|MAINTENANCE|RESEARCH|CHANGELOG|BACKLOG|README)\.md$|\.gitignore$)/;
for (const file of comparison.files) {
  assert.ok(allowed.test(file.filename) && (!file.previous_filename || allowed.test(file.previous_filename)),
    `Compiled application inputs changed: ${file.filename}. Build a new installer before diagnosis.`);
}
const bytes = Buffer.from(await (await api(`/actions/artifacts/${id}/zip`)).arrayBuffer());
assert.ok(bytes.length < 200 * 1024 * 1024);
assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
await mkdir('.cache/native-diagnostic', { recursive: true });
await writeFile('.cache/native-diagnostic/installer.zip', bytes, { flag: 'wx' });
console.log(JSON.stringify({ purpose: 'diagnosis only', artifactId: id, source, harness: head, sha256: digest }));
