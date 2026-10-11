import { beforeEach, describe, expect, it, vi } from 'vitest';

class TestMessageChannel {
  port1: { onmessage: ((event: MessageEvent) => void) | null };
  port2: { reply: (data: unknown) => void };

  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = {
      reply: (data) => this.port1.onmessage?.({ data } as MessageEvent),
    };
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('MessageChannel', TestMessageChannel);
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});

describe('safe PWA updates', () => {
  it('removes stale service workers without registering one during development', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
      register: vi.fn(),
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
    const manager = await import('./pwaUpdateManager');

    manager.startPwaUpdateManager(false);
    await vi.waitFor(() => expect(unregister).toHaveBeenCalledOnce());

    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(manager.getPwaUpdateState()).toMatchObject({
      status: 'unsupported',
      error: null,
    });
  });

  it('announces a waiting version and applies it without reloading early', async () => {
    const waitingWorker = {
      postMessage: vi.fn(
        (message: { type: string }, ports?: TestMessageChannel['port2'][]) => {
          if (message.type === 'GET_VERSION')
            ports?.[0]?.reply({ buildId: 'build-123' });
        },
      ),
    };
    const registration = {
      waiting: waitingWorker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };
    const serviceWorker = {
      controller: {},
      register: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
    const manager = await import('./pwaUpdateManager');

    manager.startPwaUpdateManager();
    window.dispatchEvent(new Event('load'));
    await vi.waitFor(() =>
      expect(manager.getPwaUpdateState().status).toBe('available'),
    );

    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(manager.getPwaUpdateState().buildId).toBe('build-123');
    expect(manager.applyPwaUpdate()).toBe(true);
    expect(waitingWorker.postMessage).toHaveBeenLastCalledWith({
      type: 'SKIP_WAITING',
    });
    expect(manager.getPwaUpdateState().status).toBe('applying');
  });

  it('does not apply a waiting version while offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const manager = await import('./pwaUpdateManager');

    expect(manager.applyPwaUpdate()).toBe(false);
  });
});
