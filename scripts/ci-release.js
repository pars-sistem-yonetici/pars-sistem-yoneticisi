#!/usr/bin/env node
'use strict';

/**
 * GitHub Actions tarafindan bir surum yayinlanirken kullanilir.
 *
 * - release/ icindeki setup exe'yi GitHub'in asset adina (noktali) kopyalar
 * - SHA-512 / SHA-256 / boyut hesaplar
 * - docs ve website icindeki latest.json, download.html, index.html,
 *   blogger.js ve blogger.html dosyalarini yeni surume gore gunceller
 * - Blogger yer tutucularini gercek GitHub Releases adresleriyle doldurur
 *
 * Kullanim: node scripts/ci-release.js --version 1.0.2
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || '' : '';
}

const version = arg('--version') || process.env.RELEASE_VERSION || '';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Surum basit semver olmali (orn. 1.0.2). Alinan: ${version || '(bos)'}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== version) {
  throw new Error(`package.json surumu (${pkg.version}) ile istenen surum (${version}) uyuşmuyor.`);
}

const repository = process.env.GITHUB_REPOSITORY || 'pars-sistem-yonetici/pars-sistem-yoneticisi';
const [owner, repo] = repository.split('/');
if (!owner || !repo) throw new Error(`GITHUB_REPOSITORY beklenen biçimde degil: ${repository}`);

const productName = (pkg.build && pkg.build.productName) || pkg.name;
const releaseBase = `https://github.com/${owner}/${repo}/releases/download/${version}/`;
const setupFriendlyName = `${productName} Setup ${version}.exe`;
const setupAssetName = `${productName.replace(/ /g, '.')}.Setup.${version}.exe`;
const portableAssetName = (pkg.build && pkg.build.portable && pkg.build.portable.artifactName) ||
  `${productName}-Portable.exe`;
const setupUrl = releaseBase + setupAssetName;
const portableUrl = releaseBase + portableAssetName;
const latestJsonUrl = `https://${owner.toLowerCase()}.github.io/${repo}/downloads/latest.json`;

const docsDir = path.join(root, 'docs');
const webDir = path.join(root, 'website');

function hashFile(file, algorithm) {
  return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest('hex');
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (/\.exe$/i.test(name)) continue;
    const source = path.join(from, name);
    const target = path.join(to, name);
    if (fs.statSync(source).isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}

function replacer(file, transform) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(file, after, 'utf8');
}

// Site dosyalari her zaman hedef surumu gostermeli. Manifestteki eski surume
// guvenmek, ayni surum yeniden derlendiginde veya site bir onceki surumden
// kaldiginda yanlis metinlerin (ornek 1.0.7) yayinda kalmasina yol aciyordu.
function versionText(text) {
  // Surum; duz metinde, "%20" ile kodlanmis URL'de ve "Setup.1.0.9.exe"
  // gibi noktali dosya adinda geciyor. Sonraki karakter ".exe" oldugunda
  // da eslesmeye izin vererek hicbir eski surumun yayinda kalmamasini sagla.
  const versionLookahead = String.raw`(?=\.exe\b|(?![.\d]))`;
  return text
    .replace(new RegExp(String.raw`(Setup[ .])\d+\.\d+\.\d+(\.exe)`, 'g'), (_full, prefix, ext) => `${prefix}${version}${ext}`)
    .replace(new RegExp(String.raw`(%[0-9A-Fa-f]{2})\d+\.\d+\.\d+` + versionLookahead, 'g'), (_full, encoded) => `${encoded}${version}`)
    .replace(new RegExp(String.raw`(?<![\d.%])\d+\.\d+\.\d+` + versionLookahead, 'g'), version);
}

/** release/ klasöründeki SHA256SUMS dosyalarını dosya adına göre okur. */
function checksumMap(file) {
  const result = {};
  const full = path.join(root, 'release', file);
  if (!fs.existsSync(full)) return result;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (match) result[path.basename(match[2].trim())] = match[1].toLowerCase();
  }
  return result;
}

function sumFor(map, pattern) {
  const name = Object.keys(map).find((item) => pattern.test(item));
  return name ? map[name] : '';
}

