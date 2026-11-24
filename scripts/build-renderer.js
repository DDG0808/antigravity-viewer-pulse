'use strict';
/**
 * Antigravity Pulse — 零依赖纯 Node.js Spatial Bento 渲染层构建器
 *
 * 将 src/renderer/ 下的模块化源码：
 *  - styles.css               (Spatial Bento 主题令牌、灵动岛、玻璃态面板与抽屉样式)
 *  - template.html            (Shadow DOM 语义化 Spatial Bento 模板)
 *  - i18n.js                  (多语言词典 zh-CN / zh-TW / en 与后端错误短语本地化)
 *  - context-budget-engine.js (精准上下文预算解析、模型能力继承与 1K 对齐引擎)
 *  - charts.js                (Retina Canvas 贝塞尔流式波形、5 视图消费矩阵、SVG 速率对决图)
 *  - main.js                  (宿主挂载、双通道 RPC/IPC 桥接、请求预算拦截器与全量交互状态机)
 * 打包生成根目录 meter-renderer.js，并通过 vm.Script 进行构建期语法零容错校验。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src', 'renderer');
const targetFile = path.join(rootDir, 'meter-renderer.js');

const TRUNCATION_PATTERN = /truncated for diff preview/i;

function assertNoTruncationMarker(filePath, content) {
  const match = TRUNCATION_PATTERN.exec(content);
  if (!match) return;
  const idx = match.index;
  const prefix = content.slice(0, idx);
  const lines = prefix.split(/\r?\n/);
  const lineNum = lines.length;
  const colNum = lines[lines.length - 1].length + 1;
  const err = new Error(
    `[构建中止] 检测到源码截断标记: ${filePath}:${lineNum}:${colNum}`
  );
  err.code = 'ERR_SOURCE_TRUNCATED';
  err.filePath = filePath;
  err.line = lineNum;
  err.column = colNum;
  throw err;
}

function escapeTemplateLiteral(raw) {
  return String(raw)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function readVerifiedRendererSource(dir, fileName) {
  const fullPath = path.join(dir, fileName);
  const raw = fs.readFileSync(fullPath, 'utf8');
  assertNoTruncationMarker(fullPath, raw);
  return raw;
}

function buildRenderer(options = {}) {
  const effRootDir = options.rootDir ? path.resolve(options.rootDir) : rootDir;
  const effSrcDir = options.srcDir ? path.resolve(options.srcDir) : path.join(effRootDir, 'src', 'renderer');
  const effTargetFile = options.targetFile ? path.resolve(options.targetFile) : path.join(effRootDir, 'meter-renderer.js');

  const pkg = JSON.parse(fs.readFileSync(path.join(effRootDir, 'package.json'), 'utf8'));
  const meterVersion = pkg.version || '0.10.0';

  const styles = readVerifiedRendererSource(effSrcDir, 'styles.css').trim();
  let template = readVerifiedRendererSource(effSrcDir, 'template.html').trim();
  template = template.replace(/\{\{PULSE_VERSION\}\}/g, `v${meterVersion}`);

  const i18n = readVerifiedRendererSource(effSrcDir, 'i18n.js').trim();
  const budgetEngine = readVerifiedRendererSource(effSrcDir, 'context-budget-engine.js').trim();
  const charts = readVerifiedRendererSource(effSrcDir, 'charts.js').trim();
  let mainSource = readVerifiedRendererSource(effSrcDir, 'main.js');

  const verRegex = /const METER_VERSION = '[^']*';/;
  if (!verRegex.test(mainSource)) {
    throw new Error('[构建中止] src/renderer/main.js 缺少 METER_VERSION 常量声明');
  }
  mainSource = mainSource.replace(
    verRegex,
    `const METER_VERSION = '${meterVersion}';`
  );

  const requiredMarkers = [
    '  /* @INSERT_STYLES_AND_TEMPLATE */',
    '  /* @INSERT_I18N_MODULE */',
    '  /* @INSERT_BUDGET_ENGINE_MODULE */',
    '  /* @INSERT_CHARTS_MODULE */'
  ];
  for (const marker of requiredMarkers) {
    if (!mainSource.includes(marker)) {
      throw new Error(`[构建中止] src/renderer/main.js 缺少模块注入锚点: ${marker.trim()}`);
    }
  }

  const domMountSnippet =
    `  shadow.innerHTML = \`<style>\\n${escapeTemplateLiteral(styles)}\\n</style>\\n${escapeTemplateLiteral(template)}\`;`;

  const output = mainSource
    .replace('  /* @INSERT_STYLES_AND_TEMPLATE */', () => domMountSnippet)
    .replace('  /* @INSERT_I18N_MODULE */', () => i18n)
    .replace('  /* @INSERT_BUDGET_ENGINE_MODULE */', () => budgetEngine)
    .replace('  /* @INSERT_CHARTS_MODULE */', () => charts);

  // 构建期语法强校验，杜绝拼装期语法损坏流入宿主
  new vm.Script(output, { filename: 'meter-renderer.js' });

  fs.writeFileSync(effTargetFile, output, 'utf8');
  console.log(
    `[Antigravity Pulse] 渲染层构建完成: ${effTargetFile} (v${meterVersion}, ${Buffer.byteLength(output, 'utf8')} bytes)`
  );
  return { targetFile: effTargetFile, version: meterVersion, bytes: Buffer.byteLength(output, 'utf8') };
}

if (require.main === module) {
  buildRenderer();
}

module.exports = { buildRenderer, assertNoTruncationMarker };
