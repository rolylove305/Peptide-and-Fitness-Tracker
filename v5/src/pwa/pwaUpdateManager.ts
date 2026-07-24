export type PwaUpdateStatus =
  'unsupported' | 'idle' | 'checking' | 'available' | 'applying' | 'error';

export type PwaUpdateState = {
  status: PwaUpdateStatus;
  buildId: string | null;
  error: string | null;
};

type PwaUpdateListener = (state: PwaUpdateState) => void;

type ServiceWorkerVersionMessage = {
  buildId?: unknown;
};

const listeners = new Set<PwaUpdateListener>();
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

let registration: ServiceWorkerRegistration | null = null;
let started = false;
let reloadRequested = false;
let state: PwaUpdateState = {
  status: 'idle',
  buildId: null,
  error: null,
};

function publish(patch: Partial<PwaUpdateState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

async function readWorkerBuildId(
  worker: ServiceWorker,
): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 1500);

    channel.port1.onmessage = (
      event: MessageEvent<ServiceWorkerVersionMessage>,
    ) => {
      window.clearTimeout(timeout);
      resolve(
        typeof event.data?.buildId === 'string' ? event.data.buildId : null,
      );
    };

    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

async function announceWaitingWorker(worker: ServiceWorker): Promise<void> {
  const buildId = await readWorkerBuildId(worker);
  publish({ status: 'available', buildId, error: null });
}

function watchInstallingWorker(worker: ServiceWorker): void {
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'installed' || !navigator.serviceWorker.controller)
      return;
    if (registration?.waiting) void announceWaitingWorker(registration.waiting);
  });
}

function watchRegistration(nextRegistration: ServiceWorkerRegistration): void {
  registration = nextRegistration;

  if (nextRegistration.waiting)
    void announceWaitingWorker(nextRegistration.waiting);
  if (nextRegistration.installing)
    watchInstallingWorker(nextRegistration.installing);

  nextRegistration.addEventListener('updatefound', () => {
    if (nextRegistration.installing)
      watchInstallingWorker(nextRegistration.installing);
  });
}

export function getPwaUpdateState(): PwaUpdateState {
  return state;
}

export function subscribePwaUpdateState(
  listener: PwaUpdateListener,
): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function checkForPwaUpdate(): Promise<void> {
  if (!registration || !navigator.onLine || state.status === 'applying') return;

  publish({ status: 'checking', error: null });
  try {
    await registration.update();
    if (registration.waiting) {
      await announceWaitingWorker(registration.waiting);
    } else {
      publish({ status: 'idle', buildId: null, error: null });
    }
  } catch (error: unknown) {
    publish({
      status: 'error',
      error:
        error instanceof Error
          ? error.message
          : 'BioTrack could not check for an update.',
    });
  }
}

export function applyPwaUpdate(): boolean {
  const waitingWorker = registration?.waiting;
  if (!waitingWorker || !navigator.onLine || state.status === 'applying')
    return false;

  reloadRequested = true;
  publish({ status: 'applying', error: null });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

async function removeDevelopmentServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((item) => item.unregister()));
  } catch (error: unknown) {
    console.warn(
      'BioTrack AI could not remove a development service worker.',
      error,
    );
  }
}

export function startPwaUpdateManager(enabled = true): void {
  if (started) return;
  started = true;

  if (!enabled) {
    publish({ status: 'unsupported', buildId: null, error: null });
    void removeDevelopmentServiceWorkers();
    return;
  }

  if (!('serviceWorker' in navigator)) {
    publish({ status: 'unsupported', buildId: null, error: null });
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadRequested) return;
    reloadRequested = false;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((nextRegistration) => {
        watchRegistration(nextRegistration);
        if (navigator.onLine) void checkForPwaUpdate();
      })
      .catch((error: unknown) => {
        publish({
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'BioTrack service worker registration failed.',
        });
        console.warn('BioTrack AI service worker registration failed.', error);
      });
  });

  window.addEventListener('online', () => void checkForPwaUpdate());
  window.addEventListener('focus', () => void checkForPwaUpdate());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForPwaUpdate();
  });
  window.setInterval(() => void checkForPwaUpdate(), UPDATE_INTERVAL_MS);
}
