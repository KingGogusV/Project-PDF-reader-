import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyNsisBinaryIdentity } from './native-binary-identity.mjs';
import { assertPublicationRequest } from './windows-release-policy.mjs';

const repository = 'KingGogusV/Project-PDF-reader-';
const tag = 'v0.1.1-preview.1';
const exeName = 'Folio-0.1.1-Windows-x64-Setup.exe';
const noticesName = 'Folio-0.1.1-Third-Party-Notices.zip';
const output = resolve('.cache/windows-release');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const revision = process.env.GITHUB_SHA;
const token = process.env.GITHUB_TOKEN;
const apiRoot = `https://api.github.com/repos/${repository}`;
const requireCI = () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true' || process.env.GITHUB_REPOSITORY !== repository || !/^[0-9a-f]{40}$/.test(revision || ''))
    throw new Error('Release operations require this repository\'s authenticated CI context.');
};

async function api(path, options = {}, allowed = []) {
  const response = await fetch(apiRoot + path, {
    ...options, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, signal: AbortSignal.timeout(120000),
  });
  if (!response.ok && !allowed.includes(response.status)) throw new Error(`GitHub ${options.method || 'GET'} ${path.split('?')[0]} returned ${response.status}.`);
  return response;
}

async function prepare() {
  requireCI();
  if (process.platform !== 'win32') throw new Error('Prepare requires the Windows build runner.');
  const directory = 'src-tauri/target/release/bundle/nsis';
  const files = (await readdir(directory)).filter(file => file.endsWith('.exe'));
  if (files.length !== 1) throw new Error('Expected exactly one NSIS installer.');
  const bytes = await readFile(join(directory, files[0]));
  if (bytes.length < 1024 * 1024 || bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Invalid installer executable.');
  const report = JSON.parse(await readFile('test-results/native-windows/report.json', 'utf8'));
  const builtExecutable = await readFile('src-tauri/target/release/folio-desktop.exe');
  const builtExecutableSha256 = sha256(builtExecutable);
  console.log(JSON.stringify({ nativeStatus: report.status, nativeMode: report.mode,
    reportSource: report.sourceCommit, expectedSource: revision,
    installedExecutableSha256: report.executable?.sha256, builtExecutableSha256,
    launches: report.launches?.map(launch => ({ status:launch.status, cleanup:launch.cleanup, webview:launch.webview })),
    checks: report.checks?.length, allChecksPassed: report.checks?.every(check => check.status === 'passed') }));
  if (!process.env.FOLIO_NATIVE_EXE || resolve(report.executable?.path || '') !== resolve(process.env.FOLIO_NATIVE_EXE))
    throw new Error('Native report does not identify the installed executable.');
  const cli = JSON.parse(await readFile('node_modules/@tauri-apps/cli/package.json', 'utf8'));
  const binaryIdentity = verifyNsisBinaryIdentity(builtExecutable, await readFile(process.env.FOLIO_NATIVE_EXE), cli.version);
  console.log(JSON.stringify({ binaryIdentity }));
  if (report.status !== 'passed' || report.mode !== 'hosted-ci' || report.sourceCommit !== revision ||
      report.executable?.sha256 !== binaryIdentity.installedSha256 ||
      report.launches?.length !== 2 || !report.nativeCloseConfirmed || !report.launches.every(launch => ['stopped','closed'].includes(launch.status) &&
        launch.cleanup?.ownedJobEmpty && launch.cleanup?.policyRemoved && launch.webview?.profileVerified && launch.webview?.portVerified) ||
      report.checks?.length < 14 || !report.checks.every(check => check.status === 'passed'))
    throw new Error('Installed native verification, source/binary identity, or process/policy cleanup did not pass.');
  const manifest = JSON.parse(await readFile('src-tauri/generated-notices/manifest.json', 'utf8'));
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length) throw new Error('Release output is not empty; refuse stale artifacts.');
  await copyFile(join(directory, files[0]), join(output, exeName));
  // The source directory is fixed, generated and checked by the native notice gate.
  const zipScript = "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath 'src-tauri/generated-notices' -DestinationPath '.cache/windows-release/" + noticesName + "'";
  execFileSync('pwsh', ['-NoProfile', '-Command', zipScript], { stdio: 'inherit' });
  const provenance = { repository, sourceCommit: revision, tag, version: '0.1.1', architecture: 'Windows x64',
    runId: Number(process.env.GITHUB_RUN_ID), signed: false, nativeSmoke: report, binaryIdentity, noticeManifest: manifest,
    artifacts: await Promise.all([exeName, noticesName].map(async name => { const data = await readFile(join(output, name)); return { name, bytes: data.length, sha256: sha256(data) }; })) };
  await writeFile(join(output, 'release-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  const sums = [...provenance.artifacts, { name: 'release-provenance.json', sha256: sha256(await readFile(join(output, 'release-provenance.json'))) }];
  await writeFile(join(output, 'SHA256SUMS.txt'), sums.map(x => `${x.sha256}  ${x.name}`).join('\n') + '\n');
  console.log(JSON.stringify({ sourceCommit: revision, files: provenance.artifacts, nativeSmoke: 'passed' }));
}

async function requireReaderChecks() {
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const data = await (await api(`/actions/workflows/checks.yml/runs?event=push&head_sha=${revision}&per_page=20`)).json();
    const run = data.workflow_runs?.find(r => r.head_sha === revision && r.event === 'push' && r.head_branch === 'main');
    if (run?.status === 'completed') {
      if (run.conclusion !== 'success') throw new Error(`Reader checks did not pass: ${run.conclusion}. No release published.`);
      return run.html_url;
    }
    console.log('Waiting for Reader checks on the exact main source revision.');
    await delay(30000);
  }
  throw new Error('Timed out waiting for source-matched Reader checks. No release published.');
}

async function verifyTag(allowMissing) {
  const response = await api(`/git/ref/tags/${tag}`, {}, [404]);
  if (response.status === 404 && allowMissing) return;
  if (!response.ok) throw new Error('Published release tag is missing.');
  let object = (await response.json()).object;
  for (let depth = 0; object?.type === 'tag' && depth < 5; depth++) object = (await (await api(`/git/tags/${object.sha}`)).json()).object;
  if (object?.type !== 'commit' || object.sha !== revision) throw new Error('Release tag does not identify the verified source commit.');
}

async function publish() {
  requireCI();
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  assertPublicationRequest(process.env, event);
  if (!token) throw new Error('Publication requires a scoped token.');
  // Refuse an existing tag at another source before waiting for checks or
  // downloading artifacts. The later checks still protect publication races.
  await verifyTag(true);
  const readerRun = await requireReaderChecks();
  const runId = Number(process.env.GITHUB_RUN_ID);
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error('Invalid workflow run.');
  const run = await (await api(`/actions/runs/${runId}`)).json();
  if (run.head_sha !== revision || run.head_branch !== 'main' || run.event !== 'workflow_dispatch' || run.repository?.full_name !== repository) throw new Error('Workflow source provenance mismatch.');
  const list = await (await api(`/actions/runs/${runId}/artifacts?per_page=100`)).json();
  const artifact = list.artifacts?.find(a => a.name === `folio-windows-release-${runId}` && !a.expired);
  if (!artifact || artifact.workflow_run?.head_sha !== revision || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest || '') || artifact.size_in_bytes > 300 * 1024 * 1024) throw new Error('Missing source-matched artifact digest or oversized archive.');
  const zip = Buffer.from(await (await api(`/actions/artifacts/${artifact.id}/zip`)).arrayBuffer());
  if (zip.length > 300 * 1024 * 1024 || 'sha256:' + sha256(zip) !== artifact.digest) throw new Error('Release archive checksum mismatch.');
  await mkdir(resolve('.cache'), { recursive: true });
  const archive = resolve('.cache/windows-release.zip');
  await writeFile(archive, zip);
  execFileSync('python3', ['scripts/unpack-release.py', archive, output], { stdio: 'inherit' });
  const provenance = JSON.parse(await readFile(join(output, 'release-provenance.json'), 'utf8'));
  if (provenance.sourceCommit !== revision || provenance.repository !== repository || provenance.runId !== runId || provenance.nativeSmoke?.status !== 'passed') throw new Error('Release provenance does not match the verified build.');
  if (!Array.isArray(provenance.artifacts) || provenance.artifacts.length !== 2 || new Set(provenance.artifacts.map(item => item.name)).size !== 2) throw new Error('Release inventory must contain exactly the installer and notices.');
  for (const item of provenance.artifacts) {
    if (![exeName, noticesName].includes(item.name)) throw new Error('Unexpected release file.');
    const bytes = await readFile(join(output, item.name));
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error('Extracted asset checksum mismatch.');
  }
  const expectedSums = [...provenance.artifacts, { name: 'release-provenance.json', sha256: sha256(await readFile(join(output, 'release-provenance.json'))) }].map(item => `${item.sha256}  ${item.name}`).join('\n') + '\n';
  if (await readFile(join(output, 'SHA256SUMS.txt'), 'utf8') !== expectedSums) throw new Error('Published checksum list differs from validated artifacts.');
  await verifyTag(true);
  let response = await api(`/releases/tags/${tag}`, {}, [404]);
  let release = response.status === 404 ? null : await response.json();
  if (!release) {
    // The tag endpoint is documented for published releases. Authenticated
    // listing also exposes drafts left behind by a failed asset upload.
    const matches = [];
    for (let page = 1; page <= 10; page++) {
      const releases = await (await api(`/releases?per_page=100&page=${page}`)).json();
      if (!Array.isArray(releases)) throw new Error('Unexpected release listing.');
      matches.push(...releases.filter(item => item.tag_name === tag));
      if (releases.length < 100) break;
      if (page === 10) throw new Error('Release listing exceeded the review limit; refusing duplicate publication.');
    }
    if (matches.length > 1) throw new Error('Multiple releases use this tag; refusing ambiguous publication.');
    release = matches[0] || null;
  }
  const body = (await readFile('docs/releases/windows-preview-2.md', 'utf8')) + `\n\nSource: ${revision}\n\nReader checks: ${readerRun}\n\nInstaller verification: https://github.com/${repository}/actions/runs/${runId}\n`;
  if (!release) release = await (await api('/releases', { method: 'POST', body: JSON.stringify({ tag_name: tag, target_commitish: revision, name: 'Folio for Windows - development preview 0.1.1', body, draft: true, prerelease: true, make_latest: 'false' }) })).json();
  if (release.target_commitish !== revision || !release.prerelease) throw new Error('Existing release belongs to different source or channel; refusing replacement.');
  const names = [exeName, noticesName, 'SHA256SUMS.txt', 'release-provenance.json'];
  for (const name of names) {
    const bytes = await readFile(join(output, name));
    let asset = release.assets?.find(a => a.name === name);
    if (asset) {
      if (asset.size !== bytes.length || asset.digest !== 'sha256:' + sha256(bytes)) throw new Error('Existing release asset differs; refusing overwrite.');
    } else {
      if (!release.draft) throw new Error('Published release is incomplete; refusing an implicit mutation.');
      const upload = new URL(release.upload_url.split('{')[0]);
      if (upload.protocol !== 'https:' || upload.hostname !== 'uploads.github.com') throw new Error('Unexpected release upload origin.');
      upload.searchParams.set('name', name);
      const sent = await fetch(upload, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(180000) });
      if (!sent.ok) throw new Error(`Asset upload failed: ${sent.status}. Release remains draft.`);
      asset = await sent.json();
      if (asset.size !== bytes.length || asset.digest !== 'sha256:' + sha256(bytes)) throw new Error('Uploaded asset digest mismatch. Release remains draft.');
    }
  }
  await verifyTag(true);
  if (release.draft) release = await (await api(`/releases/${release.id}`, { method: 'PATCH', body: JSON.stringify({ draft: false, prerelease: true, make_latest: 'false', body }) })).json();
  const published = await (await api(`/releases/${release.id}`)).json();
  if (published.draft || !published.prerelease || names.some(name => !published.assets?.find(a => a.name === name && a.state === 'uploaded'))) throw new Error('Published release verification failed.');
  await verifyTag(false);
  console.log(JSON.stringify({ release: published.html_url, source: revision, installer: published.assets.find(a => a.name === exeName).browser_download_url }));
}

const mode = process.argv[2];
if (mode === 'prepare') await prepare();
else if (mode === 'publish') await publish();
else throw new Error('Use prepare or publish.');
