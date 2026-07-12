(() => {
  const $ = (id) => document.getElementById(id);

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function installSyncUpgrade() {
    const button = $('sync');
    if (!button || button.dataset.v5Ready === '1') return;
    button.dataset.v5Ready = '1';

    let stamp = $('lastSync');
    if (!stamp) {
      stamp = document.createElement('p');
      stamp.id = 'lastSync';
      stamp.className = 'muted small';
      stamp.style.margin = '8px 0 0';
      button.closest('.bar')?.after(stamp);
    }

    const saved = localStorage.getItem('lastSuccessfulSync');
    stamp.textContent = saved ? `Last synced: ${saved}` : 'Not synced yet on this device.';

    button.onclick = async () => {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Syncing…';
      stamp.textContent = 'Downloading your latest cloud data…';

      try {
        if (typeof window.load !== 'function') throw new Error('The app sync function is unavailable.');
        await window.load();
        const now = formatTime(new Date());
        localStorage.setItem('lastSuccessfulSync', now);
        stamp.textContent = `✓ Synced successfully at ${now}`;
        button.textContent = '✓ Synced';
      } catch (error) {
        console.error('Sync failed:', error);
        stamp.textContent = `Sync failed: ${error?.message || 'Please try again.'}`;
        button.textContent = 'Retry';
      } finally {
        button.disabled = false;
        setTimeout(() => {
          if (button.textContent === '✓ Synced') button.textContent = originalText || 'Sync';
        }, 1800);
      }
    };

    window.addEventListener('offline', () => {
      stamp.textContent = 'Offline — changes will not sync until your connection returns.';
    });

    window.addEventListener('online', () => {
      stamp.textContent = 'Back online. Tap Sync to refresh your cloud data.';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installSyncUpgrade);
  } else {
    installSyncUpgrade();
  }
})();
