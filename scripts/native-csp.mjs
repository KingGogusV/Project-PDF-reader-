// Tauri sets TAURI_ENV_PLATFORM for beforeDevCommand and beforeBuildCommand:
// https://v2.tauri.app/reference/environment-variables/#tauri-cli-hook-commands
// Its local IPC sources are documented at https://v2.tauri.app/security/csp/.
export const BROWSER_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'self' blob:; base-uri 'self'; form-action 'none'";

const nativePlatforms = new Set(['windows', 'darwin', 'linux', 'android', 'ios']);
const NATIVE_CSP = BROWSER_CSP.replace("connect-src 'self';", "connect-src 'self' ipc: http://ipc.localhost;");

/** @param {string | undefined} platform */
export function frontendCsp(platform) {
  return nativePlatforms.has(platform) ? NATIVE_CSP : BROWSER_CSP;
}

/** Keep the browser source unchanged; native HTML must retain its complete CSP.
 * @param {string} html
 * @param {string | undefined} platform
 */
export function nativeIndexHtml(html, platform) {
  if (!nativePlatforms.has(platform)) return html;
  let count = 0;
  const result = html.replace(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/g, (tag, policy) => {
    count++;
    if (policy !== BROWSER_CSP) throw new Error('Review the native CSP transform when the browser metadata policy changes.');
    return tag.replace(`content="${policy}"`, `content="${NATIVE_CSP}"`);
  });
  if (count !== 1) throw new Error('Native HTML must contain exactly one reviewed CSP metadata policy.');
  return result;
}
