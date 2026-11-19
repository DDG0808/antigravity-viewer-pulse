#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const RELEASE_COMMON_FILES = [
  'README.md',
  'AGENTS.md',
  'LICENSE',
  'RELEASE_NOTES.md',
  'package.json',
  'plugin.json',
  'cli.js',
  'install.js',
  'restore.js',
  'install.sh',
  'uninstall.sh',
  'install.bat',
  'uninstall.bat',
  '安装 Antigravity Pulse.command',
  '卸载 Antigravity Pulse.command',
  'asar-engine.js',
  'live-host.js',
  'local-api.js',
  'modular-installer.js',
  'modules-config.js',
  'meter-main.js',
  'meter-core.js',
  'meter-collector.js',
  'meter-storage.js',
  'meter-proxy.js',
  'meter-enhance.js',
  'meter-context-unlock.js',
  'meter-cli-launcher.js',
  'meter-renderer.js',
  'attachment_scan.py',
  'i18n/zh-CN.json',
  'i18n/i18n-runtime.js',
  'scripts/build-renderer.js',
  'scripts/macos-setup.js',
  'scripts/cli-window-helper.cs',
  'src/renderer/charts.js',
  'src/renderer/context-budget-engine.js',
  'src/renderer/i18n.js',
  'src/renderer/main.js',
  'src/renderer/styles.css',
  'src/renderer/template.html',
  'unlock/README.md',
  'unlock/language-server/README.md',
  'unlock/language-server/patch-language_server.py',
  'unlock/agy-cli/README.md',
  'unlock/agy-cli/README-Windows.md',
  'unlock/agy-cli/FINDINGS.md',
  'unlock/agy-cli/agy-patch.py',
  'unlock/agy-cli/apply.sh',
  'unlock/agy-cli/verify_tui.py'
];

const WINDOWS_EXTRA_FILES = [
  'scripts/cli-window-helper.exe'
];

function extractLiveRuntimeFiles(collectorSource) {
  const m = collectorSource.match(/const\s+LIVE_RUNTIME_FILES\s*=\s*\[([\s\S]*?)\];/);
  if (!m) {
    throw new Error('无法在 meter-collector.js 中解析 LIVE_RUNTIME_FILES');
  }
  const items = [];
  const itemRe = /'([^']+)'|"([^"]+)"/g;
  let match;
  while ((match = itemRe.exec(m[1])) !== null) {
    items.push(match[1] || match[2]);
  }
  return items;
}

function validateManifest(options = {}) {
  const requireDocs = options.requireDocs !== false;
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin.json'), 'utf8'));
  const coreSrc = fs.readFileSync(path.join(ROOT, 'meter-core.js'), 'utf8');
  const collectorSrc = fs.readFileSync(path.join(ROOT, 'meter-collector.js'), 'utf8');
  const rendererMainSrc = fs.readFileSync(path.join(ROOT, 'src/renderer/main.js'), 'utf8');
  const rendererBundleSrc = fs.readFileSync(path.join(ROOT, 'meter-renderer.js'), 'utf8');

  const version = pkg.version;
  if (!/^v?(0|1)\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json version 非法: ${version}`);
  }
  if (plugin.version !== version) {
    throw new Error(`版本不一致: package.json (${version}) !== plugin.json (${plugin.version})`);
  }

  const rendererVerMatch = rendererMainSrc.match(/const\s+METER_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!rendererVerMatch || rendererVerMatch[1] !== version) {
    throw new Error(`src/renderer/main.js METER_VERSION (${rendererVerMatch?.[1]}) !== package.json (${version})`);
  }

  const bundleVerMatch = rendererBundleSrc.match(/const\s+METER_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!bundleVerMatch || bundleVerMatch[1] !== version) {
    throw new Error(`meter-renderer.js 未同步构建: METER_VERSION (${bundleVerMatch?.[1]}) !== ${version}`);
  }

  if (!collectorSrc.includes(`const OFFICIAL_REPO = 'DDG0808/antigravity-viewer-pulse';`)) {
    throw new Error('meter-collector.js OFFICIAL_REPO 未指向 DDG0808/antigravity-viewer-pulse');
  }
  if (!coreSrc.includes('/DDG0808/antigravity-viewer-pulse')) {
    throw new Error('meter-core.js isValidExternalUrl 未包含 /DDG0808/antigravity-viewer-pulse');
  }
  if (!rendererBundleSrc.includes('https://github.com/DDG0808/antigravity-viewer-pulse')) {
    throw new Error('meter-renderer.js 仓库链接未指向 https://github.com/DDG0808/antigravity-viewer-pulse');
  }

  const filesToCheck = RELEASE_COMMON_FILES.filter((rel) => {
    if (!requireDocs && (rel === 'AGENTS.md' || rel === 'LICENSE')) return false;
    return true;
  });

  for (const rel of filesToCheck) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`缺失发布清单文件: ${rel}`);
    }
  }

  const liveFiles = extractLiveRuntimeFiles(collectorSrc);
  const manifestSet = new Set([...RELEASE_COMMON_FILES, ...WINDOWS_EXTRA_FILES]);
  for (const rel of liveFiles) {
    if (!fs.existsSync(path.join(ROOT, rel))) {
      throw new Error(`LIVE_RUNTIME_FILES 引用了不存在的文件: ${rel}`);
    }
    if (!manifestSet.has(rel)) {
      throw new Error(`LIVE_RUNTIME_FILES 中的文件未纳入发布包清单: ${rel}`);
    }
  }

  return {
    version,
    commonFiles: RELEASE_COMMON_FILES,
    windowsExtraFiles: WINDOWS_EXTRA_FILES,
    liveRuntimeFiles: liveFiles
  };
}

if (require.main === module) {
  try {
    const res = validateManifest();
    console.log(`[Release Manifest] 校验通过: v${res.version} (${res.commonFiles.length} 个通用文件, ${res.liveRuntimeFiles.length} 个热更新核心文件)`);
  } catch (err) {
    console.error(`[Release Manifest] ❌ ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  RELEASE_COMMON_FILES,
  WINDOWS_EXTRA_FILES,
  validateManifest
};
