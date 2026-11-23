(() => {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');

  if (toggle && nav) {
    const close = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    };

    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '✕' : '☰';
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) close();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) close();
    });
  }

  const updateActiveNav = () => {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    const hash = window.location.hash;
    document.querySelectorAll('.main-nav a').forEach((link) => {
      const target = link.getAttribute('href') || '';
      const isDownload = current === 'download.html' && target === 'download.html';
      const isSection = target.startsWith('#') && target === hash;
      const isIndexDefault = current === 'index.html' && !hash && target === '#ozellikler';
      link.classList.toggle('active', isDownload || isSection || isIndexDefault);
    });
  };
  updateActiveNav();
  window.addEventListener('hashchange', updateActiveNav);

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      const previous = button.textContent;
      button.textContent = 'Kopyalandı';
      button.setAttribute('aria-label', 'Kopyalandı');
      window.setTimeout(() => {
        button.textContent = previous;
        button.removeAttribute('aria-label');
      }, 1600);
    });
  });

  async function loadLatestRelease() {
    try {
      const response = await fetch('downloads/latest.json', { cache: 'no-store' });
      if (!response.ok) return;
      const release = await response.json();
      const version = String(release.version || '').replace(/^v/, '');
      if (!version) return;

      document.querySelectorAll('[data-latest-version]').forEach((el) => {
        el.textContent = `v${version}`;
      });
      document.querySelectorAll('[data-latest-notes]').forEach((el) => {
        el.textContent = release.notes
          ? `Son sürüm: v${version} · ${release.notes}`
          : `Son sürüm: v${version}`;
      });

      const isAbsolute = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

      const setupLink = document.querySelector('[data-latest-download]');
      if (setupLink && release.fileName) {
        setupLink.href = isAbsolute(release.url)
          ? release.url
          : `downloads/${encodeURIComponent(release.fileName)}`;
        setupLink.setAttribute('download', release.fileName);
      }

      const portableLink = document.querySelector('[data-portable-download]');
      if (portableLink && release.portableFileName) {
        portableLink.href = isAbsolute(release.portableUrl)
          ? release.portableUrl
          : `downloads/${encodeURIComponent(release.portableFileName)}`;
        portableLink.setAttribute('download', release.portableFileName);
      }

      const setupCode = document.querySelector('[data-setup-checksum]');
      const setupCopy = document.querySelector('[data-setup-copy]');
      if (setupCode && release.sha256) {
        setupCode.textContent = release.sha256;
        if (setupCopy) setupCopy.setAttribute('data-copy', release.sha256);
      }

      const portableCode = document.querySelector('[data-portable-checksum]');
      const portableCopy = document.querySelector('[data-portable-copy]');
      if (portableCode && release.portableSha256) {
        portableCode.textContent = release.portableSha256;
        if (portableCopy) portableCopy.setAttribute('data-copy', release.portableSha256);
      }
    } catch {
      // file:// veya ağ hatası: HTML içindeki sabit değerler kalır.
    }
  }

  loadLatestRelease();
})();
