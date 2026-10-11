import { describe, expect, it, vi } from 'vitest';
import { repairCachedAppFiles } from './repairCachedAppFiles';

describe('global error recovery', () => {
  it('removes only BioTrack app caches and service workers', async () => {
    window.localStorage.setItem(
      'biotrack-v5-workout-set-outbox:user-1',
      '[{"setId":"set-1"}]',
    );
    const deleteCache = vi.fn().mockResolvedValue(true);
    const unregister = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi
          .fn()
          .mockResolvedValue([
            'biotrack-v5-app-old',
            'biotrack-v5-runtime-old',
            'unrelated-app-cache',
          ]),
        delete: deleteCache,
      },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
      },
    });

    await repairCachedAppFiles();

    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith('biotrack-v5-app-old');
    expect(deleteCache).toHaveBeenCalledWith('biotrack-v5-runtime-old');
    expect(deleteCache).not.toHaveBeenCalledWith('unrelated-app-cache');
    expect(unregister).toHaveBeenCalledOnce();
    expect(
      window.localStorage.getItem('biotrack-v5-workout-set-outbox:user-1'),
    ).not.toBeNull();
  });
});
