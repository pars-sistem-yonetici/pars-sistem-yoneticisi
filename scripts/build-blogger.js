#!/usr/bin/env node
'use strict';

/**
 * website/ klasöründeki iki sayfayı Blogger için tek dosyalık HTML'e dönüştürür.
 * CSS, JS ve ikon gömülür; exe bağlantıları {{SETUP_URL}} / {{PORTABLE_URL}}
 * yer tutucularına çevrilir. latest.json adresi {{LATEST_JSON_URL}} ile verilebilir.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'website');

function read(relative) {
  return fs.readFileSync(path.join(web, relative), 'utf8');
}

function between(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Bölüm başlangıcı bulunamadı: ${start}`);
  const begin = from + start.length;
  const to = end ? source.indexOf(end, begin) : source.length;
  if (to < 0) throw new Error(`Bölüm sonu bulunamadı: ${end}`);
  return source.slice(begin, to).trim();
}

const indexHtml = read('index.html');
const downloadHtml = read('download.html');
const css = read('styles.css');
const bloggerJs = read('blogger.js');
const iconBase64 = fs.readFileSync(path.join(web, 'assets', 'icon.png')).toString('base64');
const iconData = `data:image/png;base64,${iconBase64}`;

const hero = between(indexHtml, '<!-- B:HERO -->', '<!-- B:STATS -->');
const stats = between(indexHtml, '<!-- B:STATS -->', '<!-- B:FEATURES -->');
const features = between(indexHtml, '<!-- B:FEATURES -->', '<!-- B:SECURITY -->');
const security = between(indexHtml, '<!-- B:SECURITY -->', '<!-- B:SKIP1 -->');
const faq = between(indexHtml, '<!-- B:FAQ -->', '<!-- B:END -->');

let intro = between(downloadHtml, '<!-- B:INTRO -->', '<!-- B:DOWNLOADS -->')
  .replace('<h1>', '<h2>')
  .replace('</h1>', '</h2>');

let downloads = between(downloadHtml, '<!-- B:DOWNLOADS -->', '<!-- B:STEPS -->')
  .replace(
    /(<a\s+class="btn btn-primary btn-block btn-lg"\s+)data-latest-download\s+href="[^"]+"\s+download="([^"]+)"/,
    '$1data-setup-link href="{{SETUP_URL}}" download="$2"'
  )
  .replace(
    /(<a\s+class="btn btn-block btn-lg"\s+)(?:data-portable-download\s+)?href="[^"]+"\s+download="([^"]*Portable\.exe)"/,
    '$1data-portable-link href="{{PORTABLE_URL}}" download="$2"'
  );

const steps = between(downloadHtml, '<!-- B:STEPS -->', '<!-- B:VERIFY -->');
const verify = between(downloadHtml, '<!-- B:VERIFY -->', '<!-- B:REQUIREMENTS -->');
const requirements = between(downloadHtml, '<!-- B:REQUIREMENTS -->', '<!-- B:SKIP2 -->');

let html = `<!doctype html>
<!--
BLOGGER YAYIN TALİMATI
1) Önerilen: website/blogger.js içindeki CONFIG değerlerini düzenleyip
   npm run build:blogger komutunu yeniden çalıştırın. Böylece ayarlar korunur.
2) Alternatif: Aşağıdaki yer tutucuları bu dosyada doğrudan değiştirin:
   {{SETUP_URL}}     kurulum exe'sinin tam URL'si
   {{PORTABLE_URL}}  portable exe URL'si
   {{LATEST_JSON_URL}} latest.json tam URL'si; kullanmayacaksanız CONFIG.latestJsonUrl = '' yapın
3) Dosyanın tamamını Blogger → Sayfalar → Yeni Sayfa → HTML görünümü içine yapıştırın.
4) Yayınladıktan sonra bağlantıları ve sürüm bilgisini kontrol edin.
-->
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#171719" />
  <meta name="description" content="Pars Sistem Yöneticisi — Windows için winget tabanlı yazılım yönetimi, sistem bakımı, güvenlik denetimi ve güvenli temizleme paneli." />
  <title>Pars Sistem Yöneticisi — Windows Sistem Bakım Merkezi</title>
  <link rel="icon" href="${iconData}" />
  <style>
${css}

section[id], div[id] { scroll-margin-top: calc(var(--header-h) + 14px); }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="#ozellikler" aria-label="Pars Sistem Yöneticisi ana sayfa">
        <img src="${iconData}" alt="" />
        <span><strong>Pars Sistem Yöneticisi</strong><small>Sistem Bakım Merkezi</small></span>
      </a>
      <button class="menu-toggle" id="menuToggle" aria-label="Menüyü aç" aria-expanded="false">☰</button>
      <nav class="main-nav" id="mainNav" aria-label="Ana menü">
        <a href="#ozellikler">Özellikler</a>
        <a href="#guvenlik">Güvenlik</a>
        <a href="#indir">İndir</a>
        <a href="#sss">SSS</a>
      </nav>
      <a class="header-cta" href="#indir">İndir →</a>
    </div>
  </header>

  <main>
${hero}

${stats}

${features}

${security}

<div id="indir"></div>
${intro}

${downloads}

${steps}

${verify}

${requirements}

${faq}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <span><strong>Pars Sistem Yöneticisi</strong> · Sistem Bakım Merkezi · <span data-latest-version>v1.0.2</span></span>
      <span>Windows 10 / 11 x64 · <a href="#indir">İndir</a></span>
    </div>
  </footer>

  <script>
${bloggerJs}
  </script>
</body>
</html>
`;

html = html.replace(/src="assets\/icon\.png"/g, `src="${iconData}"`);

// Blogger sayfası kendi alan adında sunulduğu için göreli assets/ yolları çözümlenmez.
// Ekran görüntülerini yayındaki GitHub Pages adresine sabitle.
const siteAssets = 'https://pars-sistem-yonetici.github.io/pars-sistem-yoneticisi/assets/';
html = html.replace(/src="assets\/([^"]+)"/g, (_full, name) => `src="${siteAssets}${name}"`);

const output = path.join(web, 'blogger.html');
fs.writeFileSync(output, html, 'utf8');
console.log(`Blogger tek dosyalık sürümü oluşturuldu: ${output}`);
console.log(`Boyut: ${Buffer.byteLength(html, 'utf8')} bayt`);
console.log('Yer tutucular: {{SETUP_URL}}, {{PORTABLE_URL}}, {{LATEST_JSON_URL}}');
