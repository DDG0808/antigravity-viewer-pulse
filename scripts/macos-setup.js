'use strict';
/**
 * Antigravity Pulse 正式安装与官方更新自愈守护管理器 (scripts/macos-setup.js)
 * 核心职责：
 * 1. 将插件完整运行时持久化归档至系统标准目录 (~/Library/Application Support/AntigravityContextMeter/live-runtime)，脱离 Downloads 临时目录依赖；
 * 2. 自动优雅退出 Antigravity -> 写入 ASAR 持久化补丁 -> 重新启动并进行存活自检（若未来宿主开启严格 ASAR Fuse 签名校验导致退闪，自动秒级无损回滚原版并切换为零改包 CDP 守护模式）；
 * 3. 在 macOS 上注册零常驻内存的 launchd WatchPaths 更新守护 (com.antigravity.pulse.guard)，当官方客户端自动更新覆盖 app.asar 时自动重装插件；
 * 4. 提供一键干净卸载 (teardown)，彻底移除守护配置并无损还原官方原版 app.asar。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { getStateDir, findAsarPath } = require('../asar-engine');
const { install, extractAsarFile, tryHotInjectDetailed, shutdownLiveHostGracefully } = require('../install');
const { restore } = require('../restore');
const { syncLiveRuntimeBundle, getLiveRuntimeDir } = require('../meter-collector');
const { TAGS } = require('../modular-installer');
const { LOOPBACK_IPV4 } = require('../local-api');

const GUARD_LABEL = 'com.antigravity.pulse.guard';
const DAEMON_LABEL = 'com.antigravity.pulse.daemon';

function resolveAppBundleFromAsar(asarPath) {
  if (asarPath && process.platform === 'darwin') {
    const m = String(asarPath).match(/^(.+?\.app)\/Contents\/Resources\/app\.asar$/i);
    if (m && m[1] && fs.existsSync(m[1])) return m[1];
  }
  return '/Applications/Antigravity.app';
}

function isAntigravityProcessAlive() {
  if (process.platform === 'darwin') {
    const pg = spawnSync('pgrep', ['-x', 'Antigravity'], { encoding: 'utf8' });
    return pg.status === 0 && Boolean(String(pg.stdout || '').trim());
  }
  if (process.platform === 'win32') {
    const tl = spawnSync('tasklist', ['/FI', 'IMAGENAME eq Antigravity.exe', '/NH'], { encoding: 'utf8', windowsHide: true });
    return String(tl.stdout || '').toLowerCase().includes('antigravity.exe');
  }
  return false;
}

async function quitAntigravityGracefully(maxWaitMs = 6500) {
  if (!isAntigravityProcessAlive()) return true;
  if (process.platform === 'darwin') {
    try {
      spawnSync('osascript', ['-e', 'tell application "Antigravity" to quit'], { timeout: 4000, stdio: 'ignore' });
    } catch {}
  } else if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/IM', 'Antigravity.exe'], { timeout: 4000, stdio: 'ignore', windowsHide: true });
    } catch {}
  }
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (!isAntigravityProcessAlive()) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return !isAntigravityProcessAlive();
}

function launchAntigravityApp(appBundleOrAsar, extraArgs = []) {
  if (process.platform === 'darwin') {
    const appBundle = appBundleOrAsar.endsWith('.app')
      ? appBundleOrAsar
      : resolveAppBundleFromAsar(appBundleOrAsar);
    const args = ['-a', appBundle];
    if (Array.isArray(extraArgs) && extraArgs.length > 0) {
      args.push('--args', ...extraArgs);
    }
    const res = spawnSync('open', args, { encoding: 'utf8' });
    return res.status === 0;
  }
  if (process.platform === 'win32') {
    const exePath = path.resolve(appBundleOrAsar, '..', '..', 'Antigravity.exe');
    if (fs.existsSync(exePath)) {
      const child = spawn(exePath, extraArgs, { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
      return true;
    }
  }
  return false;
}

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getLaunchAgentsDir(customHome = null) {
  const home = customHome || os.homedir();
  return path.join(home, 'Library', 'LaunchAgents');
}

function buildGuardPlistXml({ nodePath, cliPath, asarPath, logPath }) {
  const appResourcesDir = path.dirname(asarPath);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${GUARD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(cliPath)}</string>
    <string>guard-sync</string>
    <string>--path</string>
    <string>${xmlEscape(asarPath)}</string>
  </array>
  <key>WatchPaths</key>
  <array>
    <string>${xmlEscape(asarPath)}</string>
    <string>${xmlEscape(appResourcesDir)}</string>
  </array>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`;
}

function buildDaemonPlistXml({ nodePath, cliPath, logPath }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${DAEMON_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(cliPath)}</string>
    <string>daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`;
}

function reloadLaunchAgent(plistPath, label) {
  if (process.platform !== 'darwin') return false;
  try {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid !== null) {
      spawnSync('launchctl', ['bootout', `gui/${uid}`, plistPath], { stdio: 'ignore' });
      const bRes = spawnSync('launchctl', ['bootstrap', `gui/${uid}`, plistPath], { stdio: 'ignore' });
      if (bRes.status === 0) return true;
    }
    spawnSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });
    const lRes = spawnSync('launchctl', ['load', '-w', plistPath], { stdio: 'ignore' });
    return lRes.status === 0;
  } catch {
    return false;
  }
}

function unloadAndRemoveLaunchAgent(plistPath) {
  if (!plistPath || !fs.existsSync(plistPath)) return false;
  if (process.platform === 'darwin') {
    try {
      const uid = typeof process.getuid === 'function' ? process.getuid() : null;
      if (uid !== null) {
        spawnSync('launchctl', ['bootout', `gui/${uid}`, plistPath], { stdio: 'ignore' });
      }
      spawnSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });
    } catch {}
  }
  try {
    fs.unlinkSync(plistPath);
    return true;
  } catch {
    return false;
  }
}

function installGlobalCliSymlink(runtimeCliPath) {
  if (process.platform === 'win32') return null;
  const localBinDir = path.join(os.homedir(), '.local', 'bin');
  const linkPath = path.join(localBinDir, 'ag-pulse');
  try {
    fs.chmodSync(runtimeCliPath, 0o755);
    fs.mkdirSync(localBinDir, { recursive: true });
    try {
      if (fs.lstatSync(linkPath)) fs.unlinkSync(linkPath);
    } catch {}
    fs.symlinkSync(runtimeCliPath, linkPath);
    return linkPath;
  } catch {
    return null;
  }
}

function createZeroAsarLauncherApp(sourceAppBundle, debugPort = 9222) {
  if (process.platform !== 'darwin') return null;
  const userAppsDir = path.join(os.homedir(), 'Applications');
  const launcherApp = path.join(userAppsDir, 'Antigravity Pulse.app');
  const contentsDir = path.join(launcherApp, 'Contents');
  const macosDir = path.join(contentsDir, 'MacOS');
  const resDir = path.join(contentsDir, 'Resources');
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });

  // 复用原版应用图标（若存在）
  try {
    const srcRes = path.join(sourceAppBundle, 'Contents', 'Resources');
    if (fs.existsSync(srcRes)) {
      const icns = fs.readdirSync(srcRes).find(f => f.endsWith('.icns'));
      if (icns) {
        fs.copyFileSync(path.join(srcRes, icns), path.join(resDir, 'applet.icns'));
      }
    }
  } catch {}

  const launcherScript = `#!/bin/bash
open -a "${sourceAppBundle.replace(/"/g, '\\"')}" --args --remote-debugging-address=${LOOPBACK_IPV4} --remote-debugging-port=${debugPort} --remote-allow-origins=*
`;
  const binPath = path.join(macosDir, 'launcher');
  fs.writeFileSync(binPath, launcherScript, { encoding: 'utf8', mode: 0o755 });
  fs.chmodSync(binPath, 0o755);

  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIconFile</key>
  <string>applet</string>
  <key>CFBundleIdentifier</key>
  <string>com.antigravity.pulse.launcher</string>
  <key>CFBundleName</key>
  <string>Antigravity Pulse</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.9.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
`;
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist, 'utf8');
  return launcherApp;
}

/**
 * 同步完整插件目录到持久化应用支持目录（包含 scripts/macos-setup.js 等正式运维组件）
 */
