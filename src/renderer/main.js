(function () {
  'use strict';

  const METER_VERSION = '0.9.1';
  const LOOPBACK_HOST = [127, 0, 0, 1].join('.');

  // 仅允许在本地回环页面、受控桌面协议或无 location 测试沙箱中挂载，阻止第三方外部页面加载 HUD
  try {
    const rawOrigin = String(globalThis.location?.origin || '').trim();
    if (rawOrigin && rawOrigin !== 'null') {
      const allowedOrigin = /^(?:https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?|vscode-file:\/\/.*|vscode-webview:\/\/.*|app:\/\/.*|file:\/\/.*|about:.*)$/i.test(rawOrigin);
      if (!allowedOrigin) return;
    }
  } catch {}

  let inheritedState = null;
  try {
    if (globalThis.__AGContextMeter && typeof globalThis.__AGContextMeter.captureHotReloadState === 'function') {
      inheritedState = globalThis.__AGContextMeter.captureHotReloadState();
    }
    if (globalThis.__AGContextMeter && typeof globalThis.__AGContextMeter.dispose === 'function') {
      globalThis.__AGContextMeter.dispose();
    }
    document.getElementById('ag-context-meter')?.remove?.();
  } catch {}

  const core = globalThis.__AGContextMeterCore || {};

  const host = document.createElement('div');
  host.id = 'ag-context-meter';
  host.setAttribute('data-dock', 'floating');
  host.setAttribute('data-theme', 'obsidian');
  host.setAttribute('data-mode', 'popover');
  host.setAttribute('data-layout', 'wide');
  const shadow = host.attachShadow({ mode: 'open' });

  /* @INSERT_STYLES_AND_TEMPLATE */

  /* @INSERT_I18N_MODULE */

  /* @INSERT_BUDGET_ENGINE_MODULE */

  /* @INSERT_CHARTS_MODULE */

  const budgetEngine = typeof createContextBudgetEngine === 'function'
    ? createContextBudgetEngine()
    : (globalThis.ContextBudgetEngine || globalThis.__AGContextBudgetEngine || {});

  const el = (id) => shadow.getElementById(id);
  const qsa = (sel, root = shadow) => Array.from((root || shadow).querySelectorAll(sel));

  const FALLBACK_MODELS = [
    { productKey: 'product:google:gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', vendor: 'Google', maxTokens: 1048576, maxOutputTokens: 65536 },
    { productKey: 'product:google:gemini-3.8-flash', label: 'Gemini 3.8 Flash', vendor: 'Google', maxTokens: 1048576, maxOutputTokens: 65536 },
    { productKey: 'product:anthropic:claude-sonnet', label: 'Claude Sonnet', vendor: 'Anthropic', maxTokens: 200000, maxOutputTokens: 16384 }
  ];

  const state = {
    disposed: false,
    hudOpen: false,
    dockMode: 'popover',
    activeSpace: 'cockpit',
    openSheetId: null,
    panelLang: 'zh-CN',
    theme: 'obsidian',
    chroma: '#6366f1|#38bdf8|rgba(99,102,241,0.24)|#818cf8',
    autoCheckUpdate: true,
    restartRequired: false,

    // Session & Context
    route: null,
    generation: 0,
    count: 0,
    latest: null,
    scan: null,
    scanBusy: false,
    requestBusy: false,
    requestError: '',
    scanError: '',
    requestAt: 0,
    requestNext: 0,
    scanNext: 0,
    activeModelId: '',
    activeProductKey: '',
    activeModelLabel: '',
    activeEffort: '',
    sessionCallsMap: new Map(),
    pendingFinalCalls: new Map(),
    sessionCalls: [],
    sessionCostTotal: 0,
    lastRoundCost: 0,

    // Streaming & Speed
    isStreaming: false,
    liveTps: null,
    liveTtft: null,
    liveOutTok: null,
    liveDurSec: null,
    wavePoints: [],
    speedRecords: [],
    duelMetric: 'tps',
    duelFocusModel: '',

    // Quota
    quotaSnapshot: null,
    quotaRawInput: null,
    quotaFetchedAt: 0,
    quotaError: '',
    selectedPoolKey: null,

    // Context Budget (aligned 1:1 with meter-collector & preload cache)
    budgetScope: 'per_model', // 'per_model' | 'unified'
    unifiedPref: { mode: 'default', limitTokens: null },
    contextPreferencesMap: {}, // keyed by productKey / modelId -> { scope, productKey, modelId, label, mode, limitTokens }
    selectedProductKey: '',
    manualBudgetModelSelect: false,
    modelCapabilities: {},
    cascadeModelConfigs: [],
    conversationBindings: {},
    lastInjectedLimit: null,
    lastInjectedMode: null,
    lastAdoptedLimit: null,
    injectedByProduct: new Map(),
    adoptedByProduct: new Map(),
    lastTurnStatus: null,
    unlockStatus: null,

    // Token Ledger & Subscription FX
    historyData: null,
    ledgerSource: 'all',
    heatMode: 'daily',
    hmPageOffset: 0,
    ledgerBottomMode: 'sum',
    valuationMode: 'actual',
    subRegionCode: 'US',
    subCurrency: 'USD',
    subPrice: 19.99,
    subAcqMode: 'paid_pro',
    countryFilter: '',

    // Studio
    promptTier: 0,
    zhChatTitle: false,
    proxyEnabled: false,
    proxyUrl: `http://${LOOPBACK_HOST}:7897`,
    proxyDiag: { configValid: null, proxyReachable: null, internetReachable: null, modelCallVerified: null },
    shellLanguage: 'en',
    brandTitle: 'english',
    latestRelease: null,
    backendSource: 'detecting',
    backendVersion: METER_VERSION
  };

  // Pre-hydrate preload/localStorage budget preferences immediately so cold-start interceptor is instant
  try {
    if (globalThis.__AGContextPreferences && typeof globalThis.__AGContextPreferences === 'object') {
      state.contextPreferencesMap = { ...globalThis.__AGContextPreferences };
    } else {
      const rawMap = globalThis.localStorage?.getItem?.('ag-context-preferences');
      if (rawMap) state.contextPreferencesMap = JSON.parse(rawMap) || {};
    }
    const rawScope = globalThis.__AGContextScopeMode || globalThis.localStorage?.getItem?.('ag-context-scope-mode');
    if (rawScope === 'unified' || rawScope === 'per_model') state.budgetScope = rawScope;
    if (globalThis.__AGContextUnifiedPreference && typeof globalThis.__AGContextUnifiedPreference === 'object') {
      state.unifiedPref = { ...globalThis.__AGContextUnifiedPreference };
    } else {
      const rawUni = globalThis.localStorage?.getItem?.('ag-context-unified-preference');
      if (rawUni) state.unifiedPref = JSON.parse(rawUni) || state.unifiedPref;
    }
  } catch {}

  const controllers = new Set();
  const intervals = new Set();
  let toastTimer = null;
  let autoUpdateTimer = null;

  function notify(msg) {
    const tEl = el('hudToast');
    if (!tEl || !msg) return;
    tEl.textContent = String(msg);
    tEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => tEl.classList.remove('show'), 2500);
  }

  function t(key, vars) {
    return translatePulseKey(state.panelLang, key, vars);
  }

  // ==================== Dual-Transport Backend Bridge ====================
  // 在全局单例上固化原始传输层引用，防止多次热重载叠加包装链
  if (!globalThis.__agOrigFetch && typeof globalThis.fetch === 'function') {
    globalThis.__agOrigFetch = globalThis.fetch.bind(globalThis);
  }
  const origFetch = globalThis.__agOrigFetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);

  function getLiveBridge() {
    const b = globalThis.__AGContextMeterLive;
    if (b && Number.isFinite(Number(b.port)) && Number(b.port) > 0 && typeof b.token === 'string' && b.token) {
      return b;
    }
    return null;
  }

  function shouldPreferLive() {
    const live = getLiveBridge();
    if (!live) return false;
    const hotCtx = globalThis.__AGContextMeterHotReloadContext;
    if (hotCtx && hotCtx.preferLiveHost) return true;
    const ipcApi = globalThis.contextMeterAPI;
    if (!ipcApi) return true;
    const bootVer = globalThis.__AGContextMeterBootBackend?.backendVersion;
    if (live.version && bootVer && core.compareVersions && core.compareVersions(live.version, bootVer) > 0) {
      return true;
    }
    return false;
  }

  async function callLiveRoute(route, body = {}, signal = null) {
    const live = getLiveBridge();
    if (!live || !origFetch) throw new Error('Live-Host 未连接');
    const res = await origFetch(`http://${LOOPBACK_HOST}:${Number(live.port)}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AG-Context-Token': live.token
      },
      body: JSON.stringify({ ...(body || {}), origin: globalThis.location?.origin || '' }),
      ...(signal ? { signal } : {})
    });
    if (!res.ok) throw new Error(`Live HTTP ${res.status}`);
    return await res.json();
  }

  async function callBackend({ ipcFn = null, liveRoute = '', body = {}, signal = null }) {
    const ipcAvail = typeof ipcFn === 'function';
    const liveAvail = Boolean(liveRoute && getLiveBridge());
    const preferLive = liveAvail && shouldPreferLive();

    if (preferLive) {
      try {
        const res = await callLiveRoute(liveRoute, body, signal);
        state.backendSource = 'live-host';
        if (res?.backendVersion) state.backendVersion = res.backendVersion;
        return res;
      } catch (err) {
        if (!ipcAvail) throw err;
      }
    }

    if (ipcAvail) {
      try {
        const res = await ipcFn();
        state.backendSource = 'electron-ipc';
        if (res?.backendVersion) state.backendVersion = res.backendVersion;
        return res;
      } catch (err) {
        if (!liveAvail) throw err;
      }
    }

    if (liveAvail) {
      const res = await callLiveRoute(liveRoute, body, signal);
      state.backendSource = 'live-host';
      if (res?.backendVersion) state.backendVersion = res.backendVersion;
      return res;
    }

    throw new Error('宿主通信通道尚未就绪');
  }

  // ==================== Host Titlebar Docking & Model Detection ====================
  function findHostTitlebar() {
    try {
      const bar = document.querySelector('[class*="@container/titlebar"]');
      if (bar) return bar;
      return document.querySelector('header.titlebar, .monaco-workbench .part.titlebar, [data-testid="titlebar"]');
    } catch {
      return null;
    }
  }

  function ensureHostDocked() {
    if (state.disposed) return false;
    const titlebar = findHostTitlebar();
    if (titlebar) {
      const rightSlot = titlebar.querySelector(':scope > div.shrink-0') || titlebar.lastElementChild || titlebar;
      if (host.parentNode !== rightSlot) {
        if (rightSlot !== titlebar && rightSlot.firstChild) {
          rightSlot.insertBefore(host, rightSlot.firstChild);
        } else {
          rightSlot.appendChild(host);
        }
      }
      host.setAttribute('data-dock', 'flow');
    } else if (!host.isConnected) {
      (document.body || document.documentElement)?.appendChild?.(host);
      host.setAttribute('data-dock', 'floating');
    }
    syncHudAnchorPosition();
    return Boolean(host.parentNode || host.isConnected);
  }

  function syncHudAnchorPosition() {
    try {
      const vw = Math.max(320, globalThis.innerWidth || 1200);
      if (vw < 640) host.setAttribute('data-layout', 'ring-only');
      else if (vw < 820) host.setAttribute('data-layout', 'minimal');
      else if (vw < 1020) host.setAttribute('data-layout', 'compact');
      else host.setAttribute('data-layout', 'wide');

      const pill = el('dynamicIsland');
      if (!pill || typeof pill.getBoundingClientRect !== 'function') return;
      const rect = pill.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const topPx = Math.max(36, Math.round(rect.bottom + 8));
        const rightPx = Math.max(10, Math.min(vw - 320, Math.round(vw - rect.right)));
        host.style.setProperty('--hud-top', `${topPx}px`);
        host.style.setProperty('--hud-right', `${rightPx}px`);
      }
      const bar = findHostTitlebar();
      if (bar && typeof bar.getBoundingClientRect === 'function') {
        const bRect = bar.getBoundingClientRect();
        if (bRect.bottom > 20 && bRect.bottom < 80) {
          host.style.setProperty('--hud-drawer-top', `${Math.round(bRect.bottom)}px`);
        }
      }
    } catch {}
  }

  function groupProductSafe(input) {
    if (typeof core.groupModelProduct === 'function') {
      return core.groupModelProduct(input || {});
    }
    const raw = String(input?.modelId || input?.label || 'unknown').trim();
    const low = raw.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
    const vendor = low.includes('claude') ? 'Anthropic' : (low.includes('gpt') ? 'OpenAI' : 'Google');
    const slug = low.replace(/[^a-z0-9._-]+/g, '-');
    return { productKey: `product:${vendor.toLowerCase()}:${slug}`, productLabel: raw.replace(/\s*\([^)]*\)\s*$/, ''), vendor, effort: input?.effort || null };
  }

  function resolveStableIdSafe(rawOrObj) {
    if (!rawOrObj) return null;
    if (typeof core.resolveStableModelId === 'function') {
      const r = core.resolveStableModelId(rawOrObj, state.cascadeModelConfigs || []);
      if (r) return r;
    }
    if (typeof rawOrObj === 'string') return rawOrObj.trim().toLowerCase() || null;
    const s = String(rawOrObj.modelId || rawOrObj.modelRaw || rawOrObj.model || rawOrObj.label || '').trim().toLowerCase();
    return s || null;
  }

  function extractHostSelectedModelInfo() {
    try {
      const triggers = document.querySelectorAll('[data-testid="model-selector-trigger"]');
      for (const node of triggers) {
        if (host.contains?.(node)) continue;
        if (typeof node.getBoundingClientRect === 'function') {
          const rect = node.getBoundingClientRect();
          if (rect && (rect.width <= 0 || rect.height <= 0)) continue;
        }
        let cleanSource = node;
        if (typeof node.cloneNode === 'function') {
          try {
            const cloned = node.cloneNode(true);
            if (typeof cloned.querySelectorAll === 'function') {
              cloned.querySelectorAll('svg, [aria-hidden="true"], [data-badge], .badge').forEach((elNode) => elNode.remove?.());
            }
            cleanSource = cloned;
          } catch {}
        }
        const rawText = String(cleanSource.textContent || '').replace(/\s+/g, ' ').trim();
        if (!rawText) continue;
        const effMatch = rawText.match(/\(([^)]+)\)\s*$/);
        const effort = effMatch ? effMatch[1].trim() : '';
        const stableId = resolveStableIdSafe(rawText) || rawText.toLowerCase();
        const g = groupProductSafe({ modelId: stableId, label: rawText, effort });
        return {
          rawText,
          modelId: stableId,
          productKey: g.productKey,
          productLabel: g.productLabel || rawText,
          effort: effort || g.effort || ''
        };
      }
    } catch {}
    return null;
  }

  function syncActiveModelIdentity() {
    const domInfo = extractHostSelectedModelInfo();
    if (domInfo) {
      state.activeModelLabel = domInfo.rawText;
      state.activeModelId = domInfo.modelId;
      state.activeProductKey = domInfo.productKey;
      state.activeEffort = domInfo.effort || state.activeEffort;
    } else if (state.latest?.model) {
      const sid = resolveStableIdSafe(state.latest) || String(state.latest.model).toLowerCase();
      const g = groupProductSafe({ modelId: sid, label: state.latest.model });
      state.activeModelLabel = state.latest.model;
      state.activeModelId = sid;
      state.activeProductKey = g.productKey;
    }
    const cid = state.route || getActiveConversationId();
    if (cid && state.activeProductKey) {
      state.conversationBindings[cid] = {
        productKey: state.activeProductKey,
        productLabel: state.activeModelLabel || state.activeProductKey,
        modelId: state.activeModelId || state.activeProductKey
      };
    }
    if (!state.manualBudgetModelSelect && state.activeProductKey) {
      state.selectedProductKey = state.activeProductKey;
    }
  }

  function getActiveConversationId() {
    try {
      const m = String(globalThis.location?.pathname || '').match(/^\/c\/([a-f\d-]{36})(?:\/|$)/i);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  // ==================== Real Account Model Products Catalog ====================
  function mergeCascadeConfigs(incoming) {
    if (!Array.isArray(incoming) || !incoming.length) return;
    const byId = new Map();
    for (const c of state.cascadeModelConfigs) {
      const k = String(c?.modelId || c?.modelOrAlias?.model || c?.label || '').toLowerCase();
      if (k) byId.set(k, c);
    }
    for (const c of incoming) {
      const k = String(c?.modelId || c?.modelOrAlias?.model || c?.label || '').toLowerCase();
      if (!k) continue;
      const prev = byId.get(k) || {};
      byId.set(k, {
        ...prev,
        ...c,
        maxTokens: c.maxTokens ?? prev.maxTokens ?? null,
        maxOutputTokens: c.maxOutputTokens ?? prev.maxOutputTokens ?? null
      });
    }
    state.cascadeModelConfigs = Array.from(byId.values());
  }

  function getKnownModelProducts() {
    const productMap = new Map();

    const addCandidate = (meta, fromCatalog = false) => {
      if (!meta) return;
      const g = groupProductSafe(meta);
      if (!g.productKey) return;
      let prod = productMap.get(g.productKey);
      if (!prod) {
        prod = {
          productKey: g.productKey,
          label: g.productLabel || meta.label || meta.modelId || g.productKey,
          vendor: g.vendor || 'Google',
          inCatalog: Boolean(fromCatalog),
          maxTokens: null,
          maxOutputTokens: null,
          members: new Map()
        };
        productMap.set(g.productKey, prod);
      }
      if (fromCatalog) prod.inCatalog = true;

      const rawId = String(meta.modelId || '').trim().toLowerCase();
      const stripped = rawId.replace(/^model_/, '');
      const cap = state.modelCapabilities[stripped] || state.modelCapabilities[rawId] || null;
      const mWin = Number(meta.maxTokens || cap?.maxTokens || 0);
      const mOut = Number(meta.maxOutputTokens || cap?.maxOutputTokens || 0);

      if (mWin > (prod.maxTokens || 0)) prod.maxTokens = mWin;
      if (mOut > (prod.maxOutputTokens || 0)) prod.maxOutputTokens = mOut;
      if (rawId) {
        prod.members.set(rawId, {
          modelId: rawId,
          label: meta.label || rawId,
          maxTokens: mWin || null,
          maxOutputTokens: mOut || null
        });
      }
    };

    for (const c of state.cascadeModelConfigs) {
      const sid = resolveStableIdSafe(c) || c?.modelId || c?.modelOrAlias?.model || c?.label;
      addCandidate({
        modelId: sid,
        label: c?.label || c?.displayName || sid,
        effort: c?.effort,
        maxTokens: c?.maxTokens,
        maxOutputTokens: c?.maxOutputTokens
      }, true);
    }

    for (const [k, cap] of Object.entries(state.modelCapabilities)) {
      if (!cap) continue;
      addCandidate({
        modelId: cap.modelId || k,
        label: cap.displayName || cap.modelId || k,
        maxTokens: cap.maxTokens,
        maxOutputTokens: cap.maxOutputTokens
      }, false);
    }

    if (state.activeProductKey || state.activeModelLabel) {
      addCandidate({
        modelId: state.activeModelId || state.activeModelLabel,
        label: state.activeModelLabel,
        effort: state.activeEffort
      }, true);
    }

    for (const call of state.sessionCalls) {
      const mid = call?.modelExactId || call?.modelId || call?.model;
      if (mid) addCandidate({ modelId: mid, label: call.modelLabel || call.model || mid, effort: call.effort }, false);
    }
    for (const sr of state.speedRecords.slice(0, 60)) {
      const mid = sr?.modelExactId || sr?.modelId || sr?.model;
      if (mid) addCandidate({ modelId: mid, label: sr.modelLabel || sr.model || mid, effort: sr.effort }, false);
    }

    const list = Array.from(productMap.values()).map(p => {
      const isGemini = p.vendor === 'Google' || p.productKey.includes('gemini');
      const isClaude = p.vendor === 'Anthropic' || p.productKey.includes('claude');
      const fallbackWin = isGemini ? 1048576 : (isClaude ? 200000 : 400000);
      const fallbackOut = isGemini ? 65536 : 32000;
      return {
        ...p,
        maxTokens: p.maxTokens || fallbackWin,
        maxOutputTokens: p.maxOutputTokens || fallbackOut
      };
    });

    if (!list.length) return FALLBACK_MODELS.map(m => ({ ...m, members: new Map() }));

    // Put active session model at top, followed by catalog models
    list.sort((a, b) => {
      const aAct = a.productKey === state.activeProductKey ? 0 : 1;
      const bAct = b.productKey === state.activeProductKey ? 0 : 1;
      if (aAct !== bAct) return aAct - bAct;
      if (a.inCatalog !== b.inCatalog) return a.inCatalog ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    return list;
  }

  function getProductByKey(productKey) {
    const products = getKnownModelProducts();
    if (!productKey) return products[0];
    return products.find(p => p.productKey === productKey) ||
      products.find(p => p.label.toLowerCase() === String(productKey).toLowerCase()) ||
      products[0];
  }

  // ==================== Context Budget Preference Sync & Auto-Unlock ====================
  function syncWindowContextPreferencesCache() {
    try {
      globalThis.__AGContextPreferences = { ...state.contextPreferencesMap };
      globalThis.__AGContextScopeMode = state.budgetScope;
      globalThis.__AGContextUnifiedPreference = { ...state.unifiedPref };
      globalThis.localStorage?.setItem?.('ag-context-preferences', JSON.stringify(state.contextPreferencesMap));
      globalThis.localStorage?.setItem?.('ag-context-scope-mode', state.budgetScope);
      globalThis.localStorage?.setItem?.('ag-context-unified-preference', JSON.stringify(state.unifiedPref));
    } catch {}
  }

  function getPreferenceForProduct(prod) {
    if (state.budgetScope === 'unified') {
      return state.unifiedPref || { mode: 'default', limitTokens: null };
    }
    if (!prod) return { mode: 'default', limitTokens: null };
    const direct = state.contextPreferencesMap[prod.productKey] ||
      state.contextPreferencesMap[String(prod.productKey).toLowerCase()];
    if (direct) return direct;
    if (prod.members) {
      for (const mKey of prod.members.keys()) {
        if (state.contextPreferencesMap[mKey]) return state.contextPreferencesMap[mKey];
      }
    }
    return { mode: 'default', limitTokens: null };
  }

  function computeProductMaxInput(prod) {
    const targetProd = prod || getProductByKey(state.activeProductKey);
    return Math.max(16384, Math.min(2097152, (targetProd.maxTokens || 1048576) - (targetProd.maxOutputTokens || 65536)));
  }

  function resolveEffectiveTokensForProduct(prod) {
    const targetProd = prod || getProductByKey(state.activeProductKey);
    const maxInput = computeProductMaxInput(targetProd);
    const pref = getPreferenceForProduct(targetProd);
    if (!pref || pref.mode === 'default') {
      // 当底座已解锁为动态跟随时，默认档遵循模型自身的动态预留预算而非死锁 256K
      if (isBinaryDynamicUnlocked()) {
        const reserve = Math.max(targetProd.maxOutputTokens || 65536, 40000);
        const dynDef = (targetProd.maxTokens || 1048576) - reserve;
        if (dynDef >= 16384) return Math.min(2097152, dynDef);
      }
      return Math.min(256000, maxInput);
    }
    if (pref.mode === 'dynamic') return maxInput;
    const num = Number(pref.limitTokens);
    if (Number.isFinite(num) && num >= 16384) return Math.min(2097152, Math.round(num));
    return Math.min(256000, maxInput);
  }

  function buildPrefEntryFromSelection(rawVal, prod) {
    const targetProd = prod || getProductByKey(state.selectedProductKey || state.activeProductKey);
    const maxInput = computeProductMaxInput(targetProd);

    // 严格区分「宿主默认模式 (不覆写请求字段)」与「固定 256,000 上限」
    if (rawVal === 'default') {
      return { mode: 'default', limitTokens: null };
    }
    if (rawVal === 'dynamic') {
      return { mode: 'dynamic', limitTokens: null };
    }
    if (rawVal === 'max') {
      return { mode: 'fixed', limitTokens: maxInput };
    }
    const clamped = Math.max(16384, Math.min(2097152, Math.round(Number(rawVal) || 256000)));
    return { mode: 'fixed', limitTokens: clamped };
  }

  function isBinaryUnlockSupportedOnHost() {
    const u = state.unlockStatus;
    if (!u) return true;
    if (u.isPlatformSupported === false || u.status === 'unsupported') return false;
    return true;
  }

  function isBinaryDynamicUnlocked() {
    const u = state.unlockStatus;
    if (!u || !isBinaryUnlockSupportedOnHost()) return false;
    if (u.status === 'not_patched') return false;
    return Boolean(u.configuredMode === 'dynamic' || u.unlocked === true || u.status === 'unlocked');
  }

  function isBinaryUnlocked() {
    const u = state.unlockStatus;
    if (!u || !isBinaryUnlockSupportedOnHost()) return false;
    if (u.status === 'not_patched') return false;
    return Boolean(
      u.unlocked ||
      u.patched ||
      u.configuredMode === 'dynamic' ||
      u.status === 'unlocked' ||
      u.status === 'patched' ||
      u.status === 'patched_loaded' ||
      (u.configuredMode === 'fixed' && Number(u.configuredLimitTokens) > 256000)
    );
  }

  function doesSelectionNeedBinaryUnlock(entry, effTok) {
    if (!isBinaryUnlockSupportedOnHost()) return false;
    const u = state.unlockStatus;
    if (entry.mode === 'dynamic') {
      return !isBinaryDynamicUnlocked();
    }
    if (effTok > 256000) {
      if (isBinaryDynamicUnlocked()) return false;
      if (u && u.status !== 'not_patched' && u.configuredMode === 'fixed' && Number(u.configuredLimitTokens) >= effTok) {
        return false;
      }
      if (u && (u.unlocked === true || u.patched === true) && !u.configuredMode) {
        return false;
      }
      return true;
    }
    return false;
  }

  async function saveAndApplyProductBudget(rawVal, prodOverride = null, { autoUnlockBinary = false } = {}) {
    syncActiveModelIdentity();
    const prod = prodOverride || getProductByKey(state.selectedProductKey || state.activeProductKey);
    const entry = buildPrefEntryFromSelection(rawVal, prod);

    if (state.budgetScope === 'unified') {
      state.unifiedPref = {
        modelId: 'unified',
        mode: entry.mode,
        limitTokens: entry.limitTokens,
        updatedAt: new Date().toISOString()
      };
      syncWindowContextPreferencesCache();
      renderCockpit();
      renderBudgetSpace();
      try {
        const res = await callBackend({
          ipcFn: typeof globalThis.contextMeterAPI?.saveSettings === 'function'
            ? () => globalThis.contextMeterAPI.saveSettings({
                contextScopeMode: 'unified',
                contextUnifiedPreference: state.unifiedPref
              })
            : null,
          liveRoute: '/save-settings',
          body: {
            contextScopeMode: 'unified',
            contextUnifiedPreference: state.unifiedPref
          }
        });
        if (res?.contextUnifiedPreference) state.unifiedPref = res.contextUnifiedPreference;
      } catch {}
    } else {
      const cpPayload = {
        scope: 'product',
        productKey: prod.productKey,
        modelId: prod.productKey,
        label: prod.label,
        mode: entry.mode,
        limitTokens: entry.limitTokens
      };
      state.contextPreferencesMap[prod.productKey] = {
        ...cpPayload,
        updatedAt: new Date().toISOString()
      };
      syncWindowContextPreferencesCache();
      renderCockpit();
      renderBudgetSpace();
      try {
        const res = await callBackend({
          ipcFn: typeof globalThis.contextMeterAPI?.saveSettings === 'function'
            ? () => globalThis.contextMeterAPI.saveSettings({
                contextScopeMode: 'per_model',
                contextPreference: cpPayload
              })
            : null,
          liveRoute: '/save-settings',
          body: {
            contextScopeMode: 'per_model',
            contextPreference: cpPayload
          }
        });
        if (res?.contextPreferences && typeof res.contextPreferences === 'object') {
          state.contextPreferencesMap = { ...res.contextPreferences };
          syncWindowContextPreferencesCache();
        }
      } catch {}
    }

    const effTok = resolveEffectiveTokensForProduct(prod);
    const needsUnlock = doesSelectionNeedBinaryUnlock(entry, effTok);

    if (autoUnlockBinary && needsUnlock) {
      notify(`已设为 ${entry.mode === 'dynamic' ? '动态跟随' : formatK(effTok)}，正在自动解锁底座 256K 限制...`);
      try {
        const uRes = await callBackend({
          ipcFn: typeof globalThis.contextMeterAPI?.applyContextUnlock === 'function'
            ? () => globalThis.contextMeterAPI.applyContextUnlock({ mode: 'dynamic' })
            : null,
          liveRoute: '/context-unlock-apply',
          body: { mode: 'dynamic' }
        });
        if (uRes?.ok) {
          if (uRes.needsRestart) state.restartRequired = true;
          // Also smoothly reload language_server so new dynamic binary takes effect immediately!
          await callBackend({
            ipcFn: typeof globalThis.contextMeterAPI?.restartLanguageServers === 'function'
              ? () => globalThis.contextMeterAPI.restartLanguageServers()
              : null,
            liveRoute: '/restart-language-servers',
            body: {}
          }).catch(() => {});
          await syncStudioStatuses();
          if (state.unlockStatus?.status === 'patched_pending_restart') state.restartRequired = true;
          renderCockpit();
          renderBudgetSpace();
          notify(state.restartRequired
            ? `已写入底座解锁补丁并保存 ${formatK(effTok)}，请点右上「重启生效」加载新底座`
            : `已解锁底座并切换 ${prod.label} 上限为 ${entry.mode === 'dynamic' ? '动态跟随' : formatK(effTok)}（下一条消息生效）`);
          return;
        }
      } catch {}
    }

    renderCockpit();
    renderBudgetSpace();
    notify(`${prod.label} 预算已设为 ${entry.mode === 'dynamic' ? '动态跟随' : formatK(effTok)}（下一条消息起注入生效）`);
  }

  // ==================== Multi-Channel Request Budget Interceptor ====================
  function buildInterceptorContext(channel, urlOrProcedure = '', contentType = '', extraCascadeId = null) {
    syncActiveModelIdentity();
    const bindings = { ...state.conversationBindings };
    const cid = state.route || getActiveConversationId();
    if (cid && state.activeProductKey) {
      bindings[cid] = {
        productKey: state.activeProductKey,
        productLabel: state.activeModelLabel || state.activeProductKey,
        modelId: state.activeModelId || state.activeProductKey
      };
    }
    if (extraCascadeId && state.activeProductKey && !bindings[extraCascadeId]) {
      bindings[extraCascadeId] = {
        productKey: state.activeProductKey,
        productLabel: state.activeModelLabel || state.activeProductKey,
        modelId: state.activeModelId || state.activeProductKey
      };
    }
    return {
      channel,
      urlOrProcedure,
      contentType,
      scopeMode: state.budgetScope === 'unified' ? 'unified' : 'per_model',
      unifiedPreference: state.unifiedPref || { mode: 'default', limitTokens: 256000 },
      contextPreferencesMap: state.contextPreferencesMap || {},
      knownConfigs: state.cascadeModelConfigs || [],
      verifiedConversationBindings: bindings,
      groupProduct: groupProductSafe,
      resolveStableModelId: resolveStableIdSafe,
      minTokens: 16384,
      maxTokens: 2097152
    };
  }

  function runBudgetTransformWithActiveFallback(payload, channel, urlOrProc = '', contentType = '') {
    if (typeof budgetEngine.transformOutgoingSendRequest !== 'function') return null;
    let tx = budgetEngine.transformOutgoingSendRequest(payload, buildInterceptorContext(channel, urlOrProc, contentType));
    // 仅当前台窗口可见且该会话尚未绑定其他已知模型时，允许首轮新建会话回退至当前可见模型选择器
    if (
      tx &&
      tx.handled &&
      tx.uninjectable &&
      tx.reason === 'unidentifiable_request_model' &&
      tx.cascadeId &&
      !state.conversationBindings[tx.cascadeId] &&
      !document.hidden &&
      state.activeProductKey
    ) {
      tx = budgetEngine.transformOutgoingSendRequest(payload, buildInterceptorContext(channel, urlOrProc, contentType, tx.cascadeId));
    }
    return tx;
  }

  function recordSuccessfulInjection(tx, dispatchId = null) {
    if (!tx || !tx.handled || tx.uninjectable) return;
    const prodKey = tx.productKey && tx.productKey !== '__unified__' ? tx.productKey : state.activeProductKey;
    const activeProd = getProductByKey(prodKey);
    const targetLimit = resolveEffectiveTokensForProduct(activeProd);
    const effLimit = tx.sentMode === 'fixed'
      ? tx.sentLimitTokens
      : (tx.sentMode === 'dynamic' ? targetLimit : 256000);
    state.lastInjectedMode = tx.sentMode;
    state.lastInjectedLimit = effLimit;
    if (prodKey) {
      state.injectedByProduct.set(prodKey, {
        dispatchId,
        cascadeId: tx.cascadeId || null,
        mode: tx.sentMode,
        limitTokens: effLimit,
        failed: false,
        at: Date.now()
      });
    }
    if (tx.cascadeId && tx.productKey && tx.productKey !== '__unified__') {
      state.conversationBindings[tx.cascadeId] = {
        productKey: tx.productKey,
        productLabel: tx.productLabel || activeProd?.label || tx.productKey,
        modelId: tx.modelId || tx.productKey
      };
    }
    renderBudgetSpace();
  }

  let interceptorInstalled = false;
  let lastDecoratorDispatch = null;

  function isDuplicateOfRecentDecoratorDispatch(bodyInit, channel, urlStr, contentType) {
    if (!lastDecoratorDispatch || (Date.now() - lastDecoratorDispatch.at) > 450) return false;
    try {
      const probe = budgetEngine.transformOutgoingSendRequest?.(bodyInit, {
        ...buildInterceptorContext(channel, urlStr, contentType),
        scopeMode: 'unified',
        unifiedPreference: { mode: 'default', limitTokens: null }
      });
      if (probe && probe.cascadeId && lastDecoratorDispatch.cascadeId && probe.cascadeId !== lastDecoratorDispatch.cascadeId) {
        return false;
      }
      lastDecoratorDispatch = null;
      return true;
    } catch {
      lastDecoratorDispatch = null;
      return true;
    }
  }

  function tryRewriteSendBody(bodyInit, channel = 'fetch', urlStr = '', contentType = '') {
    try {
      if (isDuplicateOfRecentDecoratorDispatch(bodyInit, channel, urlStr, contentType)) {
        return bodyInit;
      }
      const tx = runBudgetTransformWithActiveFallback(bodyInit, channel, urlStr, contentType);
      if (tx && tx.handled) {
        recordSuccessfulInjection(tx);
        if (!tx.uninjectable && tx.modified && tx.output !== undefined) {
          return tx.output;
        }
        return bodyInit;
      }
    } catch {}
    return bodyInit;
  }

  function installRequestInterceptor() {
    if (interceptorInstalled) return;
    interceptorInstalled = true;
    try {
      globalThis.__AG_METER_ON_SEND_MESSAGE__ = (reqObj, channel = 'client_object') => {
        if (!reqObj || typeof reqObj !== 'object') return null;
        const tx = runBudgetTransformWithActiveFallback(reqObj, channel, 'SendUserCascadeMessage');
        if (tx && tx.handled && !tx.uninjectable) {
          const dispatchId = `pulse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          lastDecoratorDispatch = {
            dispatchId,
            cascadeId: tx.cascadeId || reqObj.cascadeId || null,
            productKey: tx.productKey || state.activeProductKey || null,
            at: Date.now()
          };
          recordSuccessfulInjection(tx, dispatchId);
          return { dispatchId };
        }
        return null;
      };

      globalThis.__AG_METER_ON_SEND_RESULT__ = (info = {}) => {
        if (!info || info.ok !== false) return;
        const failedId = info.dispatchId || null;
        if (failedId) {
          for (const [pk, rec] of state.injectedByProduct.entries()) {
            if (rec && rec.dispatchId === failedId) {
              state.injectedByProduct.set(pk, { ...rec, failed: true });
            }
          }
          renderBudgetSpace();
        }
      };

      if (origFetch) {
        globalThis.fetch = async function (input, init) {
          const urlStr = typeof input === 'string' ? input : (input?.url || '');
          const isSendRpc = (typeof budgetEngine.isTargetBudgetRpc === 'function' && budgetEngine.isTargetBudgetRpc(urlStr)) ||
            urlStr.includes('SendUserCascadeMessage');
          if (isSendRpc) {
            if (init && init.body) {
              const hdrs = init.headers;
              const ct = typeof hdrs?.get === 'function'
                ? (hdrs.get('content-type') || '')
                : (hdrs?.['content-type'] || hdrs?.['Content-Type'] || '');
              init = { ...init, body: tryRewriteSendBody(init.body, 'fetch', urlStr, ct) };
            } else if (input && typeof input === 'object' && typeof input.clone === 'function' && typeof input.arrayBuffer === 'function') {
              try {
                const ct = typeof input.headers?.get === 'function' ? (input.headers.get('content-type') || '') : '';
                const rawBytes = new Uint8Array(await input.clone().arrayBuffer());
                if (rawBytes.length > 0) {
                  const nextBytes = tryRewriteSendBody(rawBytes, 'fetch', urlStr, ct);
                  if (nextBytes !== rawBytes && typeof globalThis.Request === 'function') {
                    input = new globalThis.Request(input, { body: nextBytes });
                  }
                }
              } catch {}
            }
          }
          return origFetch(input, init);
        };
      }

      if (typeof globalThis.WebSocket === 'function' && globalThis.WebSocket.prototype?.send) {
        if (!globalThis.__agOrigWsSend) {
          globalThis.__agOrigWsSend = globalThis.WebSocket.prototype.send;
        }
        const rawWsSend = globalThis.__agOrigWsSend;
        globalThis.WebSocket.prototype.send = function (data) {
          const next = tryRewriteSendBody(data, 'ws_frame', this?.url || '');
          return rawWsSend.call(this, next);
        };
      }

      if (typeof globalThis.XMLHttpRequest === 'function' && globalThis.XMLHttpRequest.prototype) {
        if (!globalThis.__agOrigXhrOpen) globalThis.__agOrigXhrOpen = globalThis.XMLHttpRequest.prototype.open;
        if (!globalThis.__agOrigXhrSend) globalThis.__agOrigXhrSend = globalThis.XMLHttpRequest.prototype.send;
        if (!globalThis.__agOrigXhrSetHeader && globalThis.XMLHttpRequest.prototype.setRequestHeader) {
          globalThis.__agOrigXhrSetHeader = globalThis.XMLHttpRequest.prototype.setRequestHeader;
        }
        const rawXhrOpen = globalThis.__agOrigXhrOpen;
        const rawXhrSend = globalThis.__agOrigXhrSend;
        const rawXhrSetHeader = globalThis.__agOrigXhrSetHeader;
        globalThis.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          this.__pulseUrl = String(url || '');
          this.__pulseCt = '';
          return rawXhrOpen.call(this, method, url, ...rest);
        };
        if (rawXhrSetHeader) {
          globalThis.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
            if (String(name || '').toLowerCase() === 'content-type') {
              this.__pulseCt = String(value || '');
            }
            return rawXhrSetHeader.call(this, name, value);
          };
        }
        globalThis.XMLHttpRequest.prototype.send = function (body) {
          const u = this.__pulseUrl || '';
          const isSend = (typeof budgetEngine.isTargetBudgetRpc === 'function' && budgetEngine.isTargetBudgetRpc(u)) ||
            u.includes('SendUserCascadeMessage');
          const next = isSend ? tryRewriteSendBody(body, 'xhr', u, this.__pulseCt || '') : body;
          return rawXhrSend.call(this, next);
        };
      }
    } catch {}
  }

  function uninstallRequestInterceptor() {
    if (!interceptorInstalled) return;
    interceptorInstalled = false;
    try {
      if (origFetch) globalThis.fetch = origFetch;
      if (globalThis.__agOrigWsSend && globalThis.WebSocket?.prototype) {
        globalThis.WebSocket.prototype.send = globalThis.__agOrigWsSend;
      }
      if (globalThis.__agOrigXhrOpen && globalThis.XMLHttpRequest?.prototype) {
        globalThis.XMLHttpRequest.prototype.open = globalThis.__agOrigXhrOpen;
      }
      if (globalThis.__agOrigXhrSetHeader && globalThis.XMLHttpRequest?.prototype) {
        globalThis.XMLHttpRequest.prototype.setRequestHeader = globalThis.__agOrigXhrSetHeader;
      }
      if (globalThis.__agOrigXhrSend && globalThis.XMLHttpRequest?.prototype) {
        globalThis.XMLHttpRequest.prototype.send = globalThis.__agOrigXhrSend;
      }
      delete globalThis.__AG_METER_ON_SEND_MESSAGE__;
      delete globalThis.__AG_METER_ON_SEND_RESULT__;
    } catch {}
  }

  // ==================== Theme, Chromatic Scale & Translations ====================
  function applyThemeAndChroma() {
    host.setAttribute('data-theme', state.theme || 'obsidian');
    qsa('#themeCards .th-card').forEach(btn => btn.classList.toggle('on', btn.dataset.th === state.theme));

    const parts = String(state.chroma || '').split('|');
    if (parts.length >= 4) {
      const [c1, c2, glow, h4] = parts;
      host.style.setProperty('--accent', c1);
      host.style.setProperty('--accent-2', c2);
      host.style.setProperty('--accent-glow', glow);
      host.style.setProperty('--h1', glow);
      host.style.setProperty('--h2', `${c1}88`);
      host.style.setProperty('--h3', `${c1}cc`);
      host.style.setProperty('--h4', h4);
    }
    qsa('#chromaDots .c-dot').forEach(dot => dot.classList.toggle('on', dot.dataset.chroma === state.chroma));
    drawStreamWaveform(el('waveCanvas'), host, state.wavePoints, state.isStreaming);
  }

  function applyStaticTranslations() {
    qsa('[data-i18n]').forEach(node => {
      const k = node.getAttribute('data-i18n');
      if (k) node.textContent = t(k);
    });
    qsa('#panelLangSeg .seg-item').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.plang === state.panelLang);
    });
    const headMap = { cockpit: 'headCockpit', budget: 'headBudget', ledger: 'headLedger', studio: 'headStudio' };
    if (el('spaceHeading')) el('spaceHeading').textContent = t(headMap[state.activeSpace] || 'headCockpit');
    updatePromptTierDescription();
  }

  function updatePromptTierDescription() {
    const lang = normalizePulseLang(state.panelLang);
    const descMap = PROMPT_TIER_DESCRIPTIONS[lang] || PROMPT_TIER_DESCRIPTIONS['zh-CN'];
    const box = el('ruleImpactText');
    if (box) box.innerHTML = descMap[state.promptTier] || descMap[0];
    qsa('#ruleTierSeg .seg-item').forEach(btn => {
      btn.classList.toggle('on', Number(btn.dataset.rtier) === Number(state.promptTier));
    });
  }

  // ==================== Settings Persistence (Exact meter-collector Schema) ====================
  async function persistUiAndPlanSettings() {
    const isZero = state.subAcqMode === 'free_edu' || state.subAcqMode === 'free_tier';
    const acqMap = {
      paid_pro: 'normal_paid',
      paid_ultra: 'normal_paid',
      family_share: 'family_sharing',
      free_edu: 'student_offer',
      free_tier: 'free_tier'
    };
    const payload = {
      panelLanguage: state.panelLang,
      autoCheckUpdate: state.autoCheckUpdate,
      uiPreferences: {
        theme: state.theme,
        chroma: state.chroma,
        dockMode: state.dockMode,
        panelLanguage: state.panelLang,
        autoCheckUpdate: state.autoCheckUpdate,
        valuationMode: state.valuationMode,
        ledgerSource: state.ledgerSource,
        subAcqMode: state.subAcqMode
      },
      customPlan: {
        subscriptionCountry: state.subRegionCode,
        subscriptionCurrency: state.subCurrency,
        actualPricePaid: isZero ? 0 : state.subPrice,
        monthlyPrice: state.subPrice,
        priceMode: 'custom',
        isZeroExtraCost: isZero,
        acquisitionSource: acqMap[state.subAcqMode] || 'normal_paid',
        acquisitionMode: state.subAcqMode
      }
    };
    try {
      globalThis.localStorage?.setItem?.('ag_pulse_ui_v2', JSON.stringify(payload));
    } catch {}
    try {
      await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.saveSettings === 'function'
          ? () => globalThis.contextMeterAPI.saveSettings(payload)
          : null,
        liveRoute: '/save-settings',
        body: payload
      });
    } catch {}
  }

  function hydrateSettingsResponse(res) {
    if (!res || typeof res !== 'object') return;
    const ui = res.uiPreferences || {};
    if (ui.theme) state.theme = ui.theme;
    if (ui.chroma) state.chroma = ui.chroma;
    if (ui.dockMode === 'drawer' || ui.dockMode === 'popover') {
      state.dockMode = ui.dockMode;
      host.setAttribute('data-mode', state.dockMode);
    }
    const lang = res.panelLanguage || ui.panelLanguage || ui.panelLang;
    if (lang) state.panelLang = normalizePulseLang(lang);
    if (typeof res.autoCheckUpdate === 'boolean') state.autoCheckUpdate = res.autoCheckUpdate;
    else if (typeof ui.autoCheckUpdate === 'boolean') state.autoCheckUpdate = ui.autoCheckUpdate;
    if (ui.valuationMode) state.valuationMode = ui.valuationMode;
    if (ui.ledgerSource) state.ledgerSource = ui.ledgerSource;
    if (ui.subAcqMode) state.subAcqMode = ui.subAcqMode;

    if (res.contextScopeMode === 'unified' || res.contextScopeMode === 'per_model') {
      state.budgetScope = res.contextScopeMode;
    }
    if (res.contextUnifiedPreference && typeof res.contextUnifiedPreference === 'object') {
      state.unifiedPref = { ...res.contextUnifiedPreference };
    }
    if (res.contextPreferences && typeof res.contextPreferences === 'object') {
      state.contextPreferencesMap = { ...res.contextPreferences };
    }
    syncWindowContextPreferencesCache();

    const plan = res.customPlan || {};
    if (plan.subscriptionCountry || plan.country) state.subRegionCode = plan.subscriptionCountry || plan.country;
    if (plan.subscriptionCurrency || plan.currency) state.subCurrency = plan.subscriptionCurrency || plan.currency;
    const paidNum = Number(plan.actualPricePaid ?? plan.monthlyPrice);
    if (Number.isFinite(paidNum) && paidNum >= 0) state.subPrice = paidNum;
    if (plan.acquisitionMode) state.subAcqMode = plan.acquisitionMode;
    else if (plan.acquisitionSource === 'student_offer') state.subAcqMode = 'free_edu';
    else if (plan.acquisitionSource === 'family_sharing') state.subAcqMode = 'family_share';
    else if (plan.acquisitionSource === 'free_tier') state.subAcqMode = 'free_tier';
  }

  async function restoreSettingsFromHost() {
    try {
      const localUi = globalThis.localStorage?.getItem?.('ag_pulse_ui_v2');
      if (localUi) hydrateSettingsResponse(JSON.parse(localUi));
    } catch {}
    if (globalThis.__AGContextMeterSettings) {
      hydrateSettingsResponse(globalThis.__AGContextMeterSettings);
    }
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getSettings === 'function'
          ? () => globalThis.contextMeterAPI.getSettings({})
          : null,
        liveRoute: '/get-settings',
        body: {}
      });
      if (res?.ok) hydrateSettingsResponse(res);
    } catch {}
    if (inheritedState) applyInheritedState(inheritedState);
    applyThemeAndChroma();
    applyStaticTranslations();
    el('toggleAutoUpdate')?.classList.toggle('on', state.autoCheckUpdate);
    renderAll();
    if (!state.disposed && state.autoCheckUpdate !== false) {
      clearTimeout(autoUpdateTimer);
      autoUpdateTimer = setTimeout(() => {
        if (!state.disposed && state.autoCheckUpdate !== false) {
          void checkReleaseUpdate({ silent: true, force: false });
        }
      }, 4500);
      autoUpdateTimer?.unref?.();
    }
  }

  // ==================== Real-Time Poll, Speed Telemetry & Quota ====================
  function mergeAllSpeedCalls() {
    const byId = new Map();
    for (const r of state.speedRecords) {
      if (r && r.callId) byId.set(r.callId, r);
    }
    for (const c of state.sessionCalls) {
      if (!c || !c.callId) continue;
      const prev = byId.get(c.callId);
      if (!prev || Number(c.outputTokens || 0) >= Number(prev.outputTokens || 0)) {
        byId.set(c.callId, c);
      }
    }
    return Array.from(byId.values());
  }

  function isValidCallSpeed(c) {
    if (typeof core.isValidSpeedSample === 'function') return core.isValidSpeedSample(c);
    return Boolean(c && c.status === 'final' && !c.isEstimated && Number(c.outputTokens) > 0 && Number(c.durationSec) > 0);
  }

  function computeCallEndToEndTps(c) {
    const out = Number(c?.outputTokens || 0);
    const dur = Number(c?.durationSec || 0);
    if (Number.isFinite(Number(c?.tps)) && Number(c.tps) > 0) return Number(Number(c.tps).toFixed(1));
    if (out > 0 && dur > 0) return Number((out / dur).toFixed(1));
    return null;
  }

  function hydrateSpeedTelemetryFromLatestOrHistory(latestSummaryWithSpeed = null) {
    if (!state.route) {
      state.liveTps = null;
      state.liveTtft = null;
      state.liveOutTok = null;
      state.liveDurSec = null;
      state.wavePoints = [];
      return;
    }

    // Strictly scope numeric telemetry (tok/s, TTFT, output, duration) to the CURRENT conversation only,
    // and ALWAYS use end-to-end effective rate (outputTokens / (ttft + streamingDuration)), NEVER outputTokens / streamingSec!
    const sessionSpeedCalls = (state.sessionCalls || []).filter(isValidCallSpeed);
    sessionSpeedCalls.sort((a, b) => {
      const sa = Number.isInteger(a.stepIndex) ? a.stepIndex : -1;
      const sb = Number.isInteger(b.stepIndex) ? b.stepIndex : -1;
      if (sa !== sb && sa >= 0 && sb >= 0) return sa - sb;
      return (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0);
    });

    const candSp = (latestSummaryWithSpeed?.speed && Number(latestSummaryWithSpeed.speed.tps) > 0)
      ? latestSummaryWithSpeed.speed
      : ((state.latest?.speed && Number(state.latest.speed.tps) > 0) ? state.latest.speed : null);

    if (candSp) {
      state.liveTps = Number(Number(candSp.tps).toFixed(1));
      state.liveTtft = candSp.ttft != null && Number.isFinite(Number(candSp.ttft)) ? Number(candSp.ttft) : null;
      state.liveOutTok = Number(candSp.outputTokens) > 0 ? Number(candSp.outputTokens) : null;
      state.liveDurSec = Number(candSp.duration) > 0 ? Number(candSp.duration) : null;
    } else if (sessionSpeedCalls.length > 0) {
      const lastCall = sessionSpeedCalls[sessionSpeedCalls.length - 1];
      state.liveTps = computeCallEndToEndTps(lastCall);
      state.liveTtft = lastCall.ttftSec != null && Number.isFinite(Number(lastCall.ttftSec)) ? Number(lastCall.ttftSec) : null;
      state.liveOutTok = Number(lastCall.outputTokens) > 0 ? Number(lastCall.outputTokens) : null;
      state.liveDurSec = Number(lastCall.durationSec) > 0 ? Number(lastCall.durationSec) : null;
    } else {
      state.liveTps = null;
      state.liveTtft = null;
      state.liveOutTok = null;
      state.liveDurSec = null;
    }

    const sessionWave = sessionSpeedCalls.slice(-14).map(computeCallEndToEndTps).filter(v => v !== null && v > 0);
    if (sessionWave.length >= 2) {
      state.wavePoints = sessionWave;
    } else if (sessionWave.length === 1) {
      // Supplement background sparkline ONLY with historical samples of the EXACT SAME model product, never mixing models
      const activePk = state.activeProductKey || '';
      const sameModelHist = activePk
        ? (state.speedRecords || []).filter(r => isValidCallSpeed(r) && groupProductSafe({ modelId: r.modelExactId || r.model, label: r.modelLabel || r.model }).productKey === activePk)
            .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
            .slice(-11)
            .map(computeCallEndToEndTps)
            .filter(v => v !== null && v > 0)
        : [];
      state.wavePoints = sameModelHist.length > 0 ? [...sameModelHist, sessionWave[0]] : [sessionWave[0]];
    } else if (state.liveTps != null && state.liveTps > 0) {
      state.wavePoints = [state.liveTps];
    } else {
      state.wavePoints = [];
    }
  }

  async function pollTrajectory(gen, id) {
    if (!origFetch || state.disposed || !id) return;
    const csrf = globalThis.__APP_CONFIG__?.csrfToken;
    if (!csrf) return;
    state.requestBusy = true;
    const ctrl = new AbortController();
    controllers.add(ctrl);
    const tid = setTimeout(() => ctrl.abort(), 10000);
    try {
      // On initial load of a conversation, fetch full metadata (offset 0) so we get ALL session calls & speed telemetry!
      let offset = state.sessionCallsMap.size === 0 ? 0 : Math.max(0, state.count - 6);
      const fetchWithOffset = async (off) => {
        const r = await origFetch('/exa.language_server_pb.LanguageServerService/GetCascadeTrajectoryGeneratorMetadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'x-codeium-csrf-token': csrf
          },
          body: JSON.stringify({ cascadeId: id, generatorMetadataOffset: off, includeMessages: false }),
          signal: ctrl.signal
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      };
      let data = await fetchWithOffset(offset);
      if (gen !== state.generation || state.disposed) return;
      let rows = Array.isArray(data?.generatorMetadata) ? data.generatorMetadata : [];
      // 会话消息撤回或编辑截断后 offset 可能超出新总长，自动归零重拉完整轨迹
      if (rows.length === 0 && offset > 0) {
        offset = 0;
        state.count = 0;
        state.sessionCallsMap.clear();
        data = await fetchWithOffset(0);
        if (gen !== state.generation || state.disposed) return;
        rows = Array.isArray(data?.generatorMetadata) ? data.generatorMetadata : [];
      }
      state.count = rows.length ? offset + rows.length : (offset === 0 ? 0 : state.count);

      const finalBatch = [];
      let lastParsedStatus = null;
      for (let i = 0; i < rows.length; i++) {
        const call = typeof core.parseGeneratorCall === 'function'
          ? core.parseGeneratorCall(rows[i], id, 'desktop', { cascadeModelConfigs: state.cascadeModelConfigs })
          : null;
        if (call && call.callId) {
          state.sessionCallsMap.set(call.callId, call);
          lastParsedStatus = call.status || lastParsedStatus;
          if (call.status === 'final') {
            const sig = `${call.status}:${call.outputTokens || 0}:${call.tps ?? ''}`;
            if (state.pendingFinalCalls.get(call.callId) !== sig) {
              state.pendingFinalCalls.set(call.callId, sig);
              finalBatch.push({ call, sig });
            }
          }
        }
      }
      state.lastTurnStatus = lastParsedStatus;

      state.sessionCalls = Array.from(state.sessionCallsMap.values());
      state.sessionCostTotal = state.sessionCalls.reduce((s, c) => s + (c.isPriced ? Number(c.costUSD || 0) : 0), 0);
      const lastPriced = [...state.sessionCalls].reverse().find(c => c.isPriced && Number(c.costUSD) > 0);
      state.lastRoundCost = lastPriced ? Number(lastPriced.costUSD) : 0;

      if (finalBatch.length > 0) {
        void (async () => {
          for (let start = 0; start < finalBatch.length; start += 250) {
            const slice = finalBatch.slice(start, start + 250);
            const callsChunk = slice.map((item) => item.call);
            try {
              const r = await callBackend({
                ipcFn: typeof globalThis.contextMeterAPI?.recordCalls === 'function'
                  ? () => globalThis.contextMeterAPI.recordCalls(callsChunk)
                  : null,
                liveRoute: '/record-calls',
                body: { calls: callsChunk }
              });
              if (r && r.ok === false) {
                for (const item of slice) {
                  if (state.pendingFinalCalls.get(item.call.callId) === item.sig) {
                    state.pendingFinalCalls.delete(item.call.callId);
                  }
                }
              }
            } catch {
              for (const item of slice) {
                if (state.pendingFinalCalls.get(item.call.callId) === item.sig) {
                  state.pendingFinalCalls.delete(item.call.callId);
                }
              }
            }
          }
        })();
      }

      let latestSummary = null;
      let latestSpeedSummary = null;
      let prevCtx = null;

      for (let i = 0; i < rows.length; i++) {
        const s = typeof core.summarize === 'function'
          ? core.summarize(rows[i], { cascadeModelConfigs: state.cascadeModelConfigs, previousValidContext: prevCtx })
          : null;
        if (!s) continue;
        if (s.actual != null || s.budget != null) prevCtx = s;
        latestSummary = s;
        if (s.speed && Number(s.speed.tps || 0) > 0) {
          latestSpeedSummary = s;
        }
      }

      if (latestSummary) {
        state.latest = latestSummary;
        if (Number(latestSummary.budget) > 0) {
          state.lastAdoptedLimit = Number(latestSummary.budget);
          const pk = state.activeProductKey || groupProductSafe({ modelId: latestSummary.modelId || latestSummary.model, label: latestSummary.model }).productKey;
          if (pk) {
            state.adoptedByProduct.set(pk, { budget: Number(latestSummary.budget), cascadeId: id, at: Date.now() });
          }
        }
        state.isStreaming = latestSummary.status === 'pending';
      } else {
        state.isStreaming = false;
      }

      syncActiveModelIdentity();
      hydrateSpeedTelemetryFromLatestOrHistory(latestSpeedSummary);
      host.setAttribute('data-streaming', state.isStreaming ? 'true' : 'false');
      state.requestAt = Date.now();
      state.requestError = '';
    } catch (e) {
      if (gen === state.generation && !state.disposed) {
        state.requestError = e?.name === 'AbortError' ? '读取超时' : (e?.message || '连接等待中');
      }
    } finally {
      clearTimeout(tid);
      controllers.delete(ctrl);
      if (gen === state.generation && !state.disposed) {
        state.requestBusy = false;
        state.requestNext = Date.now() + (document.hidden ? 12000 : (state.isStreaming ? 900 : 2200));
        renderCockpit();
        renderBudgetSpace();
        renderAuditSheet();
        if (state.openSheetId === 'speedSheet') renderSpeedSheet();
      }
    }
  }

  async function runSessionScan(gen, id, force = false) {
    if (state.disposed || !id || state.scanBusy) return;
    state.scanBusy = true;
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.scan === 'function'
          ? () => globalThis.contextMeterAPI.scan(id, force)
          : null,
        liveRoute: '/scan',
        body: { id, force }
      });
      if (gen !== state.generation || state.disposed) return;
      if (res?.ok && res.data) {
        state.scan = res.data;
        state.scanError = '';
        if (res.data.modelCapabilitiesById && typeof res.data.modelCapabilitiesById === 'object') {
          for (const [k, v] of Object.entries(res.data.modelCapabilitiesById)) {
            if (v && typeof v === 'object') {
              state.modelCapabilities[String(k).toLowerCase().replace(/^model_/, '')] = v;
            }
          }
        }
        if (Array.isArray(res.data.cascadeModelConfigs)) {
          mergeCascadeConfigs(res.data.cascadeModelConfigs);
        }
        if (res.data.latest && (!state.latest || Number(res.data.scannedAt || 0) >= state.requestAt)) {
          state.latest = res.data.latest;
          if (Number(res.data.latest.budget) > 0) {
            state.lastAdoptedLimit = Number(res.data.latest.budget);
          }
          hydrateSpeedTelemetryFromLatestOrHistory(res.data.latest);
        }
        syncActiveModelIdentity();
      }
    } catch (e) {
      state.scanError = e?.message || '';
    } finally {
      if (gen === state.generation && !state.disposed) {
        state.scanBusy = false;
        state.scanNext = Date.now() + (document.hidden ? 60000 : 22000);
        renderCockpit();
        renderAuditSheet();
        renderBudgetSpace();
      }
    }
  }

  async function fetchAvailableModels() {
    if (!origFetch) return;
    const csrf = globalThis.__APP_CONFIG__?.csrfToken;
    if (!csrf) return;
    try {
      const res = await origFetch('/exa.language_server_pb.LanguageServerService/GetAvailableModels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': csrf
        },
        body: JSON.stringify({ forceRefresh: false })
      });
      if (!res.ok) return;
      const data = await res.json();
      const modelsObj = data?.response?.models || data?.models;
      if (!modelsObj || typeof modelsObj !== 'object') return;
      const entries = Array.isArray(modelsObj)
        ? modelsObj.map(it => [it?.model || it?.modelId || '', it])
        : Object.entries(modelsObj);
      for (const [k, d] of entries) {
        if (!d || typeof d !== 'object') continue;
        const rawId = String(d.model || d.modelId || k || '').trim();
        if (!rawId) continue;
        const norm = rawId.toLowerCase().replace(/^model_/, '');
        state.modelCapabilities[norm] = {
          modelId: rawId,
          displayName: d.displayName || rawId,
          maxTokens: Number(d.maxTokens) > 0 ? Number(d.maxTokens) : null,
          maxOutputTokens: Number(d.maxOutputTokens) > 0 ? Number(d.maxOutputTokens) : null,
          supportsModelInfoOverride: typeof d.supportsModelInfoOverride === 'boolean' ? d.supportsModelInfoOverride : null
        };
      }
      renderBudgetSpace();
      renderCockpit();
    } catch {}
  }

  // ==================== Quota Snapshot & Pool Extraction (Exact 2.31+/2.32 Schema) ====================
  function computeEffectiveQuotaView(nowMs = Date.now()) {
    syncActiveModelIdentity();
    const curModelObj = state.activeModelId
      ? { modelId: state.activeModelId, label: state.activeModelLabel, productKey: state.activeProductKey }
      : null;

    if (state.quotaRawInput && typeof core.buildModelQuotaSnapshot === 'function') {
      try {
        return core.buildModelQuotaSnapshot({
          ...state.quotaRawInput,
          currentModel: curModelObj,
          nowMs
        });
      } catch {}
    }

    const base = state.quotaSnapshot;
    if (!base || !Array.isArray(base.pools)) return null;

    const updatedPools = base.pools.map(p => {
      const buckets = Array.isArray(p.buckets) ? p.buckets.map(b => {
        if (b?.resetTimeIso && typeof core.formatQuotaResetMeta === 'function') {
          const rm = core.formatQuotaResetMeta(b.resetTimeIso, nowMs);
          return {
            ...b,
            hasResetTime: rm.hasResetTime,
            resetAtMs: rm.resetAtMs,
            resetTimeText: rm.resetTimeText,
            countdownText: rm.countdownText,
            isResetPassed: rm.isResetPassed
          };
        }
        return { ...b };
      }) : [];

      const priced = buckets.filter(b => b && b.remainingFraction !== null && b.remainingFraction !== undefined)
        .sort((a, b) => a.remainingFraction - b.remainingFraction);
      const pb = priced[0] || buckets[0] || p.primaryBucket || null;

      const remFrac = pb?.remainingFraction !== undefined && pb?.remainingFraction !== null
        ? Number(pb.remainingFraction)
        : (p.remainingFraction !== undefined && p.remainingFraction !== null
            ? Number(p.remainingFraction)
            : (p.remainingPercent !== undefined ? Number(p.remainingPercent) / 100 : null));

      return {
        ...p,
        buckets,
        primaryBucket: pb,
        remainingFraction: remFrac,
        resetAtMs: pb?.resetAtMs ?? p.resetAtMs ?? (pb?.resetTimeIso ? Date.parse(pb.resetTimeIso) : null),
        resetTimeIso: pb?.resetTimeIso ?? p.resetTimeIso ?? null,
        countdownText: pb?.countdownText ?? p.countdownText ?? null
      };
    });

    return { ...base, pools: updatedPools };
  }

  async function fetchDirectQuotaRpcSupplement() {
    if (!origFetch) return null;
    const csrf = globalThis.__APP_CONFIG__?.csrfToken;
    if (!csrf) return null;
    const headers = {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
      'x-codeium-csrf-token': csrf
    };
    const callRpc = async (method) => {
      const r = await origFetch(`/exa.language_server_pb.LanguageServerService/${method}`, {
        method: 'POST',
        headers,
        body: '{}'
      });
      if (!r || !r.ok) return null;
      return await r.json();
    };
    const [uSet, qSet] = await Promise.allSettled([
      callRpc('GetUserStatus'),
      callRpc('RetrieveUserQuotaSummary')
    ]);
    const userStatusRes = uSet.status === 'fulfilled' ? uSet.value : null;
    const quotaSummaryRes = qSet.status === 'fulfilled' ? qSet.value : null;
    const hasGroups = Array.isArray(quotaSummaryRes?.response?.groups || quotaSummaryRes?.groups) &&
      (quotaSummaryRes?.response?.groups || quotaSummaryRes?.groups).length > 0;
    const hasConfigs = Array.isArray(userStatusRes?.userStatus?.cascadeModelConfigData?.clientModelConfigs);
    if (!hasGroups && !hasConfigs) return null;
    return { userStatusRes, quotaSummaryRes, hasGroups };
  }

  async function syncQuotaFromHost(force = false) {
    if (state.disposed) return null;
    syncActiveModelIdentity();
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getQuota === 'function'
          ? () => globalThis.contextMeterAPI.getQuota({ force: Boolean(force) })
          : null,
        liveRoute: '/quota',
        body: { force: Boolean(force), currentModel: state.activeModelId || state.activeModelLabel || null }
      });
      const payload = res?.data || res;
      if (payload) {
        state.quotaFetchedAt = Date.now();
        if (Array.isArray(payload.cascadeModelConfigs) && payload.cascadeModelConfigs.length > 0) {
          mergeCascadeConfigs(payload.cascadeModelConfigs);
        }
        if (payload.ok === false && payload.error) {
          state.quotaError = payload.error;
          if (payload.snapshot && !state.quotaSnapshot) state.quotaSnapshot = payload.snapshot;
        } else if (payload.snapshot && Array.isArray(payload.snapshot.pools)) {
          state.quotaSnapshot = payload.snapshot;
          state.quotaRawInput = null;
          state.quotaError = '';
        } else if (Array.isArray(payload.pools)) {
          state.quotaSnapshot = payload;
          state.quotaRawInput = null;
          state.quotaError = '';
        } else if (payload.userStatusRes || payload.quotaSummaryRes) {
          state.quotaRawInput = {
            userStatusRes: payload.userStatusRes || null,
            quotaSummaryRes: payload.quotaSummaryRes || null,
            cascadeModelConfigs: payload.cascadeModelConfigs || state.cascadeModelConfigs || null,
            planStatus: payload.planStatus || null
          };
          state.quotaSnapshot = null;
          state.quotaError = '';
        } else if (payload.error) {
          state.quotaError = payload.error;
        }
      }
    } catch (e) {
      state.quotaError = e?.message || '配额同步失败';
    }

    // If backend snapshot lacks RetrieveUserQuotaSummary multi-window (weekly + 5h) buckets, supplement directly via same-origin RPC!
    try {
      const curView = computeEffectiveQuotaView();
      const hasMultiWindowSummary = Array.isArray(curView?.pools) && curView.pools.some(p =>
        p.sourceType === 'quota_summary_and_configs' ||
        (Array.isArray(p.buckets) && (p.buckets.length > 1 || p.buckets.some(b => b.windowKey === 'weekly' || /week|7d/i.test(String(b.windowShort || b.bucketId || '')))))
      );
      if (!hasMultiWindowSummary && typeof core.buildModelQuotaSnapshot === 'function') {
        const direct = await fetchDirectQuotaRpcSupplement();
        if (direct && (direct.hasGroups || !curView?.pools?.length)) {
          const rawCfgs = direct.userStatusRes?.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
          if (rawCfgs.length) mergeCascadeConfigs(rawCfgs);
          state.quotaRawInput = {
            userStatusRes: direct.userStatusRes,
            quotaSummaryRes: direct.quotaSummaryRes,
            cascadeModelConfigs: state.cascadeModelConfigs.length ? state.cascadeModelConfigs : rawCfgs
          };
          state.quotaSnapshot = null;
          state.quotaFetchedAt = Date.now();
          state.quotaError = '';
        }
      }
    } catch {}

    renderQuotaSection();
    renderBudgetSpace();
    renderCockpit();
    return computeEffectiveQuotaView();
  }

  async function syncTokenHistory(force = false) {
    if (state.disposed) return;
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getTokenHistory === 'function'
          ? () => globalThis.contextMeterAPI.getTokenHistory(force)
          : null,
        liveRoute: '/token-history',
        body: { force }
      });
      if (res?.ok && res.data) {
        if (Array.isArray(res.data.speedRecords)) {
          state.speedRecords = res.data.speedRecords;
        }
        if (Array.isArray(res.data.cascadeModelConfigs) && res.data.cascadeModelConfigs.length > 0) {
          mergeCascadeConfigs(res.data.cascadeModelConfigs);
        }
        if (res.data.modelCapabilitiesById && typeof res.data.modelCapabilitiesById === 'object') {
          for (const [k, v] of Object.entries(res.data.modelCapabilitiesById)) {
            if (v && typeof v === 'object') {
              state.modelCapabilities[String(k).toLowerCase().replace(/^model_/, '')] = v;
            }
          }
        }
        state.historyData = typeof core.normalizeTokenHistoryPayload === 'function'
          ? core.normalizeTokenHistoryPayload(res.data)
          : res.data;
        hydrateSpeedTelemetryFromLatestOrHistory();
        renderLedgerSpace();
        renderCockpit();
        renderBudgetSpace();
        if (state.openSheetId === 'speedSheet') renderSpeedSheet();
      }
    } catch {}
  }

  async function syncStudioStatuses() {
    try {
      const uRes = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getContextUnlockStatus === 'function'
          ? () => globalThis.contextMeterAPI.getContextUnlockStatus({})
          : null,
        liveRoute: '/context-unlock-status',
        body: {}
      });
      if (uRes?.ok && uRes.data) {
        state.unlockStatus = uRes.data;
        if (uRes.data.status === 'patched_pending_restart') {
          state.restartRequired = true;
        }
      }
    } catch {}

    try {
      const eRes = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getEnhanceStatus === 'function'
          ? () => globalThis.contextMeterAPI.getEnhanceStatus({})
          : null,
        liveRoute: '/enhance-status',
        body: {}
      });
      if (eRes?.ok && eRes.data) {
        if (Number.isFinite(Number(eRes.data.promptTier))) state.promptTier = Number(eRes.data.promptTier);
        if (typeof eRes.data.chineseTitle === 'boolean') state.zhChatTitle = eRes.data.chineseTitle;
      }
    } catch {}

    try {
      const mRes = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getModulesStatus === 'function'
          ? () => globalThis.contextMeterAPI.getModulesStatus()
          : null,
        liveRoute: '/modules-status',
        body: {}
      });
      if (mRes?.ok && mRes.data?.modules) {
        const mods = mRes.data.modules;
        state.proxyEnabled = Boolean(mods.proxy?.enabled);
        if (mods.proxy?.proxyUrl) state.proxyUrl = mods.proxy.proxyUrl;
        state.shellLanguage = mods.chinese?.language || (mods.chinese?.enabled ? 'zh-CN' : 'en');
        state.brandTitle = mods.chinese?.brandTitle || 'english';
        if (mRes.runtime?.proxyNeedsRestart || mRes.runtime?.chineseNeedsRestart) {
          state.restartRequired = true;
        }
      }
    } catch {}

    try {
      const rRes = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getRuntimeInfo === 'function'
          ? () => globalThis.contextMeterAPI.getRuntimeInfo()
          : null,
        liveRoute: '/runtime-info',
        body: {}
      });
      if (rRes?.ok) {
        state.backendSource = rRes.backendSource || state.backendSource;
        state.backendVersion = rRes.backendVersion || state.backendVersion;
      }
    } catch {}

    renderBudgetSpace();
    renderStudioSpace();
    renderCockpit();
  }

  // ==================== UI Rendering Functions ====================
  function formatK(tok) {
    const n = Number(tok) || 0;
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(Math.round(n));
  }

  function computeCallCacheSavedUSD(call) {
    if (typeof core.calculateNetCacheSavedUSD === 'function') {
      try {
        return core.calculateNetCacheSavedUSD(call);
      } catch (_) {}
    }
    const inp = Math.max(0, Number(call?.inputTokens || 0));
    const cap = Math.max(0, Number(call?.cacheReadTokens ?? call?.cacheTokens ?? 0));
    if (cap <= 0) return 0;
    if (typeof core.calculateRequestApiCost === 'function') {
      try {
        const actualCost = Number.isFinite(Number(call?.costUSD)) && Number(call.costUSD) > 0
          ? Number(call.costUSD)
          : Number(core.calculateRequestApiCost(call)?.costUSD || 0);
        const uncached = core.calculateRequestApiCost({
          ...call,
          inputTokens: inp + cap,
          cacheTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0
        });
        if (uncached?.isPriced) {
          return Number(uncached.costUSD) - actualCost;
        }
      } catch (_) {}
    }
    const modelStr = String(call?.modelExactId || call?.modelId || call?.model || '').toLowerCase();
    const deltaPerM = modelStr.includes('opus') ? (4.00 - 0.20)
      : (modelStr.includes('sonnet') || modelStr.includes('carbon') || modelStr.includes('argon')) ? (2.00 - 0.10)
      : modelStr.includes('flash') ? (0.75 - 0.075)
      : (1.50 - 0.075);
    return (cap / 1e6) * deltaPerM;
  }

  function computeSessionCacheStats() {
    const promptCalls = (state.sessionCalls || []).filter(c => {
      const inp = Math.max(0, Number(c?.inputTokens || 0));
      const cap = Math.max(0, Number(c?.cacheReadTokens ?? c?.cacheTokens ?? 0));
      return (inp + cap) > 0;
    });

    if (promptCalls.length > 0) {
      let sessFreshInp = 0;
      let sessCacheRead = 0;
      let sessSavedUSD = 0;
      for (const c of promptCalls) {
        sessFreshInp += Math.max(0, Number(c.inputTokens || 0));
        sessCacheRead += Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
        sessSavedUSD += computeCallCacheSavedUSD(c);
      }
      const last = promptCalls[promptCalls.length - 1];
      const roundFreshInp = Math.max(0, Number(last.inputTokens || 0));
      const roundCacheRead = Math.max(0, Number(last.cacheReadTokens ?? last.cacheTokens ?? 0));
      const roundPromptTotal = roundFreshInp + roundCacheRead;
      const roundHitPct = roundPromptTotal > 0 ? (roundCacheRead / roundPromptTotal) * 100 : null;
      const roundSavedUSD = computeCallCacheSavedUSD(last);
      const sessPromptTotal = sessFreshInp + sessCacheRead;
      const sessHitPct = sessPromptTotal > 0 ? (sessCacheRead / sessPromptTotal) * 100 : null;

      let cacheDropDetected = false;
      let prevHitPct = null;
      if (promptCalls.length >= 2) {
        const prev = promptCalls[promptCalls.length - 2];
        const pInp = Math.max(0, Number(prev.inputTokens || 0));
        const pCap = Math.max(0, Number(prev.cacheReadTokens ?? prev.cacheTokens ?? 0));
        const pTot = pInp + pCap;
        if (pTot > 0) {
          prevHitPct = (pCap / pTot) * 100;
          if (prevHitPct >= 45 && roundPromptTotal >= 6000 && roundHitPct !== null && roundHitPct < 10) {
            cacheDropDetected = true;
          }
        }
      }

      return {
        promptTurnCount: promptCalls.length,
        roundFreshInp,
        roundCacheRead,
        roundHitPct,
        roundSavedUSD,
        sessFreshInp,
        sessCacheRead,
        sessHitPct,
        sessSavedUSD,
        cacheDropDetected,
        prevHitPct
      };
    }

    // Fallback to state.latest (note: core.summarize sets latest.input = freshInput + cacheReadTokens)
    const l = state.latest;
    const latestTotalPrompt = Number(l?.input || 0);
    if (l && !l.estimated && latestTotalPrompt > 0) {
      const cap = Math.min(latestTotalPrompt, Math.max(0, Number(l.cached || 0)));
      const fresh = Math.max(0, latestTotalPrompt - cap);
      const hitPct = (cap / latestTotalPrompt) * 100;
      const saved = (cap / 1e6) * (1.50 - 0.075);
      return {
        promptTurnCount: 1,
        roundFreshInp: fresh,
        roundCacheRead: cap,
        roundHitPct: hitPct,
        roundSavedUSD: saved,
        sessFreshInp: fresh,
        sessCacheRead: cap,
        sessHitPct: hitPct,
        sessSavedUSD: saved,
        cacheDropDetected: false,
        prevHitPct: null
      };
    }

    return {
      promptTurnCount: 0,
      roundFreshInp: 0,
      roundCacheRead: 0,
      roundHitPct: null,
      roundSavedUSD: 0,
      sessFreshInp: 0,
      sessCacheRead: 0,
      sessHitPct: null,
      sessSavedUSD: 0,
      cacheDropDetected: false,
      prevHitPct: null
    };
  }

  function renderCockpit() {
    syncActiveModelIdentity();
    const activeProd = getProductByKey(state.activeProductKey);
    const activePref = getPreferenceForProduct(activeProd);
    const configuredTok = resolveEffectiveTokensForProduct(activeProd);

    const modelTxtEl = el('activeModelTxt');
    if (modelTxtEl) {
      modelTxtEl.textContent = state.activeModelLabel || activeProd?.label || 'Antigravity';
    }

    const restartBtn = el('btnRestartBanner');
    if (restartBtn) restartBtn.hidden = !state.restartRequired;

    const latest = state.latest;
    const usedTok = Number(latest?.used ?? latest?.actual ?? latest?.estimate ?? 0);
    // Display the user's configured target limit immediately so clicking 512K / Max / DYN responds instantaneously!
    const adoptedBudget = Number(latest?.budget || 0);
    const isCustomConfigured = activePref && activePref.mode !== 'default';
    const limitTok = isCustomConfigured
      ? configuredTok
      : (adoptedBudget > 0 ? adoptedBudget : configuredTok || 256000);

    const pct = limitTok > 0 ? Math.min(99.9, (usedTok / limitTok) * 100) : 0;
    const remTok = Math.max(0, limitTok - usedTok);

    const usedValEl = el('heroUsedVal');
    const usedUnitEl = el('heroUsedUnit');
    if (usedValEl && usedUnitEl) {
      if (usedTok >= 1000000) {
        usedValEl.textContent = (usedTok / 1000000).toFixed(2);
        usedUnitEl.textContent = 'M';
      } else if (usedTok >= 1000) {
        usedValEl.textContent = (usedTok / 1000).toFixed(1);
        usedUnitEl.textContent = 'K';
      } else {
        usedValEl.textContent = String(Math.round(usedTok));
        usedUnitEl.textContent = 'tok';
      }
    }

    if (el('heroLimitLbl')) {
      const baseLbl = activePref?.mode === 'dynamic' ? `${formatK(limitTok)} DYN` : formatK(limitTok);
      const pendingSync = isCustomConfigured && adoptedBudget > 0 && Math.abs(adoptedBudget - limitTok) > 2048;
      el('heroLimitLbl').textContent = pendingSync ? `${baseLbl} · 待下轮` : baseLbl;
    }
    if (el('heroPctTxt')) el('heroPctTxt').textContent = `${pct.toFixed(1)}%`;
    if (el('heroSourceMode')) {
      el('heroSourceMode').textContent = latest ? (latest.estimated ? t('estimatedMode') : t('actualMeasured')) : t('idleMode');
    }
    if (el('sessionCostTxt')) {
      el('sessionCostTxt').textContent = `本轮 $${state.lastRoundCost.toFixed(3)} · 会话 $${state.sessionCostTotal.toFixed(2)}`;
    }

    const heroCirc = el('heroCtxCircle');
    const dialCtx = el('dialCtx');
    if (heroCirc) heroCirc.style.strokeDashoffset = (257.61 * (1 - pct / 100)).toFixed(2);
    if (dialCtx) dialCtx.style.strokeDashoffset = (47.12 * (1 - pct / 100)).toFixed(2);

    if (el('islandCtxPct')) el('islandCtxPct').textContent = latest ? `${Math.round(pct)}%` : '--%';
    if (el('tipCtxVal')) el('tipCtxVal').textContent = `${formatK(usedTok)} / ${formatK(limitTok)}`;

    const island = el('dynamicIsland');
    const healthTag = el('ctxHealthTag');
    if (pct >= 88) {
      if (island) island.dataset.state = 'crit';
      if (healthTag) { healthTag.className = 'tag crit'; healthTag.textContent = `即将触顶 · 余 ${formatK(remTok)}`; }
      heroCirc?.setAttribute('stroke', 'var(--rose)');
      dialCtx?.setAttribute('stroke', 'var(--rose)');
    } else if (pct >= 72) {
      if (island) island.dataset.state = 'warn';
      if (healthTag) { healthTag.className = 'tag warn'; healthTag.textContent = `高水位 · 余 ${formatK(remTok)}`; }
      heroCirc?.setAttribute('stroke', 'var(--amber)');
      dialCtx?.setAttribute('stroke', 'var(--amber)');
    } else {
      if (island) island.dataset.state = 'normal';
      if (healthTag) {
        healthTag.className = latest ? 'tag' : 'tag neutral';
        healthTag.textContent = latest ? `充裕 · 剩余 ${formatK(remTok)}` : (state.route ? '等待模型响应' : '未进入会话');
      }
      heroCirc?.setAttribute('stroke', 'var(--accent)');
      dialCtx?.setAttribute('stroke', 'var(--accent)');
    }

    // Session-first Prompt Cache Hit Rate upfront; drill into Audit Sheet for the latest single model request!
    const cacheStats = computeSessionCacheStats();
    const cacheBox = el('cacheTelemetryBox');
    const heroCachePctEl = el('heroCacheHitPct');
    const heroCacheSubEl = el('heroCacheSessSub');
    const cacheBadgeEl = el('cacheStateBadge');
    const cacheBarFillEl = el('cacheHitBarFill');
    const tipCacheEl = el('tipCacheVal');
    const sessPct = cacheStats.sessHitPct;

    if (sessPct === null) {
      if (cacheBox) cacheBox.dataset.cacheState = 'idle';
      if (heroCachePctEl) { heroCachePctEl.textContent = '--%'; heroCachePctEl.style.color = 'var(--fg-2)'; }
      if (heroCacheSubEl) heroCacheSubEl.textContent = '· 等待请求';
      if (cacheBadgeEl) cacheBadgeEl.textContent = t('latestReqJump');
      if (cacheBarFillEl) cacheBarFillEl.style.width = '0%';
      if (tipCacheEl) { tipCacheEl.textContent = '--%'; tipCacheEl.style.color = 'var(--fg-2)'; }
    } else if (cacheStats.promptTurnCount === 1 && sessPct < 10) {
      if (cacheBox) cacheBox.dataset.cacheState = 'warmup';
      if (heroCachePctEl) { heroCachePctEl.textContent = `${sessPct.toFixed(1)}%`; heroCachePctEl.style.color = 'var(--accent-2)'; }
      if (heroCacheSubEl) heroCacheSubEl.textContent = '· 首轮建库';
      if (cacheBadgeEl) cacheBadgeEl.textContent = t('latestReqJump');
      if (cacheBarFillEl) cacheBarFillEl.style.width = `${Math.max(4, sessPct).toFixed(1)}%`;
      if (tipCacheEl) { tipCacheEl.textContent = `${sessPct.toFixed(1)}% · 首轮建库`; tipCacheEl.style.color = 'var(--accent-2)'; }
    } else {
      const sessColor = sessPct >= 50 ? 'var(--emerald)' : (sessPct >= 20 ? 'var(--amber)' : 'var(--fg-2)');
      const absSaved = Math.abs(cacheStats.sessSavedUSD);
      const savedFmt = `${cacheStats.sessSavedUSD < 0 ? '-' : ''}$${absSaved >= 0.01 ? absSaved.toFixed(2) : absSaved.toFixed(3)}`;
      if (heroCachePctEl) { heroCachePctEl.textContent = `${sessPct.toFixed(1)}%`; heroCachePctEl.style.color = sessColor; }
      if (heroCacheSubEl) heroCacheSubEl.textContent = `· 省 ${savedFmt}`;
      if (cacheBarFillEl) cacheBarFillEl.style.width = `${Math.min(100, Math.max(4, sessPct)).toFixed(1)}%`;

      if (cacheStats.cacheDropDetected) {
        if (cacheBox) cacheBox.dataset.cacheState = 'drop';
        if (cacheBadgeEl) cacheBadgeEl.textContent = '⚠️ 最近断流 ›';
        if (tipCacheEl) { tipCacheEl.textContent = `${sessPct.toFixed(1)}% · ⚠️ 本轮断流`; tipCacheEl.style.color = 'var(--rose)'; }
      } else {
        if (cacheBox) cacheBox.dataset.cacheState = sessPct >= 50 ? 'good' : 'low';
        if (cacheBadgeEl) cacheBadgeEl.textContent = t('latestReqJump');
        if (tipCacheEl) { tipCacheEl.textContent = `${sessPct.toFixed(1)}% · 省 ${savedFmt}`; tipCacheEl.style.color = sessColor; }
      }
    }

    // Context DNA 6-Segment Breakdown (aligned with collect() session.groups)
    const grp = state.scan?.session?.groups || null;
    const attArr = state.scan?.session?.attachments || state.scan?.session?.files || [];
    const filesCount = Array.isArray(attArr) ? attArr.length : 0;
    if (el('auditLinkTxt')) {
      el('auditLinkTxt').textContent = filesCount > 0 ? `双账本与附件 (${filesCount})` : '双账本与附件';
    }
    const sysVal = grp ? (Number(grp.system?.high || 0) + Number(grp.definitions?.high || 0)) : Math.max(1, usedTok * 0.18);
    const chatVal = grp ? (Number(grp.user?.high || 0) + Number(grp.assistant?.high || 0)) : Math.max(1, usedTok * 0.22);
    const thinkVal = grp ? Number(grp.thinking?.high || 0) : Math.max(1, usedTok * 0.16);
    const toolVal = grp ? Number(grp.tools?.high || 0) : Math.max(1, usedTok * 0.28);
    const ckptVal = grp ? Number(grp.summaries?.high || 0) : Math.max(1, usedTok * 0.08);
    const fileVal = state.scan?.session?.attachmentTotal ? Number(state.scan.session.attachmentTotal.high || 0) : Math.max(1, usedTok * 0.08);
    const segDefs = [
      { id: 'sys', label: '系统与工具契约', val: Math.max(0, sysVal) },
      { id: 'chat', label: '用户与助手对话', val: Math.max(0, chatVal) },
      { id: 'think', label: '思考链 Thinking', val: Math.max(0, thinkVal) },
      { id: 'tool', label: '工具调用与文件读取', val: Math.max(0, toolVal) },
      { id: 'ckpt', label: '压缩摘要 Checkpoint', val: Math.max(0, ckptVal) },
      { id: 'file', label: '外部附件与图像', val: Math.max(0, fileVal) }
    ];
    const sumSeg = Math.max(1, segDefs.reduce((s, x) => s + x.val, 0));
    segDefs.forEach(s => {
      const node = shadow.querySelector(`.dna-seg[data-seg="${s.id}"]`);
      if (node) {
        const wPct = Math.max(3, (s.val / sumSeg) * 100);
        node.style.width = `${wPct.toFixed(1)}%`;
        node.dataset.dnaInfo = `${s.label} · ${formatK(s.val)} (${Math.round((s.val / sumSeg) * 100)}%)`;
      }
    });

    // Speed Telemetry Card
    if (el('heroTpsVal')) el('heroTpsVal').textContent = state.liveTps != null ? Number(state.liveTps).toFixed(1) : '--';
    if (el('islandTps')) el('islandTps').textContent = state.liveTps != null ? Number(state.liveTps).toFixed(1) : '--';
    if (el('heroTtftVal')) el('heroTtftVal').textContent = state.liveTtft != null ? `${Number(state.liveTtft).toFixed(2)}s` : '--';
    if (el('heroOutTok')) el('heroOutTok').textContent = state.liveOutTok != null ? Number(state.liveOutTok).toLocaleString() : '--';
    if (el('heroDurSec')) el('heroDurSec').textContent = state.liveDurSec != null ? `${Number(state.liveDurSec).toFixed(1)}s` : '--';

    const tpsTag = el('tpsDeltaTag');
    if (tpsTag) {
      if (state.isStreaming) {
        tpsTag.className = 'tag';
        tpsTag.textContent = state.liveTps != null ? t('streamingNow') : t('measuringNow');
      } else if (state.liveTps != null) {
        const isLastFinal = !state.lastTurnStatus || state.lastTurnStatus === 'final';
        tpsTag.className = isLastFinal ? 'tag' : 'tag neutral';
        tpsTag.textContent = isLastFinal ? t('measuredRound') : t('measuredHistory');
      } else {
        tpsTag.className = 'tag neutral';
        tpsTag.textContent = t('waitingGen');
      }
    }
    drawStreamWaveform(el('waveCanvas'), host, state.wavePoints, state.isStreaming);
  }

  function formatResetCountdown(resetAtMs, fallbackText = '', nowMs = Date.now(), compact = false) {
    const tMs = typeof resetAtMs === 'string' ? Date.parse(resetAtMs) : Number(resetAtMs);
    if (!Number.isFinite(tMs)) return fallbackText || (compact ? '--' : '随时可用');
    if (tMs <= nowMs) return compact ? '待重置' : '即将重置';
    const diffSec = Math.max(0, Math.floor((tMs - nowMs) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return compact ? `${d}天${h % 24}h` : `${d}天 ${h % 24}h 重置`;
    }
    if (compact) {
      return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(s).padStart(2, '0')}s`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} 重置`;
  }

  function classifyBucketWindow(b, nowMs = Date.now()) {
    const raw = [b?.windowKey, b?.windowShort, b?.window, b?.windowLabel, b?.bucketId].filter(Boolean).join(' ').toLowerCase();
    if (/5h|hour|5小时/.test(raw)) return { kind: '5h', tag: '5h', order: 1 };
    if (/weekly|7d|week|168h|168_hours|周/.test(raw)) return { kind: 'weekly', tag: t('tagWeekShort'), order: 2 };
    if (/daily|24h|24_hours|day|日/.test(raw)) return { kind: 'daily', tag: t('tagDayShort'), order: 3 };
    const rMs = typeof b?.resetAtMs === 'number' ? b.resetAtMs : (b?.resetTimeIso ? Date.parse(b.resetTimeIso) : NaN);
    if (Number.isFinite(rMs) && (rMs - nowMs) > 12 * 3600 * 1000) {
      return { kind: 'weekly', tag: t('tagWeekShort'), order: 2 };
    }
    if (Number.isFinite(rMs) && (rMs - nowMs) > 0) {
      return { kind: '5h', tag: '5h', order: 1 };
    }
    return { kind: 'other', tag: t('tagQuotaShort'), order: 4 };
  }

  function shortenPoolTitle(rawTitle, poolKey = '') {
    const s = String(rawTitle || '').trim();
    if (poolKey === 'shared_gemini_main' && s.length > 18) return 'Gemini 主力池';
    if (poolKey === 'shared_3p_pool' && s.length > 18) return 'Claude / 第三方池';
    if (poolKey === 'shared_gemini_argon' && s.length > 18) return 'Gemini Argon';
    if (poolKey === 'shared_gemini_carbon' && s.length > 18) return 'Gemini Carbon';
    return s;
  }

  function extractNormalizedPools(nowMs = Date.now()) {
    const view = computeEffectiveQuotaView(nowMs);
    const rawPools = view?.pools || [];
    if (!Array.isArray(rawPools) || !rawPools.length) return [];

    return rawPools.map((p, i) => {
      const hasFrac = p.remainingFraction !== null && p.remainingFraction !== undefined && Number.isFinite(Number(p.remainingFraction));
      const pct = hasFrac ? Math.max(0, Math.min(100, Math.round(Number(p.remainingFraction) * 100))) : null;
      const exactPctStr = typeof core.formatQuotaPercentText === 'function' && hasFrac
        ? core.formatQuotaPercentText(Number(p.remainingFraction))
        : (pct !== null ? `${pct}%` : (p.percentText || '--%'));
      const pctLabel = p.noPermission ? '无权限' : exactPctStr;

      const rawBuckets = Array.isArray(p.buckets) ? p.buckets : [];
      const normBuckets = rawBuckets.map((b, bIdx) => {
        const w = classifyBucketWindow(b, nowMs);
        const bHasFrac = b?.remainingFraction !== null && b?.remainingFraction !== undefined && Number.isFinite(Number(b.remainingFraction));
        const bFrac = bHasFrac ? Math.max(0, Math.min(1, Number(b.remainingFraction))) : null;
        const bPctNum = bFrac !== null ? Math.round(bFrac * 100) : null;
        const bPctText = bHasFrac
          ? (typeof core.formatQuotaPercentText === 'function' ? core.formatQuotaPercentText(bFrac) : `${bPctNum}%`)
          : (b?.percentText || '--%');
        const rMs = b?.resetAtMs ?? (b?.resetTimeIso ? Date.parse(b.resetTimeIso) : null);
        return {
          id: b?.bucketId || `${w.kind}_${bIdx}`,
          kind: w.kind,
          tag: w.tag,
          order: w.order,
          fraction: bFrac,
          pct: bPctNum,
          pctLabel: bPctText,
          resetAtMs: rMs,
          resetShort: formatResetCountdown(rMs, b?.countdownText || b?.resetTimeText || '', nowMs, true)
        };
      }).sort((a, b) => a.order - b.order);

      const bucket5h = normBuckets.find(b => b.kind === '5h') || null;
      const bucketWeekly = normBuckets.find(b => b.kind === 'weekly') || null;
      const tightestBucket = normBuckets
        .filter(b => b.fraction !== null)
        .sort((a, b) => a.fraction - b.fraction)[0] || normBuckets[0] || null;

      const fullTitle = p.title || p.label || p.name || `额度池 ${i + 1}`;
      const modelNames = Array.isArray(p.models) ? p.models.map(m => m.productLabel || m.modelId).filter(Boolean).join(', ') : '';

      return {
        key: p.poolKey || p.id || `pool_${i}`,
        label: shortenPoolTitle(fullTitle, p.poolKey),
        fullTitle: modelNames ? `${fullTitle} (${modelNames})` : fullTitle,
        sourceType: p.sourceType || '',
        pct,
        pctLabel,
        tightestTag: tightestBucket?.tag || '',
        noPermission: Boolean(p.noPermission),
        unavailabilityReason: p.unavailabilityReason || '当前套餐不含',
        resetAtMs: p.resetAtMs || null,
        countdownFallback: p.countdownText || p.resetTimeText || '',
        buckets: normBuckets,
        bucket5h,
        bucketWeekly,
        models: Array.isArray(p.models) ? p.models : []
      };
    });
  }

  function findMatchingPoolForProduct(pools, prodKeyOrId) {
    if (!Array.isArray(pools) || !pools.length) return null;
    const target = String(prodKeyOrId || '').toLowerCase();
    for (const p of pools) {
      for (const m of (p.models || [])) {
        if (m.productKey && String(m.productKey).toLowerCase() === target) return p;
        const ids = [...(m.modelIds || []), ...(m.aliases || [])].map(x => String(x).toLowerCase());
        if (ids.includes(target)) return p;
      }
    }
    if (typeof core.getSharedQuotaGroupKey === 'function' && prodKeyOrId) {
      const gk = core.getSharedQuotaGroupKey(prodKeyOrId);
      const hit = pools.find(p => p.key === gk);
      if (hit) return hit;
    }
    return pools[0];
  }

  function pickBucketColor(fraction, idx = 0) {
    if (fraction === null || fraction === undefined) return 'var(--fg-3)';
    const pct = fraction * 100;
    if (pct <= 15) return 'var(--rose)';
    if (pct <= 35) return 'var(--amber)';
    return idx % 3 === 2 ? 'var(--accent-2)' : 'var(--emerald)';
  }

  function renderQuotaSection(nowMs = Date.now()) {
    const pools = extractNormalizedPools(nowMs);
    const grid = el('quotaTrioGrid');
    const metaLine = el('quotaMetaLine');

    if (metaLine) {
      if (state.quotaError) {
        metaLine.textContent = `同步提示: ${state.quotaError}`;
      } else if (state.quotaFetchedAt > 0) {
        const clock = new Date(state.quotaFetchedAt).toTimeString().slice(0, 8);
        metaLine.textContent = pools.length ? `同步于 ${clock} · 共 ${pools.length} 组 (含 5h 与周额度)` : `同步于 ${clock} · 宿主暂未返回可用池`;
      } else {
        metaLine.textContent = '自动连接宿主配额服务...';
      }
    }

    if (!pools.length) return;

    const matchedActivePool = findMatchingPoolForProduct(pools, state.activeProductKey || state.activeModelId || state.activeModelLabel);
    const primary = pools.find(p => p.key === state.selectedPoolKey) || matchedActivePool || pools[0];

    const dialQuota = el('dialQuota');
    if (dialQuota && primary.pct !== null) {
      dialQuota.style.strokeDashoffset = (27.02 * (1 - primary.pct / 100)).toFixed(2);
      const qColor = primary.pct <= 15 ? 'var(--rose)' : primary.pct <= 35 ? 'var(--amber)' : 'var(--emerald)';
      dialQuota.setAttribute('stroke', qColor);
    }
    if (el('islandQuotaSub')) {
      const winPrefix = primary.tightestTag ? `${primary.tightestTag} ` : '余 ';
      el('islandQuotaSub').textContent = primary.pct !== null ? `· ${winPrefix}${primary.pctLabel}` : `· ${primary.pctLabel}`;
    }
    if (el('tipPoolLbl')) el('tipPoolLbl').textContent = primary.label;
    if (el('tipQuotaVal')) {
      if (primary.bucket5h && primary.bucketWeekly) {
        el('tipQuotaVal').textContent = `5h ${primary.bucket5h.pctLabel} · 周 ${primary.bucketWeekly.pctLabel}`;
      } else {
        el('tipQuotaVal').textContent = `${primary.pctLabel} · ${formatResetCountdown(primary.resetAtMs, primary.countdownFallback, nowMs, true)}`;
      }
    }

    if (grid) {
      const colCount = Math.max(1, Math.min(4, pools.length));
      grid.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;
      const nextGridHtml = pools.map((p, idx) => {
        const isSel = p.key === primary.key;
        if (p.noPermission) {
          return `
            <div class="pool-mini-card${isSel ? ' selected' : ''}" data-pkey="${escapeSvgText(p.key)}" title="${escapeSvgText(p.fullTitle)}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
                <span style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeSvgText(p.label)}</span>
                <span class="mono" style="font-size:10.5px;color:var(--fg-3)">无权限</span>
              </div>
              <div style="font-size:10px;color:var(--fg-3);line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escapeSvgText(p.unavailabilityReason)}</div>
            </div>`;
        }

        const renderBucketRow = (b) => {
          const bColor = pickBucketColor(b.fraction, idx);
          const wPct = b.fraction !== null ? Math.max(b.fraction > 0 ? 2 : 0, Math.min(100, b.fraction * 100)).toFixed(1) : '0';
          return `
            <div class="pool-bucket-row">
              <div class="pool-bucket-hdr mono">
                <span style="color:var(--fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong>${escapeSvgText(b.tag)}</strong> · ${escapeSvgText(b.resetShort)}</span>
                <strong style="font-size:11px;color:${bColor};flex-shrink:0">${escapeSvgText(b.pctLabel)}</strong>
              </div>
              <div class="thin-bar"><i style="width:${wPct}%;background:${bColor}"></i></div>
            </div>`;
        };

        let rowsHtml = '';
        if (p.buckets.length >= 2) {
          rowsHtml = p.buckets.slice(0, 2).map(renderBucketRow).join('');
        } else if (p.buckets.length === 1) {
          const onlyB = p.buckets[0];
          rowsHtml = renderBucketRow(onlyB);
          const missingNote = onlyB.kind === 'weekly'
            ? '5h · 按周总额度共享'
            : (p.sourceType === 'quota_summary_and_configs' ? '周 · 无独立周上限' : '周 · 同步汇总中');
          rowsHtml += `
            <div class="pool-bucket-row" style="opacity:0.62">
              <div class="pool-bucket-hdr mono">
                <span style="color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeSvgText(missingNote)}</span>
                <span style="color:var(--fg-3)">—</span>
              </div>
              <div class="thin-bar"><i style="width:0%"></i></div>
            </div>`;
        } else {
          const pColor = pickBucketColor(p.pct !== null ? p.pct / 100 : null, idx);
          rowsHtml = `
            <div class="pool-bucket-row">
              <div class="pool-bucket-hdr mono"><span style="color:var(--fg-2)">配额</span><strong style="color:${pColor}">${escapeSvgText(p.pctLabel)}</strong></div>
              <div class="thin-bar"><i style="width:${p.pct ?? 0}%;background:${pColor}"></i></div>
            </div>`;
        }

        const isActivePool = matchedActivePool && p.key === matchedActivePool.key;
        return `
          <div class="pool-mini-card${isSel ? ' selected' : ''}" data-pkey="${escapeSvgText(p.key)}" title="${escapeSvgText(p.fullTitle)}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
              <span style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeSvgText(p.label)}</span>
              ${isActivePool ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--emerald);flex-shrink:0" title="当前会话所属池"></span>' : ''}
            </div>
            <div class="pool-bucket-stack">${rowsHtml}</div>
          </div>`;
      }).join('');

      // 仅在渲染签名变化时更新 DOM 并使用容器级事件委托，防止每秒心跳销毁点击中的节点
      if (!grid.__pulseDelegated) {
        grid.__pulseDelegated = true;
        grid.addEventListener('click', (ev) => {
          let cur = ev?.target || null;
          if (cur && typeof cur.closest === 'function') {
            const hit = cur.closest('.pool-mini-card');
            if (hit && hit.dataset?.pkey) {
              state.selectedPoolKey = hit.dataset.pkey;
              renderQuotaSection();
              return;
            }
          }
          while (cur && cur !== grid) {
            if (cur.dataset?.pkey) {
              state.selectedPoolKey = cur.dataset.pkey;
              renderQuotaSection();
              return;
            }
            cur = cur.parentNode;
          }
        });
      }
      if (grid.__lastHtml !== nextGridHtml) {
        grid.innerHTML = nextGridHtml;
        grid.__lastHtml = nextGridHtml;
      }
    }
  }

  function renderBudgetSpace() {
    syncActiveModelIdentity();
    qsa('#budgetScopeSeg .seg-item').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.bscope === state.budgetScope);
    });

    const products = getKnownModelProducts();
    if (!state.selectedProductKey || !products.some(p => p.productKey === state.selectedProductKey)) {
      state.selectedProductKey = state.activeProductKey && products.some(p => p.productKey === state.activeProductKey)
        ? state.activeProductKey
        : products[0].productKey;
    }

    const pools = extractNormalizedPools();
    const listBox = el('budgetModelList');
    if (listBox) {
      listBox.innerHTML = products.map(prod => {
        const pref = getPreferenceForProduct(prod);
        const lim = resolveEffectiveTokensForProduct(prod);
        const onCls = prod.productKey === state.selectedProductKey ? ' on' : '';
        const isCurrentSession = prod.productKey === state.activeProductKey;
        const badgeTxt = pref?.mode === 'dynamic' ? 'DYN' : formatK(lim);
        const matchedPool = findMatchingPoolForProduct(pools, prod.productKey);
        const quotaHint = matchedPool && matchedPool.pct !== null ? ` · 余 ${matchedPool.pct}%` : '';
        return `
          <button class="m-row-btn${onCls}" type="button" data-pkey="${escapeSvgText(prod.productKey)}">
            <div style="min-width:0">
              <div style="font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${escapeSvgText(prod.label)}${isCurrentSession ? ' · 当前' : ''}
              </div>
              <div style="font-size:9.5px;color:var(--fg-3)" class="mono">窗口 ${formatK(prod.maxTokens)}${escapeSvgText(quotaHint)}</div>
            </div>
            <span class="tag neutral mono">${badgeTxt}</span>
          </button>`;
      }).join('');

      qsa('.m-row-btn', listBox).forEach(btn => {
        btn.addEventListener('click', () => {
          state.manualBudgetModelSelect = true;
          state.selectedProductKey = btn.dataset.pkey;
          renderBudgetSpace();
        });
      });
    }

    const selProd = getProductByKey(state.selectedProductKey);
    const maxInput = computeProductMaxInput(selProd);
    const pref = getPreferenceForProduct(selProd);
    const curVal = resolveEffectiveTokensForProduct(selProd);

    if (el('bModelTitle')) el('bModelTitle').textContent = selProd.label;
    if (el('bSpecWin')) el('bSpecWin').textContent = (selProd.maxTokens || 0).toLocaleString();
    if (el('bSpecOut')) el('bSpecOut').textContent = (selProd.maxOutputTokens || 0).toLocaleString();
    if (el('bSpecMax')) el('bSpecMax').textContent = maxInput.toLocaleString();
    if (el('budgetHintRange')) {
      el('budgetHintRange').textContent = `拖动滑轨或输入精确预算 (16,384 – ${maxInput.toLocaleString()})`;
    }

    const slider = el('budgetSlider');
    const numInput = el('exactTokenInput');
    if (slider) {
      slider.setAttribute('max', String(maxInput));
      slider.max = String(maxInput);
      if (shadow.activeElement !== slider) slider.value = String(Math.min(curVal, maxInput));
    }
    if (numInput) {
      numInput.setAttribute('max', String(maxInput));
      numInput.max = String(maxInput);
      if (shadow.activeElement !== numInput) numInput.value = String(curVal);
    }

    qsa('#detentBtns button').forEach(b => {
      const det = b.dataset.det;
      let match = false;
      if (det === 'default') match = !pref || pref.mode === 'default';
      else if (det === 'dynamic') match = pref?.mode === 'dynamic';
      else if (det === 'max') match = pref?.mode === 'fixed' && Math.abs(curVal - maxInput) <= 1024;
      else match = pref?.mode === 'fixed' && Number(det) === curVal;
      b.classList.toggle('on', match);
    });

    if (el('pipeSaved')) {
      el('pipeSaved').textContent = pref?.mode === 'dynamic'
        ? `DYN (${formatK(curVal)})`
        : (!pref || pref.mode === 'default' ? `默认 (${formatK(curVal)})` : curVal.toLocaleString());
    }
    const scopedInj = state.budgetScope === 'unified'
      ? (state.lastInjectedLimit ? { mode: state.lastInjectedMode, limitTokens: state.lastInjectedLimit, failed: false } : null)
      : (state.injectedByProduct.get(selProd.productKey) || null);
    if (el('pipeSent')) {
      if (scopedInj?.failed) {
        el('pipeSent').textContent = '发送失败';
      } else if (scopedInj?.limitTokens) {
        el('pipeSent').textContent = scopedInj.mode === 'dynamic'
          ? 'DYN 放行'
          : (scopedInj.mode === 'default' ? '宿主默认' : scopedInj.limitTokens.toLocaleString());
      } else {
        el('pipeSent').textContent = '下一条消息注入';
      }
    }
    const scopedAdp = state.adoptedByProduct.get(selProd.productKey) ||
      (selProd.productKey === state.activeProductKey && (state.lastAdoptedLimit || state.latest?.budget)
        ? { budget: Number(state.lastAdoptedLimit || state.latest?.budget) }
        : null);
    if (el('pipeAdopted')) {
      const adopted = scopedAdp?.budget || null;
      el('pipeAdopted').textContent = adopted ? `${Number(adopted).toLocaleString()} ✓` : '待会话返回';
    }

    const binBadge = el('binaryUnlockBadge');
    const restoreBtn = el('btnRestoreBin');
    const applyBtn = el('btnApplyBudget');
    const unlockSupported = isBinaryUnlockSupportedOnHost();
    if (restoreBtn) restoreBtn.hidden = !unlockSupported;
    if (applyBtn) {
      applyBtn.textContent = unlockSupported ? t('saveAndSyncBin') : t('savePrefOnly');
    }
    if (binBadge) {
      if (!unlockSupported) {
        binBadge.className = 'tag neutral';
        binBadge.textContent = t('unlockReadyInject');
      } else if (state.unlockStatus?.status === 'patched_pending_restart') {
        binBadge.className = 'tag warn';
        binBadge.textContent = t('unlockPendingRestart');
      } else if (isBinaryDynamicUnlocked()) {
        binBadge.className = 'tag';
        binBadge.textContent = t('unlockDynamicActive');
      } else if (isBinaryUnlocked()) {
        binBadge.className = 'tag';
        binBadge.textContent = state.unlockStatus?.configuredLimitTokens
          ? `底座固定 ${formatK(state.unlockStatus.configuredLimitTokens)}`
          : t('unlockDynamicActive');
      } else if (state.unlockStatus) {
        binBadge.className = 'tag warn';
        binBadge.textContent = t('unlockStock256k');
      } else {
        binBadge.className = 'tag neutral';
        binBadge.textContent = t('unlockReadyInject');
      }
    }
  }

  function getFilteredDailySeries() {
    const h = state.historyData;
    const src = state.ledgerSource;
    const rawDays = (h?.dailyMapBySource && h.dailyMapBySource[src])
      ? h.dailyMapBySource[src]
      : (h?.dailyMap || h?.daily || h?.days || {});
    const entries = [];

    if (Array.isArray(rawDays)) {
      for (const d of rawDays) {
        if (!d || !d.date) continue;
        entries.push({
          date: d.date,
          input: Number(d.inputTokens || d.input || 0),
          cache: Number(d.cacheTokens || d.cacheReadTokens || d.cache || 0),
          output: Number(d.outputTokens || d.output || 0),
          total: Number(d.totalTokens || d.total || 0),
          costUSD: Number(d.costUSD || 0)
        });
      }
    } else if (rawDays && typeof rawDays === 'object') {
      for (const [dateKey, rec] of Object.entries(rawDays)) {
        if (!rec || typeof rec !== 'object') continue;
        const bucket = (src !== 'all' && rec.bySource?.[src]) ? rec.bySource[src] : rec;
        const inp = Number(bucket.inputTokens ?? bucket.input ?? 0);
        const cap = Number(bucket.cacheTokens ?? bucket.cacheReadTokens ?? bucket.cache ?? 0);
        const out = Number(bucket.outputTokens ?? bucket.output ?? 0);
        const tot = Number(bucket.totalTokens ?? bucket.total ?? (inp + cap + out));
        const dayCostObj = typeof core.getDailyModelCost === 'function'
          ? core.getDailyModelCost({ input: inp, cache: cap, output: out, total: tot }, dateKey)
          : null;
        const cost = Number(bucket.costUSD ?? dayCostObj?.costUSD ?? 0);
        entries.push({ date: dateKey, input: inp, cache: cap, output: out, total: tot, costUSD: cost });
      }
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }

  function renderLedgerSpace() {
    qsa('#ledgerSrcSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.lsrc === state.ledgerSource));
    qsa('#heatModeSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.hm === state.heatMode));
    qsa('#ledgerBottomToggle .seg-item').forEach(b => b.classList.toggle('on', b.dataset.lbot === state.ledgerBottomMode));
    qsa('#valuationModeSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.vmode === state.valuationMode));

    if (el('ledgerSumStrip')) el('ledgerSumStrip').style.display = state.ledgerBottomMode === 'api' ? 'none' : 'flex';
    if (el('ledgerApiStrip')) el('ledgerApiStrip').style.display = state.ledgerBottomMode === 'api' ? 'flex' : 'none';

    const days = getFilteredDailySeries();
    const nowLocal = new Date();
    const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
    const monthPrefix = todayStr.slice(0, 7);

    let grandTotal = 0;
    let todayTotal = 0;
    let monthTotal = 0;
    let totalInp = 0;
    let totalCap = 0;
    let totalOut = 0;
    let totalActualUSD = 0;
    let activeDays = 0;

    for (const d of days) {
      grandTotal += d.total;
      totalInp += d.input;
      totalCap += d.cache;
      totalOut += d.output;
      totalActualUSD += d.costUSD;
      if (d.total > 0) activeDays++;
      if (d.date === todayStr) todayTotal += d.total;
      if (d.date.startsWith(monthPrefix)) monthTotal += d.total;
    }

    if (grandTotal === 0 && state.sessionCalls.length > 0) {
      for (const c of state.sessionCalls) {
        const inp = Math.max(0, Number(c.inputTokens || 0));
        const cap = Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
        const out = Math.max(0, Number(c.outputTokens || 0));
        const tot = Number(c.totalTokens || (inp + cap + out));
        grandTotal += tot;
        totalInp += inp;
        totalCap += cap;
        totalOut += out;
        todayTotal += tot;
        monthTotal += tot;
        totalActualUSD += Number(c.costUSD || 0);
      }
      if (grandTotal > 0) activeDays = 1;
    }

    const totalValEl = el('ledgerTotalVal');
    const totalUnitEl = el('ledgerTotalUnit');
    if (totalValEl && totalUnitEl) {
      if (grandTotal >= 1e9) {
        totalValEl.textContent = (grandTotal / 1e9).toFixed(2);
        totalUnitEl.textContent = 'B';
      } else if (grandTotal >= 1e6) {
        totalValEl.textContent = (grandTotal / 1e6).toFixed(2);
        totalUnitEl.textContent = 'M';
      } else if (grandTotal >= 1e3) {
        totalValEl.textContent = (grandTotal / 1e3).toFixed(1);
        totalUnitEl.textContent = 'K';
      } else {
        totalValEl.textContent = String(Math.round(grandTotal));
        totalUnitEl.textContent = 'tok';
      }
    }

    if (el('ledgerSubTotals')) {
      el('ledgerSubTotals').textContent = `今日 ${formatCompactTokens(todayTotal)} · 本月 ${formatCompactTokens(monthTotal)}`;
    }
    if (el('tipTodayVal')) {
      const todayRec = days.find(x => x.date === todayStr);
      const todayCost = todayRec?.costUSD ? todayRec.costUSD : state.sessionCostTotal;
      el('tipTodayVal').textContent = `${formatCompactTokens(todayTotal)} · $${todayCost.toFixed(2)}`;
    }

    const ledgerPromptTotal = totalInp + totalCap;
    const ledgerHitPct = ledgerPromptTotal > 0 ? (totalCap / ledgerPromptTotal) * 100 : null;
    const valModelForSave = state.valuationMode === 'claude-opus-4-6-thinking' ? 'claude-opus-5-5' : 'gemini-4-hydrogen';
    const ledgerSavedUSD = typeof core.calculateNetCacheSavedUSD === 'function'
      ? core.calculateNetCacheSavedUSD({
          model: valModelForSave,
          inputTokens: totalInp,
          cacheReadTokens: totalCap,
          outputTokens: totalOut
        })
      : ((totalCap / 1e6) * (state.valuationMode === 'claude-opus-4-6-thinking' ? (4.00 - 0.20) : (1.50 - 0.075)));
    if (el('ledgerCacheSummary')) {
      el('ledgerCacheSummary').textContent = ledgerHitPct !== null
        ? `缓存命中 ${ledgerHitPct.toFixed(1)}% · 累计省 $${ledgerSavedUSD.toFixed(2)}`
        : '缓存命中 --% · 省 $0.00';
    }

    const srcCostEst = state.historyData?.costEstimateBySource?.[state.ledgerSource] || state.historyData?.costEstimate || null;
    const pricedActualUSD = Number(srcCostEst?.pricedCostUSD || 0);
    let inpCost = totalInp * (1.50 / 1e6);
    let capCost = totalCap * (0.075 / 1e6);
    let outCost = totalOut * (7.50 / 1e6);
    if (state.valuationMode === 'claude-opus-4-6-thinking') {
      inpCost = totalInp * (4.00 / 1e6);
      capCost = totalCap * (0.20 / 1e6);
      outCost = totalOut * (20.00 / 1e6);
    }
    const effectiveTotalUSD = state.valuationMode === 'actual'
      ? (pricedActualUSD > 0 ? pricedActualUSD : (totalActualUSD > 0 ? totalActualUSD : (inpCost + capCost + outCost)))
      : (inpCost + capCost + outCost);

    if (el('apiBreakdownNums')) {
      const hitTag = ledgerHitPct !== null ? `${ledgerHitPct.toFixed(1)}% 命中` : '0%';
      el('apiBreakdownNums').innerHTML =
        `<span>新输入: <strong>$${inpCost.toFixed(2)}</strong></span>` +
        `<span>缓存 (${hitTag}): <strong style="color:var(--emerald)">$${capCost.toFixed(2)}</strong> <small style="color:var(--emerald)">(省 $${ledgerSavedUSD.toFixed(2)})</small></span>` +
        `<span>输出: <strong>$${outCost.toFixed(2)}</strong></span>`;
    }

    if (el('hmActiveSummary')) {
      const avg = activeDays > 0 ? effectiveTotalUSD / activeDays : 0;
      el('hmActiveSummary').textContent = `活跃 ${activeDays} 天 · 日均 $${avg.toFixed(2)}`;
    }

    const isFreeMode = state.subAcqMode === 'free_edu' || state.subAcqMode === 'free_tier';
    const effPrice = isFreeMode ? 0 : Number(state.subPrice || 0);
    const cnyMonthly = typeof core.convertToCNY === 'function'
      ? Number(core.convertToCNY(effPrice, state.subCurrency) || 0)
      : effPrice * 7.22;
    // USD 订阅直接使用原值计算美元月费，避免经 CNY 中转二次换算引入汇率舍入偏差
    const usdMonthly = String(state.subCurrency || '').toUpperCase() === 'USD'
      ? effPrice
      : (cnyMonthly / 7.22);
    const sym = (core.CURRENCY_SYMBOLS && core.CURRENCY_SYMBOLS[state.subCurrency]) || state.subCurrency;

    if (el('roiMultTxt')) {
      if (isFreeMode || usdMonthly <= 0.01) {
        el('roiMultTxt').textContent = `免额外付费 · 等效 $${effectiveTotalUSD.toFixed(1)}`;
      } else {
        const mult = effectiveTotalUSD / usdMonthly;
        el('roiMultTxt').textContent = `${mult.toFixed(1)}× 价值回本`;
      }
    }
    if (el('subSummaryLine')) {
      el('subSummaryLine').textContent = `${state.subRegionCode} ${sym}${effPrice} (≈¥${Math.round(cnyMonthly)}) · API 折算 $${effectiveTotalUSD.toFixed(2)}`;
    }

    const dailyWrap = el('hmDailyWrap');
    const altSvg = el('hmAltSvg');
    const hoverEl = el('hmHoverTxt');

    const dayMap = new Map(days.map(d => [d.date, d]));
    const endDay = new Date();
    endDay.setDate(endDay.getDate() - state.hmPageOffset * 90);
    const paddedSeries = [];
    for (let i = 251; i >= 0; i--) {
      const dt = new Date(endDay);
      dt.setDate(endDay.getDate() - i);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      paddedSeries.push(dayMap.get(iso) || { date: iso, input: 0, cache: 0, output: 0, total: 0, costUSD: 0 });
    }

    if (el('hmPeriodLbl')) {
      el('hmPeriodLbl').textContent = `${paddedSeries[0].date.slice(5)} – ${paddedSeries[paddedSeries.length - 1].date.slice(5)}`;
    }
    if (el('btnHmNext')) el('btnHmNext').disabled = state.hmPageOffset <= 0;

    if (state.heatMode === 'daily') {
      if (dailyWrap) dailyWrap.style.display = 'grid';
      if (altSvg) altSvg.style.display = 'none';
      renderDailyHeatmapGrid(dailyWrap, paddedSeries, (item) => {
        if (hoverEl) {
          const dayPrompt = (item.input || 0) + (item.cache || 0);
          const dayHitTxt = dayPrompt > 0 ? ` · 命中 ${((item.cache / dayPrompt) * 100).toFixed(1)}%` : '';
          hoverEl.textContent = `${item.date} · ${formatCompactTokens(item.total)} tok (新输入 ${formatCompactTokens(item.input)} · 缓存 ${formatCompactTokens(item.cache)}${dayHitTxt} · 输出 ${formatCompactTokens(item.output)})`;
        }
      });
    } else {
      if (dailyWrap) dailyWrap.style.display = 'none';
      if (altSvg) altSvg.style.display = 'block';
      const bucketMap = new Map();
      // 年度与全周期累计视图使用完整历史天数聚合，避免被 252 天分页切片截断早期记录
      const sourceSeries = (state.heatMode === 'yearly' || state.heatMode === 'cum') && days.length > 0
        ? days
        : paddedSeries;
      if ((state.heatMode === 'yearly' || state.heatMode === 'cum') && days.length > 0 && el('hmPeriodLbl')) {
        el('hmPeriodLbl').textContent = `${days[0].date} – ${days[days.length - 1].date}`;
      }
      for (let idx = 0; idx < sourceSeries.length; idx++) {
        const item = sourceSeries[idx];
        const key = state.heatMode === 'weekly'
          ? `W${Math.floor(idx / 7) + 1}`
          : state.heatMode === 'monthly'
            ? item.date.slice(0, 7)
            : state.heatMode === 'yearly'
              ? item.date.slice(0, 4)
              : item.date;
        const cur = bucketMap.get(key) || { shortLabel: key.slice(-5), total: 0, date: key };
        cur.total += item.total;
        bucketMap.set(key, cur);
      }
      renderAlternateHistorySvg(altSvg, state.heatMode, Array.from(bucketMap.values()), (b) => {
        if (hoverEl) hoverEl.textContent = `${b.date} · 合计 ${formatCompactTokens(b.total)} tok`;
      }, state.panelLang);
    }
  }

  function renderStudioSpace() {
    el('toggleZhTitle')?.classList.toggle('on', state.zhChatTitle);
    updatePromptTierDescription();

    el('toggleProxyMod')?.classList.toggle('on', state.proxyEnabled);
    const pInput = el('proxyUrlInput');
    if (pInput && shadow.activeElement !== pInput) pInput.value = state.proxyUrl;

    const setStep = (id, val) => {
      const node = el(id);
      if (!node) return;
      node.className = val === true ? 'topo-step ok' : val === false ? 'topo-step fail' : 'topo-step';
    };
    setStep('topoStep1', state.proxyDiag.configValid);
    setStep('topoStep2', state.proxyDiag.proxyReachable);
    setStep('topoStep3', state.proxyDiag.internetReachable);
    setStep('topoStep4', state.proxyDiag.modelCallVerified || (state.proxyDiag.internetReachable && Boolean(state.latest)));

    qsa('#shellLangSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.slang === state.shellLanguage));
    qsa('#brandWordSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.bword === state.brandTitle));

    if (el('runtimeVerDiag')) {
      el('runtimeVerDiag').textContent = `Renderer v${METER_VERSION} · Backend ${state.backendSource} (v${state.backendVersion})`;
    }
  }

  function renderAuditSheet() {
    const l = state.latest;
    const cs = computeSessionCacheStats();
    const scanEstHigh = state.scan?.session?.total?.high || state.scan?.estimatedTotal || null;

    // Layer 1: Whole-Session Cumulative Cache Overview Banner
    if (el('audSessTurnTag')) {
      el('audSessTurnTag').textContent = cs.promptTurnCount > 0 ? `共 ${cs.promptTurnCount} 轮请求` : '0 轮请求';
    }
    if (cs.sessHitPct === null) {
      if (el('audSessCachePct')) { el('audSessCachePct').textContent = '--%'; el('audSessCachePct').style.color = 'var(--fg-2)'; }
      if (el('audSessSavedBadge')) { el('audSessSavedBadge').textContent = '累计省 $0.00'; el('audSessSavedBadge').style.color = 'var(--fg-3)'; }
      if (el('audSessCacheBar')) el('audSessCacheBar').style.width = '0%';
      if (el('audSessTokDetail')) el('audSessTokDetail').textContent = '累计缓存读取 -- / 会话总输入 --';
      if (el('audSessTrendHint')) { el('audSessTrendHint').textContent = '等待首次模型响应'; el('audSessTrendHint').style.color = 'var(--fg-3)'; }
    } else {
      const sessTotInp = cs.sessFreshInp + cs.sessCacheRead;
      const sessColor = cs.sessHitPct >= 50 ? 'var(--emerald)' : (cs.sessHitPct >= 20 ? 'var(--amber)' : 'var(--fg-2)');
      const sessSavedStr = cs.sessSavedUSD >= 0.01 ? cs.sessSavedUSD.toFixed(2) : cs.sessSavedUSD.toFixed(3);
      if (el('audSessCachePct')) { el('audSessCachePct').textContent = `${cs.sessHitPct.toFixed(1)}%`; el('audSessCachePct').style.color = sessColor; }
      if (el('audSessSavedBadge')) { el('audSessSavedBadge').textContent = `累计省 $${sessSavedStr}`; el('audSessSavedBadge').style.color = sessColor; }
      if (el('audSessCacheBar')) el('audSessCacheBar').style.width = `${Math.min(100, Math.max(3, cs.sessHitPct)).toFixed(1)}%`;
      if (el('audSessTokDetail')) {
        el('audSessTokDetail').textContent = `缓存读取 ${formatK(cs.sessCacheRead)} / 总输入 ${formatK(sessTotInp)} tok (新输入 ${formatK(cs.sessFreshInp)})`;
      }
      if (el('audSessTrendHint')) {
        el('audSessTrendHint').textContent = cs.cacheDropDetected ? '⚠️ 最近一次请求发生断流重算 ↓' : '下方为最近一次模型请求明细 ↓';
        el('audSessTrendHint').style.color = cs.cacheDropDetected ? 'var(--rose)' : 'var(--fg-3)';
      }
    }

    // Layer 2: Latest Single Model Request Breakdown
    if (el('audLatestTurnBadge')) {
      el('audLatestTurnBadge').textContent = cs.promptTurnCount > 0 ? `第 ${cs.promptTurnCount} 轮` : '待请求';
    }
    if (el('audStatus')) el('audStatus').textContent = l ? (l.estimated ? '本地启发式估算' : '服务端权威返回') : '等待会话请求';
    if (el('audActualTok')) el('audActualTok').textContent = l?.used ? `${Number(l.used).toLocaleString()} tok` : '--';
    if (el('audCacheSplit')) {
      el('audCacheSplit').textContent = cs.roundHitPct !== null
        ? `${formatK(cs.roundFreshInp)} / ${formatK(cs.roundCacheRead)} tok`
        : '--';
    }
    if (el('audCacheRate')) {
      const rateEl = el('audCacheRate');
      if (cs.roundHitPct === null) {
        rateEl.textContent = '--';
        rateEl.style.color = 'var(--fg-2)';
      } else if (cs.cacheDropDetected) {
        rateEl.textContent = `${cs.roundHitPct.toFixed(1)}% ⚠️ 失效重算 (上轮 ${Math.round(cs.prevHitPct || 0)}%)`;
        rateEl.style.color = 'var(--rose)';
      } else if (cs.promptTurnCount === 1 && cs.roundHitPct < 10) {
        rateEl.textContent = `${cs.roundHitPct.toFixed(1)}% · 首轮建库`;
        rateEl.style.color = 'var(--accent-2)';
      } else {
        const roundSavedStr = cs.roundSavedUSD >= 0.01 ? cs.roundSavedUSD.toFixed(2) : cs.roundSavedUSD.toFixed(3);
        rateEl.textContent = `${cs.roundHitPct.toFixed(1)}% · 本次省 $${roundSavedStr}`;
        rateEl.style.color = cs.roundHitPct >= 50 ? 'var(--emerald)' : 'var(--amber)';
      }
    }
    if (el('audEstTok')) el('audEstTok').textContent = (l?.estimate || scanEstHigh) ? `≈ ${Number(l?.estimate || scanEstHigh).toLocaleString()} tok` : '--';
    const sentOrBudget = state.lastInjectedLimit || l?.budget || null;
    const effLbl = state.activeEffort || 'Default';
    if (el('audSentLim')) {
      el('audSentLim').textContent = sentOrBudget ? `${formatK(Number(sentOrBudget))} · ${effLbl}` : `-- · ${effLbl}`;
    }
    if (el('audErrorLim')) el('audErrorLim').textContent = l?.error || state.requestError || '无超限';
    if (el('audRuntimeLine')) el('audRuntimeLine').textContent = `通道: ${state.backendSource} · 会话步数: ${state.scan?.session?.steps || state.count}`;

    const files = state.scan?.session?.attachments || state.scan?.session?.files || [];
    if (el('audStepStats')) el('audStepStats').textContent = `${state.scan?.session?.steps || state.count} 步 · ${files.length} 附件`;
    const listEl = el('auditFileList');
    if (listEl) {
      if (!files.length) {
        listEl.innerHTML = `<div style="font-size:11px;color:var(--fg-3);padding:14px 0;text-align:center">${state.scanBusy ? '正在扫描会话归档与附件...' : '当前会话暂无附件记录，可点击下方按钮重扫'}</div>`;
      } else {
        listEl.innerHTML = files.map(f => {
          const name = f.name || f.path || '附件';
          const refs = Number(f.references || 1);
          const tok = Number(f.high || f.low || f.tokens || f.estimatedTokens || 0) * refs;
          const refTxt = refs > 1 ? ` ×${refs}` : '';
          return `<div class="file-audit-item"><span class="file-audit-name">${escapeSvgText(name + refTxt)}</span><strong class="mono" style="color:var(--emerald)">${formatK(tok)} tok</strong></div>`;
        }).join('');
      }
    }
  }

  function renderSpeedSheet() {
    const allCalls = mergeAllSpeedCalls();
    let groups = [];
    if (typeof core.summarizeSpeedByModel === 'function') {
      groups = core.summarizeSpeedByModel(allCalls, {
        metric: state.duelMetric === 'dur' ? 'duration' : state.duelMetric,
        cascadeModelConfigs: state.cascadeModelConfigs
      });
    }

    qsa('#duelMetricSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.dm === state.duelMetric));
    const focusKey = state.duelFocusModel || state.activeModelId || state.activeModelLabel;
    renderSpeedDuelView(
      el('duelBarsBox'),
      el('duelTrendSvg'),
      el('duelTrendTitle'),
      el('duelTrendMedian'),
      groups,
      state.duelMetric,
      focusKey,
      (clickedModelKey) => {
        state.duelFocusModel = clickedModelKey;
        renderSpeedSheet();
      },
      state.panelLang
    );
  }

  function renderSubscriptionSheet() {
    const presets = Array.isArray(core.SUBSCRIPTION_REGIONS_PRESET) && core.SUBSCRIPTION_REGIONS_PRESET.length
      ? core.SUBSCRIPTION_REGIONS_PRESET
      : [
          { id: 'TR', name: '土耳其', flag: '🇹🇷', currency: 'TRY', symbol: '₺', monthlyPrice: 869.99 },
          { id: 'US', name: '美国', flag: '🇺🇸', currency: 'USD', symbol: '$', monthlyPrice: 19.99 },
          { id: 'JP', name: '日本', flag: '🇯🇵', currency: 'JPY', symbol: '¥', monthlyPrice: 2900 },
          { id: 'HK', name: '中国香港', flag: '🇭🇰', currency: 'HKD', symbol: 'HK$', monthlyPrice: 158 },
          { id: 'TW', name: '中国台湾', flag: '🇹🇼', currency: 'TWD', symbol: 'NT$', monthlyPrice: 650 }
        ];

    const kw = String(state.countryFilter || '').trim().toLowerCase();
    const filtered = presets.filter(r => {
      if (!kw) return true;
      const code = String(r.id || r.code || '').toLowerCase();
      const name = String(r.name || r.nameZh || '').toLowerCase();
      const cur = String(r.currency || '').toLowerCase();
      const aliasHit = Array.isArray(r.aliases) && r.aliases.some(a => String(a).toLowerCase().includes(kw));
      return code.includes(kw) || name.includes(kw) || cur.includes(kw) || aliasHit;
    });

    const grid = el('countryGrid');
    if (grid) {
      grid.innerHTML = filtered.map(r => {
        const code = r.id || r.code || 'US';
        const name = r.name || r.nameZh || code;
        const flag = r.flag ? `${r.flag} ` : '';
        const cur = r.currency || 'USD';
        const price = Number(r.monthlyPrice ?? r.proMonthly ?? 19.99);
        const sym = r.symbol || (core.CURRENCY_SYMBOLS && core.CURRENCY_SYMBOLS[cur]) || `${cur} `;
        const cny = typeof core.convertToCNY === 'function'
          ? Math.round(core.convertToCNY(price, cur) || 0)
          : Math.round(price * (r.rateToCNY || 7.2));
        const onCls = code === state.subRegionCode ? ' on' : '';
        return `
          <button class="country-pill${onCls}" type="button" data-rcode="${escapeSvgText(code)}" data-rcur="${escapeSvgText(cur)}" data-rprice="${price}">
            <div style="font-size:11.5px;font-weight:600">${escapeSvgText(flag + name)} · ${escapeSvgText(code)}</div>
            <div class="mono" style="font-size:10px;color:var(--fg-2);margin-top:2px">${escapeSvgText(sym)}${price} · ≈¥${cny}</div>
          </button>`;
      }).join('');

      qsa('.country-pill', grid).forEach(pill => {
        pill.addEventListener('click', () => {
          state.subRegionCode = pill.dataset.rcode;
          state.subCurrency = pill.dataset.rcur;
          state.subPrice = Number(pill.dataset.rprice || 0);
          if (el('subPriceInput')) el('subPriceInput').value = String(state.subPrice);
          renderSubscriptionSheet();
          renderLedgerSpace();
          void persistUiAndPlanSettings();
        });
      });
    }

    qsa('#acqModeSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.acq === state.subAcqMode));
    const sym = (core.CURRENCY_SYMBOLS && core.CURRENCY_SYMBOLS[state.subCurrency]) || state.subCurrency;
    if (el('selectedCurrencyTag')) el('selectedCurrencyTag').textContent = `${state.subCurrency} ${sym}`;
    const pIn = el('subPriceInput');
    if (pIn && shadow.activeElement !== pIn) pIn.value = String(state.subPrice);

    const effP = (state.subAcqMode === 'free_edu' || state.subAcqMode === 'free_tier') ? 0 : state.subPrice;
    const cnyVal = typeof core.convertToCNY === 'function' ? (core.convertToCNY(effP, state.subCurrency) || 0) : effP * 7.2;
    if (el('subConversionPreview')) {
      el('subConversionPreview').textContent = `当前折合人民币约 ¥${cnyVal.toFixed(1)} / 月`;
    }
  }

  function renderAll() {
    renderCockpit();
    renderQuotaSection();
    renderBudgetSpace();
    renderLedgerSpace();
    renderStudioSpace();
    renderAuditSheet();
    renderSpeedSheet();
    renderSubscriptionSheet();
  }

  // ==================== Interactive Event Bindings ====================
  function toggleHud(open) {
    state.hudOpen = Boolean(open);
    syncHudAnchorPosition();
    el('pulseHud')?.classList.toggle('closed', !state.hudOpen);
    el('dynamicIsland')?.classList.toggle('active', state.hudOpen);
    el('glanceTip')?.classList.toggle('hidden-tip', state.hudOpen);
    if (state.hudOpen) {
      renderAll();
    } else {
      state.openSheetId = null;
      qsa('.glass-sheet').forEach(s => s.classList.remove('open'));
    }
  }

  function switchSpace(sp) {
    state.activeSpace = sp;
    state.openSheetId = null;
    qsa('.glass-sheet').forEach(s => s.classList.remove('open'));
    qsa('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.space === sp));
    qsa('.space-view').forEach(v => v.classList.toggle('active', v.id === `space-${sp}`));
    applyStaticTranslations();
    if (sp === 'ledger') renderLedgerSpace();
    if (sp === 'budget') renderBudgetSpace();
    if (sp === 'studio') renderStudioSpace();
  }

  function openSheet(sheetId) {
    qsa('.glass-sheet').forEach(s => s.classList.toggle('open', s.id === sheetId));
    state.openSheetId = sheetId;
    if (sheetId === 'auditSheet') renderAuditSheet();
    if (sheetId === 'speedSheet') renderSpeedSheet();
    if (sheetId === 'subSheet') renderSubscriptionSheet();
  }

  el('dynamicIsland')?.addEventListener('click', () => {
    toggleHud(!state.hudOpen);
  });
  el('dynamicIsland')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault?.();
      toggleHud(!state.hudOpen);
    }
  });

  el('btnHideHud')?.addEventListener('click', () => toggleHud(false));

  el('btnToggleDock')?.addEventListener('click', () => {
    state.dockMode = state.dockMode === 'drawer' ? 'popover' : 'drawer';
    host.setAttribute('data-mode', state.dockMode);
    toggleHud(true);
    notify(state.dockMode === 'drawer' ? '已切换为右侧贴边抽屉' : '已切换为悬浮玻璃窗');
    void persistUiAndPlanSettings();
  });

  qsa('.rail-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSpace(btn.dataset.space));
  });

  qsa('[data-open-sheet]').forEach(btn => {
    btn.addEventListener('click', () => openSheet(btn.dataset.openSheet));
  });

  qsa('[data-close-sheet]').forEach(btn => {
    btn.addEventListener('click', () => {
      el(btn.dataset.closeSheet)?.classList.remove('open');
      state.openSheetId = null;
    });
  });

  el('btnOpenUpdateSheet')?.addEventListener('click', () => openSheet('updateSheet'));

  qsa('#panelLangSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.panelLang = normalizePulseLang(btn.dataset.plang);
      applyStaticTranslations();
      renderAll();
      void persistUiAndPlanSettings();
    });
  });

  const dnaReadout = el('dnaReadout');
  qsa('.dna-seg').forEach(seg => {
    seg.addEventListener('mouseenter', () => {
      if (dnaReadout && seg.dataset.dnaInfo) dnaReadout.textContent = seg.dataset.dnaInfo;
    });
    seg.addEventListener('mouseleave', () => {
      if (dnaReadout) dnaReadout.textContent = '上下文构成 · 悬停色带查看占比';
    });
  });

  // Cockpit read-only limit pill jumps straight to Budget Space (single source of truth)
  el('btnJumpBudget')?.addEventListener('click', () => {
    syncActiveModelIdentity();
    if (state.activeProductKey) {
      state.manualBudgetModelSelect = false;
      state.selectedProductKey = state.activeProductKey;
    }
    switchSpace('budget');
  });

  el('btnSyncQuotaNow')?.addEventListener('click', async () => {
    notify('正在强制刷新全部共享额度池...');
    const view = await syncQuotaFromHost(true);
    const count = view?.pools?.length || 0;
    notify(count > 0 ? `配额同步完成（共 ${count} 组共享池）` : (state.quotaError || '已请求宿主，暂未返回配额桶'));
  });

  el('btnSheetRescan')?.addEventListener('click', async () => {
    if (!state.route) { notify('请先打开一个会话'); return; }
    notify('正在深度扫描归档与外部附件...');
    await runSessionScan(state.generation, state.route, true);
    notify('已完成会话归档与附件重扫');
  });

  // Budget Space Controls
  qsa('#budgetScopeSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.budgetScope = btn.dataset.bscope;
      syncWindowContextPreferencesCache();
      renderBudgetSpace();
      renderCockpit();
      try {
        await callBackend({
          ipcFn: typeof globalThis.contextMeterAPI?.saveSettings === 'function'
            ? () => globalThis.contextMeterAPI.saveSettings({ contextScopeMode: state.budgetScope })
            : null,
          liveRoute: '/save-settings',
          body: { contextScopeMode: state.budgetScope }
        });
      } catch {}
    });
  });

  const stageDraftBudgetUI = (rawVal) => {
    const selProd = getProductByKey(state.selectedProductKey || state.activeProductKey);
    const entry = buildPrefEntryFromSelection(rawVal, selProd);
    if (state.budgetScope === 'unified') {
      state.unifiedPref = { modelId: 'unified', mode: entry.mode, limitTokens: entry.limitTokens };
    } else {
      state.contextPreferencesMap[selProd.productKey] = {
        scope: 'product',
        productKey: selProd.productKey,
        modelId: selProd.productKey,
        label: selProd.label,
        mode: entry.mode,
        limitTokens: entry.limitTokens
      };
    }
    syncWindowContextPreferencesCache();
    renderBudgetSpace();
    renderCockpit();
  };

  el('budgetSlider')?.addEventListener('input', (e) => stageDraftBudgetUI(Number(e.target.value)));
  el('exactTokenInput')?.addEventListener('input', (e) => {
    const num = Number(e.target.value);
    if (Number.isFinite(num) && num >= 16384) stageDraftBudgetUI(num);
  });
  el('exactTokenInput')?.addEventListener('change', (e) => stageDraftBudgetUI(Number(e.target.value)));
  qsa('#detentBtns button').forEach(btn => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset.det;
      const selProd = getProductByKey(state.selectedProductKey || state.activeProductKey);
      void saveAndApplyProductBudget(raw, selProd, { autoUnlockBinary: true });
    });
  });

  const resolveCurrentBudgetInputSelection = (selProd) => {
    const curPref = getPreferenceForProduct(selProd);
    const curEff = resolveEffectiveTokensForProduct(selProd);
    const typedNum = Number(el('exactTokenInput')?.value);
    if (Number.isFinite(typedNum) && typedNum >= 16384 && Math.round(typedNum) !== curEff) {
      return Math.round(typedNum);
    }
    if (curPref?.mode === 'dynamic') return 'dynamic';
    if (!curPref || curPref.mode === 'default') return 'default';
    return Number.isFinite(typedNum) && typedNum >= 16384 ? Math.round(typedNum) : Number(curPref.limitTokens || 256000);
  };

  el('btnSaveOnly')?.addEventListener('click', async () => {
    const selProd = getProductByKey(state.selectedProductKey || state.activeProductKey);
    const rawVal = resolveCurrentBudgetInputSelection(selProd);
    await saveAndApplyProductBudget(rawVal, selProd, { autoUnlockBinary: false });
  });

  el('btnApplyBudget')?.addEventListener('click', async () => {
    const selProd = getProductByKey(state.selectedProductKey || state.activeProductKey);
    const rawVal = resolveCurrentBudgetInputSelection(selProd);
    await saveAndApplyProductBudget(rawVal, selProd, { autoUnlockBinary: true });
  });

  el('btnRestoreBin')?.addEventListener('click', async () => {
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.restoreContextUnlock === 'function'
          ? () => globalThis.contextMeterAPI.restoreContextUnlock({})
          : null,
        liveRoute: '/context-unlock-restore',
        body: {}
      });
      if (res?.ok) {
        await syncStudioStatuses();
        notify('已无损恢复官方原版二进制文件');
      } else {
        notify(res?.error || '无需还原或未找到备份');
      }
    } catch (e) {
      notify(e?.message || '还原失败');
    }
  });

  // Ledger & Speed & Studio Controls
  qsa('#ledgerSrcSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ledgerSource = btn.dataset.lsrc;
      renderLedgerSpace();
      void persistUiAndPlanSettings();
    });
  });

  qsa('#heatModeSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.heatMode = btn.dataset.hm;
      renderLedgerSpace();
    });
  });

  qsa('#ledgerBottomToggle .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ledgerBottomMode = btn.dataset.lbot;
      renderLedgerSpace();
    });
  });

  qsa('#valuationModeSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.valuationMode = btn.dataset.vmode;
      renderLedgerSpace();
      void persistUiAndPlanSettings();
    });
  });

  el('btnHmPrev')?.addEventListener('click', () => {
    state.hmPageOffset += 1;
    renderLedgerSpace();
  });

  el('btnHmNext')?.addEventListener('click', () => {
    state.hmPageOffset = Math.max(0, state.hmPageOffset - 1);
    renderLedgerSpace();
  });

  el('btnRefreshHistory')?.addEventListener('click', async () => {
    notify('正在同步本地与 CLI 历史账本...');
    await syncTokenHistory(true);
    notify('历史 Token 账本与测速样本已更新');
  });

  qsa('#duelMetricSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.duelMetric = btn.dataset.dm;
      renderSpeedSheet();
    });
  });

  el('countrySearchInput')?.addEventListener('input', (e) => {
    state.countryFilter = e.target.value;
    renderSubscriptionSheet();
  });

  qsa('#acqModeSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.subAcqMode = btn.dataset.acq;
      renderSubscriptionSheet();
      renderLedgerSpace();
      void persistUiAndPlanSettings();
    });
  });

  el('subPriceInput')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 0) {
      state.subPrice = v;
      renderSubscriptionSheet();
      renderLedgerSpace();
      void persistUiAndPlanSettings();
    }
  });

  qsa('#ruleTierSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.promptTier = Number(btn.dataset.rtier || 0);
      updatePromptTierDescription();
    });
  });

  el('toggleZhTitle')?.addEventListener('click', () => {
    state.zhChatTitle = !state.zhChatTitle;
    el('toggleZhTitle')?.classList.toggle('on', state.zhChatTitle);
  });

  el('btnApplyEnhance')?.addEventListener('click', async () => {
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.applyEnhancePatch === 'function'
          ? () => globalThis.contextMeterAPI.applyEnhancePatch({ promptTier: state.promptTier, chineseTitle: state.zhChatTitle })
          : null,
        liveRoute: '/enhance-apply',
        body: { promptTier: state.promptTier, chineseTitle: state.zhChatTitle }
      });
      notify(res?.ok ? `已应用 Lv.${state.promptTier} 提示词增强补丁` : (res?.error || '应用增强失败'));
    } catch (e) {
      notify(e?.message || '应用增强异常');
    }
  });

  el('btnResetEnhance')?.addEventListener('click', async () => {
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.restoreAllEnhance === 'function'
          ? () => globalThis.contextMeterAPI.restoreAllEnhance({})
          : null,
        liveRoute: '/enhance-restore',
        body: {}
      });
      if (res?.ok) {
        state.promptTier = 0;
        state.zhChatTitle = false;
        renderStudioSpace();
        notify('已恢复官方原版提示词与标题策略');
      } else {
        notify(res?.error || '恢复失败');
      }
    } catch (e) {
      notify(e?.message || '恢复异常');
    }
  });

  el('toggleProxyMod')?.addEventListener('click', async () => {
    const nextEnable = !state.proxyEnabled;
    const urlVal = el('proxyUrlInput')?.value?.trim() || state.proxyUrl;
    state.proxyUrl = urlVal;
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.toggleModule === 'function'
          ? () => globalThis.contextMeterAPI.toggleModule('proxy', nextEnable, { proxyUrl: urlVal })
          : null,
        liveRoute: '/toggle-module',
        body: { name: 'proxy', enable: nextEnable, opts: { proxyUrl: urlVal } }
      });
      if (res?.ok) {
        state.proxyEnabled = nextEnable;
        if (res.restartRequired) state.restartRequired = true;
        renderStudioSpace();
        renderCockpit();
        notify(res.message || (nextEnable ? '已启用免 TUN 代理配置' : '已关闭免 TUN 代理'));
      } else {
        notify(res?.error || '切换代理失败');
      }
    } catch (e) {
      notify(e?.message || '切换代理异常');
    }
  });

  el('btnPingTopo')?.addEventListener('click', async () => {
    const urlVal = el('proxyUrlInput')?.value?.trim() || state.proxyUrl;
    state.proxyUrl = urlVal;
    notify('正在执行四层代理连通性诊断...');
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.testProxy === 'function'
          ? () => globalThis.contextMeterAPI.testProxy(urlVal)
          : null,
        liveRoute: '/test-proxy',
        body: { proxyUrl: urlVal }
      });
      const d = res?.data || res;
      if (d) {
        state.proxyDiag = {
          configValid: Boolean(d.configValid),
          proxyReachable: Boolean(d.proxyReachable),
          internetReachable: Boolean(d.internetReachable),
          modelCallVerified: Boolean(d.internetReachable && state.latest)
        };
        renderStudioSpace();
        notify(d.internetReachable ? '四层代理链路连通正常' : (d.error || '外网探测未通过'));
      }
    } catch (e) {
      notify(e?.message || '代理诊断失败');
    }
  });

  el('btnReloadLs')?.addEventListener('click', async () => {
    notify('正在平滑重启语言服务进程...');
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.restartLanguageServers === 'function'
          ? () => globalThis.contextMeterAPI.restartLanguageServers()
          : null,
        liveRoute: '/restart-language-servers',
        body: {}
      });
      notify(res?.ok ? '语言服务已平滑重启' : (res?.error || '重启语言服务失败'));
    } catch (e) {
      notify(e?.message || '重启失败');
    }
  });

  qsa('#shellLangSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.slang;
      const enable = lang === 'zh-CN';
      try {
        const res = await callBackend({
          ipcFn: typeof globalThis.contextMeterAPI?.toggleModule === 'function'
            ? () => globalThis.contextMeterAPI.toggleModule('chinese', enable, { language: lang, brandTitle: state.brandTitle })
            : null,
          liveRoute: '/toggle-module',
          body: { name: 'chinese', enable, opts: { language: lang, brandTitle: state.brandTitle } }
        });
        if (res?.ok) {
          state.shellLanguage = lang;
          if (res.restartRequired) state.restartRequired = true;
          renderStudioSpace();
          renderCockpit();
          notify(res.message || '已更新客户端壳层语言设置');
        } else {
          notify(res?.error || '切换壳层语言失败');
        }
      } catch (e) {
        notify(e?.message || '切换壳层语言异常');
      }
    });
  });

  qsa('#brandWordSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bword = btn.dataset.bword;
      try {
        const res = await callBackend({
          ipcFn: typeof globalThis.contextMeterAPI?.toggleModule === 'function'
            ? () => globalThis.contextMeterAPI.toggleModule('chinese', state.shellLanguage === 'zh-CN', { language: state.shellLanguage, brandTitle: bword })
            : null,
          liveRoute: '/toggle-module',
          body: { name: 'chinese', enable: state.shellLanguage === 'zh-CN', opts: { language: state.shellLanguage, brandTitle: bword } }
        });
        state.brandTitle = bword;
        renderStudioSpace();
        notify(res?.message || '已同步左上角品牌词配置');
      } catch (e) {
        notify(e?.message || '同步品牌词失败');
      }
    });
  });

  qsa('#themeCards .th-card').forEach(card => {
    card.addEventListener('click', () => {
      state.theme = card.dataset.th;
      applyThemeAndChroma();
      void persistUiAndPlanSettings();
    });
  });

  qsa('#chromaDots .c-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      state.chroma = dot.dataset.chroma;
      applyThemeAndChroma();
      void persistUiAndPlanSettings();
    });
  });

  el('btnOpenRepo')?.addEventListener('click', () => {
    const repoUrl = 'https://github.com/DDG0808/antigravity-viewer-pulse';
    if (typeof globalThis.contextMeterAPI?.openExternal === 'function') {
      void globalThis.contextMeterAPI.openExternal(repoUrl);
    } else {
      globalThis.open?.(repoUrl, '_blank', 'noopener');
    }
  });

  el('toggleAutoUpdate')?.addEventListener('click', () => {
    state.autoCheckUpdate = !state.autoCheckUpdate;
    el('toggleAutoUpdate')?.classList.toggle('on', state.autoCheckUpdate);
    void persistUiAndPlanSettings();
  });

  const triggerRestartHost = async () => {
    try {
      if (typeof globalThis.contextMeterAPI?.restartHost === 'function') {
        const res = await globalThis.contextMeterAPI.restartHost();
        if (res?.supported) {
          notify('正在平滑重启客户端...');
          return;
        }
      }
      notify('请手动退出并重新打开 Antigravity 客户端');
    } catch {
      notify('请手动重启 Antigravity 客户端');
    }
  };

  el('btnRestartBanner')?.addEventListener('click', triggerRestartHost);
  el('btnHardRestartHost')?.addEventListener('click', triggerRestartHost);

  async function checkReleaseUpdate({ silent = false, force = false } = {}) {
    if (!silent) notify('正在检查最新 Release...');
    try {
      const payload = { currentVersion: METER_VERSION, force: Boolean(force) };
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.checkUpdate === 'function'
          ? () => globalThis.contextMeterAPI.checkUpdate(payload)
          : null,
        liveRoute: '/check-update',
        body: payload
      });
      if (state.disposed) return res;
      if (res && res.ok === false) {
        if (!silent) notify(res.error || '检查更新失败');
        return res;
      }
      const tagEl = el('updateStateTag');
      const hotBtn = el('btnRunHotReload');
      const notesText = String(res?.releaseNotes || res?.body || '').trim();
      if (res?.hasUpdate && res.latestVersion) {
        state.latestRelease = res;
        if (el('updateBadgeDot')) el('updateBadgeDot').hidden = false;
        if (tagEl) { tagEl.className = 'tag'; tagEl.textContent = `发现新版本 v${res.latestVersion}`; }
        if (el('updateNotesBox') && notesText) el('updateNotesBox').textContent = notesText;
        if (hotBtn) { hotBtn.disabled = false; hotBtn.textContent = `免重启热更新至 v${res.latestVersion}`; }
        if (!silent) notify(`发现新版本 v${res.latestVersion}`);
      } else {
        if (el('updateBadgeDot')) el('updateBadgeDot').hidden = true;
        if (tagEl) { tagEl.className = 'tag neutral'; tagEl.textContent = `已是最新 v${METER_VERSION}`; }
        if (el('updateNotesBox') && !state.latestRelease) {
          el('updateNotesBox').textContent = `当前运行 v${METER_VERSION} 已是最新正式版本（自动订阅 DDG0808/antigravity-viewer-pulse Releases）。`;
        }
        if (hotBtn) { hotBtn.disabled = true; hotBtn.textContent = '当前已是最新版本'; }
        if (!silent) notify('当前已是最新版本');
      }
      return res;
    } catch (e) {
      if (!silent) notify(e?.message || '检查更新失败');
      return null;
    }
  }

  el('btnCheckUpdateNow')?.addEventListener('click', () => {
    void checkReleaseUpdate({ silent: false, force: true });
  });

  el('btnRunHotReload')?.addEventListener('click', async () => {
    const hotBtn = el('btnRunHotReload');
    if (hotBtn) hotBtn.disabled = true;
    const targetVersion = state.latestRelease?.latestVersion || undefined;
    notify(targetVersion ? `正在下载 v${targetVersion} 并校验 SHA-256...` : '正在下载并热切换 Live-Host 引擎...');
    try {
      const payload = { currentVersion: METER_VERSION, version: targetVersion };
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.applyUpdate === 'function'
          ? () => globalThis.contextMeterAPI.applyUpdate(payload)
          : null,
        liveRoute: '/apply-update',
        body: payload
      });
      if (res?.ok) {
        if (el('updateBadgeDot')) el('updateBadgeDot').hidden = true;
        if (!res.liveInjected || res.restartRequired) state.restartRequired = true;
        const tagEl = el('updateStateTag');
        if (tagEl && res.version) {
          tagEl.className = 'tag';
          tagEl.textContent = res.liveInjected ? `已热更新至 v${res.version}` : `已下载 v${res.version}（待重启生效）`;
        }
        renderCockpit();
        notify(res.liveInjected ? `免重启热更新至 v${res.version || targetVersion || ''} 成功！` : '更新已写入磁盘，重启客户端后生效');
      } else {
        if (hotBtn) hotBtn.disabled = false;
        notify(res?.error || '更新失败');
      }
    } catch (e) {
      if (hotBtn) hotBtn.disabled = false;
      notify(e?.message || '热更新异常');
    }
  });

  function onDocClick(e) {
    if (!state.hudOpen || state.dockMode === 'drawer') return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.includes(host)) return;
    toggleHud(false);
  }

  function onDocKeydown(e) {
    if (e.key !== 'Escape' || !state.hudOpen) return;
    if (state.openSheetId) {
      el(state.openSheetId)?.classList.remove('open');
      state.openSheetId = null;
      return;
    }
    toggleHud(false);
  }

  function onWinResize() {
    syncHudAnchorPosition();
  }

  document.addEventListener?.('click', onDocClick, true);
  document.addEventListener?.('keydown', onDocKeydown);
  globalThis.addEventListener?.('resize', onWinResize);

  // ==================== Main Heartbeat Loop ====================
  function tick() {
    if (state.disposed) return;
    ensureHostDocked();
    syncActiveModelIdentity();

    const nextRoute = getActiveConversationId();
    if (nextRoute !== state.route) {
      state.route = nextRoute;
      state.generation += 1;
      state.count = 0;
      state.latest = null;
      state.scan = null;
      state.sessionCallsMap.clear();
      state.pendingFinalCalls.clear();
      state.sessionCalls = [];
      state.sessionCostTotal = 0;
      state.lastRoundCost = 0;
      state.isStreaming = false;
      state.liveTps = null;
      state.liveTtft = null;
      state.liveOutTok = null;
      state.liveDurSec = null;
      state.wavePoints = [];
      host.setAttribute('data-streaming', 'false');
      state.requestNext = 0;
      state.scanNext = 0;
      renderCockpit();
    }

    const now = Date.now();
    if (state.route) {
      if (!state.requestBusy && now >= state.requestNext) {
        void pollTrajectory(state.generation, state.route);
      }
      if (!state.scanBusy && now >= state.scanNext) {
        void runSessionScan(state.generation, state.route, false);
      }
    }

    if (state.hudOpen && state.activeSpace === 'cockpit') {
      renderQuotaSection(now);
    }
  }

  const mainTimer = setInterval(tick, 1000);
  intervals.add(mainTimer);
  const quotaTimer = setInterval(() => {
    if (!document.hidden) void syncQuotaFromHost(false);
  }, 60000);
  intervals.add(quotaTimer);

  // ==================== Public Host Contract (`window.__AGContextMeter`) ====================
  function captureHotReloadState() {
    return {
      hudOpen: state.hudOpen,
      dockMode: state.dockMode,
      activeSpace: state.activeSpace,
      panelLang: state.panelLang,
      theme: state.theme,
      chroma: state.chroma
    };
  }

  function applyInheritedState(snap) {
    if (!snap || typeof snap !== 'object') return;
    if (snap.dockMode) { state.dockMode = snap.dockMode; host.setAttribute('data-mode', state.dockMode); }
    if (snap.activeSpace) switchSpace(snap.activeSpace);
    if (snap.panelLang) state.panelLang = normalizePulseLang(snap.panelLang);
    if (snap.theme) state.theme = snap.theme;
    if (snap.chroma) state.chroma = snap.chroma;
    if (snap.hudOpen) toggleHud(true);
  }

  async function verifyHotReloadAndRefreshQuota() {
    await syncStudioStatuses();
    await syncQuotaFromHost(true);
    return {
      rendererVersion: METER_VERSION,
      backendVersion: state.backendVersion,
      backendSource: state.backendSource
    };
  }

  globalThis.__AGContextMeter = {
    version: METER_VERSION,
    uiEngine: 'spatial-bento-v3',
    ensureAlive: () => {
      if (state.disposed) return false;
      return ensureHostDocked();
    },
    snapshot: () => {
      const cs = computeSessionCacheStats();
      return {
        version: METER_VERSION,
        route: state.route,
        count: state.count,
        latest: state.latest,
        scan: state.scan,
        hudOpen: state.hudOpen,
        activeSpace: state.activeSpace,
        dockMode: state.dockMode,
        activeProductKey: state.activeProductKey,
        lastInjectedLimit: state.lastInjectedLimit,
        liveTps: state.liveTps,
        liveTtft: state.liveTtft,
        sessionCalls: state.sessionCalls,
        sessionCostTotal: state.sessionCostTotal,
        roundCacheHitPct: cs.roundHitPct,
        sessionCacheHitPct: cs.sessHitPct,
        sessionCacheSavedUSD: cs.sessSavedUSD,
        cacheDropDetected: cs.cacheDropDetected
      };
    },
    captureHotReloadState,
    verifyHotReloadAndRefreshQuota,
    getPanelLanguage: () => state.panelLang,
    setPanelLanguage: (lang) => {
      state.panelLang = normalizePulseLang(lang);
      applyStaticTranslations();
      renderAll();
      return state.panelLang;
    },
    setModelBudgetForTest: async (modelOrProductKey, target, scope = 'per_model') => {
      state.budgetScope = scope;
      const prod = getProductByKey(modelOrProductKey);
      await saveAndApplyProductBudget(target, prod, { autoUnlockBinary: true });
      return resolveEffectiveTokensForProduct(prod);
    },
    getKnownProductsForTest: () => getKnownModelProducts().map(p => ({ productKey: p.productKey, label: p.label, maxTokens: p.maxTokens })),
    getBackendStatusForTest: () => ({
      backendSource: state.backendSource,
      backendVersion: state.backendVersion,
      hasLiveBridge: Boolean(getLiveBridge()),
      preferLiveHost: shouldPreferLive()
    }),
    getModelQuotaStateForTest: (nowMs) => ({
      pools: extractNormalizedPools(nowMs || Date.now()),
      error: state.quotaError
    }),
    setQuotaSnapshotForTest: (payload, nowMs) => {
      if (payload?.snapshot) state.quotaSnapshot = payload.snapshot;
      else state.quotaSnapshot = payload;
      if (Array.isArray(payload?.cascadeModelConfigs)) mergeCascadeConfigs(payload.cascadeModelConfigs);
      state.quotaFetchedAt = nowMs || Date.now();
      renderQuotaSection(state.quotaFetchedAt);
      renderBudgetSpace();
      return extractNormalizedPools(state.quotaFetchedAt);
    },
    openSpaceForTest: (sp) => {
      toggleHud(true);
      switchSpace(sp);
      return state.activeSpace;
    },
    pollTrajectoryForTest: () => pollTrajectory(state.generation, state.route),
    tickForTest: () => tick(),
    isDisposedForTest: () => state.disposed,
    dispose() {
      state.disposed = true;
      for (const tId of intervals) clearInterval(tId);
      intervals.clear();
      for (const c of controllers) {
        try { c.abort(); } catch {}
      }
      controllers.clear();
      clearTimeout(toastTimer);
      clearTimeout(autoUpdateTimer);
      uninstallRequestInterceptor();
      document.removeEventListener?.('click', onDocClick, true);
      document.removeEventListener?.('keydown', onDocKeydown);
      globalThis.removeEventListener?.('resize', onWinResize);
      try { host.remove(); } catch {}
    }
  };

  ensureHostDocked();
  installRequestInterceptor();
  applyThemeAndChroma();
  applyStaticTranslations();
  if (inheritedState) applyInheritedState(inheritedState);

  void restoreSettingsFromHost();
  void fetchAvailableModels();
  void syncQuotaFromHost(false);
  void syncTokenHistory(false);
  void syncStudioStatuses();
  tick();
})();
