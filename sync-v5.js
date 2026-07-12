(() => {
  const $ = (id) => document.getElementById(id);

  function installAppBranding() {
    document.title = 'BioTrack AI';

    const ensureLink = (rel, href, sizes) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
      if (sizes) link.sizes = sizes;
      link.type = 'image/svg+xml';
    };

    ensureLink('icon', 'biotrack-icon.svg?v=1', 'any');
    ensureLink('apple-touch-icon', 'biotrack-icon.svg?v=1');

    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content = '#07111f';

    let capable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!capable) {
      capable = document.createElement('meta');
      capable.name = 'apple-mobile-web-app-capable';
      document.head.appendChild(capable);
    }
    capable.content = 'yes';

    let title = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!title) {
      title = document.createElement('meta');
      title.name = 'apple-mobile-web-app-title';
      document.head.appendChild(title);
    }
    title.content = 'BioTrack AI';
  }

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

  const install = () => {
    installAppBranding();
    installSyncUpgrade();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();