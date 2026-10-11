import { supabase } from '../lib/supabase/client';

const LOCAL_CRASH_KEY = 'biotrack-v5-last-render-crash';
const RECENT_FINGERPRINTS_KEY = 'biotrack-v5-error-fingerprints';
const FINGERPRINT_WINDOW_MS = 5 * 60 * 1000;

type ClientErrorEventInsert = {
  user_id: string;
  error_kind: string;
  message: string;
  component_stack: string | null;
  route: string;
  build_id: string | null;
  online: boolean;
  user_agent: string | null;
  occurred_at: string;
};

type ObservabilityInsertClient = {
  from: (table: 'client_error_events') => {
    insert: (payload: ClientErrorEventInsert) => PromiseLike<{
      error: { message: string } | null;
    }>;
  };
};

export type ClientErrorReport = {
  kind: 'render' | 'window-error' | 'unhandled-rejection';
  error: unknown;
  componentStack?: string | null;
};

function cleanText(value: unknown, maximumLength: number): string {
  const text =
    value instanceof Error
      ? value.message
      : String(value ?? 'Unknown client error');
  return (
    text.replace(/\s+/g, ' ').trim().slice(0, maximumLength) ||
    'Unknown client error'
  );
}

function stackText(
  error: unknown,
  componentStack: string | null | undefined,
): string | null {
  const parts = [error instanceof Error ? error.stack : null, componentStack]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n');
  return parts ? parts.slice(0, 4000) : null;
}

function routeWithoutSensitiveQuery(): string {
  return (
    `${window.location.pathname}${window.location.hash}`.slice(0, 500) || '/'
  );
}

function fingerprint(
  kind: ClientErrorReport['kind'],
  message: string,
  route: string,
): string {
  let hash = 2166136261;
  const value = `${kind}|${message}|${route}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function shouldSend(fingerprintValue: string): boolean {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(RECENT_FINGERPRINTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const recent: Record<string, number> = Object.fromEntries(
      Object.entries(parsed).filter(
        ([, timestamp]) => now - timestamp < FINGERPRINT_WINDOW_MS,
      ),
    );
    if (recent[fingerprintValue]) return false;
    recent[fingerprintValue] = now;
    window.sessionStorage.setItem(
      RECENT_FINGERPRINTS_KEY,
      JSON.stringify(recent),
    );
    return true;
  } catch {
    return true;
  }
}

function rememberLocally(payload: ClientErrorEventInsert): void {
  try {
    window.sessionStorage.setItem(
      LOCAL_CRASH_KEY,
      JSON.stringify({
        occurredAt: payload.occurred_at,
        kind: payload.error_kind,
        message: payload.message,
        componentStack: payload.component_stack,
        route: payload.route,
        online: payload.online,
      }),
    );
  } catch {
    // Reporting remains best effort when browser storage is restricted.
  }
}

async function readServiceWorkerBuildId(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller)
    return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 600);
    channel.port1.onmessage = (event: MessageEvent<{ buildId?: unknown }>) => {
      window.clearTimeout(timeout);
      resolve(
        typeof event.data?.buildId === 'string'
          ? event.data.buildId.slice(0, 160)
          : null,
      );
    };
    navigator.serviceWorker.controller?.postMessage({ type: 'GET_VERSION' }, [
      channel.port2,
    ]);
  });
}

export async function reportClientError(
  report: ClientErrorReport,
): Promise<void> {
  const message = cleanText(report.error, 500);
  const route = routeWithoutSensitiveQuery();
  const fingerprintValue = fingerprint(report.kind, message, route);
  if (!shouldSend(fingerprintValue)) return;

  const occurredAt = new Date().toISOString();
  const componentStack = stackText(report.error, report.componentStack);
  const buildIdPromise = readServiceWorkerBuildId();

  if (!supabase) {
    rememberLocally({
      user_id: '',
      error_kind: report.kind,
      message,
      component_stack: componentStack,
      route,
      build_id: null,
      online: navigator.onLine,
      user_agent: navigator.userAgent.slice(0, 500),
      occurred_at: occurredAt,
    });
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  const buildId = await buildIdPromise;
  const payload: ClientErrorEventInsert = {
    user_id: userId ?? '',
    error_kind: report.kind,
    message,
    component_stack: componentStack,
    route,
    build_id: buildId,
    online: navigator.onLine,
    user_agent: navigator.userAgent.slice(0, 500),
    occurred_at: occurredAt,
  };
  rememberLocally(payload);
  if (!userId || !navigator.onLine) return;

  const observabilityClient = supabase as unknown as ObservabilityInsertClient;
  const { error } = await observabilityClient
    .from('client_error_events')
    .insert(payload);
  if (error)
    console.warn(
      'BioTrack AI could not upload a client diagnostic.',
      error.message,
    );
}

let globalReportingStarted = false;

export function startClientErrorReporting(): void {
  if (globalReportingStarted) return;
  globalReportingStarted = true;

  window.addEventListener('error', (event) => {
    void reportClientError({
      kind: 'window-error',
      error: event.error ?? event.message,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError({
      kind: 'unhandled-rejection',
      error: event.reason,
    });
  });
}
