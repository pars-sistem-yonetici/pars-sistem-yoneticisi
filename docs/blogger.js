/* Blogger tek dosyalık sürüm için ayarlar.
 * {{...}} yer tutucu değerlerini yayınlamadan önce düzenleyin.
 */
var CONFIG = {
  setupUrl: 'https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/download/1.8.0/Pars.Sistem.Yoneticisi.Setup.1.8.0.exe',
  portableUrl: 'https://github.com/pars-sistem-yonetici/pars-sistem-yoneticisi/releases/download/1.8.0/ParsSistemYoneticisi-Portable.exe',
  latestJsonUrl: 'https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/downloads/latest.json'
};

(function () {
  function isPlaceholder(value) {
    return !value || /^\{\{.*\}\}$/.test(value);
  }

  function fileNameFromUrl(url) {
    try {
      var clean = url.split('?')[0].split('#')[0];
      return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1));
    } catch (e) {
      return 'indirme.exe';
    }
  }

  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    function closeMenu() {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }
    toggle.addEventListener('click', function () {
      var open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '✕' : '☰';
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) closeMenu();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) closeMenu();
    });
  }

  function updateActiveNav() {
    var hash = window.location.hash || '#ozellikler';
    document.querySelectorAll('.main-nav a').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === hash);
    });
  }
  updateActiveNav();
  window.addEventListener('hashchange', updateActiveNav);

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var value = button.getAttribute('data-copy') || '';
      function done() {
        var previous = button.getAttribute('data-label') || 'Kopyala';
        button.setAttribute('data-label', previous);
        button.textContent = 'Kopyalandı';
        window.setTimeout(function () {
          button.textContent = previous;
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(function () {
          fallbackCopy(value);
          done();
        });
      } else {
        fallbackCopy(value);
        done();
      }
    });
  });

  function fallbackCopy(value) {
    var area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (e) { /* yoksay */ }
    area.remove();
  }

  function applyConfiguredLinks() {
    var setup = document.querySelector('[data-setup-link]');
    if (setup && !isPlaceholder(CONFIG.setupUrl)) {
      setup.setAttribute('href', CONFIG.setupUrl);
      setup.setAttribute('download', fileNameFromUrl(CONFIG.setupUrl));
    }
    var portable = document.querySelector('[data-portable-link]');
    if (portable && !isPlaceholder(CONFIG.portableUrl)) {
      portable.setAttribute('href', CONFIG.portableUrl);
      portable.setAttribute('download', fileNameFromUrl(CONFIG.portableUrl));
    }
  }

  function manifestBaseUrl(raw) {
    if (/\.json($|\?)/i.test(raw)) return raw;
    return raw.replace(/\/+$/, '') + '/latest.json';
  }

  function applyManifest(release, manifestUrl) {
    var version = String(release.version || '').replace(/^v/, '');
    if (!version) return;

    document.querySelectorAll('[data-latest-version]').forEach(function (el) {
      el.textContent = 'v' + version;
    });
    document.querySelectorAll('[data-latest-notes]').forEach(function (el) {
      el.textContent = release.notes
        ? 'Son sürüm: v' + version + ' · ' + release.notes
        : 'Son sürüm: v' + version;
    });

    var setup = document.querySelector('[data-setup-link]');
    if (setup && isPlaceholder(CONFIG.setupUrl) && (release.url || release.fileName)) {
      try {
        var target = new URL(release.url || release.fileName, manifestUrl).href;
        setup.setAttribute('href', target);
        setup.setAttribute('download', release.fileName || fileNameFromUrl(target));
      } catch (e) { /* geçersiz URL ise sabit bağlantı kalır */ }
    }

    var setupCode = document.querySelector('[data-setup-checksum]');
    var setupCopy = document.querySelector('[data-setup-copy]');
    if (setupCode && release.sha256) {
      setupCode.textContent = release.sha256;
      if (setupCopy) setupCopy.setAttribute('data-copy', release.sha256);
    }

    var portableCode = document.querySelector('[data-portable-checksum]');
    var portableCopy = document.querySelector('[data-portable-copy]');
    if (portableCode && release.portableSha256) {
      portableCode.textContent = release.portableSha256;
      if (portableCopy) portableCopy.setAttribute('data-copy', release.portableSha256);
    }
  }

  function loadLatestRelease() {
    if (isPlaceholder(CONFIG.latestJsonUrl)) return;
    var manifestUrl = manifestBaseUrl(CONFIG.latestJsonUrl);
    fetch(manifestUrl, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (release) { applyManifest(release, manifestUrl); })
      .catch(function () { /* manifest okunamazsa sabit değerler kalır */ });
  }

  applyConfiguredLinks();
  loadLatestRelease();
})();
