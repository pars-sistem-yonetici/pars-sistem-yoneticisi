#!/usr/bin/env node
'use strict';

/**
 * Surum numarasini tek komutla tum kaynak dosyalarda gunceller.
 *
 * Kullanim:
 *   node scripts/bump-version.js 1.0.3
 *   node scripts/bump-version.js 1.0.3 --check    (sadece kontrol, yazmaz)
 *   npm run bump -- 1.0.3
 *
 * Guncellenen dosyalar:
 *   package.json, package-lock.json (ilk iki "version"),
 *   src/shared/i18n.ts (baslikdaki surum), README.md, RELEASE_NOTES.md,
 *   build/updates/latest.json (gOmulu manifest sablonu).
 *
 * website/ ve docs/ dosyalari CI (ci-release.js) tarafindan uretilir;
 * bu script onlara dokunmaz.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check') || args.includes('-n');
const versionArg = args.find((arg) => !arg.startsWith('-'));

if (!versionArg) {
  console.error('Kullanim: node scripts/bump-version.js <x.y.z> [--check]');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(versionArg)) {
  console.error(`Gecersiz surum: ${versionArg}. Ornek: 1.0.3`);
  process.exit(1);
}

const version = versionArg;
const changes = [];

function replace(text, pattern, value, minCount, label) {
  let count = 0;
  const next = text.replace(pattern, (...matched) => {
    count += 1;
    return typeof value === 'function' ? value(...matched) : value;
  });
  if (count < minCount) {
    throw new Error(`${label}: beklenen alan bulunamadi (${count}/${minCount}).`);
  }
  return { text: next, count };
}

function update(relativePath, transform) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) throw new Error(`Dosya bulunamadi: ${relativePath}`);
  const before = fs.readFileSync(file, 'utf8');
  const result = transform(before);
  if (!result || typeof result.text !== 'string') {
    throw new Error(`${relativePath}: gecersiz donusum.`);
  }
  if (result.text === before) {
    changes.push({ file: relativePath, count: 0 });
    return;
  }
  if (!checkOnly) fs.writeFileSync(file, result.text, 'utf8');
  changes.push({ file: relativePath, count: result.count || 0 });
}

update('package.json', (text) => {
  const r = replace(
    text,
    /^(\s*"version":\s*)"[^"]+"/m,
    (_full, prefix) => `${prefix}"${version}"`,
    1,
    'package.json',
  );
  return r;
});

update('package-lock.json', (text) => {
  let count = 0;
  const next = text.replace(/^(\s*"version":\s*)"\d+\.\d+\.\d+"/gm, (full, prefix) => {
    count += 1;
    return count <= 2 ? `${prefix}"${version}"` : full;
  });
  if (count < 2) throw new Error(`package-lock.json: ilk iki surum alani bulunamadi (${count}).`);
  return { text: next, count: 2 };
});

update('src/shared/i18n.ts', (text) => {
  let count = 0;
  let next = text.replace(/('Sistem Bakım Merkezi · v)\d+\.\d+\.\d+(')/g, (_full, prefix, suffix) => {
    count += 1;
    return `${prefix}${version}${suffix}`;
  });
  next = next.replace(/('System Maintenance Center · v)\d+\.\d+\.\d+(')/g, (_full, prefix, suffix) => {
    count += 1;
    return `${prefix}${version}${suffix}`;
  });
  if (count < 1) throw new Error('i18n.ts: baslik surumu bulunamadi.');
  return { text: next, count };
});

update('README.md', (text) => {
  let count = 0;
  let next = text.replace(/Setup \d+\.\d+\.\d+\.exe/g, () => {
    count += 1;
    return `Setup ${version}.exe`;
  });
  next = next.replace(/("version":\s*")[^"]+(")/, (_full, prefix, suffix) => {
    count += 1;
    return `${prefix}${version}${suffix}`;
  });
  if (count < 1) throw new Error('README.md: surum ornekleri bulunamadi.');
  return { text: next, count };
});

update('RELEASE_NOTES.md', (text) => {
  let count = 0;
  let next = text.replace(/^# Pars Sistem Yöneticisi \d+\.\d+\.\d+/m, () => {
    count += 1;
    return `# Pars Sistem Yöneticisi ${version}`;
  });
  next = next.replace(/Setup \d+\.\d+\.\d+\.exe/g, () => {
    count += 1;
    return `Setup ${version}.exe`;
  });
  if (count < 1) throw new Error('RELEASE_NOTES.md: surum basligi bulunamadi.');
  return { text: next, count };
});

update('build/updates/latest.json', (text) => {
  let count = 0;
  let next = text.replace(/^(\s*"version":\s*)"[^"]+"/m, (_full, prefix) => {
    count += 1;
    return `${prefix}"${version}"`;
  });
  next = next.replace(/^(\s*"fileName":\s*"Pars Sistem Yoneticisi Setup )[^"]+(\.exe")/m, (_full, prefix, suffix) => {
    count += 1;
    return `${prefix}${version}${suffix}`;
  });
  next = next.replace(/^(\s*"url":\s*"Pars Sistem Yoneticisi Setup )[^"]+(\.exe")/m, (_full, prefix, suffix) => {
    count += 1;
    return `${prefix}${version}${suffix}`;
  });
  if (count < 3) throw new Error(`build/updates/latest.json: alan sayisi ${count}/3.`);
  return { text: next, count };
});

console.log(`${checkOnly ? 'KONTROL' : 'GUNCELLENDI'}: ${version}`);
for (const item of changes) {
  console.log(`  ${item.count ? '✓' : '–'} ${item.file}${item.count ? ` (${item.count} alan)` : ' (degisiklik yok)'}`);
}
if (!checkOnly) {
  console.log('\nSiradaki adim: RELEASE_NOTES.md icerigini gozden gecirip workflowu calistirin.');
}
