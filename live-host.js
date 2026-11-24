'use strict';
// 本地开发与实时会话桥接服务。常规启动时由 Electron IPC 接管。
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { connect, normalizeLoopbackOrigin, discoverCdpTargets, LOOPBACK_IPV4 } = require('./local-api');
const {
  collect,
  collectTokenHistoryAsync,
  fetchQuotaSnapshotFromHost,
  checkUpdateAsync,
  applyUpdateAsync,
  recordModelCalls,
  recordModelCallsAsync,
  getPluginSettings,
  savePluginSettings,
  launchCliSession,
  getContextUnlockStatus,
  applyContextUnlockAsync,
  restoreContextUnlockAsync
} = require('./meter-collector');
const { normalizeProxyUrl, normalizeBypassListForCompare, parseAndValidateProxyUrl } = require('./meter-proxy');
const { getStateDir } = require('./asar-engine');
const { PROJECT_VERSION } = require('./modules-config');

const liveBootProxySnapshot = (() => {
  const bootInfo = (typeof globalThis !== 'undefined' && globalThis.__AG_PROXY_BOOT_INFO__ && globalThis.__AG_PROXY_BOOT_INFO__.injectedAtStartup)
    ? globalThis.__AG_PROXY_BOOT_INFO__
    : null;
  if (bootInfo) {
    return {
      injectedAtStartup: true,
      enabled: Boolean(bootInfo.active && bootInfo.proxyUrl),
      proxyUrl: bootInfo.proxyUrl || null,
      bypassList: typeof bootInfo.bypassList === 'string' ? bootInfo.bypassList : null
    };
  }
  const envProxy = normalizeProxyUrl(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || '');
  const envBypass = String(process.env.NO_PROXY || process.env.no_proxy || '').trim() || null;
  return {
    injectedAtStartup: false,
    enabled: Boolean(envProxy),
    proxyUrl: envProxy || null,
    bypassList: envBypass
  };
})();

const liveBootChineseSnapshots = new Map();
const TOGGLEABLE_MODULES = new Set(['meter', 'chinese', 'proxy']);
const SAFE_SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function sanitizeLiveGetSettings(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return {};
  const safe = {};
  if (typeof request.email === 'string' && request.email.trim()) safe.email = request.email.trim();
  return safe;
}

function sanitizeLiveSaveSettings(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return {};
  const allowedKeys = [
    'account',
    'email',
    'clearPlan',
    'customPlan',
    'savedHeatView',
    'autoCheckUpdate',
    'panelLanguage',
    'uiPreferences',
    'clearContextPreferences',
    'clearContextPreference',
    'productKey',
    'modelId',
    'contextPreference',
    'contextPreferences',
    'contextScopeMode',
    'contextUnifiedPreference'
  ];
  const safe = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(request, key) && request[key] !== undefined) {
      safe[key] = request[key];
    }
  }
  return safe;
}

function sanitizeLiveUnlockOpts(request, isWrite = false) {
  const safe = {};
  if (request && typeof request === 'object' && !Array.isArray(request)) {
    if (typeof request.mode === 'string') safe.mode = request.mode;
    if (Number.isFinite(Number(request.targetBudget))) safe.targetBudget = Number(request.targetBudget);
    if (Number.isFinite(Number(request.limitTokens))) safe.limitTokens = Number(request.limitTokens);
    if (typeof request.force === 'boolean') safe.force = request.force;
    if (Number.isFinite(Number(request.currentBudget))) safe.currentBudget = Number(request.currentBudget);
    if (Number.isFinite(Number(request.observedBudget))) safe.observedBudget = Number(request.observedBudget);
    if (Number.isFinite(Number(request.serviceLimit))) safe.serviceLimit = Number(request.serviceLimit);
    if (typeof request.syncConfigFiles === 'boolean') safe.syncConfigFiles = request.syncConfigFiles;
    if (typeof request.syncCliConfigs === 'boolean') safe.syncCliConfigs = request.syncCliConfigs;
  }
  if (isWrite && safe.syncConfigFiles === undefined) safe.syncConfigFiles = true;
  return safe;
}

function sanitizeLiveEnhanceStatus(request) {
  const safe = {};
  if (request && typeof request === 'object' && !Array.isArray(request)) {
    if (typeof request.force === 'boolean') safe.force = request.force;
    if (typeof request.includeContext === 'boolean') safe.includeContext = request.includeContext;
  }
  return safe;
}

