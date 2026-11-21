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
const { PROJECT_VERSION } = require('../modules-config');
const { LOOPBACK_IPV4 } = require('../local-api');

const GUARD_LABEL = 'com.antigravity.pulse.guard';
const DAEMON_LABEL = 'com.antigravity.pulse.daemon';

/**
 * 解析稳定的 Node.js 可执行入口路径（优先选用 /opt/homebrew/bin/node 等软链而非易随小版本升级失效的 Cellar 版本目录）
 */
function resolveStableNodeBinary(execPath = process.execPath) {
  if (process.platform === 'win32') return execPath;
  const stableCandidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    path.join(os.homedir(), '.volta', 'bin', 'node'),
    path.join(os.homedir(), '.asdf', 'shims', 'node'),
    '/usr/bin/node'
  ];
  let currentReal = execPath;
  try { currentReal = fs.realpathSync(execPath); } catch {}
  for (const cand of stableCandidates) {
    try {
      if (!fs.existsSync(cand)) continue;
      const candReal = fs.realpathSync(cand);
      if (candReal === currentReal) return cand;
    } catch {}
  }
  for (const cand of ['/opt/homebrew/bin/node', '/usr/local/bin/node']) {
    try {
      if (fs.existsSync(cand)) return cand;
    } catch {}
  }
  return execPath;
}

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
    if (pg.status !== 0) return false;
    const pids = String(pg.stdout || '').split(/\s+/).map(s => Number(s.trim())).filter(n => n > 0 && n !== process.pid && n !== process.ppid);
    return pids.length > 0;
  }
  if (process.platform === 'win32') {
    // 排除当前安装器进程及父进程，防止 ELECTRON_RUN_AS_NODE 借壳 Antigravity.exe 运行时把自身误判为活跃客户端
    const tl = spawnSync('tasklist', ['/FI', 'IMAGENAME eq Antigravity.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
    const lines = String(tl.stdout || '').split(/\r?\n/).filter(l => l.toLowerCase().includes('antigravity.exe'));
    for (const line of lines) {
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      const pid = Number(cols[1]);
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid) {
        return true;
      }
    }
    return false;
  }
  if (process.platform === 'linux') {
    const pg = spawnSync('pgrep', ['-x', 'antigravity'], { encoding: 'utf8' });
    if (pg.status !== 0) return false;
    const pids = String(pg.stdout || '').split(/\s+/).map(s => Number(s.trim())).filter(n => n > 0 && n !== process.pid && n !== process.ppid);
    return pids.length > 0;
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
      spawnSync('taskkill', ['/FI', `PID ne ${process.pid}`, '/FI', `PID ne ${process.ppid || 0}`, '/IM', 'Antigravity.exe'], { timeout: 4000, stdio: 'ignore', windowsHide: true });
    } catch {}
  } else if (process.platform === 'linux') {
    try {
      spawnSync('pkill', ['-TERM', '-x', 'antigravity'], { timeout: 4000, stdio: 'ignore' });
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
      const cleanEnv = { ...process.env };
      delete cleanEnv.ELECTRON_RUN_AS_NODE;
      const child = spawn(exePath, extraArgs, { detached: true, stdio: 'ignore', windowsHide: true, env: cleanEnv });
      child.unref();
      return true;
    }
  }
  if (process.platform === 'linux') {
    const binCandidates = [
      path.resolve(appBundleOrAsar, '..', '..', 'antigravity'),
      '/usr/bin/antigravity',
      '/opt/antigravity/antigravity'
    ];
    const binPath = binCandidates.find(p => fs.existsSync(p));
    if (binPath) {
      const cleanEnv = { ...process.env };
      delete cleanEnv.ELECTRON_RUN_AS_NODE;
      const child = spawn(binPath, extraArgs, { detached: true, stdio: 'ignore', env: cleanEnv });
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
  <false/>
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
open -a "${sourceAppBundle.replace(/"/g, '\\"')}" --args --remote-debugging-address=${LOOPBACK_IPV4} --remote-debugging-port=${debugPort}
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
  <string>${xmlEscape(PROJECT_VERSION)}</string>
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
      try { fs.rmSync(path.join(stateDir, '.zero-asar-mode.json'), { force: true }); } catch {}
      if (process.platform === 'darwin') {
        unloadAndRemoveLaunchAgent(daemonPlistPath);
        fs.mkdirSync(launchAgentsDir, { recursive: true });
        const plistXml = buildGuardPlistXml({
          nodePath: resolveStableNodeBinary(),
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
  try {
    fs.writeFileSync(path.join(stateDir, '.zero-asar-mode.json'), JSON.stringify({
      enabled: true,
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf8');
  } catch {}
  if (process.platform === 'darwin') {
    unloadAndRemoveLaunchAgent(guardPlistPath);
    fs.mkdirSync(launchAgentsDir, { recursive: true });
    const daemonXml = buildDaemonPlistXml({
      nodePath: resolveStableNodeBinary(),
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
        '--remote-debugging-port=9222'
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
    let sleepMs = 4500;
    try {
      const snap = await queryLiveWindow();
      if (snap.running && snap.pageFound) {
        if (!snap.active) {
          const bridgePrep = await ensureLiveBridgeIfNeeded(snap);
          await tryHotInjectDetailed({
            source: 'pulse-daemon',
            cdpPort: snap.cdpPort || null,
            liveInfo: bridgePrep.liveInfo || null,
            liveVerified: Boolean(bridgePrep.ready && bridgePrep.liveInfo),
            preferLiveHost: Boolean(bridgePrep.ready && bridgePrep.backendSource === 'live-host'),
            clearStaleLiveBridge: Boolean(bridgePrep.clearStaleLiveBridge)
          });
          sleepMs = 3500;
        } else {
          // 窗口已成功挂载时拉长探测间隔，避免短周期重复建立 CDP WebSocket 会话
          sleepMs = 9000;
        }
      } else {
        sleepMs = 6000;
      }
    } catch {}
    await new Promise(r => setTimeout(r, sleepMs));
  }
}

/**
 * 一键彻底卸载并还原官方纯净状态 (teardown)
 */
async function runFormalTeardown(options = {}) {
  const customPath = options.customPath || null;
  const purgeAll = Boolean(options.purge || process.argv.includes('--purge'));
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

  // 清理运行态归档、临时快照与守护日志，防止卸载后在应用支持目录残留数十 MB 备份文件
  try {
    if (purgeAll) {
      fs.rmSync(stateDir, { recursive: true, force: true });
    } else {
      for (const relClean of ['live-runtime', 'locks', '.zero-asar-mode.json', '.live-session.json', 'guard.log', path.join('backups', 'snapshots')]) {
        try { fs.rmSync(path.join(stateDir, relClean), { recursive: true, force: true }); } catch {}
      }
    }
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