function syncFormalRuntimeDir(rootDir, stateDir = getStateDir()) {
  const runtimeDir = syncLiveRuntimeBundle(rootDir, { stateDir }) || getLiveRuntimeDir(stateDir);
  fs.mkdirSync(path.join(runtimeDir, 'scripts'), { recursive: true });
  for (const extraRel of ['scripts/macos-setup.js', 'scripts/build-renderer.js']) {
    const src = path.join(rootDir, extraRel);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(runtimeDir, extraRel));
    }
  }
  return runtimeDir;
}

/**
 * 执行一键正式安装 (setup)
 */
async function runFormalSetup(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const customPath = options.customPath || null;
  const zeroAsarOnly = Boolean(options.zeroAsar);
  const skipRelaunch = Boolean(options.noRelaunch);

  // 1. 确保前端渲染包为最新构建产物
  const buildScript = path.join(rootDir, 'scripts', 'build-renderer.js');
  if (fs.existsSync(buildScript)) {
    const { buildRenderer } = require(buildScript);
    buildRenderer({ rootDir });
  }

  const asarPath = findAsarPath(customPath);
  const appBundle = resolveAppBundleFromAsar(asarPath);
  const stateDir = getStateDir();

  // 2. 归档独立运行时到 ~/Library/Application Support/AntigravityContextMeter/live-runtime
  const runtimeDir = syncFormalRuntimeDir(rootDir, stateDir);
  const runtimeCliPath = path.join(runtimeDir, 'cli.js');
  const cliLink = installGlobalCliSymlink(runtimeCliPath);

  const launchAgentsDir = getLaunchAgentsDir();
  const guardPlistPath = path.join(launchAgentsDir, `${GUARD_LABEL}.plist`);
  const daemonPlistPath = path.join(launchAgentsDir, `${DAEMON_LABEL}.plist`);
  const guardLogPath = path.join(stateDir, 'guard.log');

  if (!zeroAsarOnly) {
    // 3. 若 Antigravity 正在运行，先优雅关闭以安全写入持久化 ASAR 并使主进程/Preload 生效
    const wasRunning = isAntigravityProcessAlive();
    if (wasRunning) {
      console.log('⏳ 检测到 Antigravity 正在运行，正在通知客户端安全保存并退出...');
      const exited = await quitAntigravityGracefully(7000);
      if (!exited) {
        throw new Error('Antigravity 未能在 7 秒内自动退出（可能有未保存对话框），请先按 Cmd+Q 手动退出后再双击运行安装器。');
      }
    }

    // 4. 执行 ASAR 持久化注入（含 SHA-256 原版备份校验）
    const manifest = await install({ path: customPath });
    console.log(`✅ 核心组件已持久化注入: ${manifest.installed} (宿主 v${manifest.version})`);

    // 5. 自动启动客户端并做 3.5 秒健康存活自检（防止未来 macOS ASAR 签名 Fuse 拦截导致打不开）
    let nativeBootHealthy = true;
    if (!skipRelaunch) {
      console.log('🚀 正在启动 Antigravity 并核验原生持久化挂载状态...');
      const launched = launchAntigravityApp(appBundle);
      if (launched && process.platform === 'darwin') {
        await new Promise(r => setTimeout(r, 1400));
        let aliveChecks = 0;
        for (let i = 0; i < 5; i++) {
          if (isAntigravityProcessAlive()) aliveChecks++;
          await new Promise(r => setTimeout(r, 450));
        }
        if (aliveChecks === 0) {
          nativeBootHealthy = false;
        }
      }
    }

    if (nativeBootHealthy) {
      // 注册 0 常驻内存的官方更新自动重装守护 (WatchPaths)
      if (process.platform === 'darwin') {
        unloadAndRemoveLaunchAgent(daemonPlistPath);
        fs.mkdirSync(launchAgentsDir, { recursive: true });
        const plistXml = buildGuardPlistXml({
          nodePath: process.execPath,
          cliPath: runtimeCliPath,
          asarPath,
          logPath: guardLogPath
        });
        fs.writeFileSync(guardPlistPath, plistXml, 'utf8');
        reloadLaunchAgent(guardPlistPath, GUARD_LABEL);
        console.log(`🛡️  已启用 macOS 官方更新自动守护 (${GUARD_LABEL} · 平时 0 内存占用，客户端自动更新后将自动补装插件)`);
      }
      if (cliLink) {
        console.log(`🔗 已关联终端命令: ${cliLink}`);
      }
      return {
        ok: true,
        mode: 'native-asar-with-guard',
        installed: manifest.installed,
        runtimeDir,
        guardPlistPath: process.platform === 'darwin' ? guardPlistPath : null
      };
    }

    // 兜底分支：若未来某版 macOS 客户端启用严格 ASAR Fuse 导致改包后退出，立即自动无损回滚原版并切换零改包守护模式
    console.log('⚠️  检测到当前客户端启用了严格签名校验，正在自动回滚官方原版 app.asar 并切换为「零改包守护模式」...');
    await restore({ path: customPath });
  }

  // 零改包正式守护模式 (--zero-asar 或签名严格兜底)
  if (process.platform === 'darwin') {
    unloadAndRemoveLaunchAgent(guardPlistPath);
    fs.mkdirSync(launchAgentsDir, { recursive: true });
    const daemonXml = buildDaemonPlistXml({
      nodePath: process.execPath,
      cliPath: runtimeCliPath,
      logPath: guardLogPath
    });
    fs.writeFileSync(daemonPlistPath, daemonXml, 'utf8');
    reloadLaunchAgent(daemonPlistPath, DAEMON_LABEL);
    const launcherApp = createZeroAsarLauncherApp(appBundle, 9222);
    if (!skipRelaunch) {
      await quitAntigravityGracefully(5000);
      launchAntigravityApp(appBundle, [
        `--remote-debugging-address=${LOOPBACK_IPV4}`,
        '--remote-debugging-port=9222',
        '--remote-allow-origins=*'
      ]);
    }
    console.log(`✅ 已启用「零改包后台自动挂载守护」(${DAEMON_LABEL})`);
    if (launcherApp) {
      console.log(`✅ 已生成免改包启动器: ${launcherApp}`);
    }
    return {
      ok: true,
      mode: 'zero-asar-daemon',
      runtimeDir,
      daemonPlistPath,
      launcherApp
    };
  }

  return { ok: true, mode: 'completed', runtimeDir };
}