function sanitizeLiveEnhanceApply(request) {
  const safe = {};
  if (request && typeof request === 'object' && !Array.isArray(request)) {
    if (request.promptTier !== undefined && request.promptTier !== null) safe.promptTier = Number(request.promptTier);
    if (typeof request.chineseTitle === 'boolean') safe.chineseTitle = request.chineseTitle;
    if (typeof request.contextMode === 'string') safe.contextMode = request.contextMode;
    if (Number.isFinite(Number(request.contextBudget))) safe.contextBudget = Number(request.contextBudget);
    if (typeof request.restartLanguageServers === 'boolean') safe.restartLanguageServers = request.restartLanguageServers;
  }
  return safe;
}

function sanitizeLiveEnhanceRestore(request) {
  const safe = {};
  if (request && typeof request === 'object' && !Array.isArray(request)) {
    if (typeof request.restartLanguageServers === 'boolean') safe.restartLanguageServers = request.restartLanguageServers;
  }
  return safe;
}

function sanitizeLiveUpdateOpts(request) {
  const safe = { currentVersion: PROJECT_VERSION };
  if (request && typeof request === 'object' && !Array.isArray(request)) {
    if (request.force === true) safe.force = true;
    if (typeof request.version === 'string') {
      const cleaned = request.version.trim().replace(/^v/i, '');
      if (SAFE_SEMVER_RE.test(cleaned)) safe.version = cleaned;
    }
  }
  return safe;
}

function resolveLiveBootChineseSnapshot() {
  const key = String(process.env.AG_METER_STATE_DIR || '__default__');
  if (liveBootChineseSnapshots.has(key)) return liveBootChineseSnapshots.get(key);
  let snap = { enabled: false, language: 'en', brandTitle: 'english', runtimeLoaded: false };
  try {
    const { loadModulesConfig, inspectDiskModules } = require('./modules-config');
    const cfg = loadModulesConfig();
    const disk = inspectDiskModules();
    const ch = cfg?.modules?.chinese || {};
    const diskReady = disk.chineseReady !== undefined ? Boolean(disk.chineseReady) : Boolean(disk.chinese);
    const active = Boolean(ch.enabled && String(ch.language || '').toLowerCase() !== 'en' && diskReady);
    const brandTitle = String(ch.brandTitle || 'english');
    snap = {
      enabled: active,
      language: String(ch.language || (ch.enabled ? 'zh-CN' : 'en')),
      brandTitle,
      runtimeLoaded: Boolean(diskReady && (active || brandTitle !== 'english'))
    };
  } catch {}
  liveBootChineseSnapshots.set(key, snap);
  return snap;
}
try { resolveLiveBootChineseSnapshot(); } catch {}

function buildLiveRuntimeModulesMeta(cfg) {
  const diskProxy = cfg?.modules?.proxy || {};
  const diskEnabled = Boolean(diskProxy.enabled);
  const diskUrl = normalizeProxyUrl(diskProxy.proxyUrl || '');
  const diskBypass = normalizeBypassListForCompare(diskProxy.bypassList || '');
  const runtimeEnabled = Boolean(liveBootProxySnapshot.enabled);
  const runtimeUrl = normalizeProxyUrl(liveBootProxySnapshot.proxyUrl || '');
  const runtimeBypass = normalizeBypassListForCompare(liveBootProxySnapshot.bypassList || '');
  const proxyNeedsRestart = runtimeEnabled !== diskEnabled ||
    (diskEnabled && runtimeEnabled && (diskUrl !== runtimeUrl || diskBypass !== runtimeBypass));
  const bootZh = resolveLiveBootChineseSnapshot();
  const diskCh = cfg?.modules?.chinese || {};
  const diskZhActive = Boolean(diskCh.enabled && String(diskCh.language || '').toLowerCase() !== 'en');
  return {
    injectedAtStartup: Boolean(liveBootProxySnapshot.injectedAtStartup),
    proxyActive: runtimeEnabled,
    runtimeProxyUrl: runtimeUrl || null,
    runtimeBypassList: typeof liveBootProxySnapshot.bypassList === 'string' ? liveBootProxySnapshot.bypassList : null,
    proxyNeedsRestart,
    chineseActive: Boolean(bootZh.enabled),
    chineseBootLanguage: bootZh.language,
    chineseNeedsRestart: diskZhActive !== Boolean(bootZh.enabled)
  };
}

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_RECORD_CALLS = 500;
const ALLOWED_ROUTES = [
  '/runtime-info',
  '/scan',
  '/token-history',
  '/quota',
  '/record-calls',
  '/get-settings',
  '/save-settings',
  '/launch-cli',
  '/context-unlock-status',
  '/context-unlock-apply',
  '/context-unlock-restore',
  '/enhance-status',
  '/enhance-apply',
  '/enhance-restore',
  '/restart-language-servers',
  '/modules-status',
  '/toggle-module',
  '/test-proxy',
  '/check-update',
  '/apply-update',
  '/shutdown',
  '/restart-host'
];

