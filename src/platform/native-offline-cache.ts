interface OfflineWorker {
  scriptURL: string;
  state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

interface OfflineRegistration {
  scope: string;
  active?: OfflineWorker | null;
  waiting?: OfflineWorker | null;
  installing?: OfflineWorker | null;
  unregister(): Promise<boolean>;
  addEventListener(type: 'updatefound', listener: () => void): void;
  removeEventListener(type: 'updatefound', listener: () => void): void;
}

export interface NativeOfflineServices {
  serviceWorker?: { getRegistrations(): Promise<readonly OfflineRegistration[]> };
  caches?: { keys(): Promise<string[]>; delete(name: string): Promise<boolean> };
}

const APP_CACHE_PREFIX = 'folio-app-';

/** Retire the browser app shell before importing a newly installed native reader.
 * This never opens document stores or touches another application's worker/cache.
 */
export async function retireNativeOfflineAssets(locationHref: string, services?: NativeOfflineServices, timeoutMs = 10_000): Promise<void> {
  const location = new URL(locationHref);
  // Custom-protocol native origins cannot have registered this HTTP(S) worker.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  const scope = new URL('/', location).href;
  const script = new URL('sw.js', scope).href;
  const ownedRegistration = (registration: OfflineRegistration): boolean => {
    const workers = [registration.active, registration.waiting, registration.installing].filter(
      (worker): worker is OfflineWorker => worker != null,
    );
    return registration.scope === scope && workers.length > 0 && workers.every((worker) => worker.scriptURL === script);
  };
  let active = true;
  const disposers = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout>;
  const checkActive = () => {
    if (!active) throw new Error('App shell cleanup has stopped.');
  };
  const installationSettled = (worker: OfflineWorker) =>
    ['installed', 'activating', 'activated', 'redundant'].includes(worker.state);
  const waitForInstallation = async (worker: OfflineWorker) => {
    checkActive();
    if (installationSettled(worker)) return;
    await new Promise<void>((resolve, reject) => {
      const dispose = () => {
        worker.removeEventListener('statechange', inspect);
        disposers.delete(cancel);
      };
      const cancel = () => { dispose(); reject(new Error('App shell cleanup has stopped.')); };
      const inspect = () => {
        if (installationSettled(worker)) { dispose(); resolve(); }
      };
      disposers.add(cancel);
      worker.addEventListener('statechange', inspect);
      // The worker can settle between the first read and listener registration.
      inspect();
    });
    checkActive();
  };
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      active = false;
      reject(new Error('App shell cleanup took too long.'));
    }, timeoutMs);
  });
  const cleanup = async () => {
    const available = services ?? {
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      caches: typeof caches !== 'undefined' ? caches : undefined,
    };
    if (available.serviceWorker) {
      for (const registration of await available.serviceWorker.getRegistrations()) {
        checkActive();
        if (!ownedRegistration(registration)) continue;
        const installing = new Set<OfflineWorker>();
        const capture = () => {
          const worker = registration.installing;
          if (active && worker?.scriptURL === script) installing.add(worker);
        };
        capture();
        const stopTracking = () => {
          registration.removeEventListener('updatefound', capture);
          disposers.delete(stopTracking);
        };
        disposers.add(stopTracking);
        registration.addEventListener('updatefound', capture);
        try {
          capture();
          await registration.unregister();
          checkActive();
          capture();
        } finally { stopTracking(); }
        // An unregister acknowledgement can precede a detached install event's
        // cache writes. Retain its exact worker and wait within the same deadline.
        // A browser that never reports settlement fails closed before deletion.
        for (const worker of installing) await waitForInstallation(worker);
      }
      checkActive();
      const remaining = await available.serviceWorker.getRegistrations();
      checkActive();
      if (remaining.some(ownedRegistration)) throw new Error('The previous app shell is still registered.');
    }
    checkActive();
    if (available.caches) {
      for (const name of await available.caches.keys()) {
        checkActive();
        if (name.startsWith(APP_CACHE_PREFIX)) await available.caches.delete(name);
      }
      checkActive();
      const remaining = await available.caches.keys();
      checkActive();
      if (remaining.some((name) => name.startsWith(APP_CACHE_PREFIX))) throw new Error('The previous app shell cache is still present.');
    }
  };
  try { await Promise.race([cleanup(), deadline]); }
  finally {
    // Browser worker/cache calls cannot be aborted. Fence every following step
    // so a late completion cannot continue cleanup after startup has failed.
    active = false;
    clearTimeout(timer!);
    for (const dispose of disposers) dispose();
  }
}
