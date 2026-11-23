#!/usr/bin/env node
'use strict';

/**
 * Uygulama güncellemesi yayınlama yardımcısı.
 *
 * package.json sürümünü okur, release/ içindeki setup exe'yi bulur,
 * SHA-512 + boyut hesaplar ve publish/updates klasörüne latest.json ile
 * birlikte kopyalar. Web'e yükleme yapmaz; klasörü siz yayınlarsınız.
 *
 * Kullanım:
 *   npm run publish
 *   npm run publish -- --notes "Kısa sürüm notu"
 *   npm run publish -- --out C:\Yayin\updates
 *   npm run publish -- --exe "release\Pars Sistem Yoneticisi Setup 1.0.1.exe"
 *   npm run publish -- --embed
 *   npm run publish -- --website   # ayrıca website/downloads klasörünü günceller
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function usage() {
  console.log(`Kullanım: npm run publish -- [seçenekler]

Seçenekler:
  --notes <metin>   latest.json içindeki sürüm notu (ASCII için güvenlidir)
  --notes-file <dosya>  Notları UTF-8 dosyadan oku (Türkçe için önerilir)
  --out <klasör>    Çıktı klasörü (varsayılan: publish/updates)
  --exe <dosya>     Setup exe yolu (varsayılan: release/ içinde sürümle eşleşen)
  --embed           build/updates/latest.json dosyasını da güncelle
  --website         website/downloads klasörünü de güncelle
  -h, --help        Bu yardım
`);
}

function parseArgs(argv) {
  const args = {
    notes: '',
    notesFile: '',
    out: path.join('publish', 'updates'),
    exe: '',
    embed: false,
    website: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--notes') args.notes = argv[++i] || '';
    else if (a === '--notes-file') args.notesFile = argv[++i] || '';
    else if (a === '--out') args.out = argv[++i] || args.out;
    else if (a === '--exe') args.exe = argv[++i] || '';
    else if (a === '--embed') args.embed = true;
    else if (a === '--website') args.website = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else throw new Error(`Bilinmeyen argüman: ${a}`);
  }
  return args;
}

async function hashFile(file, algorithm) {
  const hash = crypto.createHash(algorithm);
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function listExes(pattern) {
  const found = [];
  for (const dir of ['release', 'release2']) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (pattern.test(name)) found.push(path.join(dir, name));
    }
  }
  return found;
}

function findSetupExe(version, explicit) {
  if (explicit) {
    const p = path.resolve(root, explicit);
    if (!fs.existsSync(p)) throw new Error(`Belirtilen exe bulunamadı: ${p}`);
    return p;
  }
  const productName = (pkg.build && pkg.build.productName) || pkg.name;
  const fileName = `${productName} Setup ${version}.exe`;
  const candidates = [
    path.join(root, 'release', fileName),
    path.join(root, 'release2', fileName),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) return found;
  const available = listExes(/setup.*\.exe$/i);
  throw new Error(
    `Sürüm ${version} için setup exe bulunamadı. Beklenen: ${fileName}\n` +
    (available.length
      ? `Bulunan setup dosyaları:\n  ${available.join('\n  ')}`
      : 'release/ içinde setup exe yok. Önce npm run dist çalıştırın.')
  );
}

function findPortableExe() {
  const build = pkg.build || {};
  const artifact = (build.portable && build.portable.artifactName) ||
    `${build.productName || pkg.name}-Portable.exe`;
  const candidates = [
    path.join(root, 'release', artifact),
    path.join(root, 'release2', artifact),
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const version = String(pkg.version || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json sürümü basit semver olmalı (örn. 1.0.1). Mevcut: ${version || '(boş)'}`);
  }

  let notes = args.notes;
  if (args.notesFile) {
    const notesPath = path.resolve(root, args.notesFile);
    notes = (await fsp.readFile(notesPath, 'utf8')).trim();
  }

  const exe = findSetupExe(version, args.exe);
  const fileName = path.basename(exe);
  if (!/\.exe$/i.test(fileName)) throw new Error(`Güncelleme dosyası .exe olmalı: ${fileName}`);

  const size = (await fsp.stat(exe)).size;
  const sha512 = await hashFile(exe, 'sha512');
  const sha256 = await hashFile(exe, 'sha256');

  const manifest = {
    version,
    notes: notes || `Sürüm ${version}`,
    fileName,
    sha512,
    sha256,
    size,
    url: fileName,
  };

  const portable = args.website ? findPortableExe() : '';
  if (portable) {
    manifest.portableFileName = path.basename(portable);
    manifest.portableSha256 = await hashFile(portable, 'sha256');
    manifest.portableSize = (await fsp.stat(portable)).size;
    manifest.portableUrl = path.basename(portable);
  }

  const json = `${JSON.stringify(manifest, null, 2)}\n`;

  const outDir = path.resolve(root, args.out);
  await fsp.mkdir(outDir, { recursive: true });
  const destExe = path.join(outDir, fileName);
  await fsp.copyFile(exe, destExe);
  if ((await fsp.stat(destExe)).size !== size) throw new Error('Kopyalanan dosya boyutu kaynakla uyuşmuyor.');
  const manifestPath = path.join(outDir, 'latest.json');
  await fsp.writeFile(manifestPath, json, 'utf8');

  if (args.embed) {
    const embedDir = path.join(root, 'build', 'updates');
    await fsp.mkdir(embedDir, { recursive: true });
    await fsp.writeFile(path.join(embedDir, 'latest.json'), json, 'utf8');
  }

  if (args.website) {
    const webDir = path.join(root, 'website', 'downloads');
    await fsp.mkdir(webDir, { recursive: true });
    await fsp.copyFile(exe, path.join(webDir, fileName));
    if (portable) await fsp.copyFile(portable, path.join(webDir, path.basename(portable)));
    await fsp.writeFile(path.join(webDir, 'latest.json'), json, 'utf8');
  }

  console.log('Güncelleme yayını hazırlandı.');
  console.log(`  Sürüm   : ${version}`);
  console.log(`  Kaynak  : ${exe}`);
  console.log(`  Çıktı   : ${outDir}`);
  console.log(`  Dosya   : ${fileName}`);
  console.log(`  Boyut   : ${size} bayt`);
  console.log(`  SHA-512 : ${sha512}`);
  console.log(`  SHA-256 : ${sha256}`);
  console.log(`  Manifest: ${manifestPath}`);
  if (portable) console.log(`  Portable: ${manifest.portableFileName} · ${manifest.portableSize} bayt`);
  if (args.embed) console.log('  build/updates/latest.json da güncellendi (sonraki paketlemede gömülür).');
  if (args.website) {
    console.log('  website/downloads/latest.json ve exe kopyaları güncellendi.');
    console.log('  Uygulamada güncelleme kaynağını https://<siteniz>/downloads yapabilirsiniz.');
  }
  console.log('');
  console.log('Sonraki adım:');
  console.log('  1) Klasörü bir web adresine yükleyin veya yerel/ağ klasörü olarak paylaşın.');
  console.log('  2) Uygulamada Ayarlar → Güncelleme kaynağı alanına bu klasörü/adresi yazın.');
  console.log('  3) latest.json ve exe birlikte aynı klasörde kalmalı.');
}

main().catch((error) => {
  console.error(`Hata: ${error.message}`);
  process.exitCode = 1;
});