const LIVE_HOST_STARTED_AT = Date.now();
const LIVE_CAPABILITIES = {
  scan: true,
  tokenHistory: true,
  quota: true,
  recordCalls: true,
  settings: true,
  launchCli: true,
  contextUnlock: true,
  enhance: true,
  modules: true,
  checkUpdate: true,
  applyUpdate: true,
  restartHost: false,
  hotReload: true
};

function timingSafeTokenEqual(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const bufA = Buffer.from(provided, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createLiveRequestHandler({ api, secret, getAllowedOrigins = null, onShutdown = null, startedAt = LIVE_HOST_STARTED_AT }) {
  const resolveAllowedSet = () => {
    const set = new Set();
    const addAllowed = (raw) => {
      if (!raw || typeof raw !== 'string') return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      const norm = normalizeLoopbackOrigin(trimmed);
      set.add(norm || trimmed);
    };
    if (typeof getAllowedOrigins === 'function') {
      const list = getAllowedOrigins() || [];
      for (const o of list) addAllowed(o);
    }
    if (Array.isArray(api?.origins)) {
      for (const o of api.origins) addAllowed(o);
    }
    if (api?.origin) addAllowed(api.origin);
    return set;
  };

  return async (req, res) => {
    const rawOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    const reqOrigin = normalizeLoopbackOrigin(rawOrigin) || rawOrigin;
    const allowedSet = resolveAllowedSet();
    if (!reqOrigin || !allowedSet.has(reqOrigin)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-AG-Context-Token');
      res.writeHead(204); res.end(); return;
    }
    if (req.method !== 'POST' || !ALLOWED_ROUTES.includes(req.url) || !timingSafeTokenEqual(req.headers['x-ag-context-token'], secret)) { res.writeHead(403); res.end(); return; }
    const chunks = [];
    let bodyLength = 0;
    let exceeded = false;
    req.on('data', chunk => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bodyLength += buf.length;
      if (bodyLength > MAX_BODY_BYTES) {
        exceeded = true;
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '请求体积超出限制（最大 1MB）' }));
        }
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', async () => {
      if (exceeded) return;
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const request = JSON.parse(body || '{}');
        if (req.url === '/record-calls') {
          const calls = Array.isArray(request.calls) ? request.calls : [];
          if (calls.length > MAX_RECORD_CALLS) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: `单次入账记录数超出上限（最多 ${MAX_RECORD_CALLS} 条）` }));
            return;
          }
          const resCall = typeof recordModelCallsAsync === 'function'
            ? await recordModelCallsAsync(calls)
            : recordModelCalls(calls);
          if (resCall && typeof resCall === 'object' && resCall.ok === false) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: false,
              changed: false,
              error: resCall.error || '入账落盘失败',
              ...(resCall.phase ? { phase: resCall.phase } : {}),
              ...(resCall.code ? { code: resCall.code } : {})
            }));
            return;
          }
          const changed = (resCall && typeof resCall === 'object') ? !!resCall.changed : !!resCall;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, changed }));
          return;
        }
        if (req.url === '/get-settings') {
          const result = getPluginSettings(sanitizeLiveGetSettings(request));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/save-settings') {
          const result = savePluginSettings(sanitizeLiveSaveSettings(request));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/launch-cli') {
          const safeCliReq = {};
          if (request && typeof request === 'object') {
            if (typeof request.model === 'string') safeCliReq.model = request.model;
            if (typeof request.cascadeId === 'string') safeCliReq.cascadeId = request.cascadeId;
            if (typeof request.conversationId === 'string') safeCliReq.conversationId = request.conversationId;
            const rawCwd = typeof request.cwd === 'string' && request.cwd.trim()
              ? request.cwd.trim()
              : (typeof request.workspacePath === 'string' && request.workspacePath.trim() ? request.workspacePath.trim() : '');
            if (rawCwd) {
              safeCliReq.cwd = rawCwd;
              safeCliReq.workspacePath = rawCwd;
            }
            if (request.dryRun === true) safeCliReq.dryRun = true;
          }
          const result = await launchCliSession(safeCliReq);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/context-unlock-status') {
          const result = await getContextUnlockStatus(undefined, sanitizeLiveUnlockOpts(request, false));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
          return;
        }
        if (req.url === '/context-unlock-apply') {
          const result = await applyContextUnlockAsync(sanitizeLiveUnlockOpts(request, true));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/context-unlock-restore') {
          const result = await restoreContextUnlockAsync(sanitizeLiveUnlockOpts(request, true));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/enhance-status') {
          const { getEnhanceStatusAsync } = require('./meter-enhance');
          const result = await getEnhanceStatusAsync(sanitizeLiveEnhanceStatus(request));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
          return;
        }
        if (req.url === '/enhance-apply') {
          const { applyEnhancePatchAsync } = require('./meter-enhance');
          const result = await applyEnhancePatchAsync(sanitizeLiveEnhanceApply(request), {});
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/enhance-restore') {
          const { restoreAllEnhanceAsync } = require('./meter-enhance');
          const result = await restoreAllEnhanceAsync(sanitizeLiveEnhanceRestore(request));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/restart-language-servers') {
          const { restartLanguageServersAsync } = require('./meter-enhance');
          const result = await restartLanguageServersAsync();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/test-proxy') {
          const { testProxyHealth } = require('./modules-config');
          const report = await testProxyHealth(request?.proxyUrl);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: report }));
          return;
        }
        if (req.url === '/modules-status') {
          const { loadModulesConfig, inspectDiskModules } = require('./modules-config');
          const cfg = loadModulesConfig();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            data: cfg,
            disk: inspectDiskModules(null),
            runtime: buildLiveRuntimeModulesMeta(cfg),
            configCorrupted: Boolean(cfg.__configCorrupted),
            configError: cfg.__configError || null,
            corruptedConfigPath: cfg.__corruptedConfigPath || null
          }));
          return;
        }
        if (req.url === '/toggle-module') {
          const { loadModulesConfig, saveModulesConfig, inspectDiskModules, normalizeBrandTitle, normalizeClientLanguage, sanitizeProxyProfiles } = require('./modules-config');
          const cfg = loadModulesConfig();
          const mod = request?.name;
          if (!TOGGLEABLE_MODULES.has(mod) || !cfg.modules[mod]) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: `未知模块: ${mod}` }));
            return;
          }
          const rawExtra = (request?.opts && typeof request.opts === 'object' && !Array.isArray(request.opts)) ? request.opts : {};
          const extra = {};
          if (typeof rawExtra.language === 'string') extra.language = rawExtra.language;
          if (typeof rawExtra.brandTitle === 'string') extra.brandTitle = rawExtra.brandTitle;
          if (typeof rawExtra.proxyUrl === 'string') extra.proxyUrl = rawExtra.proxyUrl;
          if (typeof rawExtra.bypassList === 'string') extra.bypassList = rawExtra.bypassList;
          if (Array.isArray(rawExtra.profiles)) extra.profiles = rawExtra.profiles;
          if (typeof rawExtra.activeProfileId === 'string' || rawExtra.activeProfileId === null) extra.activeProfileId = rawExtra.activeProfileId;
          const targetEnable = Boolean(request?.enable);
          const disk = inspectDiskModules(null);
          const hasDiskCapability = mod === 'chinese'
            ? Boolean(disk.chineseReady)
            : (mod === 'proxy' ? Boolean(disk.proxyReady) : Boolean(disk.meterReady));

          if (targetEnable && !hasDiskCapability) {
            const modLabel = mod === 'chinese' ? '汉化' : (mod === 'proxy' ? '免 TUN 代理' : '核心监控');
            const subCmd = mod === 'proxy' ? 'proxy:enable' : (mod === 'chinese' ? 'chinese:enable' : 'install');
            const cmdHint = process.platform === 'win32'
              ? `在插件目录打开终端运行 install.bat 或 node cli.js ${subCmd}`
              : `在插件目录打开终端运行 node cli.js ${subCmd}`;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: false,
              status: 'install_failed',
              data: cfg,
              disk,
              runtime: buildLiveRuntimeModulesMeta(cfg),
              error: `当前客户端磁盘 ASAR 未注入${modLabel}组件（或组件不完整）。请先彻底退出 Antigravity（包含系统托盘），再${cmdHint} 完成持久化注入。`,
              restartRequired: false
            }));
            return;
          }

          const bootZh = resolveLiveBootChineseSnapshot();
          const prevChineseEnabled = Boolean(cfg.modules.chinese?.enabled);
          const prevChineseLang = cfg.modules.chinese?.language || (prevChineseEnabled ? 'zh-CN' : 'en');
          if (mod === 'chinese') {
            const nextLang = normalizeClientLanguage(extra.language, targetEnable);
            cfg.modules.chinese.language = nextLang;
            cfg.modules.chinese.enabled = nextLang === 'zh-CN';
            if (extra.brandTitle !== undefined) cfg.modules.chinese.brandTitle = normalizeBrandTitle(extra.brandTitle);
            cfg.modules.chinese.lastUpdated = new Date().toISOString();
          } else {
            if (mod === 'proxy' && extra.proxyUrl !== undefined) {
              const check = parseAndValidateProxyUrl(extra.proxyUrl);
              if (!check.ok) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  ok: false,
                  status: 'invalid_config',
                  error: check.error,
                  data: cfg,
                  runtime: buildLiveRuntimeModulesMeta(cfg)
                }));
                return;
              }
              cfg.modules.proxy.proxyUrl = check.value;
            }
            cfg.modules[mod].enabled = targetEnable;
            if (mod === 'proxy') {
              if (typeof extra.bypassList === 'string') {
                cfg.modules.proxy.bypassList = extra.bypassList.trim();
              }
              if (Array.isArray(extra.profiles)) {
                const pCheck = sanitizeProxyProfiles(extra.profiles, { strict: true });
                if (!pCheck.ok) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    ok: false,
                    status: 'invalid_config',
                    error: pCheck.error,
                    data: cfg,
                    runtime: buildLiveRuntimeModulesMeta(cfg)
                  }));
                  return;
                }
                cfg.modules.proxy.profiles = pCheck.profiles;
              }
              if (extra.activeProfileId !== undefined) {
                const pid = typeof extra.activeProfileId === 'string' ? extra.activeProfileId.trim() : null;
                cfg.modules.proxy.activeProfileId = pid && Array.isArray(cfg.modules.proxy.profiles) && cfg.modules.proxy.profiles.some(p => p.id === pid)
                  ? pid
                  : null;
              }
              cfg.modules.proxy.lastUpdated = new Date().toISOString();
            }
          }
          saveModulesConfig(cfg);
          const runtime = buildLiveRuntimeModulesMeta(cfg);
          const langChanged = mod === 'chinese' && (
            Boolean(cfg.modules.chinese.enabled) !== prevChineseEnabled ||
            cfg.modules.chinese.language !== prevChineseLang
          );
          const brandOnlyUpdate = mod === 'chinese' && extra.brandTitle !== undefined && !langChanged;
          const brandNeedsRestart = brandOnlyUpdate && !bootZh.runtimeLoaded && cfg.modules.chinese.brandTitle !== 'english';
          const restartRequired = mod === 'proxy'
            ? Boolean(runtime.proxyNeedsRestart)
            : (mod === 'meter'
              ? !Boolean(cfg.modules.meter.enabled)
              : (brandOnlyUpdate ? brandNeedsRestart : Boolean(runtime.chineseNeedsRestart)));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            status: 'config_toggled',
            data: cfg,
            disk,
            runtime,
            restartRequired
          }));
          return;
        }
        if (req.url === '/runtime-info') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            backendVersion: PROJECT_VERSION,
            backendSource: 'live-host',
            pid: process.pid,
            startedAt,
            capabilities: { ...LIVE_CAPABILITIES },
            origins: Array.from(resolveAllowedSet())
          }));
          return;
        }
        if (req.url === '/check-update') {
          const result = await checkUpdateAsync(sanitizeLiveUpdateOpts(request));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/apply-update') {
          const result = await applyUpdateAsync(sanitizeLiveUpdateOpts(request));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === '/shutdown') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, shuttingDown: true, pid: process.pid, version: PROJECT_VERSION }));
          if (typeof onShutdown === 'function') {
            setImmediate(() => {
              try { onShutdown(); } catch {}
            });
          }
          return;
        }
        if (req.url === '/restart-host') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, supported: false }));
          return;
        }
        if (req.url === '/token-history') {
          const data = await collectTokenHistoryAsync({ force: request.force === true });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data }));
          return;
        }
        if (req.url === '/quota') {
          const reqTargetOrigin = normalizeLoopbackOrigin(request?.origin) || reqOrigin;
          const targetOrigin = allowedSet.has(reqTargetOrigin) ? reqTargetOrigin : reqOrigin;
          const safeCsrf = (typeof request?.csrfToken === 'string' && request.csrfToken.trim().length <= 512 && !/[\r\n]/.test(request.csrfToken))
            ? request.csrfToken.trim()
            : '';
          const resData = await fetchQuotaSnapshotFromHost({
            force: request.force === true,
            origin: targetOrigin,
            backendSource: 'live-host',
            currentModel: request.currentModel || null,
            browsePoolKey: request.browsePoolKey || null,
            ...(safeCsrf ? { csrfToken: safeCsrf } : {})
          });
          const { _raw, ...safeData } = resData || {};
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: safeData }));
          return;
        }
        const scanOrigin = normalizeLoopbackOrigin(request?.origin) || reqOrigin;
        const effectiveOrigin = allowedSet.has(scanOrigin) ? scanOrigin : reqOrigin;
        const scanCsrf = (typeof request?.csrfToken === 'string' && request.csrfToken.trim().length <= 512 && !/[\r\n]/.test(request.csrfToken))
          ? request.csrfToken.trim()
          : '';
        const data = await collect(effectiveOrigin, request.id, {
          force: request.force === true,
          ...(scanCsrf ? { csrfToken: scanCsrf } : {})
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          data: {
            ...(data || {}),
            backendVersion: PROJECT_VERSION,
            backendSource: 'live-host'
          }
        }));
      }
      catch (e) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      }
    });
  };
}

