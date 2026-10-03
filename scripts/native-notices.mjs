import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = 'x86_64-pc-windows-msvc';
const toolVersion = '0.9.2';
const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'Unicode-3.0', 'Zlib', 'Unlicense', 'CC0-1.0', '0BSD', 'Apache-2.0 WITH LLVM-exception']);
const mpl = new Set(['cssparser@0.37.0', 'cssparser-macros@0.7.1', 'dtoa-short@0.3.5', 'option-ext@0.2.0', 'selectors@0.38.0']);
const clarifiedVersions = new Map([
  ['webview2-com', ['0.39.1']], ['webview2-com-sys', ['0.39.1']], ['webview2-com-macros', ['0.8.1']],
  ['dunce', ['1.0.5']], ['alloc-stdlib', ['0.3.0']], ['brotli-decompressor', ['6.0.1']], ['cargo_toml', ['1.0.1']], ['dpi', ['0.1.2']],
  ['windows-collections', ['0.3.2']], ['windows-core', ['0.62.2']], ['windows-future', ['0.3.2']], ['windows-implement', ['0.60.2']],
  ['windows-interface', ['0.59.3']], ['windows-link', ['0.2.1']], ['windows-numerics', ['0.3.1']], ['windows-result', ['0.4.1']],
  ['windows-strings', ['0.5.1']], ['windows-sys', ['0.59.0', '0.61.2']], ['windows-targets', ['0.52.6']],
  ['windows-threading', ['0.2.1']], ['windows-version', ['0.1.7']], ['windows', ['0.62.2']], ['windows_x86_64_msvc', ['0.52.6']],
]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const key = crate => `${crate.name}@${crate.version}`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const command = (name, args) => execFileSync(name, args, { cwd: project, encoding: 'utf8', maxBuffer: 48 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }).trim();

function lockPackages(text) {
  const packages = new Map();
  for (const block of text.split(/^\[\[package\]\]\s*$/m).slice(1)) {
    const field = name => block.match(new RegExp(`^${name} = "([^"\\r\\n]+)"`, 'm'))?.[1];
    const name = field('name'), version = field('version');
    if (!name || !version) throw new Error('Cannot identify a package in the Cargo lockfile.');
    packages.set(`${name}@${version}`, { name, version, source: field('source'), checksum: field('checksum') });
  }
  if (!packages.size) throw new Error('The committed Cargo lockfile has no packages.');
  return packages;
}

async function noticeFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in crate sources: ${join(directory, entry.name)}`);
    const path = join(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await noticeFiles(path, `${name}/`));
    else if (/^(?:licen[cs]e|copying|copyright|notice|authors?)(?:[._-].*)?$/i.test(entry.name)) {
      const bytes = await readFile(path);
      if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new Error(`Unexpected notice size: ${name}`);
      result.push({ path, relativePath: name, bytes, sha256: hash(bytes) });
    }
  }
  return result;
}

async function main() {
  const output = resolve(project, process.argv[2] || 'src-tauri/generated-notices');
  const withinProject = relative(project, output);
  if (!withinProject || withinProject.startsWith('..') || isAbsolute(withinProject)) throw new Error('Notice output must be a new directory inside this repository.');
  try { if ((await readdir(output)).length) throw new Error(`Refusing to mix notices with an existing nonempty output: ${output}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  const installTool = `cargo install cargo-about --version ${toolVersion} --locked --features cli`;
  let cargoAbout;
  try { cargoAbout = command('cargo', ['about', '--version']); }
  catch (error) { throw new Error(`The cargo-about command is unavailable. Install with ${installTool}; version ${toolVersion} requires the explicit cli feature to install its binary.`, { cause: error }); }
  if (cargoAbout !== `cargo-about ${toolVersion}`) throw new Error(`Expected cargo-about ${toolVersion}; got ${cargoAbout}. Install with ${installTool}.`);
  const lockPath = join(project, 'src-tauri/Cargo.lock');
  const lockBytes = await readFile(lockPath);
  const locked = lockPackages(lockBytes.toString('utf8'));
  const packageManifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  if (packageManifest.devDependencies?.['@tauri-apps/cli'] !== '2.12.1') throw new Error('Review native platform notices when the pinned Tauri CLI changes.');
  // cargo-about deliberately rejects piped stdout under PowerShell. Its own
  // output-file option writes UTF-8 without shell redirection/encoding changes.
  const reportPath = join(project, '.cache', 'native-license-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  command('cargo', ['about', 'generate', '--manifest-path', 'src-tauri/Cargo.toml', '--config', 'scripts/native-licenses.toml', '--target', target, '--locked', '--fail', '--format', 'json', '--output-file', reportPath]);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  if (!Array.isArray(report.crates) || !report.crates.length || !Array.isArray(report.licenses) || !report.licenses.length) throw new Error('cargo-about returned an empty or unrecognized report.');
  if (hash(await readFile(lockPath)) !== hash(lockBytes)) throw new Error('Cargo lockfile changed during notice generation.');

  const coverage = new Map();
  const licenseErrors = [];
  for (const license of report.licenses) {
    if (!license.source_path || typeof license.text !== 'string' || license.text.trim().length < 40) licenseErrors.push(`Missing original ${license.id} text: ${(license.used_by || []).map(item => key(item.crate)).join(', ')}.`);
    for (const item of license.used_by || []) {
      const id = key(item.crate);
      if (!allowed.has(license.id) && !(license.id === 'MPL-2.0' && mpl.has(id))) licenseErrors.push(`Unapproved ${license.id} in ${id}.`);
      const list = coverage.get(id) || [];
      list.push(license.id); coverage.set(id, list);
    }
  }
  for (const entry of report.crates) {
    const crate = entry.package;
    if (!crate.source && crate.name === 'folio-desktop') continue;
    if (clarifiedVersions.has(crate.name) && !clarifiedVersions.get(crate.name).includes(crate.version)) licenseErrors.push(`Review the license clarification for changed ${key(crate)}.`);
    if (!coverage.has(key(crate)) || entry.license === 'Unknown') licenseErrors.push(`No resolved original license covers ${key(crate)}.`);
  }
  if (licenseErrors.length) throw new Error(`License review required:\n${[...new Set(licenseErrors)].map(message => `- ${message}`).join('\n')}\nCanonical SPDX fallbacks are insufficient; add reviewed hash-pinned clarifications. Do not broaden license allowances automatically.`);

  const records = [];
  for (const entry of report.crates) {
    const crate = entry.package, id = key(crate), lockedCrate = locked.get(id);
    if (!crate.source && crate.name === 'folio-desktop') continue;
    if (!coverage.has(id) || entry.license === 'Unknown') throw new Error(`No resolved original license text covers ${id}.`);
    if (!lockedCrate || lockedCrate.source !== 'registry+https://github.com/rust-lang/crates.io-index' || !/^[a-f0-9]{64}$/.test(lockedCrate.checksum || '')) throw new Error(`Unexpected or unpinned registry source for ${id}.`);
    if (crate.source !== lockedCrate.source) throw new Error(`Cargo source differs from lockfile for ${id}.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(crate.name) || !/^[0-9A-Za-z.+-]+$/.test(crate.version)) throw new Error('Unexpected crate name/version.');
    const root = dirname(crate.manifest_path);
    const archive = join(dirname(dirname(root)), '..', 'cache', basename(dirname(root)), `${crate.name}-${crate.version}.crate`);
    const archiveBytes = await readFile(archive);
    if (hash(archiveBytes) !== lockedCrate.checksum) throw new Error(`Crate archive checksum mismatch for ${id}.`);
    let checksums;
    try { checksums = JSON.parse(await readFile(join(root, '.cargo-checksum.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (checksums && checksums.package !== lockedCrate.checksum) throw new Error(`Unverified unpacked crate source for ${id}.`);
    const files = await noticeFiles(root);
    for (const file of files) {
      // Registry caches may omit per-file hashes; compare to the checksum-verified
      // original archive in that case instead of trusting mutable unpacked files.
      const expected = checksums?.files?.[file.relativePath] || hash(execFileSync('tar', ['-xOf', archive, `${crate.name}-${crate.version}/${file.relativePath}`], { maxBuffer: 8 * 1024 * 1024 }));
      if (expected !== file.sha256) throw new Error(`Notice differs from the locked crate: ${id}/${file.relativePath}`);
    }
    records.push({ crate, id, root, files, archive, checksum: lockedCrate.checksum, selectedLicenses: [...new Set(coverage.get(id))], includeSource: coverage.get(id).includes('MPL-2.0') });
  }
  if (!records.some(record => record.crate.name === 'tauri')) throw new Error('Native notice graph unexpectedly excludes Tauri.');

  await mkdir(output, { recursive: true });
  const manifest = {
    schemaVersion: 1, target, cargoAbout, cargoAboutCrateSha256: '0cd19d99696eb83f0a2d6ab7a347b14968d2980416c8cca827ded220e6e9c4bb',
    cargo: command('cargo', ['--version']), rustc: command('rustc', ['--version', '--verbose']), cargoLockSha256: hash(lockBytes),
    policy: 'Permissive SPDX alternatives preferred. Only enumerated exact MPL crate versions accepted; unchanged original source archives accompany them. Includes build dependency notices conservatively.',
    packages: [], licenseTexts: [], platform: [],
  };
  for (const record of records) {
    const folder = `licenses/${record.crate.name}-${record.crate.version}`;
    const copied = [];
    for (const file of record.files) {
      const destination = join(output, folder, file.relativePath);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, file.bytes);
      copied.push({ path: `${folder}/${file.relativePath}`, sha256: file.sha256 });
    }
    let sourceArchive;
    if (record.includeSource) {
      sourceArchive = `sources/${record.crate.name}-${record.crate.version}.crate`;
      await mkdir(join(output, 'sources'), { recursive: true });
      await copyFile(record.archive, join(output, sourceArchive));
    }
    manifest.packages.push({ name: record.crate.name, version: record.crate.version, declaredLicense: record.crate.license, selectedLicenses: record.selectedLicenses, repository: record.crate.repository, registryArchiveSha256: record.checksum, notices: copied, sourceArchive });
  }

  const sections = [];
  for (const [index, license] of report.licenses.entries()) {
    const path = `license-texts/${String(index + 1).padStart(3, '0')}.txt`;
    await mkdir(join(output, 'license-texts'), { recursive: true });
    await writeFile(join(output, path), license.text);
    const usedBy = license.used_by.map(item => key(item.crate));
    manifest.licenseTexts.push({ id: license.id, path, sha256: hash(license.text), usedBy });
    sections.push(`<section><h2>${escape(license.name)}</h2><p>${usedBy.map(escape).join(', ')}</p><pre>${escape(license.text)}</pre></section>`);
  }
  // Platform/compiler/installer notices are added here before the complete manifest is written.
  const { collectPlatformNotices } = await import('./native-platform-notices.mjs');
  manifest.platform = await collectPlatformNotices({ output, target, packages: manifest.packages });
  await writeFile(join(output, 'Cargo-THIRD-PARTY-NOTICES.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Folio native dependency notices</title><style>body{max-width:70rem;margin:2rem auto;padding:0 1rem;font:16px system-ui;color:#182527}pre{white-space:pre-wrap;overflow-wrap:anywhere}section{border-top:1px solid #ccd8d8;margin-top:2rem}h2{font-size:1.3rem}</style><h1>Folio native dependency notices</h1><p>Windows target ${target}. Cargo lock SHA-256: ${manifest.cargoLockSha256}. Full crate notices, compiler/platform notices and unchanged MPL source archives accompany this file. These third-party terms do not grant a license to Folio's own source.</p>${sections.join('\n')}</html>`);
  await writeFile(join(output, 'README.txt'), `Folio Windows native third-party notices\n\nOpen Cargo-THIRD-PARTY-NOTICES.html for dependency license texts. The licenses/ directory preserves original crate LICENSE, COPYING, NOTICE, COPYRIGHT and AUTHORS files. Platform notices are under platform/.\n\nThe sources/ directory contains the unchanged original registry archives for the specifically accepted MPL-2.0 crates. These source archives correspond to the exact Cargo.lock checksums and are distributed under their own terms; no changes were made to those sources. Build-time dependencies are conservatively included.\n\nmanifest.json records the target, exact tool/compiler and lockfile, selected licenses, source checksums and notice hashes. This collection addresses the inspected native dependency inventory; it is not a general legal opinion or security audit. Browser/PDF/OCR dependencies have separate notices embedded in the application vendor assets. This downloadable native-notices archive covers only the native inventory described above.\n`);
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Native notices complete: ${records.length} crates, ${manifest.licenseTexts.length} original license texts, ${records.filter(record => record.includeSource).length} unchanged MPL source archives.`);
}

main().catch(error => { console.error(`Native notice gate failed: ${error.message}`); process.exitCode = 1; });