// Site sablonlarindaki yer tutucularini doldurur. Bir ozet dosyasi henuz
// release'de yoksa ilgili yer tutucu korunur; bos hex yazilmaz.
function templateText(text) {
  const macSums = checksumMap('SHA256SUMS-macOS.txt');
  const linuxSums = checksumMap('SHA256SUMS-Linux.txt');
  const values = {
    '{{SETUP_URL}}': setupUrl,
    '{{PORTABLE_URL}}': portableUrl,
    '{{LATEST_JSON_URL}}': latestJsonUrl,
    '{{SETUP_SHA256}}': setupSha256,
    '{{PORTABLE_SHA256}}': portableSha256,
    '{{SETUP_SHA512}}': setupSha512,
    '{{SETUP_SIZE}}': String(setupSize),
    '{{PORTABLE_SIZE}}': String(portableSize),
    '{{MACOS_ARM64_DMG_SHA}}': sumFor(macSums, /arm64.*\.dmg$/i),
    '{{MACOS_ARM64_ZIP_SHA}}': sumFor(macSums, /arm64.*\.zip$/i),
    '{{MACOS_X64_DMG_SHA}}': sumFor(macSums, /x64.*\.dmg$/i),
    '{{MACOS_X64_ZIP_SHA}}': sumFor(macSums, /x64.*\.zip$/i),
    '{{LINUX_APPIMAGE_SHA}}': sumFor(linuxSums, /x64.*\.AppImage$/i),
    '{{LINUX_DEB_SHA}}': sumFor(linuxSums, /x64\.deb$/i),
  };
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    if (value) out = out.split(key).join(value);
  }
  return out;
}

// 1) Setup exe'yi GitHub asset adiyla kopyala (web arayuzu de ayni adi uretir).
const setupSource = path.join(root, 'release', setupFriendlyName);
const portableSource = path.join(root, 'release', portableAssetName);
if (!fs.existsSync(setupSource)) throw new Error(`Setup exe bulunamadi: ${setupSource}`);
if (!fs.existsSync(portableSource)) throw new Error(`Portable exe bulunamadi: ${portableSource}`);
const setupAsset = path.join(root, 'release', setupAssetName);
fs.copyFileSync(setupSource, setupAsset);

const setupSha512 = hashFile(setupAsset, 'sha512');
const setupSha256 = hashFile(setupAsset, 'sha256');
const setupSize = fs.statSync(setupAsset).size;
const portableSha256 = hashFile(portableSource, 'sha256');
const portableSize = fs.statSync(portableSource).size;

// 2) Kisa surum notu: RELEASE_NOTES.md icindeki ilk bos olmayan, baslik olmayan satir.
let notes = `Surum ${version}`;
const notesFile = path.join(root, 'RELEASE_NOTES.md');
if (fs.existsSync(notesFile)) {
  const line = fs.readFileSync(notesFile, 'utf8').split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith('#') && !item.startsWith('>'));
  if (line) notes = line.replace(/\*\*/g, '').slice(0, 240);
}

const manifest = {
  version,
  notes,
  fileName: setupFriendlyName,
  sha512: setupSha512,
  sha256: setupSha256,
  size: setupSize,
  url: setupUrl,
  portableFileName: portableAssetName,
  portableSha256,
  portableSize,
  portableUrl,
};
const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

// 3) website icerigini docs'a kopyala, sonra ikisini birlikte guncelle.
copyDir(webDir, docsDir);

for (const dir of [docsDir, webDir]) {
  fs.writeFileSync(path.join(dir, 'downloads', 'latest.json'), manifestJson, 'utf8');

  for (const name of ['download.html', 'index.html', 'blogger.js', 'blogger.html']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    replacer(file, (text) => templateText(versionText(text)));
  }
}

console.log(`Surum ${version} icin site dosyalari hazirlandi.`);
console.log(`  Kurulum : ${setupAssetName} · ${setupSize} bayt`);
console.log(`  SHA-256 : ${setupSha256}`);
console.log(`  Portable: ${portableAssetName} · ${portableSize} bayt`);
console.log(`  SHA-256 : ${portableSha256}`);
console.log(`  Manifest: ${setupUrl}`);
