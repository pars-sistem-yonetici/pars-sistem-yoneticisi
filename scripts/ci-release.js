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

// Onceki surumu site manifestinden oku (metinlerde eski->yeni degistirmek icin).
const oldManifestPath = path.join(docsDir, 'downloads', 'latest.json');
const oldVersion = fs.existsSync(oldManifestPath)
  ? (JSON.parse(fs.readFileSync(oldManifestPath, 'utf8')).version || '')
  : '';

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

function versionText(text) {
  if (!oldVersion || oldVersion === version) return text;
  return text.split(oldVersion).join(version);
}

function checksumText(text, setupSha, portableSha, label) {
  let index = 0;
  const result = text.replace(/\b[0-9a-f]{64}\b/g, () => {
    index += 1;
    return index <= 2 ? setupSha : portableSha;
  });
  if (index !== 0 && index !== 4) {
    throw new Error(`${label}: beklenen 4 SHA-256 alani, bulunan ${index}`);
  }
  return result;
}

function bloggerText(text) {
  return text
    .split('{{SETUP_URL}}').join(setupUrl)
    .split('{{PORTABLE_URL}}').join(portableUrl)
    .split('{{LATEST_JSON_URL}}').join(latestJsonUrl);
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
    replacer(file, (text) => {
      let out = versionText(text);
      out = bloggerText(out);
      if (name === 'download.html' || name === 'blogger.html' || name === 'blogger.js') {
        out = checksumText(out, setupSha256, portableSha256, name);
      }
      return out;
    });
  }
}

console.log(`Surum ${version} icin site dosyalari hazirlandi.`);
console.log(`  Kurulum : ${setupAssetName} · ${setupSize} bayt`);
console.log(`  SHA-256 : ${setupSha256}`);
console.log(`  Portable: ${portableAssetName} · ${portableSize} bayt`);
console.log(`  SHA-256 : ${portableSha256}`);
console.log(`  Manifest: ${setupUrl}`);
