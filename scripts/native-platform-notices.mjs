import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const MiB = 1024 * 1024;
const sdkVersion = '1.0.3800.47';
const pluginCommit = '13d9edd27b69310e108d6fbd49f90992f8a05390';
const nsisCommit = '7359413009afd4f0fff472d841fc2f2cc0e0a5f8';

// These hashes were checked against the exact releases used by Tauri CLI 2.12.1
// and webview2-com-sys 0.39.1. Changing either dependency requires renewed review.
const sdk = {
  name: `Microsoft.Web.WebView2 ${sdkVersion}`,
  url: `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${sdkVersion}/microsoft.web.webview2.${sdkVersion}.nupkg`,
  sha256: '56c9f26bdd07916a2d1949fb58a5c7e434dfa1173577dca879206050c4e718db',
  maxBytes: 12 * MiB,
};
const nsis = {
  name: 'NSIS 3.11',
  url: 'https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip',
  sha256: 'c7d27f780ddb6cffb4730138cd1591e841f4b7edb155856901cdf5f214394fa1',
  maxBytes: 4 * MiB,
};
const nsisSource = {
  name: 'NSIS 3.11 unchanged source',
  url: `https://codeload.github.com/NSIS-Dev/nsis/tar.gz/${nsisCommit}`,
  sha256: 'b176182d7d37f564fb97f0b2b1f84f4651702a17d7b3b1ce6a0dc50652001365',
  maxBytes: 6 * MiB,
};
const pluginLicense = {
  name: 'nsis-tauri-utils 0.5.3 MIT license',
  url: `https://raw.githubusercontent.com/tauri-apps/nsis-tauri-utils/${pluginCommit}/LICENSE_MIT`,
  sha256: '1c1020fa10a6bf318717e82c911bcc54ebdfb9bb280460ae332bcb2f82f57fbe',
  maxBytes: 16 * 1024,
};

async function download(asset) {
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok || !response.body) throw new Error(`Cannot download ${asset.name}: HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > asset.maxBytes) {
    await response.body.cancel();
    throw new Error(`Unexpected download size for ${asset.name}.`);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > asset.maxBytes) throw new Error(`Download exceeds the size limit for ${asset.name}.`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!size || sha256(bytes) !== asset.sha256) throw new Error(`SHA-256 mismatch for ${asset.name}.`);
  return bytes;
}

function extract(archive, entry, expectedHash, maxBytes = 4 * MiB) {
  // Read only the specified entry to stdout. No archive path is extracted onto
  // disk, no downloaded executable is run, and original notice bytes survive.
  const bytes = execFileSync('tar', ['-xOf', archive, entry], {
    encoding: 'buffer', maxBuffer: maxBytes, timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  if (!bytes.length || bytes.length > maxBytes || sha256(bytes) !== expectedHash) {
    throw new Error(`Missing or changed notice in pinned archive: ${entry}.`);
  }
  return bytes;
}

async function save(output, path, bytes, metadata) {
  const destination = join(output, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: 'wx' });
  return { ...metadata, path, sha256: sha256(bytes), bytes: bytes.length };
}

function requirePackage(packages, name, version) {
  const found = packages.find(item => item.name === name && item.version === version);
  if (!found) throw new Error(`Native platform notices require reviewed ${name}@${version}.`);
  return found;
}

async function rustNotices(output) {
  const run = args => execFileSync('rustc', args, {
    encoding: 'utf8', maxBuffer: MiB, timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  }).trim();
  const sysroot = resolve(run(['--print', 'sysroot']));
  const version = run(['--version', '--verbose']);
  const commit = version.match(/^commit-hash: ([a-f0-9]{40})$/m)?.[1];
  const release = version.match(/^release: ([0-9]+\.[0-9]+\.[0-9]+)$/m)?.[1];
  if (!commit || !release) throw new Error('Native notices require an identifiable stable Rust compiler release.');
  const result = [];
  // Rust 1.99 ships the standard-library copyright inventory and referenced
  // license collection in the installed component; top-level root licenses are
  // in the distribution archive instead. Keep the actual component layout.
  const licenseDirectory = join(sysroot, 'share', 'doc', 'rust', 'licenses');
  const licenseEntries = await readdir(licenseDirectory, { withFileTypes: true });
  if (!licenseEntries.length) throw new Error('The exact build compiler has no license collection.');
  for (const entry of licenseEntries) {
    if (!entry.isFile() || !/^[A-Za-z0-9.-]+\.txt$/.test(entry.name)) throw new Error(`Unexpected Rust license entry: ${entry.name}.`);
  }
  for (const name of ['COPYRIGHT-library.html', ...licenseEntries.map(entry => `licenses/${entry.name}`)]) {
    const source = join(sysroot, 'share', 'doc', 'rust', name);
    let info;
    try { info = await stat(source); }
    catch (error) { throw new Error(`Required notice is missing from the exact build toolchain: share/doc/rust/${name}.`, { cause: error }); }
    if (!info.isFile() || info.size < 40 || info.size > 8 * MiB) throw new Error(`Unexpected Rust notice size: ${name}.`);
    result.push(await save(output, `platform/rust/${name}`, await readFile(source), {
      name: `Rust ${release} ${name}`,
      url: `https://github.com/rust-lang/rust/tree/${commit}`,
      compiler: version,
      sourceRelativePath: `share/doc/rust/${name}`,
      provenance: 'Copied without alteration from the running build compiler sysroot. This conservative license collection does not imply that every listed component is linked on Windows; COPYRIGHT-library.html contains the standard-library attribution inventory.',
    }));
  }
  for (const [name, expectedHash] of [
    ['LICENSE-MIT', 'b71bd43a069ca0641a9ecfe585ca7b3c53b5cc1608f8b68321168698e28b5ea1'],
    ['LICENSE-APACHE', '62c7a1e35f56406896d7aa7ca52d0cc0d272ac022b5d2796e7d6905db8a3636a'],
  ]) {
    const asset = { name: `Rust ${release} original ${name}`, url: `https://raw.githubusercontent.com/rust-lang/rust/${commit}/${name}`, sha256: expectedHash, maxBytes: 32 * 1024 };
    result.push(await save(output, `platform/rust/${name}`, await download(asset), {
      name: asset.name, url: asset.url, compiler: version,
      provenance: 'Original root license from the exact compiler commit; reviewed SHA-256 values were independently checked against the official Rust 1.99 compiler archive. License changes require review.',
    }));
  }
  return result;
}