/**
 * 由 macOS launchd WatchPaths 在 app.asar 发生变动（例如官方自动更新覆盖）时唤醒执行。
 * 若检测到插件标记已被官方更新抹除，自动静默补装回新版 app.asar 并尝试热挂载。
 */
async function runGuardSync(options = {}) {
  const customPath = options.customPath || null;
  let asarPath = null;
  try {
    asarPath = findAsarPath(customPath);
  } catch {
    return { ok: false, reason: 'asar_not_found' };
  }

  // 等待官方更新器完成文件原子替换
  await new Promise(r => setTimeout(r, 1500));

  let utilsRaw = '';
  try {
    utilsRaw = extractAsarFile(asarPath, 'dist/utils.js').toString('utf8');
  } catch {
    return { ok: false, reason: 'asar_busy_or_unreadable' };
  }

  const alreadyPatched = utilsRaw.includes('installContextMeter') || utilsRaw.includes(TAGS.METER_UTILS_START);
  if (alreadyPatched) {
    return { ok: true, action: 'noop_already_patched' };
  }

  console.log(`[GuardSync ${new Date().toISOString()}] 检测到官方更新覆盖了 app.asar，正在自动恢复 Antigravity Pulse...`);
  try {
    const manifest = await install({ path: asarPath });
    if (process.platform === 'darwin') {
      try {
        const msg = manifest.liveInjected
          ? '检测到 Antigravity 更新，已自动重装并热恢复 Pulse 面板！'
          : '检测到 Antigravity 更新，已自动重装 Pulse 持久化组件（下次重启客户端生效）。';
        spawnSync('osascript', ['-e', `display notification "${msg}" with title "Antigravity Pulse"`], { stdio: 'ignore' });
      } catch {}
    }
    return { ok: true, action: 'reinstalled_after_update', version: manifest.version, liveInjected: manifest.liveInjected };
  } catch (err) {
    console.error(`[GuardSync] 自动补装异常: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

/**
 * 轻量后台自动热挂载守护（仅在 --zero-asar 模式下使用）
 */
async function runZeroAsarDaemon( hooks = {} ) {
  const { queryLiveWindow, ensureLiveBridgeIfNeeded } = hooks;
  console.log(`[Pulse Daemon ${new Date().toISOString()}] 零改包自动挂载守护已启动`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const snap = await queryLiveWindow();
      if (snap.running && snap.pageFound && !snap.active) {
        const bridgePrep = await ensureLiveBridgeIfNeeded(snap);
        await tryHotInjectDetailed({
          source: 'pulse-daemon',
          cdpPort: snap.cdpPort || null,
          liveInfo: bridgePrep.liveInfo || null,
          liveVerified: Boolean(bridgePrep.ready && bridgePrep.liveInfo),
          preferLiveHost: Boolean(bridgePrep.ready && bridgePrep.backendSource === 'live-host'),
          clearStaleLiveBridge: Boolean(bridgePrep.clearStaleLiveBridge)
        });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2800));
  }
}

/**
 * 一键彻底卸载并还原官方纯净状态 (teardown)
 */
async function runFormalTeardown(options = {}) {
  const customPath = options.customPath || null;
  const launchAgentsDir = getLaunchAgentsDir();
  const guardRemoved = unloadAndRemoveLaunchAgent(path.join(launchAgentsDir, `${GUARD_LABEL}.plist`));
  const daemonRemoved = unloadAndRemoveLaunchAgent(path.join(launchAgentsDir, `${DAEMON_LABEL}.plist`));

  if (process.platform === 'darwin') {
    const launcherApp = path.join(os.homedir(), 'Applications', 'Antigravity Pulse.app');
    try {
      if (fs.existsSync(launcherApp)) fs.rmSync(launcherApp, { recursive: true, force: true });
    } catch {}
  }

  const localBinLink = path.join(os.homedir(), '.local', 'bin', 'ag-pulse');
  try {
    if (fs.lstatSync(localBinLink).isSymbolicLink()) fs.unlinkSync(localBinLink);
  } catch {}

  const stateDir = getStateDir();
  const liveSessionPath = path.join(stateDir, '.live-session.json');
  if (fs.existsSync(liveSessionPath)) {
    try {
      const liveInfo = JSON.parse(fs.readFileSync(liveSessionPath, 'utf8'));
      await shutdownLiveHostGracefully(liveInfo);
    } catch {}
  }

  let asarRestored = false;
  try {
    const asarPath = findAsarPath(customPath);
    const utilsRaw = extractAsarFile(asarPath, 'dist/utils.js').toString('utf8');
    const hasTraces = utilsRaw.includes('installContextMeter') || utilsRaw.includes(TAGS.METER_UTILS_START) || utilsRaw.includes(TAGS.PROXY_START);
    if (hasTraces) {
      const wasRunning = isAntigravityProcessAlive();
      if (wasRunning) {
        console.log('⏳ 正在安全关闭 Antigravity 以还原官方原版 app.asar...');
        await quitAntigravityGracefully(6500);
      }
      await restore({ path: customPath });
      asarRestored = true;
      if (wasRunning && !options.noRelaunch) {
        launchAntigravityApp(asarPath);
      }
    }
  } catch (e) {
    if (!String(e.message || '').includes('installation.json not found')) {
      console.warn(`⚠️  ASAR 还原提示: ${e.message}`);
    }
  }

  try {
    const { restoreAllEnhance } = require('../meter-enhance');
    restoreAllEnhance({});
  } catch {}

  return {
    ok: true,
    guardRemoved,
    daemonRemoved,
    asarRestored
  };
}

module.exports = {
  GUARD_LABEL,
  DAEMON_LABEL,
  buildGuardPlistXml,
  buildDaemonPlistXml,
  syncFormalRuntimeDir,
  runFormalSetup,
  runGuardSync,
  runZeroAsarDaemon,
  runFormalTeardown
};