function getCliArgValue(flagName) {
  const idx = process.argv.indexOf(flagName);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return String(process.argv[idx + 1] || '').trim();
  }
  return '';
}

function parseInitialOriginsEnv() {
  const cliOriginsB64 = getCliArgValue('--origins-b64');
  let raw = String(process.env.AG_LIVE_ORIGINS || '').trim();
  if (!raw && cliOriginsB64) {
    try { raw = Buffer.from(cliOriginsB64, 'base64').toString('utf8').trim(); } catch {}
  }
  if (!raw) return [];
  try {
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? Array.from(new Set(parsed.map(o => normalizeLoopbackOrigin(o) || String(o || '').trim()).filter(Boolean)))
        : [];
    }
  } catch {}
  return Array.from(new Set(raw.split(/[,;\s]+/).map(o => normalizeLoopbackOrigin(o) || String(o || '').trim()).filter(Boolean)));
}

async function discoverCdpPageOrigins() {
  try {
    const discovery = await discoverCdpTargets();
    return Array.isArray(discovery.origins) ? discovery.origins : [];
  } catch {
    return [];
  }
}

function probeOriginAlive(origin) {
  return new Promise((resolve) => {
    try {
      const norm = normalizeLoopbackOrigin(origin);
      if (!norm) return resolve(false);
      const client = norm.startsWith('https:') ? https : http;
      const req = client.request(norm + '/', { agent: false, rejectUnauthorized: false, method: 'GET' }, res => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function startLiveHost() {
  const envOrigins = parseInitialOriginsEnv();
  const httpLoopbackOrigins = envOrigins.filter(o => normalizeLoopbackOrigin(o));
  let currentOrigins = envOrigins;
  let api = null;
  if (httpLoopbackOrigins.length > 0) {
    api = await connect({ origin: httpLoopbackOrigins[0] });
    api.origins = currentOrigins;
  } else {
    try {
      api = await connect();
      currentOrigins = Array.from(new Set([...(Array.isArray(api.origins) && api.origins.length ? api.origins : [api.origin]), ...envOrigins]));
    } catch (connectErr) {
      // 当宿主仅通过 vscode-file:// / app:// 窗口传递 origins 且未开启 CDP 时，降级保留非回环 origin 以维持本地桥接启动
      if (envOrigins.length > 0) {
        api = { origin: envOrigins[0], origins: envOrigins };
      } else {
        throw connectErr;
      }
    }
  }
  const secret = crypto.randomBytes(32).toString('hex');
  const cliStamp = getCliArgValue('--stamp');
  const stampRaw = process.env.AG_LIVE_STAMP_PATH || cliStamp;
  const stamp = stampRaw
    ? path.resolve(stampRaw)
    : path.join(getStateDir(), '.live-session.json');
  const hostPidRaw = Number(process.env.AG_LIVE_HOST_PID || getCliArgValue('--host-pid') || 0);
  const watchHostPid = Number.isInteger(hostPidRaw) && hostPidRaw > 0 ? hostPidRaw : null;

  let checkTimer = null;
  let server = null;
  let shuttingDown = false;
  const shutdownGracefully = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
    const primaryStamp = path.join(getStateDir(), '.live-session.json');
    for (const candidateStamp of Array.from(new Set([stamp, primaryStamp]))) {
      try {
        if (fs.existsSync(candidateStamp)) {
          const cur = JSON.parse(fs.readFileSync(candidateStamp, 'utf8'));
          if (cur && cur.pid === process.pid) fs.unlinkSync(candidateStamp);
        }
      } catch {}
    }
    if (server) {
      try {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 500).unref();
      } catch {
        process.exit(0);
      }
    } else {
      process.exit(0);
    }
  };

  server = http.createServer(createLiveRequestHandler({
    api,
    secret,
    getAllowedOrigins: () => currentOrigins,
    onShutdown: shutdownGracefully,
    startedAt: LIVE_HOST_STARTED_AT
  }));

  server.listen(0, LOOPBACK_IPV4, () => {
    const info = {
      port: server.address().port,
      token: secret,
      pid: process.pid,
      origin: api.origin,
      origins: currentOrigins,
      version: PROJECT_VERSION,
      backendSource: 'live-host',
      hasQuota: true,
      hasRuntimeInfo: true,
      capabilities: Object.keys(LIVE_CAPABILITIES).filter(k => LIVE_CAPABILITIES[k]),
      startedAt: LIVE_HOST_STARTED_AT
    };
    fs.mkdirSync(path.dirname(stamp), { recursive: true });
    const tmpStamp = `${stamp}.tmp-${process.pid}`;
    // 限制 .live-session.json 仅当前用户可读，避免本机多用户场景泄露会话令牌
    fs.writeFileSync(tmpStamp, JSON.stringify(info, null, 2), { mode: 0o600 });
    fs.renameSync(tmpStamp, stamp);
    console.log('Context Meter local bridge ready on loopback port ' + info.port);
  });

  process.on('SIGTERM', shutdownGracefully);
  process.on('SIGINT', shutdownGracefully);

  let misses = 0;
  checkTimer = setInterval(async () => {
    if (shuttingDown) return;
    try {
      if (watchHostPid) {
        try { process.kill(watchHostPid, 0); } catch {
          shutdownGracefully();
          return;
        }
      }
      const cdpOrigins = await discoverCdpPageOrigins();
      if (cdpOrigins.length > 0) {
        currentOrigins = Array.from(new Set([...cdpOrigins, ...envOrigins]));
        misses = 0;
        return;
      }
      if (envOrigins.length > 0) {
        const aliveResults = await Promise.all(envOrigins.map(o => probeOriginAlive(o)));
        if (aliveResults.some(Boolean)) {
          misses = 0;
          return;
        }
      }
      throw new Error('No live Antigravity origins available');
    } catch {
      if (++misses >= 3) {
        shutdownGracefully();
      }
    }
  }, 10000);
}

if (require.main === module) {
  startLiveHost().catch(e => { console.error(e.message); process.exitCode = 1; });
}

module.exports = {
  LIVE_CAPABILITIES,
  buildLiveRuntimeModulesMeta,
  createLiveRequestHandler,
  parseInitialOriginsEnv,
  startLiveHost
};
