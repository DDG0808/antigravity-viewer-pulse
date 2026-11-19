#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const {
  RELEASE_COMMON_FILES,
  WINDOWS_EXTRA_FILES,
  validateManifest
} = require('./check-release-manifest');

const ROOT = path.resolve(__dirname, '..');

const TARGET_MATRIX = [
  { os: 'darwin', arch: 'arm64' },
  { os: 'darwin', arch: 'amd64' },
  { os: 'windows', arch: 'amd64' },
  { os: 'windows', arch: 'arm64' },
  { os: 'linux', arch: 'amd64' },
  { os: 'linux', arch: 'arm64' }
];

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(zipPath, entries) {
  const execExts = ['.sh', '.command', '.py'];
  const execNames = new Set(['cli.js', 'install.js', 'restore.js']);
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const item of entries) {
    const rawBuf = fs.readFileSync(item.src);
    const compBuf = zlib.deflateRawSync(rawBuf, { level: 9 });
    const nameBuf = Buffer.from(item.arc, 'utf8');
    const crc = crc32(rawBuf);
    const baseName = path.posix.basename(item.arc);
    const isExec = execNames.has(baseName) || execExts.some((ext) => item.arc.endsWith(ext));
    const unixMode = isExec ? 0o100755 : 0o100644;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8); // Deflate
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localOffset = offset;
    localChunks.push(localHeader, nameBuf, compBuf);
    offset += localHeader.length + nameBuf.length + compBuf.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE((3 << 8) | 20, 4); // Unix + PKZIP 2.0
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(((unixMode & 0xffff) << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralChunks.push(centralHeader, nameBuf);
  }

  const centralDirBuf = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...localChunks, centralDirBuf, eocd]));
}

function parseArgs(argv) {
  let outDir = path.join(ROOT, 'dist', 'releases');
  let versionOverride = null;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-dir' && argv[i + 1]) {
      outDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--out-dir=')) {
      outDir = path.resolve(arg.slice('--out-dir='.length));
    } else if (arg === '--version' && argv[i + 1]) {
      versionOverride = argv[i + 1].replace(/^v/, '');
      i += 1;
    } else if (arg.startsWith('--version=')) {
      versionOverride = arg.slice('--version='.length).replace(/^v/, '');
    }
  }
  return { outDir, versionOverride };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function main() {
  const { outDir, versionOverride } = parseArgs(process.argv);
  const manifestInfo = validateManifest();
  const version = versionOverride || manifestInfo.version;
  if (version !== manifestInfo.version) {
    throw new Error(`Tag 版本 (${version}) 与 package.json 版本 (${manifestInfo.version}) 不一致`);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const checksumLines = [];

  for (const target of TARGET_MATRIX) {
    const relFiles = [...RELEASE_COMMON_FILES];
    if (target.os === 'windows') {
      for (const extra of WINDOWS_EXTRA_FILES) {
        if (fs.existsSync(path.join(ROOT, extra))) {
          relFiles.push(extra);
        }
      }
    }

    const entries = relFiles.map((rel) => ({
      src: path.join(ROOT, rel),
      arc: rel.replace(/\\/g, '/')
    }));

    const zipName = `antigravity-viewer-pulse_${version}_${target.os}_${target.arch}.zip`;
    const zipPath = path.join(outDir, zipName);
    createZipArchive(zipPath, entries);

    const digest = sha256File(zipPath);
    checksumLines.push(`${digest}  ${zipName}`);
    console.log(`[Package] 生成 ${zipName} (SHA-256: ${digest.slice(0, 16)}...)`);
  }

  const checksumPath = path.join(outDir, 'checksums.txt');
  fs.writeFileSync(checksumPath, checksumLines.join('\n') + '\n', 'utf8');
  console.log(`[Package] 写入校验表: ${checksumPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[Package] ❌ ${err.message}`);
    process.exit(1);
  }
}

module.exports = { createZipArchive };