/** Independently verifiable pinned assets; does not replace compiler notices. */
export async function collectPinnedWindowsNotices({ output, target, packages }) {
  if (target !== 'x86_64-pc-windows-msvc') throw new Error(`Native platform notice inventory has not been reviewed for ${target}.`);
  if (!Array.isArray(packages)) throw new Error('Native package inventory is required.');
  const cli = JSON.parse(await readFile(new URL('../node_modules/@tauri-apps/cli/package.json', import.meta.url), 'utf8'));
  if (cli.version !== '2.12.1') throw new Error(`Installer notice inventory needs review for Tauri CLI ${cli.version}.`);
  requirePackage(packages, 'webview2-com-sys', '0.39.1');
  const pluginCoverage = [
    requirePackage(packages, 'windows-sys', '0.61.2'),
    requirePackage(packages, 'windows-link', '0.2.1'),
    requirePackage(packages, 'semver', '1.0.28'),
  ];
  for (const item of pluginCoverage) {
    if (!item.selectedLicenses?.includes('MIT')) throw new Error(`Installer companion notices need the original MIT license for ${item.name}.`);
  }
  const destination = resolve(output);
  const result = [];
  const scratch = await mkdtemp(join(tmpdir(), 'folio-native-notices-'));
  const temporaryFiles = [];
  try {
    for (const archive of [sdk, nsis]) {
      const archivePath = join(scratch, archive === sdk ? 'webview2-sdk.zip' : 'nsis.zip');
      await writeFile(archivePath, await download(archive), { flag: 'wx' });
      temporaryFiles.push(archivePath);
      const entries = archive === sdk ? [
        ['LICENSE.txt', 'platform/webview2-sdk/LICENSE.txt', '0af8f1b807512aae39c2ac1aa4d0cae65cabecb6fd554b8439a5162a0d6eca55'],
        ['NOTICE.txt', 'platform/webview2-sdk/NOTICE.txt', '106423785c5b7eba0a8e61d1837f2132e9c828e20ad530f565d981c1df60dd90'],
      ] : [
        ['nsis-3.11/COPYING', 'platform/nsis/COPYING', 'e7dd514003ab96cb3ddccbc028fe5c795fccf57dc41f21cfb9d4dd16ead23bf5'],
        ['nsis-3.11/Docs/Modern UI 2/License.txt', 'platform/nsis/Modern-UI-2-LICENSE.txt', 'd5957bd99460eb21148bd2695eeb5a3718abae6b118040a4678926da3f4cfbc0'],
        ['nsis-3.11/Docs/Modern UI/License.txt', 'platform/nsis/Modern-UI-LICENSE.txt', '75416e94e65b7584ee76e66f7f2f0b087ad8bc1371d3da4486091923076d36b3'],
        ['nsis-3.11/Docs/NSISdl/License.txt', 'platform/nsis/NSISdl-LICENSE.txt', '326e587f36ca58e14bd09cca153f9e69f1c5ed701189aa47d2d0627af7e16280'],
      ];
      for (const [entry, path, expectedHash] of entries) {
        result.push(await save(destination, path, extract(archivePath, entry, expectedHash), {
          name: `${archive.name}: ${entry}`, url: archive.url,
          archiveSha256: archive.sha256, archiveEntry: entry,
          provenance: 'Exact upstream bytes retained, including the original text encoding.',
        }));
      }
      if (archive === sdk) {
        extract(archivePath, 'build/native/x64/WebView2LoaderStatic.lib', '89c6b872783b8f6c3cedbff618adb42082d455c615453ae10cfc753f1e8f25d8', 12 * MiB);
      }
    }
    result.push(await save(destination, 'sources/nsis-3.11-source.tar.gz', await download(nsisSource), {
      name: nsisSource.name, url: nsisSource.url, sourceCommit: nsisCommit,
      provenance: 'Unchanged official v311 source archive accompanies the NSIS LZMA component and its full CPL linking exception. No Folio source relicensing is implied.',
    }));
    result.push(await save(destination, 'platform/nsis-tauri-utils/LICENSE-MIT.txt', await download(pluginLicense), {
      name: pluginLicense.name, url: pluginLicense.url, sourceCommit: pluginCommit,
      binaryUrl: 'https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll',
      reviewedBinarySha256: '5ba143b5db4a87d32d6e7802e033330aae56cbceabe0d1e3ba41948385ad4709',
      tauriBinarySha1: '75197fee3c6a814fe035788d1c34ead39349b860',
      companionNoticeCoverage: pluginCoverage.map(({ name, version }) => ({ name, version })),
      limitation: 'Upstream supplies no Cargo.lock or exact compiler manifest for this precompiled plugin. It uses no_std with Rust core/alloc, its own plugin API, semver and Windows bindings. Companion notices cover those projects, but app crate versions do not establish exact versions linked into the upstream DLL.',
    }));
    const readme = `Windows native platform notice scope\n\nRust notices come from the exact compiler sysroot used for this build and the original root licenses at its recorded source commit. Full original WebView2 SDK, NSIS and installer-plugin notices accompany them. Archive and individual notice hashes are recorded in manifest.json.\n\nWebView2 SDK ${sdkVersion}: webview2-com-sys 0.39.1 statically links the Microsoft loader. The reviewed x64 loader is byte-identical to the SDK archive and is covered by the SDK BSD license and NOTICE. The current installer uses Evergreen downloadBootstrapper if the runtime is absent; a fixed WebView2/Chromium runtime is not embedded. Microsoft's runtime installation remains separate.\n\nNSIS 3.11: full COPYING and Modern UI/NSISdl notices are retained. Unchanged upstream v311 source accompanies them at ../sources/nsis-3.11-source.tar.gz. Default LZMA includes a CPL linking exception; Folio does not modify that component. The source is available in this distribution under its original terms. No additional promises or warranty are made on behalf of its contributors.\n\nnsis-tauri-utils 0.5.3: the original MIT notice and companion project notices are retained. This precompiled no_std plugin uses Rust core/alloc, its plugin API, Windows bindings and semver. Its upstream release does not supply an exact dependency lockfile/compiler inventory. The application dependency versions are not claimed to be that plugin's build provenance.\n\nMicrosoft C runtime: Tauri CLI 2.12.1 defaults build.windows.staticVCRuntime=true and bundle.windows.bundleVCRuntime=false. This application therefore uses static Microsoft runtime components rather than intentionally adding separate CRT DLLs. The Windows build environment supplies the MSVC/Windows SDK toolchain under its applicable Microsoft terms. Do not label the entire executable as containing only permissively licensed Rust code. See https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170 .\n\nThis is the reviewed Windows x64 inventory. It does not establish a native security audit, runtime verification, a license for Folio's own code, or notice completeness for another platform/build configuration.\n`;
    result.push(await save(destination, 'platform/README.txt', Buffer.from(readme), {
      name: 'Windows platform inventory and limits',
      url: 'https://github.com/tauri-apps/tauri/tree/tauri-cli-v2.12.1',
    }));
    return result;
  } finally {
    for (const path of temporaryFiles) {
      if (relative(scratch, path).startsWith('..') || dirname(path) !== scratch) throw new Error('Unsafe temporary cleanup path.');
      await unlink(path);
    }
    await rmdir(scratch);
  }
}

/** Complete collector: missing exact compiler notices stop the release gate. */
export async function collectPlatformNotices(options) {
  if (options.target !== 'x86_64-pc-windows-msvc') throw new Error(`Native platform notice inventory has not been reviewed for ${options.target}.`);
  const compiler = await rustNotices(resolve(options.output));
  return [...compiler, ...await collectPinnedWindowsNotices(options)];
}
