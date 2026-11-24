'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Duplex } = require('node:stream');
const crypto = require('node:crypto');
const vm = require('node:vm');

const rootDir = __dirname;
const { buildRenderer } = require('./scripts/build-renderer');
const { PROJECT_VERSION } = require('./modules-config');

test('1. Build pipeline generates valid meter-renderer.js with zero native ugly form controls', () => {
  const res = buildRenderer({ rootDir });
  assert.equal(res.version, '0.10.0');
  assert.equal(PROJECT_VERSION, '0.10.0');
  assert.ok(fs.existsSync(res.targetFile), 'meter-renderer.js should exist');
  assert.ok(res.bytes > 40000, 'meter-renderer.js should contain complete bundled styles, template & logic');

  const bundled = fs.readFileSync(res.targetFile, 'utf8');
  assert.doesNotMatch(bundled, /<select[\s>]/i, 'Must not contain native <select>');
  assert.doesNotMatch(bundled, /type=["']checkbox["']/i, 'Must not contain native checkbox');
  assert.doesNotMatch(bundled, /type=["']color["']/i, 'Must not contain native color input');
  assert.doesNotMatch(bundled, /id=["']quickLimitBar["']/i, 'Cockpit must not duplicate Budget Space quick limit buttons');
  assert.doesNotMatch(bundled, /id=["']btnTopCli["']/i, 'Topbar capsule must not include the >_ CLI button');
});

test('2. Real Antigravity 2.32 payload regression: Quota snapshot+cascadeModelConfigs, Gemini 4 Hydrogen catalog, nested speed, and 512K auto-unlock', async () => {
  class MockClassList {
    constructor() { this.set = new Set(); }
    syncFromAttr(str) { this.set = new Set(String(str || '').split(/\s+/).filter(Boolean)); }
    add(...names) { names.forEach(n => this.set.add(n)); }
    remove(...names) { names.forEach(n => this.set.delete(n)); }
    toggle(name, force) {
      const next = force !== undefined ? Boolean(force) : !this.set.has(name);
      if (next) this.set.add(name); else this.set.delete(name);
      return next;
    }
    contains(name) { return this.set.has(name); }
  }

  class MockElement {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.dataset = {};
      this.attributes = new Map();
      this.style = { setProperty(k, v) { this[k] = v; }, getPropertyValue(k) { return this[k] || ''; } };
      this.classList = new MockClassList();
      this.children = [];
      this.parentNode = null;
      this.listeners = new Map();
      this.textContent = '';
      this._innerHTML = '';
      this.hidden = false;
      this.value = '';
    }
    setAttribute(k, v) {
      this.attributes.set(k, String(v));
      if (k === 'id') this.id = String(v);
      if (k === 'class') this.classList.syncFromAttr(v);
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camel] = String(v);
      }
    }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    appendChild(ch) { ch.parentNode = this; this.children.push(ch); return ch; }
    insertBefore(ch, ref) {
      ch.parentNode = this;
      const i = this.children.indexOf(ref);
      if (i >= 0) this.children.splice(i, 0, ch); else this.children.push(ch);
      return ch;
    }
    get firstChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    get isConnected() { return Boolean(this.parentNode); }
    contains(other) { return other === this; }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx >= 0) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    removeEventListener() {}
    getBoundingClientRect() { return { top: 6, bottom: 36, left: 900, right: 1180, width: 280, height: 30 }; }
    getContext() {
      return {
        save() {}, restore() {}, scale() {}, clearRect() {}, beginPath() {}, moveTo() {},
        quadraticCurveTo() {}, lineTo() {}, stroke() {}, closePath() {}, fill() {}, arc() {},
        setLineDash() {}, createLinearGradient() { return { addColorStop() {} }; }
      };
    }
    attachShadow() {
      const sr = new MockShadowRoot(this);
      this.shadowRoot = sr;
      return sr;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll() { return []; }
  }

  class MockShadowRoot extends MockElement {
    constructor(hostEl) {
      super('shadow-root');
      this.host = hostEl;
      this.byId = new Map();
      this.allNodes = [];
    }
    set innerHTML(html) {
      this._innerHTML = String(html);
      this.byId.clear();
      this.allNodes = [];
      const tagRe = /<([a-zA-Z0-9-]+)([^>]*)>/g;
      let m;
      while ((m = tagRe.exec(this._innerHTML))) {
        const node = new MockElement(m[1]);
        const attrRe = /([a-zA-Z0-9_-]+)=["']([^"']*)["']/g;
        let am;
        while ((am = attrRe.exec(m[2] || ''))) {
          node.setAttribute(am[1], am[2]);
        }
        if (node.id) this.byId.set(node.id, node);
        this.allNodes.push(node);
      }
    }
    get innerHTML() { return this._innerHTML; }
    getElementById(id) { return this.byId.get(id) || null; }
    querySelectorAll(sel) {
      if (sel.startsWith('#') && sel.includes(' .')) {
        const cls = sel.split(' .')[1];
        return this.allNodes.filter(n => n.classList.contains(cls));
      }
      if (sel === '#detentBtns button') {
        return this.allNodes.filter(n => n.tagName === 'BUTTON' && n.attributes.has('data-det'));
      }
      if (sel.startsWith('.dna-seg[data-seg="')) {
        const segVal = sel.match(/data-seg="([^"]+)"/)?.[1];
        return this.allNodes.filter(n => n.classList.contains('dna-seg') && n.dataset.seg === segVal);
      }
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return this.allNodes.filter(n => n.classList.contains(cls));
      }
      if (sel.startsWith('[') && sel.endsWith(']')) {
        const attr = sel.slice(1, -1);
        return this.allNodes.filter(n => n.attributes.has(attr));
      }
      return [];
    }
  }

  const titlebarRightSlot = new MockElement('div');
  titlebarRightSlot.setAttribute('class', 'shrink-0');
  const titlebar = new MockElement('header');
  titlebar.appendChild(titlebarRightSlot);
  titlebar.querySelector = (s) => (s.includes('shrink-0') ? titlebarRightSlot : null);

  const modelTrigger = new MockElement('button');
  modelTrigger.textContent = 'Gemini 4 Hydrogen (XHigh)';

  const bodyEl = new MockElement('body');
  let unlockApplyCalled = 0;
  let savedPayloads = [];
  let generatorRows = [{
    stepIndices: [1],
    chatModel: {
      model: 'MODEL_GEMINI_4_HYDROGEN',
      modelDisplayName: 'Gemini 4 Hydrogen (XHigh)',
      timeToFirstToken: '0.48s',
      streamingDuration: '9.60s',
      usage: { inputTokens: 15900, cacheReadTokens: 200000, outputTokens: 960 },
      chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 256000 } }
    }
  }];

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    DataView,
    ArrayBuffer,
    innerWidth: 1280,
    __APP_CONFIG__: { csrfToken: 'test-csrf' },
    location: { pathname: '/c/12345678-1234-1234-1234-123456789abc', origin: 'https://localhost:4100' },
    getComputedStyle: () => ({ getPropertyValue: () => '#38bdf8' }),
    fetch: async (url) => {
      if (String(url).includes('GetCascadeTrajectoryGeneratorMetadata')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ generatorMetadata: generatorRows })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    },
    contextMeterAPI: {
      getSettings: async () => ({ ok: true, uiPreferences: {}, contextPreferences: {}, contextScopeMode: 'per_model' }),
      saveSettings: async (p) => { savedPayloads.push(p); return { ok: true }; },
      getQuota: async () => ({
        ok: true,
        data: {
          ok: true,
          snapshot: {
            pools: [
              {
                poolKey: 'shared_gemini_main',
                title: 'Gemini 主力共享池',
                remainingFraction: 0.82,
                percentText: '82%',
                buckets: [
                  { windowShort: '5h', remainingFraction: 0.82, resetTimeIso: new Date(Date.now() + 7200000).toISOString() },
                  { windowShort: '周配额', remainingFraction: 0.74 }
                ],
                models: [{ productKey: 'product:google:gemini-4-hydrogen', productLabel: 'Gemini 4 Hydrogen' }]
              },
              {
                poolKey: 'shared_3p_pool',
                title: 'Claude / 第三方池',
                remainingFraction: 0.45,
                percentText: '45%',
                buckets: [{ windowShort: '5h', remainingFraction: 0.45, resetTimeIso: new Date(Date.now() + 14400000).toISOString() }],
                models: []
              }
            ]
          },
          cascadeModelConfigs: [
            { modelId: 'MODEL_GEMINI_4_HYDROGEN', label: 'Gemini 4 Hydrogen (XHigh)', maxTokens: 1048576, maxOutputTokens: 65536 },
            { modelId: 'MODEL_GEMINI_3_8_FLASH', label: 'Gemini 3.8 Flash', maxTokens: 1048576, maxOutputTokens: 65536 }
          ]
        }
      }),
      getTokenHistory: async () => ({
        ok: true,
        data: {
          daily: { '2026-11-17': { inputTokens: 120000, cacheTokens: 340000, outputTokens: 25000, totalTokens: 485000, costUSD: 0.45 } },
          speedRecords: [
            { callId: 'c1', model: 'Gemini 4 Hydrogen (XHigh)', outputTokens: 960, durationSec: 10.08, tps: 95.2, ttftSec: 0.48, timestamp: Date.now() - 5000 }
          ]
        }
      }),
      getContextUnlockStatus: async () => ({ ok: true, data: { unlocked: false, configuredMode: 'default' } }),
      applyContextUnlock: async () => { unlockApplyCalled++; return { ok: true }; },
      restartLanguageServers: async () => ({ ok: true }),
      getEnhanceStatus: async () => ({ ok: true, data: { promptTier: 3, chineseTitle: true } }),
      getModulesStatus: async () => ({ ok: true, data: { modules: { proxy: { enabled: false }, chinese: { language: 'en', brandTitle: 'english' } } } }),
      getRuntimeInfo: async () => ({ ok: true, backendSource: 'electron-ipc', backendVersion: '0.9.0' }),
      scan: async () => ({ ok: true, data: { estimatedTotal: 215900, session: { files: [] } } })
    },
    document: {
      hidden: false,
      body: bodyEl,
      documentElement: bodyEl,
      createElement: (tag) => new MockElement(tag),
      getElementById: () => null,
      querySelector: (sel) => (sel.includes('@container/titlebar') ? titlebar : null),
      querySelectorAll: (sel) => (sel.includes('model-selector-trigger') ? [modelTrigger] : []),
      addEventListener() {},
      removeEventListener() {}
    },
    addEventListener() {},
    removeEventListener() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const coreCode = fs.readFileSync(path.join(rootDir, 'meter-core.js'), 'utf8');
  const rendererCode = fs.readFileSync(path.join(rootDir, 'meter-renderer.js'), 'utf8');

  vm.createContext(sandbox);
  vm.runInContext(coreCode, sandbox, { filename: 'meter-core.js' });
  vm.runInContext(rendererCode, sandbox, { filename: 'meter-renderer.js' });

  await new Promise(r => setTimeout(r, 80));

  const api = sandbox.__AGContextMeter;
  try {
    const snap = api.snapshot();
    assert.equal(snap.liveTps, 95.2, `Expected exact end-to-end 95.2 tok/s, got ${snap.liveTps}`);
    assert.equal(snap.liveTtft, 0.48, 'Expected TTFT 0.48s from chatModel.timeToFirstToken');

    const quotaState = api.getModelQuotaStateForTest();
    assert.equal(quotaState.pools.length, 2, 'Both shared quota pools must render');
    assert.equal(quotaState.pools[0].pct, 74, 'Tightest bucket (weekly 74% < 5h 82%) drives primary alert pct');
    assert.equal(quotaState.pools[0].bucket5h?.pctLabel, '82%', 'Must expose 5h bucket percentage');
    assert.equal(quotaState.pools[0].bucketWeekly?.pctLabel, '74%', 'Must expose Weekly bucket percentage');
    const hostEl = titlebarRightSlot.children.find(n => n.id === 'ag-context-meter');
    const trioGrid = hostEl?.shadowRoot?.getElementById('quotaTrioGrid');
    assert.match(trioGrid?.innerHTML || '', /<strong>5h<\/strong>/, 'Quota card DOM must render 5h bar row');
    assert.match(trioGrid?.innerHTML || '', /<strong>周<\/strong>/, 'Quota card DOM must render Weekly bar row');

    const products = api.getKnownProductsForTest();
    assert.ok(products.some(p => p.label.includes('Gemini 4 Hydrogen')), 'Must discover Gemini 4 Hydrogen from host');

    const effTok = await api.setModelBudgetForTest(snap.activeProductKey, 512000, 'per_model');
    assert.equal(effTok, 512000);
    assert.equal(unlockApplyCalled, 1, 'Selecting 512K while binary is locked at 256K must auto-trigger applyContextUnlock');
    assert.ok(savedPayloads.some(p => p.contextPreference?.limitTokens === 512000), 'Must persist contextPreference with limitTokens: 512000');

    const mockReq = { cascadeId: '12345678-1234-1234-1234-123456789abc', items: [{ text: 'hi' }] };
    const hookRes = sandbox.__AG_METER_ON_SEND_MESSAGE__(mockReq, 'client_object');
    assert.ok(hookRes?.dispatchId, 'Client decorator hook must succeed (not uninjectable)');
    assert.equal(mockReq.cascadeConfig?.checkpointConfig?.maxTokenLimit, 512000, 'Must actually write maxTokenLimit=512000 onto SendUserCascadeMessage payload');
    assert.equal(api.snapshot().lastInjectedLimit, 512000);

    const turn1NewConvReq = { cascadeId: '99999999-8888-7777-6666-555555555555', items: [{ text: 'new chat' }] };
    sandbox.__AG_METER_ON_SEND_MESSAGE__(turn1NewConvReq, 'client_object');
    assert.equal(turn1NewConvReq.cascadeConfig?.checkpointConfig?.maxTokenLimit, 512000, 'Brand-new conversation Turn 1 must also inject 512000');

    const snapTurn1 = api.snapshot();
    assert.ok(snapTurn1.roundCacheHitPct > 92.5 && snapTurn1.roundCacheHitPct < 92.7, `Expected ~92.6% cache hit, got ${snapTurn1.roundCacheHitPct}`);
    assert.ok(snapTurn1.sessionCacheSavedUSD > 0.25, `Expected > $0.25 cache savings, got ${snapTurn1.sessionCacheSavedUSD}`);
    assert.equal(snapTurn1.cacheDropDetected, false);

    generatorRows.push({
      stepIndices: [2],
      chatModel: {
        model: 'MODEL_GEMINI_4_HYDROGEN',
        modelDisplayName: 'Gemini 4 Hydrogen (XHigh)',
        timeToFirstToken: '0.92s',
        streamingDuration: '6.40s',
        usage: { inputTokens: 218000, cacheReadTokens: 0, outputTokens: 640 },
        chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 512000 } }
      }
    });
    await api.pollTrajectoryForTest();
    const snapTurn2 = api.snapshot();
    assert.equal(snapTurn2.roundCacheHitPct, 0, 'Turn 2 with 0 cacheReadTokens must report 0% hit rate (no stale carryover)');
    assert.equal(snapTurn2.cacheDropDetected, true, 'Must flag sudden multi-turn cache invalidation drop');
    assert.equal(hostEl?.shadowRoot?.getElementById('heroCacheHitPct')?.textContent, '46.1%', 'Cockpit upfront cache pct must display whole-session hit rate');
    assert.equal(hostEl?.shadowRoot?.getElementById('audSessCachePct')?.textContent, '46.1%', 'Audit sheet top banner must display whole-session hit rate');
    assert.match(hostEl?.shadowRoot?.getElementById('audCacheRate')?.textContent || '', /^0\.0%/, 'Audit sheet latest-request row must display latest single request 0.0%');

    generatorRows.push({
      stepIndices: [3],
      chatModel: {
        model: 'MODEL_GEMINI_4_HYDROGEN',
        modelDisplayName: 'Gemini 4 Hydrogen (XHigh)',
        timeToFirstToken: '15.0s',
        streamingDuration: '2.0s',
        usage: { inputTokens: 12000, cacheReadTokens: 210000, outputTokens: 2550, thinkingOutputTokens: 2200, responseOutputTokens: 350 },
        chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 512000 } }
      }
    });
    await api.pollTrajectoryForTest();
    const snapThinking = api.snapshot();
    assert.equal(snapThinking.liveTps, 150.0, 'XHigh thinking turn must report end-to-end 150.0 tok/s, never inflated 1275.0 tok/s');
    assert.equal(snapThinking.liveTtft, 15.0);

    generatorRows = [];
    sandbox.location.pathname = '/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    api.tickForTest();
    await api.pollTrajectoryForTest();
    const snapEmptyChat = api.snapshot();
    assert.equal(snapEmptyChat.liveTps, null, 'Empty new conversation must reset liveTps to null instead of borrowing historical speedRecords');
    assert.equal(snapEmptyChat.liveTtft, null, 'Empty new conversation must reset liveTtft to null');
  } finally {
    api.dispose();
  }
});

test('3. Post-update resilience: stale DevToolsActivePort fallback, WebContentsView (type: other) target match, zero-Origin 330KB+ CDP frame, and refactored utils.js cleaning', async () => {
  const {
    LOOPBACK_IPV4,
    discoverCdpTargets,
    openCdpSession
  } = require('./local-api');
  const {
    TAGS,
    generateMeterUtilsCode,
    cleanUtilsSource,
    verifyCleanStructure,
    validateSyntax
  } = require('./modular-installer');
  const { formatLiveFailureDiagnostic } = require('./cli');

  // Part A: Verify refactored post-update dist/utils.js (no 4-space `void win.loadURL(url);` or `setupNodeWrapper`) passes verifyCleanStructure & round-trips cleanly
  const refactoredHostUtils = `"use strict";
const { BaseWindow, WebContentsView } = require("electron");
async function createModernHubWindow(targetUrl) {
  const win = new BaseWindow({ width: 1280, height: 840 });
  const view = new WebContentsView();
  win.contentView.addChildView(view);
  await view.webContents.loadURL(targetUrl);
  return win;
}
module.exports = { createModernHubWindow };
`;
  assert.equal(verifyCleanStructure(refactoredHostUtils), true, 'Refactored modern dist/utils.js must pass verifyCleanStructure');
  const meterUtils = generateMeterUtilsCode();
  const injectedUtils = refactoredHostUtils.replace('"use strict";', `"use strict";\n${meterUtils.startupBootstrapBlock}`);
  assert.equal(validateSyntax(injectedUtils, 'dist/utils.js'), true, 'Injected modern dist/utils.js must be valid JS');
  assert.ok(injectedUtils.includes(TAGS.METER_UTILS_START), 'Must include METER_UTILS_START tag');
  assert.ok(injectedUtils.includes('remote-debugging-port'), 'Must auto-enable loopback CDP switch for future live sessions');
  const cleanedBack = cleanUtilsSource(injectedUtils);
  assert.equal(verifyCleanStructure(cleanedBack), true, 'Cleaned modern dist/utils.js must pass verifyCleanStructure');
  assert.equal(cleanedBack, refactoredHostUtils, 'cleanUtilsSource must restore exact original modern dist/utils.js');

  // Part B: Verify discoverCdpTargets skips dead stale DevToolsActivePort (45111) and selects live fallback port (9222) + WebContentsView target (type: "other")
  const tmpAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-pulse-cdp-test-'));
  try {
    const agDir = path.join(tmpAppData, 'Antigravity');
    fs.mkdirSync(agDir, { recursive: true });
    fs.writeFileSync(path.join(agDir, 'DevToolsActivePort'), '45111\n/devtools/browser/stale\n', 'utf8');

    const discovery = await discoverCdpTargets({
      appDataDir: tmpAppData,
      allowTestPorts: true,
      fallbackPorts: [9222],
      _fetchJsonList: async (port) => {
        if (port === 45111) {
          const err = new Error('connect ECONNREFUSED');
          err.code = 'ECONNREFUSED';
          throw err;
        }
        if (port === 9222) {
          return [
            {
              id: 'devtools-1',
              type: 'page',
              url: 'devtools://devtools/bundled/inspector.html',
              webSocketDebuggerUrl: `ws://${LOOPBACK_IPV4}:9222/devtools/page/devtools-1`
            },
            {
              id: 'hub-wcv-1',
              type: 'other',
              title: 'Antigravity',
              url: 'http://localhost:51234/c/chat-1',
              webSocketDebuggerUrl: `ws://${LOOPBACK_IPV4}:9222/devtools/page/hub-wcv-1`
            }
          ];
        }
        throw new Error('unexpected port');
      }
    });

    assert.equal(discovery.ok, true, 'Must skip dead DevToolsActivePort and discover live fallback port');
    assert.equal(discovery.port, 9222);
    assert.equal(discovery.stalePorts.length, 1, 'Must record dead DevToolsActivePort in stalePorts');
    assert.equal(discovery.matchedTargets.length, 1, 'Must match WebContentsView target (type: other) and ignore devtools://');
    assert.equal(discovery.matchedTargets[0].id, 'hub-wcv-1');
    assert.deepEqual(discovery.origins, ['http://localhost:51234']);

    // Verify diagnostic formatter gives actionable commands when CDP is disabled post-update
    const diagText = formatLiveFailureDiagnostic({
      reason: 'cdp_port_unreachable',
      stalePorts: discovery.stalePorts
    }, {});
    assert.match(diagText, /npm run install:plugin/);
    assert.match(diagText, /npm run live:relaunch/);

    // Part C: Test zero-Origin HTTP Upgrade + 64-bit (>65KB, 330KB) RFC6455 frame over in-memory Duplex socket pair
    function createSocketPair() {
      let peerA = null;
      let peerB = null;
      peerA = new Duplex({
        read() {},
        write(chunk, _enc, cb) { peerB.push(chunk); cb(); },
        final(cb) { peerB.push(null); cb(); }
      });
      peerB = new Duplex({
        read() {},
        write(chunk, _enc, cb) { peerA.push(chunk); cb(); },
        final(cb) { peerA.push(null); cb(); }
      });
      peerA.setNoDelay = () => {};
      peerB.setNoDelay = () => {};
      return [peerA, peerB];
    }

    let sawOriginHeader = false;
    let receivedPayloadLen = 0;

    const session = await openCdpSession(
      discovery.matchedTargets[0].webSocketDebuggerUrl,
      3000,
      {
        _createConnection: () => {
          const [clientSock, serverSock] = createSocketPair();
          let upgraded = false;
          let rx = Buffer.alloc(0);
          serverSock.on('data', (chunk) => {
            rx = Buffer.concat([rx, chunk]);
            if (!upgraded) {
              const idx = rx.indexOf('\r\n\r\n');
              if (idx < 0) return;
              const rawHeaders = rx.subarray(0, idx).toString('utf8');
              rx = rx.subarray(idx + 4);
              if (/^Origin:/im.test(rawHeaders)) {
                sawOriginHeader = true;
                serverSock.write('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
                serverSock.end();
                return;
              }
              const keyMatch = rawHeaders.match(/Sec-WebSocket-Key:\s*([^\r\n]+)/i);
              const accept = crypto
                .createHash('sha1')
                .update(String(keyMatch?.[1] || '').trim() + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
                .digest('base64');
              upgraded = true;
              serverSock.write(
                'HTTP/1.1 101 Switching Protocols\r\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
              );
            }
            while (rx.length >= 2) {
              const opcode = rx[0] & 0x0f;
              const masked = (rx[1] & 0x80) !== 0;
              let len = rx[1] & 0x7f;
              let off = 2;
              if (len === 126) {
                if (rx.length < 4) return;
                len = rx.readUInt16BE(2);
                off = 4;
              } else if (len === 127) {
                if (rx.length < 10) return;
                len = Number(rx.readBigUInt64BE(2));
                off = 10;
              }
              const maskOff = off;
              if (masked) off += 4;
              if (rx.length < off + len) return;
              const data = Buffer.from(rx.subarray(off, off + len));
              if (masked) {
                const m = rx.subarray(maskOff, maskOff + 4);
                for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3];
              }
              rx = rx.subarray(off + len);
              if (opcode === 0x08) {
                serverSock.end();
                return;
              }
              if (opcode === 0x01) {
                const parsed = JSON.parse(data.toString('utf8'));
                receivedPayloadLen = Math.max(receivedPayloadLen, String(parsed?.params?.expression || '').length);
                const reply = Buffer.from(JSON.stringify({
                  id: parsed.id,
                  result: { result: { type: 'object', value: { ok: true, len: receivedPayloadLen } } }
                }), 'utf8');
                const hdr = reply.length < 126
                  ? Buffer.from([0x81, reply.length])
                  : (() => { const b = Buffer.alloc(4); b[0] = 0x81; b[1] = 126; b.writeUInt16BE(reply.length, 2); return b; })();
                // Deliberately split server frame into 2 chunks to verify multi-chunk reassembly
                const fullFrame = Buffer.concat([hdr, reply]);
                serverSock.write(fullFrame.subarray(0, 7));
                serverSock.write(fullFrame.subarray(7));
              }
            }
          });
          setImmediate(() => clientSock.emit('connect'));
          return clientSock;
        }
      }
    );

    try {
      const largeBundle = '/*' + 'x'.repeat(330000) + '*/ 1+1;';
      const evalRes = await session.evaluate(largeBundle, 4000);
      assert.equal(sawOriginHeader, false, 'openCdpSession must NOT send Origin header');
      assert.equal(receivedPayloadLen, largeBundle.length, '64-bit masked RFC6455 frame must deliver full 330KB+ bundle intact');
      assert.equal(evalRes?.result?.result?.value?.ok, true);
    } finally {
      session.close();
    }
  } finally {
    fs.rmSync(tmpAppData, { recursive: true, force: true });
  }
});

test('4. Online update system (DDG0808/antigravity-viewer-pulse), ZIP integrity & zero privacy leakage audit', async () => {
  const { execFileSync } = require('node:child_process');
  const core = require('./meter-core');
  const { validateManifest } = require('./scripts/check-release-manifest');
  const { createZipArchive } = require('./scripts/package-release');

  const repoBase = 'https://github.com/DDG0808/antigravity-viewer-pulse';
  assert.deepEqual(core.parseSemver('v0.9.0'), { major: 0, minor: 9, patch: 0 });
  assert.deepEqual(core.parseSemver('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.equal(core.compareVersions('0.10.0', '0.9.1'), 1);
  assert.equal(core.compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(core.compareVersions('0.9.0', '0.9.0'), 0);

  const mockReleases = [
    {
      tag_name: 'v0.9.1',
      draft: false,
      prerelease: false,
      html_url: `${repoBase}/releases/tag/v0.9.1`,
      body: 'Previous release',
      assets: []
    },
    {
      tag_name: 'v0.10.0',
      draft: false,
      prerelease: false,
      html_url: `${repoBase}/releases/tag/v0.10.0`,
      body: '### Release v0.10.0',
      assets: [
        { name: 'antigravity-viewer-pulse_0.10.0_darwin_arm64.zip', browser_download_url: `${repoBase}/releases/download/v0.10.0/antigravity-viewer-pulse_0.10.0_darwin_arm64.zip` },
        { name: 'antigravity-viewer-pulse_0.10.0_windows_amd64.zip', browser_download_url: `${repoBase}/releases/download/v0.10.0/antigravity-viewer-pulse_0.10.0_windows_amd64.zip` },
        { name: 'checksums.txt', browser_download_url: `${repoBase}/releases/download/v0.10.0/checksums.txt` }
      ]
    }
  ];

  const filtered = core.filterReleases(mockReleases, '0.9.1');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].version, '0.10.0');

  const matchedDarwin = core.findReleaseAsset(filtered[0].assets, 'darwin', 'arm64');
  assert.equal(matchedDarwin.packageAsset?.name, 'antigravity-viewer-pulse_0.10.0_darwin_arm64.zip');
  assert.equal(matchedDarwin.checksumAsset?.name, 'checksums.txt');

  const matchedWin = core.findReleaseAsset(filtered[0].assets, 'win32', 'x64');
  assert.equal(matchedWin.packageAsset?.name, 'antigravity-viewer-pulse_0.10.0_windows_amd64.zip');

  assert.equal(core.isValidExternalUrl(repoBase), true);
  assert.equal(core.isValidExternalUrl(`${repoBase}/releases/tag/v0.9.0`), true);

  const manifestInfo = validateManifest();
  assert.equal(manifestInfo.version, '0.10.0');
  assert.ok(manifestInfo.liveRuntimeFiles.includes('scripts/macos-setup.js'));
  assert.ok(manifestInfo.liveRuntimeFiles.includes('meter-renderer.js'));

  const tmpZipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-zip-test-'));
  try {
    const testZipPath = path.join(tmpZipDir, 'antigravity-viewer-pulse_0.10.0_darwin_arm64.zip');
    createZipArchive(testZipPath, [
      { src: path.join(rootDir, 'package.json'), arc: 'package.json' },
      { src: path.join(rootDir, 'install.sh'), arc: 'install.sh' }
    ]);
    assert.ok(fs.existsSync(testZipPath));
    if (process.platform !== 'win32') {
      execFileSync('unzip', ['-t', testZipPath], { stdio: 'pipe' });
    }
    const zipHash = crypto.createHash('sha256').update(fs.readFileSync(testZipPath)).digest('hex');
    const checksumLine = `${zipHash}  antigravity-viewer-pulse_0.10.0_darwin_arm64.zip`;
    assert.match(checksumLine, /^[0-9a-f]{64}\s+antigravity-viewer-pulse_0\.10\.0_darwin_arm64\.zip$/);
  } finally {
    fs.rmSync(tmpZipDir, { recursive: true, force: true });
  }

  const ignoredNames = new Set(['.git', 'node_modules', 'dist', 'releases', 'release-artifacts', 'backups', 'backup', 'logs', '.DS_Store']);
  const forbiddenFiles = new Set(['installation.json', '.live-session.json']);
  const homePrefix = ['', 'Users', ''].join('/');
  const leakPatterns = [
    { label: 'macOS personal user path', re: new RegExp(homePrefix + '(?!Shared)[A-Za-z0-9._-]{3,}') },
    { label: 'Windows personal user path', re: /C:\\Users\\(?!<|YourName|Public|Administrator)[A-Za-z0-9._-]{3,}/i },
    { label: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
    { label: 'Cloud API key', re: /(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,})/ }
  ];

  function auditDir(dirPath) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (ignoredNames.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(rootDir, fullPath);
      if (relPath === 'pulse-renderer.test.js') continue;
      assert.ok(!forbiddenFiles.has(entry.name), `Forbidden local state file present: ${relPath}`);
      assert.ok(!entry.name.endsWith('.backup') && !entry.name.endsWith('.asar'), `Forbidden backup/asar file present: ${relPath}`);
      if (entry.isDirectory()) {
        auditDir(fullPath);
      } else if (entry.isFile()) {
        if (/\.(png|jpe?g|gif|webp|ico|exe)$/i.test(entry.name)) continue;
        const text = fs.readFileSync(fullPath, 'utf8');
        for (const item of leakPatterns) {
          const hit = text.match(item.re);
          assert.equal(hit, null, `Potential privacy/secret leak [${item.label}] in ${relPath}: ${hit ? hit[0] : ''}`);
        }
      }
    }
  }

  auditDir(rootDir);
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/preview.png')), 'Missing assets/preview.png');
  assert.match(fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8'), /assets\/preview\.png/);
});

test('5. Security & host infrastructure regressions: zero remote-allow-origins=*, symlink/exec ASAR round-trip, macOS .app path resolution & user-space file locks', () => {
  const { builtinAsar, findAsarPath } = require('./asar-engine');
  const { acquireFileLock } = require('./modules-config');
  const { withFileLockSync } = require('./meter-storage');

  // Verify CSWSH RCE switch is completely absent across installer, CLI, and daemon launcher
  for (const rel of ['modular-installer.js', 'cli.js', 'scripts/macos-setup.js']) {
    const src = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    assert.doesNotMatch(src, /remote-allow-origins/i, `${rel} must never set remote-allow-origins`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-pulse-sec-'));
  const prevStateEnv = process.env.AG_METER_STATE_DIR;
  try {
    const customStateDir = path.join(tmpDir, 'state-root');
    process.env.AG_METER_STATE_DIR = customStateDir;

    // 1. Verify acquireFileLock writes into user-space state locks dir, NOT alongside read-only/watched target
    const watchedTarget = path.join(tmpDir, 'watched-resources', 'app.asar');
    fs.mkdirSync(path.dirname(watchedTarget), { recursive: true });
    fs.writeFileSync(watchedTarget, 'dummy');
    const lockHandle = acquireFileLock(watchedTarget, 2000);
    try {
      assert.equal(
        fs.existsSync(`${watchedTarget}.lock`),
        false,
        'acquireFileLock must not create .lock inside watched/read-only target directory'
      );
      const lockDir = path.join(customStateDir, 'locks');
      assert.ok(fs.existsSync(lockDir) && fs.readdirSync(lockDir).length === 1, 'Lock must live in stateDir/locks');
    } finally {
      lockHandle.release();
    }

    // 2. Verify meter-storage withFileLockSync does NOT steal active lock when process.kill throws EPERM
    const storageTarget = path.join(tmpDir, 'ledger.json');
    const storageLockFile = `${path.resolve(storageTarget)}.lock`;
    fs.writeFileSync(storageLockFile, `${process.pid}:${Date.now()}`, 'utf8');
    const origKill = process.kill;
    process.kill = () => {
      const err = new Error('Operation not permitted');
      err.code = 'EPERM';
      throw err;
    };
    try {
      assert.throws(
        () => withFileLockSync(storageTarget, () => {}, 35),
        /获取文件写锁超时/,
        'EPERM on live foreign PID must treat lock as active, never unlink it'
      );
      assert.equal(fs.existsSync(storageLockFile), true);
    } finally {
      process.kill = origKill;
      fs.rmSync(storageLockFile, { force: true });
    }

    // 3. Verify findAsarPath resolves macOS .app bundle and rejects bare non-app directory
    const fakeApp = path.join(tmpDir, 'Antigravity.app');
    const fakeAsar = path.join(fakeApp, 'Contents', 'Resources', 'app.asar');
    fs.mkdirSync(path.dirname(fakeAsar), { recursive: true });
    fs.writeFileSync(fakeAsar, 'asar-bytes');
    assert.equal(findAsarPath(fakeApp), fakeAsar);
    const emptyDir = path.join(tmpDir, 'not-an-app');
    fs.mkdirSync(emptyDir, { recursive: true });
    assert.throws(() => findAsarPath(emptyDir), /Could not find app\.asar inside directory/);

    // 4. Verify builtinAsar round-trips symlinks and executable permissions without Buffer.alloc(undefined) crash
    if (process.platform !== 'win32') {
      const srcPkg = path.join(tmpDir, 'pkg-src');
      const binDir = path.join(srcPkg, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      const runSh = path.join(binDir, 'run.sh');
      fs.writeFileSync(runSh, '#!/bin/sh\necho ok\n', { mode: 0o755 });
      fs.chmodSync(runSh, 0o755);
      fs.symlinkSync('run.sh', path.join(binDir, 'run-link'));

      const archiveOut = path.join(tmpDir, 'bundle.asar');
      const extractOut = path.join(tmpDir, 'pkg-extracted');
      builtinAsar.createPackageWithOptions(srcPkg, archiveOut, {});
      builtinAsar.extractAll(archiveOut, extractOut);

      const extractedLink = path.join(extractOut, 'bin', 'run-link');
      const extractedRun = path.join(extractOut, 'bin', 'run.sh');
      assert.equal(fs.lstatSync(extractedLink).isSymbolicLink(), true, 'Symlink must be preserved in ASAR');
      assert.equal(fs.readlinkSync(extractedLink), 'run.sh');
      assert.ok((fs.statSync(extractedRun).mode & 0o111) !== 0, 'Executable bit must be preserved in ASAR');
    }
  } finally {
    if (prevStateEnv === undefined) delete process.env.AG_METER_STATE_DIR;
    else process.env.AG_METER_STATE_DIR = prevStateEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('6. Collector, attachment XML/ZIP-bomb defense & core ledger/quota/FX regressions', async () => {
  const { execFileSync } = require('node:child_process');
  const zipfileCode = [
    'import json, os, sys, tempfile, zipfile',
    'd = tempfile.mkdtemp()',
    'docx_bomb = os.path.join(d, "xxe.docx")',
    'with zipfile.ZipFile(docx_bomb, "w") as z:',
    '    z.writestr("word/document.xml", \'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "boom">]><w:document><w:t>hello</w:t></w:document>\')',
    'print(docx_bomb)'
  ].join('\n');

  const core = require('./meter-core');
  const { collect } = require('./meter-collector');

  // 1. Sub-second Protobuf Duration (<1s with omitted seconds: 0) & streamingTps vs end-to-end tps
  assert.equal(core.parseDurationSec({ nanos: 180000000 }), 0.18);
  assert.equal(core.parseDurationSec({ seconds: '1', nanos: 250000000 }), 1.25);

  const callParsed = core.parseGeneratorCall({
    stepIndices: [1],
    chatModel: {
      model: 'MODEL_GEMINI_3_1_PRO',
      modelDisplayName: 'Gemini 3.1 Pro',
      timeToFirstToken: { nanos: 200000000 },
      streamingDuration: { seconds: 1, nanos: 800000000 },
      usage: { inputTokens: 4000, cacheReadTokens: 16000, outputTokens: 200 }
    }
  }, 'conv-1', 'desktop');
  assert.equal(callParsed.ttftSec, 0.2);
  assert.equal(callParsed.streamingSec, 1.8);
  assert.equal(callParsed.durationSec, 2.0);
  assert.equal(callParsed.tps, 100, 'End-to-end tps = 200 / (0.2 + 1.8) = 100');
  assert.ok(Math.abs(callParsed.streamingTps - (200 / 1.8)) < 0.2, 'streamingTps must reflect pure streaming phase rate');

  const emptyOutputCall = core.parseGeneratorCall({
    stepIndices: [2],
    chatModel: {
      model: 'MODEL_GEMINI_3_1_PRO',
      timeToFirstToken: '0.5s',
      streamingDuration: '0.4s',
      usage: { inputTokens: 1000, outputTokens: 0 }
    }
  }, 'conv-1', 'desktop');
  assert.notEqual(emptyOutputCall.status, 'final', '0-output turn without finish signal must not be marked final');

  // 2. Summarize explicit zero cacheReadTokens on Turn 2 vs missing usage
  const prevSummary = core.summarize({
    chatModel: {
      model: 'MODEL_GEMINI_3_1_PRO',
      usage: { inputTokens: 10000, cacheReadTokens: 50000, outputTokens: 500 },
      chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 256000 } }
    }
  });
  assert.equal(prevSummary.cached, 50000);
  const turn2ZeroCache = core.summarize({
    chatModel: {
      model: 'MODEL_GEMINI_3_1_PRO',
      usage: { inputTokens: 62000, cacheReadTokens: 0, outputTokens: 300 },
      chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 256000 } }
    }
  }, { previousValidContext: prevSummary });
  assert.equal(turn2ZeroCache.cached, 0, 'Explicit 0 cacheReadTokens must never inherit previous turn cached tokens');

  // 3. Cache write surcharge & net cache savings
  const writeHeavyCost = core.calculateRequestApiCost({
    model: 'claude-opus-5-5',
    inputTokens: 10000,
    cacheReadTokens: 0,
    cacheWriteTokens: 100000,
    outputTokens: 1000
  });
  const plainCost = core.calculateRequestApiCost({
    model: 'claude-opus-5-5',
    inputTokens: 110000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 1000
  });
  assert.ok(writeHeavyCost.costUSD > plainCost.costUSD, 'Cache write surcharge must exceed plain input cost on cold write');
  const netSavedOnColdWrite = core.calculateNetCacheSavedUSD({
    model: 'claude-opus-5-5',
    inputTokens: 10000,
    cacheReadTokens: 0,
    cacheWriteTokens: 100000,
    outputTokens: 1000
  });
  assert.ok(netSavedOnColdWrite < 0, 'Cold cache write with zero cache reads has negative net savings');

  // 4. Region search collision fix ("China" -> CN, "United Kingdom" -> GB, never hijacked by "in" -> India)
  assert.equal(core.findRegionPreset('China')?.id, 'CN');
  assert.equal(core.findRegionPreset('United Kingdom')?.id, 'GB');
  assert.equal(core.findRegionPreset('India')?.id, 'IN');

  // 5. Epoch-zero quota resetTime exclusion & 168_hours bucket merging
  const parsedEpochZero = core.parseQuotaFraction({ resetTime: '1970-01-01T00:00:00Z' }, { schemaKind: 'codeium_quota_info' });
  assert.equal(parsedEpochZero.isExhausted, false, '1970 epoch zero timestamp must not trigger proto3 zero exhaustion');
  assert.equal(core.formatQuotaResetMeta('1970-01-01T00:00:00Z').hasResetTime, false, '1970 epoch zero must have hasResetTime=false');
  const multiWinSnap = core.buildModelQuotaSnapshot({
    quotaSummaryRes: {
      groups: [
        { groupId: 'gemini_hydrogen_a', displayName: 'Gemini Hydrogen', buckets: [{ bucketId: 'b5h', window: '5_hours', remainingFraction: 0.8 }] },
        { groupId: 'gemini_hydrogen_b', displayName: 'Gemini Hydrogen', buckets: [{ bucketId: 'b168h', window: '168_hours', remainingFraction: 0.6 }] }
      ]
    },
    cascadeModelConfigs: [{ modelId: 'MODEL_GEMINI_4_HYDROGEN', label: 'Gemini 4 Hydrogen' }]
  });
  assert.ok(multiWinSnap.pools[0].buckets.some(b => b.windowKey === 'weekly'), '168_hours must map to weekly windowKey');
  assert.ok(multiWinSnap.pools[0].buckets.some(b => b.windowKey === '5h'), '5_hours must map to 5h windowKey');

  // 6. Collector collect() end-to-end without ReferenceError: cachedHostUserStatus is not defined
  const collectorSrc = fs.readFileSync(path.join(rootDir, 'meter-collector.js'), 'utf8');
  assert.doesNotMatch(collectorSrc, /\bcachedHostUserStatus\b/, 'meter-collector.js must not reference undeclared cachedHostUserStatus');
  const https = require('node:https');
  const { EventEmitter } = require('node:events');
  const origHttpsRequest = https.request;
  const convId = '11111111-2222-3333-4444-555555555555';
  https.request = (arg1, arg2, arg3) => {
    const cb = typeof arg2 === 'function' ? arg2 : arg3;
    const reqPath = typeof arg1 === 'string'
      ? arg1
      : (arg1 instanceof URL ? arg1.pathname : String(arg1?.path || arg2?.path || '/'));
    const reqEmitter = new EventEmitter();
    reqEmitter.write = () => {};
    reqEmitter.destroy = () => {};
    reqEmitter.setTimeout = () => {};
    reqEmitter.end = () => {
      const resEmitter = new EventEmitter();
      resEmitter.statusCode = 200;
      resEmitter.setEncoding = () => {};
      let payloadStr = '<html><script>window.__APP_CONFIG__ = {"csrfToken":"mock-csrf"};</script></html>';
      if (reqPath.includes('GetCascadeTrajectoryGeneratorMetadata')) {
        payloadStr = JSON.stringify({ generatorMetadata: [] });
      } else if (reqPath.includes('GetCascadeTrajectory')) {
        payloadStr = JSON.stringify({
          numTotalSteps: 1,
          trajectory: { steps: [{ userInput: { items: [{ text: 'hello world' }] } }] }
        });
      }
      process.nextTick(() => {
        if (typeof cb === 'function') cb(resEmitter);
        resEmitter.emit('data', Buffer.from(payloadStr, 'utf8'));
        resEmitter.emit('end');
      });
    };
    return reqEmitter;
  };
  try {
    const collected = await collect('https://127.0.0.1:49999', convId, { force: true });
    assert.equal(collected.conversation, convId);
    assert.ok(collected.session && collected.session.steps === 1, 'collect() must return session breakdown without ReferenceError');
  } finally {
    https.request = origHttpsRequest;
  }

  // 7. Attachment scanner <!ENTITY XML bomb defense
  const pyBin = process.platform === 'win32' ? 'python' : 'python3';
  try {
    const bombPath = execFileSync(pyBin, ['-c', zipfileCode], { encoding: 'utf8' }).trim();
    try {
      const scanOut = execFileSync(pyBin, [path.join(rootDir, 'attachment_scan.py')], {
        input: JSON.stringify([{ key: 'bomb-1', path: bombPath, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }]),
        encoding: 'utf8'
      });
      const parsedOut = JSON.parse(scanOut);
      const item = Array.isArray(parsedOut) ? parsedOut[0] : parsedOut.results?.[0];
      assert.equal(item?.status, 'unknown', 'DOCTYPE ENTITY XML bomb must be blocked by _safe_zip_xml_bytes');
    } finally {
      fs.rmSync(path.dirname(bombPath), { recursive: true, force: true });
    }
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e;
  }
});

test('7. Binary enhance & context-unlock coexistence: CHINESE_TITLE_META.mixed and surgical gate restore', () => {
  const enhance = require('./meter-enhance');
  assert.ok(enhance.CHINESE_TITLE_META.mixed, 'CHINESE_TITLE_META must define mixed state so partial rule match never crashes');
  assert.equal(enhance.CHINESE_TITLE_META.mixed.mode, 'mixed');
});

test('8. HUD renderer regressions: external origin block, unsupported platform unlock guard, fixed 256K vs default, decorator+fetch dedup & EN/zh-TW i18n', async () => {
  class MiniClassList {
    constructor() { this.set = new Set(); }
    syncFromAttr(s) { this.set = new Set(String(s || '').split(/\s+/).filter(Boolean)); }
    add(...n) { n.forEach(x => this.set.add(x)); }
    remove(...n) { n.forEach(x => this.set.delete(x)); }
    toggle(n, f) { const v = f !== undefined ? Boolean(f) : !this.set.has(n); if (v) this.set.add(n); else this.set.delete(n); return v; }
    contains(n) { return this.set.has(n); }
  }
  class MiniEl {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.id = '';
      this.dataset = {};
      this.attributes = new Map();
      this.style = { setProperty(k, v) { this[k] = v; }, getPropertyValue(k) { return this[k] || ''; } };
      this.classList = new MiniClassList();
      this.children = [];
      this.parentNode = null;
      this.listeners = new Map();
      this.textContent = '';
      this._innerHTML = '';
      this.hidden = false;
      this.value = '';
    }
    setAttribute(k, v) {
      this.attributes.set(k, String(v));
      if (k === 'id') this.id = String(v);
      if (k === 'class') this.classList.syncFromAttr(v);
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camel] = String(v);
      }
    }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    insertBefore(c) { c.parentNode = this; this.children.push(c); return c; }
    get firstChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    get isConnected() { return Boolean(this.parentNode); }
    contains(o) { return o === this; }
    remove() {}
    addEventListener(t, fn) { if (!this.listeners.has(t)) this.listeners.set(t, []); this.listeners.get(t).push(fn); }
    removeEventListener() {}
    getBoundingClientRect() { return { top: 6, bottom: 36, left: 900, right: 1180, width: 268, height: 30 }; }
    getContext() {
      return {
        save() {}, restore() {}, setTransform() {}, scale() {}, clearRect() {}, beginPath() {}, moveTo() {},
        quadraticCurveTo() {}, lineTo() {}, stroke() {}, closePath() {}, fill() {}, arc() {},
        setLineDash() {}, createLinearGradient() { return { addColorStop() {} }; }
      };
    }
    attachShadow() {
      const sr = new MiniEl('shadow-root');
      sr.byId = new Map();
      sr.allNodes = [];
      Object.defineProperty(sr, 'innerHTML', {
        get() { return this._innerHTML; },
        set(html) {
          this._innerHTML = String(html);
          this.byId.clear();
          this.allNodes = [];
          const tagRe = /<([a-zA-Z0-9-]+)([^>]*)>/g;
          let m;
          while ((m = tagRe.exec(this._innerHTML))) {
            const node = new MiniEl(m[1]);
            const attrRe = /([a-zA-Z0-9_-]+)=["']([^"']*)["']/g;
            let am;
            while ((am = attrRe.exec(m[2] || ''))) node.setAttribute(am[1], am[2]);
            if (node.id) this.byId.set(node.id, node);
            this.allNodes.push(node);
          }
        }
      });
      sr.getElementById = (id) => sr.byId.get(id) || null;
      sr.querySelectorAll = (sel) => {
        if (sel === '[data-i18n]') return sr.allNodes.filter(n => n.attributes.has('data-i18n'));
        if (sel === '#detentBtns button') return sr.allNodes.filter(n => n.attributes.has('data-det'));
        if (sel.startsWith('#') && sel.includes(' .')) {
          const cls = sel.split(' .')[1];
          return sr.allNodes.filter(n => n.classList.contains(cls));
        }
        if (sel.startsWith('.')) return sr.allNodes.filter(n => n.classList.contains(sel.slice(1)));
        if (sel.startsWith('[') && sel.endsWith(']')) return sr.allNodes.filter(n => n.attributes.has(sel.slice(1, -1)));
        return [];
      };
      sr.querySelector = (sel) => sr.querySelectorAll(sel)[0] || null;
      this.shadowRoot = sr;
      return sr;
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }

  const coreCode = fs.readFileSync(path.join(rootDir, 'meter-core.js'), 'utf8');
  const rendererCode = fs.readFileSync(path.join(rootDir, 'meter-renderer.js'), 'utf8');

  // Part A: External untrusted origin must refuse to mount HUD
  const extBody = new MiniEl('body');
  const extSandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { origin: 'https://evil.example.com', pathname: '/' },
    document: { body: extBody, documentElement: extBody, createElement: (t) => new MiniEl(t), getElementById: () => null }
  };
  extSandbox.window = extSandbox;
  extSandbox.globalThis = extSandbox;
  vm.createContext(extSandbox);
  vm.runInContext(rendererCode, extSandbox, { filename: 'meter-renderer.js' });
  assert.equal(extSandbox.__AGContextMeter, undefined, 'External non-loopback origin must never mount __AGContextMeter');

  // Part B: macOS unsupported binary unlock + fixed 256K vs default + decorator/fetch dedup + i18n
  const localBody = new MiniEl('body');
  const trigger = new MiniEl('button');
  trigger.textContent = 'Gemini 3.1 Pro';
  let macUnlockCalls = 0;
  let fetchCapturedBodies = [];

  const sb = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer,
    innerWidth: 1280,
    __APP_CONFIG__: { csrfToken: 'csrf' },
    location: { origin: 'http://127.0.0.1:4100', pathname: '/c/12345678-1234-1234-1234-123456789abc' },
    getComputedStyle: () => ({ getPropertyValue: () => '#10b981' }),
    fetch: async (url, init) => {
      if (String(url).includes('SendUserCascadeMessage')) {
        fetchCapturedBodies.push(init?.body);
      }
      return { ok: true, status: 200, json: async () => ({ generatorMetadata: [] }) };
    },
    contextMeterAPI: {
      getSettings: async () => ({ ok: true, autoCheckUpdate: false, uiPreferences: { autoCheckUpdate: false }, contextScopeMode: 'per_model' }),
      saveSettings: async () => ({ ok: true }),
      getQuota: async () => ({ ok: true, data: { snapshot: { pools: [] }, cascadeModelConfigs: [{ modelId: 'MODEL_GEMINI_3_1_PRO', label: 'Gemini 3.1 Pro', maxTokens: 1048576, maxOutputTokens: 65536 }] } }),
      getTokenHistory: async () => ({ ok: true, data: { daily: {}, speedRecords: [] } }),
      getContextUnlockStatus: async () => ({ ok: true, data: { status: 'unsupported', isPlatformSupported: false } }),
      applyContextUnlock: async () => { macUnlockCalls++; return { ok: false }; },
      getEnhanceStatus: async () => ({ ok: true, data: {} }),
      getModulesStatus: async () => ({ ok: true, data: { modules: {} } }),
      getRuntimeInfo: async () => ({ ok: true, backendSource: 'electron-ipc', backendVersion: '0.9.0' }),
      scan: async () => ({ ok: true, data: { session: { files: [] } } })
    },
    document: {
      hidden: false,
      body: localBody,
      documentElement: localBody,
      createElement: (t) => new MiniEl(t),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: (s) => (s.includes('model-selector-trigger') ? [trigger] : []),
      addEventListener() {},
      removeEventListener() {}
    },
    addEventListener() {},
    removeEventListener() {}
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(coreCode, sb, { filename: 'meter-core.js' });
  vm.runInContext(rendererCode, sb, { filename: 'meter-renderer.js' });
  await new Promise(r => setTimeout(r, 80));

  const api = sb.__AGContextMeter;
  try {
    const hostEl = localBody.children.find(n => n.id === 'ag-context-meter');
    const sr = hostEl.shadowRoot;

    // 1. Unsupported platform must NOT call applyContextUnlock on >256K budget
    await api.setModelBudgetForTest('Gemini 3.1 Pro', 512000, 'per_model');
    assert.equal(macUnlockCalls, 0, 'macOS unsupported binary unlock platform must not invoke applyContextUnlock');
    assert.equal(sr.getElementById('btnRestoreBin')?.hidden, true, 'Restore binary button must hide on unsupported platform');

    // 2. Numeric 256000 must inject maxTokenLimit=256000 (fixed), whereas 'default' strips maxTokenLimit
    await api.setModelBudgetForTest('Gemini 3.1 Pro', 256000, 'per_model');
    const reqFixed256 = { cascadeId: '12345678-1234-1234-1234-123456789abc', items: [{ text: 'test 256k' }] };
    sb.__AG_METER_ON_SEND_MESSAGE__(reqFixed256, 'client_object');
    assert.equal(reqFixed256.cascadeConfig?.checkpointConfig?.maxTokenLimit, 256000, 'Numeric 256000 must be saved as fixed 256000 and injected');

    // Immediate fetch of the already-mutated payload within 450ms must pass through without double-rewrite
    const wireJson = JSON.stringify(reqFixed256);
    await sb.fetch('/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: wireJson
    });
    assert.equal(fetchCapturedBodies[0], wireJson, 'Transport send immediately following decorator hook must be deduplicated');

    await api.setModelBudgetForTest('Gemini 3.1 Pro', 'default', 'per_model');
    const reqDefault = {
      cascadeId: '12345678-1234-1234-1234-123456789abc',
      cascadeConfig: { checkpointConfig: { maxTokenLimit: 512000 } },
      items: [{ text: 'reset to default' }]
    };
    sb.__AG_METER_ON_SEND_MESSAGE__(reqDefault, 'client_object');
    assert.equal(reqDefault.cascadeConfig?.checkpointConfig?.maxTokenLimit, undefined, 'Default mode must strip custom maxTokenLimit');

    // 3. Language switch updates both static [data-i18n] and dynamic text
    api.setPanelLanguage('en');
    assert.equal(sr.getElementById('binaryUnlockBadge')?.textContent, 'Request Injection Ready');
    assert.equal(sr.getElementById('tpsDeltaTag')?.textContent, 'Waiting');
    api.setPanelLanguage('zh-TW');
    assert.equal(sr.getElementById('binaryUnlockBadge')?.textContent, '請求級注入就緒');
  } finally {
    api.dispose();
  }
});

test('9. v0.9.2 security boundary, IPC/Live-Host whitelist, redirect/ZIP hardening & cross-platform fixes', async () => {
  const { isAntigravityFallbackWorkbenchUrl } = require('./local-api');
  const { isAllowedDownloadRedirectUrl } = require('./meter-collector');
  const { getProxyCandidatePaths } = require('./meter-proxy');
  const { generateProxyUtilsCode } = require('./modular-installer');
  const { cleanupOldReplacedFiles } = require('./meter-context-unlock');
  const { registerMeterIpcHandlers } = require('./meter-main');
  const { createLiveRequestHandler } = require('./live-host');
  const { EventEmitter } = require('node:events');

  // 1. S1: External URLs with workbench.html must be rejected; local/loopback allowed
  assert.equal(isAntigravityFallbackWorkbenchUrl('https://evil.example/?p=workbench.html'), false);
  assert.equal(isAntigravityFallbackWorkbenchUrl('https://evil.example/workbench.html'), false);
  assert.equal(isAntigravityFallbackWorkbenchUrl('devtools://devtools/bundled/workbench.html'), false);
  assert.equal(isAntigravityFallbackWorkbenchUrl('http://127.0.0.1:42000/workbench.html'), true);
  assert.equal(isAntigravityFallbackWorkbenchUrl('file:///opt/app/workbench.html'), true);
  assert.equal(isAntigravityFallbackWorkbenchUrl('vscode-file://vscode-app/index.html'), true);

  // 2. S2: IPC handlers enforce module whitelist & block appOverride on restart-host
  const handlers = new Map();
  registerMeterIpcHandlers({
    handle(channel, fn) { handlers.set(channel, fn); },
    on() {}
  });
  const localEvt = {
    sender: { getURL: () => 'https://127.0.0.1:43210/', mainFrame: { url: 'https://127.0.0.1:43210/' } }
  };
  localEvt.senderFrame = localEvt.sender.mainFrame;
  const toggleEnhanceRes = await handlers.get('context-meter:toggle-module')(localEvt, 'enhance', true, {});
  assert.equal(toggleEnhanceRes.ok, false, 'toggle-module must reject non-toggleable enhance key');

  let evilRelaunchCalled = false;
  const restartRes = await handlers.get('context-meter:restart-host')(localEvt, {
    appOverride: { relaunch: () => { evilRelaunchCalled = true; }, quit: () => {} },
    args: ['--injected']
  });
  assert.equal(evilRelaunchCalled, false, 'IPC restart-host must never accept renderer appOverride/args');
  assert.equal(restartRes.supported, false);

  // Live-Host HTTP route also rejects enhance toggle and decodes split UTF-8 safely
  const liveHandler = createLiveRequestHandler({
    api: { origin: 'https://127.0.0.1:43210', origins: ['https://127.0.0.1:43210'] },
    secret: 'unit-test-secret'
  });
  const invokeLive = (route, payloadBufChunks) => new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = 'POST';
    req.url = route;
    req.headers = { origin: 'https://127.0.0.1:43210', 'x-ag-context-token': 'unit-test-secret' };
    req.destroy = () => {};
    let status = 200;
    let bodyOut = '';
    const res = {
      headersSent: false,
      setHeader() {},
      writeHead(code) { status = code; this.headersSent = true; },
      end(str = '') { bodyOut += String(str); this.headersSent = true; resolve({ status, body: JSON.parse(bodyOut || '{}') }); }
    };
    void liveHandler(req, res);
    process.nextTick(() => {
      for (const ch of payloadBufChunks) req.emit('data', ch);
      req.emit('end');
    });
  });
  const utf8Json = Buffer.from(JSON.stringify({ name: 'enhance', enable: true, note: '中文测试边界' }), 'utf8');
  const splitAt = utf8Json.indexOf(Buffer.from('中', 'utf8')) + 1;
  const liveToggleRes = await invokeLive('/toggle-module', [utf8Json.subarray(0, splitAt), utf8Json.subarray(splitAt)]);
  assert.equal(liveToggleRes.body.ok, false, 'live-host /toggle-module must reject enhance and parse split UTF-8 cleanly');

  // 3. S3 & S5: Download redirect allowlist tightened; no tar/unzip fallback; Chromium proxy strips credentials
  assert.equal(isAllowedDownloadRedirectUrl('https://attacker.githubusercontent.com/a.zip'), false);
  assert.equal(isAllowedDownloadRedirectUrl('https://evil-github-production-release-asset.s3.amazonaws.com/a.zip'), false);
  assert.equal(isAllowedDownloadRedirectUrl('https://objects.githubusercontent.com/github-production-release-asset-2e65be/a.zip'), true);
  assert.equal(isAllowedDownloadRedirectUrl('https://release-assets.githubusercontent.com/a.zip'), true);
  assert.equal(isAllowedDownloadRedirectUrl('https://github-production-release-asset-2e65be.s3.amazonaws.com/a.zip'), true);

  const collectorSrc = fs.readFileSync(path.join(rootDir, 'meter-collector.js'), 'utf8');
  assert.doesNotMatch(collectorSrc, /spawnSync\('unzip'/, 'OTA ZIP extraction must not fall back to external unzip');
  assert.doesNotMatch(collectorSrc, /spawnSync\('tar'/, 'OTA ZIP extraction must not fall back to external tar');

  const proxySnippet = generateProxyUtilsCode({ enabled: true, proxyUrl: 'http://alice:secret@127.0.0.1:7890' });
  assert.match(proxySnippet, /_stripCreds/, 'Chromium proxy switch must strip userinfo credentials');

  // 4. S4: release.yml least-privilege & no raw input interpolation inside run:
  const workflowSrc = fs.readFileSync(path.join(rootDir, '.github/workflows/release.yml'), 'utf8');
  assert.match(workflowSrc, /^permissions:\s*\n\s*contents:\s*read/m, 'Top-level workflow permissions must be contents: read');
  assert.doesNotMatch(workflowSrc, /TAG="\$\{\{\s*github\.event\.inputs\.tag_name/, 'Workflow must not interpolate tag_name directly inside shell');

  // 5. B4: cleanupOldReplacedFiles cleans both .old_<ts> and .old_<ts>_<rand5>
  const tmpCleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-clean-old-'));
  try {
    const baseName = 'language_server_windows_x64.exe';
    fs.writeFileSync(path.join(tmpCleanDir, baseName), 'bin');
    fs.writeFileSync(path.join(tmpCleanDir, `${baseName}.orig`), 'orig');
    fs.writeFileSync(path.join(tmpCleanDir, `${baseName}.old_1700000000000`), 'old1');
    fs.writeFileSync(path.join(tmpCleanDir, `${baseName}.old_1700000000001_a9f2k`), 'old2');
    const cleanRes = cleanupOldReplacedFiles(tmpCleanDir, baseName);
    assert.equal(cleanRes.cleaned.length, 2, 'Both .old_<ts> and .old_<ts>_<rand> must be cleaned');
    assert.equal(fs.existsSync(path.join(tmpCleanDir, `${baseName}.orig`)), true, '.orig backup must remain untouched');
    assert.equal(fs.existsSync(path.join(tmpCleanDir, baseName)), true, 'Target binary must remain untouched');
  } finally {
    fs.rmSync(tmpCleanDir, { recursive: true, force: true });
  }

  // 6. B6: Windows batch scripts flatten ERRORLEVEL check
  const installBat = fs.readFileSync(path.join(rootDir, 'install.bat'), 'utf8');
  const uninstallBat = fs.readFileSync(path.join(rootDir, 'uninstall.bat'), 'utf8');
  assert.match(installBat, /if %ERRORLEVEL% NEQ 0 goto :TRY_ELECTRON/);
  assert.match(uninstallBat, /if %ERRORLEVEL% NEQ 0 goto :TRY_ELECTRON/);

  // 7. B9: Linux proxy config paths prioritize XDG_STATE_HOME (~/.local/state) before ~/.config
  const linuxPaths = getProxyCandidatePaths(null, { platform: 'linux', homeDir: '/tmp/fake-linux-home', env: {} });
  const stateIdx = linuxPaths.findIndex(p => p.includes(path.join('.local', 'state', 'AntigravityContextMeter', 'modules.json')));
  const cfgIdx = linuxPaths.findIndex(p => p.includes(path.join('.config', 'AntigravityContextMeter', 'modules.json')));
  assert.ok(stateIdx >= 0 && cfgIdx > stateIdx, 'Linux proxy lookup must check XDG_STATE_HOME before XDG_CONFIG_HOME');
});

test('10. v0.9.2 collector abort recovery, Speed Duel empty metric, WS dedup, Studio summary & cacheWrite/FX accuracy', async () => {
  const core = require('./meter-core');
  const { collect } = require('./meter-collector');
  const https = require('node:https');
  const { EventEmitter } = require('node:events');

  // 1. B1: collect() supersedePrevious abort must clear pending so subsequent collect() succeeds
  const origHttpsRequest = https.request;
  const convA = 'aaaaaaaa-1111-2222-3333-444444444444';
  const convB = 'bbbbbbbb-1111-2222-3333-444444444444';
  let holdFirstReq = true;
  let releaseFirst = null;
  https.request = (arg1, arg2, arg3) => {
    const cb = typeof arg2 === 'function' ? arg2 : arg3;
    const opts = typeof arg2 === 'object' ? arg2 : {};
    const reqPath = typeof arg1 === 'string' ? arg1 : String(arg1?.path || '/');
    const reqEmitter = new EventEmitter();
    reqEmitter.write = () => {};
    reqEmitter.destroy = (err) => { if (err) process.nextTick(() => reqEmitter.emit('error', err)); };
    reqEmitter.setTimeout = () => {};
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        const abortErr = new Error('aborted');
        abortErr.name = 'AbortError';
        reqEmitter.emit('error', abortErr);
      }, { once: true });
    }
    reqEmitter.end = () => {
      const sendReply = () => {
        if (opts.signal?.aborted) return;
        const resEmitter = new EventEmitter();
        resEmitter.statusCode = 200;
        let payloadStr = '<html><script>window.__APP_CONFIG__ = {"csrfToken":"mock-csrf-2"};</script></html>';
        if (reqPath.includes('GetCascadeTrajectoryGeneratorMetadata')) {
          payloadStr = JSON.stringify({ generatorMetadata: [] });
        } else if (reqPath.includes('GetCascadeTrajectory')) {
          payloadStr = JSON.stringify({ numTotalSteps: 1, trajectory: { steps: [{ userInput: { items: [{ text: 'hi' }] } }] } });
        }
        if (typeof cb === 'function') cb(resEmitter);
        resEmitter.emit('data', Buffer.from(payloadStr, 'utf8'));
        resEmitter.emit('end');
      };
      if (holdFirstReq && reqPath.includes('GetCascadeTrajectory')) {
        holdFirstReq = false;
        releaseFirst = sendReply;
      } else {
        process.nextTick(sendReply);
      }
    };
    return reqEmitter;
  };
  try {
    const pA1 = collect('https://127.0.0.1:49998', convA, { supersedePrevious: true, force: true });
    await new Promise(r => setTimeout(r, 20));
    const pB = collect('https://127.0.0.1:49998', convB, { supersedePrevious: true, force: true });
    const [resA1, resB] = await Promise.all([pA1, pB]);
    assert.equal(resA1.abortedStale, true, 'First superseded collect() must resolve abortedStale');
    assert.equal(resB.conversation, convB);
    if (typeof releaseFirst === 'function') releaseFirst();
    const resA2 = await collect('https://127.0.0.1:49998', convA, { supersedePrevious: true, force: true });
    assert.notEqual(resA2.abortedStale, true, 'Subsequent collect() for convA must NOT be poisoned by aborted pending Promise');
    assert.equal(resA2.conversation, convA);
  } finally {
    https.request = origHttpsRequest;
  }

  // 2. B2: renderSpeedDuelView with metric='ttft' when all groups lack TTFT must not crash
  const chartsSrc = fs.readFileSync(path.join(rootDir, 'src/renderer/charts.js'), 'utf8');
  const chartsCtx = { console, Math, Number, Array, String, Boolean };
  vm.createContext(chartsCtx);
  vm.runInContext(chartsSrc, chartsCtx, { filename: 'charts.js' });
  const mockBars = { innerHTML: '', querySelectorAll: () => [] };
  const mockSvg = { innerHTML: '', querySelectorAll: () => [] };
  const mockTitle = { textContent: '' };
  const mockMed = { textContent: '' };
  assert.doesNotThrow(() => {
    chartsCtx.renderSpeedDuelView(
      mockBars,
      mockSvg,
      mockTitle,
      mockMed,
      [{ key: 'm1', modelLabel: 'Model A', count: 3, medianTps: 88.5, medianTtft: null, samples: [{ tps: 88.5 }] }],
      'ttft'
    );
  }, 'Switching Speed Duel to ttft with no TTFT samples must not throw TypeError');
  assert.equal(mockMed.textContent, 'n = 0');

  // 3. D1 & D2: meter-core cacheWriteTokens accounting, flash-lite classification & local YYYY-MM-DD date parsing
  assert.equal(core.normalizeModelId('gemini-2.5-flash-lite'), null, 'gemini-2.5-flash-lite must not be misclassified as 3.5-flash-lite');
  assert.equal(core.normalizeModelId('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');

  const cwSummary = core.summarize({
    chatModel: {
      model: 'claude-opus-5-5',
      usage: { inputTokens: 1000, cacheReadTokens: 2000, cacheWriteTokens: 5000, outputTokens: 500 },
      chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 256000 } }
    }
  });
  assert.equal(cwSummary.cacheWrite, 5000);
  assert.equal(cwSummary.input, 8000, 'summarize() input must include fresh + cacheRead + cacheWrite');
  assert.equal(cwSummary.actual, 8500, 'summarize() actual must include cacheWriteTokens');

  const unpricedCost = core.summarizeApiCost([
    { model: 'unknown-experimental-model', inputTokens: 100, cacheReadTokens: 200, cacheWriteTokens: 700, outputTokens: 50 }
  ]);
  assert.equal(unpricedCost.unpricedTokens, 1050, 'summarizeApiCost unpricedTokens must include cacheWriteTokens');

  const localDateCall = core.parseGeneratorCall({
    stepIndices: [1],
    date: '2026-05-01',
    chatModel: { model: 'gemini-4-hydrogen', usage: { inputTokens: 10, outputTokens: 5 } }
  }, 'conv-date', 'desktop');
  assert.equal(localDateCall.timestamp, new Date(2026, 4, 1).getTime(), 'Pure YYYY-MM-DD must parse as local midnight');

  // 4. B3, B5 & D2 in renderer HUD: Studio summary read, WS unrelated frame dedup preservation, negative cache saving label
  const coreCode = fs.readFileSync(path.join(rootDir, 'meter-core.js'), 'utf8');
  const rendererCode = fs.readFileSync(path.join(rootDir, 'meter-renderer.js'), 'utf8');
  class TinyEl {
    constructor(tag) {
      this.tagName = String(tag || 'div').toUpperCase();
      this.id = '';
      this.className = '';
      this.style = { setProperty() {}, removeProperty() {} };
      this.dataset = {};
      this.attrs = {};
      this.children = [];
      this.textContent = '';
      this.value = '';
      this.hidden = false;
      this.disabled = false;
      this._listeners = {};
      this.classList = {
        _s: new Set(),
        add: (...c) => c.forEach(x => this.classList._s.add(x)),
        remove: (...c) => c.forEach(x => this.classList._s.delete(x)),
        toggle: (c, f) => { const on = f === undefined ? !this.classList._s.has(c) : Boolean(f); if (on) this.classList._s.add(c); else this.classList._s.delete(c); return on; },
        contains: (c) => this.classList._s.has(c)
      };
    }
    set innerHTML(v) { this._html = String(v); }
    get innerHTML() { return this._html || ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    appendChild(ch) { ch.parentNode = this; this.children.push(ch); return ch; }
    remove() { this.parentNode = null; }
    addEventListener(ev, fn) { (this._listeners[ev] ||= []).push(fn); }
    removeEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { left: 100, top: 0, right: 300, bottom: 32, width: 200, height: 32 }; }
    getContext() { return { save() {}, restore() {}, setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, createLinearGradient: () => ({ addColorStop() {} }) }; }
    attachShadow() {
      const byId = new Map();
      const mk = (id) => { if (!byId.has(id)) { const e = new TinyEl('div'); e.id = id; byId.set(id, e); } return byId.get(id); };
      this.shadowRoot = { innerHTML: '', getElementById: (id) => mk(id), querySelector: () => null, querySelectorAll: () => [], activeElement: null };
      return this.shadowRoot;
    }
  }
  const bodyEl = new TinyEl('body');
  const fetchBodies = [];
  function FakeWs(url) { this.url = url; }
  FakeWs.prototype.send = function () {};
  const sb = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, URL, URLSearchParams, TextEncoder, TextDecoder,
    Uint8Array, ArrayBuffer, DataView, Promise, Map, Set, Date, Math, JSON, Number, String, Boolean, Array, Object, RegExp, Error,
    WebSocket: FakeWs,
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
    location: { protocol: 'https:', hostname: '127.0.0.1', origin: 'https://127.0.0.1:43210', href: 'https://127.0.0.1:43210/conv/12345678-1234-1234-1234-123456789abc', pathname: '/conv/12345678-1234-1234-1234-123456789abc' },
    localStorage: { getItem: () => null, setItem: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '#38bdf8' }),
    __APP_CONFIG__: { csrfToken: 'test-csrf-v092' },
    fetch: async (url, init) => {
      if (String(url).includes('SendUserCascadeMessage')) {
        fetchBodies.push(init?.body);
        return { ok: true, json: async () => ({}) };
      }
      if (String(url).includes('GetCascadeTrajectoryGeneratorMetadata')) {
        return {
          ok: true,
          json: async () => ({
            generatorMetadata: [{
              stepIndices: [1],
              chatModel: {
                model: 'claude-opus-5-5',
                usage: { inputTokens: 1000, cacheReadTokens: 1000, cacheWriteTokens: 100000, outputTokens: 200 },
                chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 256000 } }
              }
            }]
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    },
    contextMeterAPI: {
      getSettings: async () => ({ ok: true, uiPreferences: {}, contextPreferences: {} }),
      saveSettings: async () => ({ ok: true }),
      getQuota: async () => ({ ok: true, data: { snapshot: { pools: [] }, cascadeModelConfigs: [{ modelId: 'MODEL_GEMINI_3_1_PRO', label: 'Gemini 3.1 Pro', maxTokens: 1048576, maxOutputTokens: 65536 }] } }),
      getTokenHistory: async () => ({ ok: true, data: { daily: {}, speedRecords: [] } }),
      getContextUnlockStatus: async () => ({ ok: true, data: { status: 'unsupported', isPlatformSupported: false } }),
      getEnhanceStatus: async () => ({ ok: true, data: { summary: { promptTier: 3, chineseTitleEnabled: true, pendingLsRestart: true } } }),
      getModulesStatus: async () => ({ ok: true, data: { modules: {} } }),
      getRuntimeInfo: async () => ({ ok: true, backendSource: 'electron-ipc', backendVersion: '0.10.0' }),
      scan: async () => ({ ok: true, data: { session: { files: [] } } })
    },
    document: {
      hidden: false,
      body: bodyEl,
      documentElement: bodyEl,
      createElement: (t) => new TinyEl(t),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {}
    },
    addEventListener() {},
    removeEventListener() {}
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(coreCode, sb, { filename: 'meter-core.js' });
  vm.runInContext(rendererCode, sb, { filename: 'meter-renderer.js' });
  await new Promise(r => setTimeout(r, 90));
  const api = sb.__AGContextMeter;
  try {
    const hostEl = bodyEl.children.find(n => n.id === 'ag-context-meter');
    const sr = hostEl.shadowRoot;

    // B3: Studio status must read eRes.data.summary (pendingLsRestart -> restart banner visible, zhTitle on)
    assert.equal(sr.getElementById('btnRestartBanner')?.hidden, false, 'pendingLsRestart from enhance-status summary must reveal restart banner');
    assert.equal(sr.getElementById('toggleZhTitle')?.classList.contains('on'), true, 'chineseTitleEnabled from enhance-status summary must toggle UI on');

    // D2: Negative net cache savings on cold Claude write must NEVER render "省 $-"
    await api.pollTrajectoryForTest();
    const audBadge = sr.getElementById('audSessSavedBadge')?.textContent || '';
    const heroSub = sr.getElementById('heroCacheSessSub')?.textContent || '';
    assert.doesNotMatch(audBadge, /省\s*\$-/, 'Negative net savings must not render "省 $-"');
    assert.doesNotMatch(heroSub, /省\s*\$-/, 'Cockpit negative net savings must not render "省 $-"');

    // B5: Unrelated WS ping between decorator hook & fetch must NOT consume lastDecoratorDispatch
    await api.setModelBudgetForTest('Gemini 3.1 Pro', 512000, 'per_model');
    const reqObj = { cascadeId: '12345678-1234-1234-1234-123456789abc', items: [{ text: 'hello' }] };
    sb.__AG_METER_ON_SEND_MESSAGE__(reqObj, 'client_object');
    const ws = new sb.WebSocket('ws://127.0.0.1:43210/ws');
    ws.send('{"type":"ping"}');
    const wire = JSON.stringify(reqObj);
    await sb.fetch('/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage', {
      method: 'POST',
      headers: [['Content-Type', 'application/json']],
      body: wire
    });
    assert.equal(fetchBodies[0], wire, 'Unrelated WS frame must not wipe decorator dedup marker before real fetch');
  } finally {
    api.dispose();
  }
});

test('11. v0.10.0 Proxy Profiles validation/persistence & Windows Update Guard XML/VBS/CMD builder', async () => {
  const modulesConfig = require('./modules-config');
  const setupMod = require('./scripts/macos-setup');

  // 11a. Proxy profiles sanitization (strict rejects bad schemes, non-strict filters & caps at 12)
  const badStrict = modulesConfig.sanitizeProxyProfiles(
    [{ id: 'bad1', name: 'Evil', proxyUrl: 'javascript:alert(1)' }],
    { strict: true }
  );
  assert.equal(badStrict.ok, false, 'Strict sanitizeProxyProfiles must reject non-proxy schemes');
  assert.match(badStrict.error || '', /无效|协议|地址/i);

  const rawMany = Array.from({ length: 15 }, (_, idx) => ({
    id: `p_${idx}`,
    name: `Node ${idx}`,
    proxyUrl: `http://127.0.0.1:${7890 + idx}`
  }));
  rawMany.push({ id: 'bad', name: 'Bad', proxyUrl: 'ftp://127.0.0.1:21' });
  const cleanedRes = modulesConfig.sanitizeProxyProfiles(rawMany, { strict: false });
  assert.equal(cleanedRes.ok, true);
  assert.equal(cleanedRes.profiles.length, 12, 'Proxy profiles must be capped at 12 entries');
  assert.equal(cleanedRes.profiles[0].name, 'Node 0');
  assert.equal(cleanedRes.profiles[0].proxyUrl, 'http://127.0.0.1:7890');

  // 11b. Persist & reload profiles in isolated temp stateDir
  const tmpState = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-v010-prof-'));
  try {
    const cfg = modulesConfig.loadModulesConfig({ stateDir: tmpState });
    cfg.modules.proxy.enabled = true;
    cfg.modules.proxy.proxyUrl = 'socks5://127.0.0.1:10808';
    cfg.modules.proxy.profiles = [
      { id: 'clash', name: 'Clash Verge', proxyUrl: 'http://127.0.0.1:7897' },
      { id: 'v2ray', name: 'V2Ray Socks', proxyUrl: 'socks5://127.0.0.1:10808' }
    ];
    cfg.modules.proxy.activeProfileId = 'v2ray';
    modulesConfig.saveModulesConfig(cfg, { stateDir: tmpState });
    const reloaded = modulesConfig.loadModulesConfig({ stateDir: tmpState });
    assert.equal(reloaded.modules.proxy.profiles.length, 2);
    assert.equal(reloaded.modules.proxy.activeProfileId, 'v2ray');
    assert.equal(reloaded.modules.proxy.profiles[1].proxyUrl, 'socks5://127.0.0.1:10808');
  } finally {
    fs.rmSync(tmpState, { recursive: true, force: true });
  }

  // 11c. Windows Update Guard script & Task Scheduler XML generation
  assert.equal(setupMod.WIN_GUARD_TASK_NAME, 'AntigravityPulseUpdateGuard');
  const guardFiles = setupMod.buildWindowsGuardFiles({
    nodePath: 'C:\\Program Files\\nodejs\\node.exe',
    cliPath: 'C:\\ProgramData\\AntigravityPulse\\live-runtime\\cli.js',
    asarPath: 'C:\\Program Files\\Antigravity\\resources\\app.asar',
    logPath: 'C:\\ProgramData\\AntigravityPulse\\guard-sync.log',
    cmdPath: 'C:\\ProgramData\\AntigravityPulse\\guard-sync.cmd',
    isElectronNode: false
  });
  assert.match(guardFiles.cmdContent, /guard-sync/, 'guard-sync.cmd should invoke cli.js guard-sync');
  assert.match(guardFiles.cmdContent, /set "ELECTRON_RUN_AS_NODE="/, 'Non-Electron node must clear ELECTRON_RUN_AS_NODE');
  assert.match(guardFiles.vbsContent, /WScript\.Shell/, 'guard-sync.vbs should run silently via WScript.Shell');
  assert.match(guardFiles.vbsContent, /,\s*0,\s*False/, 'guard-sync.vbs must hide console window (windowStyle=0)');

  const xml = setupMod.buildWindowsGuardTaskXml({ vbsPath: 'C:\\ProgramData\\AntigravityPulse\\guard-sync.vbs' });
  assert.match(xml, /encoding="UTF-16"/, 'Windows Task Scheduler XML must declare UTF-16');
  assert.match(xml, /<LogonTrigger>/, 'Task XML must trigger on user logon');
  assert.match(xml, /<Interval>PT2H<\/Interval>/, 'Task XML must run every 2 hours');
  assert.match(xml, /<Command>wscript\.exe<\/Command>/, 'Task XML must execute via wscript.exe to prevent console flash');
});

test('12. v0.10.0 HUD Ledger CSV/JSON export, model cost ranking, Audit compaction timeline, Markdown snapshot & Alt+Shift+P', async () => {
  const built = buildRenderer({ rootDir });
  const coreCode = fs.readFileSync(path.join(rootDir, 'meter-core.js'), 'utf8');
  const rendererCode = fs.readFileSync(built.targetFile, 'utf8');

  class MiniClassList {
    constructor() { this.set = new Set(); }
    add(...names) { names.forEach(n => this.set.add(n)); }
    remove(...names) { names.forEach(n => this.set.delete(n)); }
    toggle(name, force) {
      if (force === undefined) {
        if (this.set.has(name)) { this.set.delete(name); return false; }
        this.set.add(name); return true;
      }
      if (force) this.set.add(name); else this.set.delete(name);
      return Boolean(force);
    }
    contains(name) { return this.set.has(name); }
  }
  class MiniEl {
    constructor(tag = 'div', id = '') {
      this.tagName = String(tag).toUpperCase();
      this.id = id;
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = new MiniClassList();
      this.children = [];
      this.listeners = new Map();
      this.attributes = new Map();
      this.textContent = '';
      this.value = '';
      this.hidden = false;
      this.disabled = false;
      this.shadowRoot = null;
      this._innerHTML = '';
    }
    set innerHTML(html) {
      this._innerHTML = String(html || '');
      if (this._nodesById) {
        const re = /id=["']([^"']+)["']/g;
        let m;
        while ((m = re.exec(this._innerHTML)) !== null) {
          if (!this._nodesById.has(m[1])) this._nodesById.set(m[1], new MiniEl('div', m[1]));
        }
      }
    }
    get innerHTML() { return this._innerHTML; }
    setAttribute(k, v) {
      this.attributes.set(k, String(v));
      if (k === 'id') this.id = String(v);
      if (k.startsWith('data-')) {
        const key = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[key] = String(v);
      }
    }
    getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
    appendChild(child) { this.children.push(child); return child; }
    remove() {}
    closest() { return null; }
    focus() {}
    select() {}
    click() {
      const fns = this.listeners.get('click') || [];
      fns.forEach(fn => fn({ target: this, preventDefault() {}, stopPropagation() {} }));
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    removeEventListener(type, fn) {
      if (!this.listeners.has(type)) return;
      this.listeners.set(type, this.listeners.get(type).filter(f => f !== fn));
    }
    attachShadow() {
      const nodesById = new Map();
      const sr = {
        _nodesById: nodesById,
        activeElement: null,
        set innerHTML(html) {
          this._html = String(html || '');
          const re = /id=["']([^"']+)["']/g;
          let m;
          while ((m = re.exec(this._html)) !== null) {
            if (!nodesById.has(m[1])) nodesById.set(m[1], new MiniEl('div', m[1]));
          }
        },
        get innerHTML() { return this._html || ''; },
        getElementById: (id) => nodesById.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => []
      };
      this.shadowRoot = sr;
      return sr;
    }
    getBoundingClientRect() { return { left: 20, top: 20, width: 140, height: 32, right: 160, bottom: 52 }; }
  }

  const bodyEl = new MiniEl('body');
  const docListeners = new Map();
  let copiedClipboardText = '';
  const sb = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, URL, URLSearchParams, TextDecoder, TextEncoder,
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
    navigator: {
      clipboard: {
        writeText: async (txt) => { copiedClipboardText = String(txt); }
      }
    },
    location: { protocol: 'https:', hostname: '127.0.0.1', origin: 'https://127.0.0.1:43210', href: 'https://127.0.0.1:43210/conv/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', pathname: '/conv/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    localStorage: { getItem: () => null, setItem: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '#38bdf8' }),
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    contextMeterAPI: {
      getSettings: async () => ({ ok: true, uiPreferences: {}, contextPreferences: {} }),
      saveSettings: async () => ({ ok: true }),
      getQuota: async () => ({
        ok: true,
        data: {
          snapshot: {
            pools: [{
              key: 'gemini-3.1-pro',
              label: 'Gemini 3.1 Pro',
              remainingFraction: 0.85,
              buckets: [{ tag: '5h', remainingFraction: 0.9, resetTime: new Date(Date.now() + 3600000).toISOString() }]
            }]
          },
          cascadeModelConfigs: [{ modelId: 'MODEL_GEMINI_3_1_PRO', label: 'Gemini 3.1 Pro', maxTokens: 1048576, maxOutputTokens: 65536 }]
        }
      }),
      getTokenHistory: async () => ({ ok: true, data: { daily: {}, speedRecords: [] } }),
      getContextUnlockStatus: async () => ({ ok: true, data: { status: 'unsupported', isPlatformSupported: false } }),
      getEnhanceStatus: async () => ({ ok: true, data: { summary: { promptTier: 0, chineseTitleEnabled: false } } }),
      getModulesStatus: async () => ({
        ok: true,
        data: {
          modules: {
            proxy: {
              enabled: true,
              proxyUrl: 'http://127.0.0.1:7897',
              activeProfileId: 'p1',
              profiles: [{ id: 'p1', name: 'Clash', proxyUrl: 'http://127.0.0.1:7897' }]
            }
          }
        }
      }),
      getRuntimeInfo: async () => ({ ok: true, backendSource: 'electron-ipc', backendVersion: '0.10.0' }),
      scan: async () => ({ ok: true, data: { session: { files: [] } } })
    },
    document: {
      hidden: false,
      activeElement: null,
      body: bodyEl,
      documentElement: bodyEl,
      createElement: (t) => new MiniEl(t),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(type, fn) {
        if (!docListeners.has(type)) docListeners.set(type, []);
        docListeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        if (!docListeners.has(type)) return;
        docListeners.set(type, docListeners.get(type).filter(f => f !== fn));
      }
    },
    addEventListener() {},
    removeEventListener() {}
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(coreCode, sb, { filename: 'meter-core.js' });
  vm.runInContext(rendererCode, sb, { filename: 'meter-renderer.js' });
  await new Promise(r => setTimeout(r, 90));
  const api = sb.__AGContextMeter;

  try {
    const hostEl = bodyEl.children.find(n => n.id === 'ag-context-meter');
    const sr = hostEl.shadowRoot;

    // 12a. Ledger CSV (with UTF-8 BOM) & JSON export + Per-Model Cost Ranking
    api.setHistoryDataForTest({
      daily: {
        '2026-11-23': { inputTokens: 10000, cacheTokens: 40000, outputTokens: 5000, totalTokens: 55000, costUSD: 0.42 },
        '2026-11-24': { inputTokens: 20000, cacheTokens: 80000, outputTokens: 10000, totalTokens: 110000, costUSD: 1.25 }
      },
      costEstimateBySource: {
        all: {
          pricedCostUSD: 1.67,
          byModel: {
            'claude-opus-5-5': { requests: 8, costUSD: 1.15, tokens: 95000 },
            'gemini-3.1-pro-preview': { requests: 12, costUSD: 0.52, tokens: 70000 }
          }
        }
      }
    });

    const csvExp = api.buildLedgerExportForTest('csv');
    assert.ok(csvExp.content.startsWith('\uFEFFdate,source,total_tokens,'), 'CSV export must start with UTF-8 BOM and standard header');
    assert.match(csvExp.content, /2026-11-24,all,110000,20000,80000,10000,80,1\.25/);

    const jsonExp = api.buildLedgerExportForTest('json');
    const parsedJson = JSON.parse(jsonExp.content);
    assert.equal(parsedJson.version, '0.10.0');
    assert.equal(parsedJson.daily.length, 2);
    assert.equal(parsedJson.modelBreakdown.length, 2);
    assert.equal(parsedJson.modelBreakdown[0].modelKey, 'claude-opus-5-5', 'Model ranking must sort by costUSD descending');
    assert.ok(parsedJson.modelBreakdown[0].sharePct > 65, 'Top model cost share must exceed 65%');

    // 12b. Audit session turn timeline auto-compaction & non-compaction cache drop detection
    api.setSessionCallsForTest([
      { callId: 'c1', model: 'claude-opus-5-5', inputTokens: 30000, cacheReadTokens: 0, outputTokens: 800, tps: 45, ttftSec: 1.2, costUSD: 0.18 },
      { callId: 'c2', model: 'claude-opus-5-5', inputTokens: 5000, cacheReadTokens: 30000, outputTokens: 600, tps: 52, ttftSec: 0.9, costUSD: 0.06 },
      // Auto-compaction: prompt drops from 35K -> 10K (<72%) with 0% cache hit -> MUST mark compacted, NOT cacheDrop
      { callId: 'c3', model: 'claude-opus-5-5', inputTokens: 10000, cacheReadTokens: 0, outputTokens: 500, tps: 48, ttftSec: 1.0, costUSD: 0.05 },
      { callId: 'c4', model: 'claude-opus-5-5', inputTokens: 2000, cacheReadTokens: 12000, outputTokens: 400, tps: 60, ttftSec: 0.8, costUSD: 0.03 },
      // True cache drop without compaction: prompt stays >=14K, hit drops from 85% -> 0%
      { callId: 'c5', model: 'claude-opus-5-5', inputTokens: 16000, cacheReadTokens: 0, outputTokens: 400, tps: 50, ttftSec: 1.1, costUSD: 0.09 }
    ]);

    const tl = api.buildTurnTimelineForTest();
    assert.equal(tl.turns.length, 5);
    assert.equal(tl.compactionCount, 1, 'Timeline must detect exactly 1 auto-compaction event');
    assert.equal(tl.turns[2].compacted, true, 'Turn 3 (35K -> 10K) must be flagged as compacted');
    assert.equal(tl.turns[2].cacheDrop, false, 'Compacted turn must NOT be flagged as cacheDrop');
    assert.equal(tl.cacheDropCount, 1, 'Timeline must detect 1 genuine non-compaction cache drop');
    assert.equal(tl.turns[4].cacheDrop, true, 'Turn 5 (85% -> 0% without shrink) must be flagged as cacheDrop');
    assert.equal(sr.getElementById('audCompactionTag')?.hidden, false, 'Compaction badge must become visible');
    assert.match(sr.getElementById('auditTimelineList')?.innerHTML || '', /自动压缩/);

    // 12c. Privacy-safe Markdown Telemetry Snapshot & Clipboard copy
    const mdSnap = api.buildTelemetrySnapshotForTest();
    assert.match(mdSnap, /Antigravity Pulse v0\.10\.0/);
    assert.match(mdSnap, /自动压缩 1 次/);
    assert.doesNotMatch(mdSnap, /aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/, 'Markdown snapshot must not expose conversation ID');
    sr.getElementById('btnCopySnapshot')?.click();
    await new Promise(r => setTimeout(r, 20));
    assert.match(copiedClipboardText, /Antigravity Pulse v0\.10\.0/, 'Clicking copy snapshot must write Markdown to clipboard');

    // 12d. Alt+Shift+P global HUD toggle shortcut (and ignoring inside INPUT)
    const keyHandlers = docListeners.get('keydown') || [];
    assert.ok(keyHandlers.length > 0, 'Document keydown listener must be registered');
    assert.equal(api.snapshot().hudOpen, false, 'HUD starts closed');
    let prevented = false;
    keyHandlers.forEach(fn => fn({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyP', key: 'P', preventDefault: () => { prevented = true; } }));
    assert.equal(prevented, true, 'Alt+Shift+P should call preventDefault');
    assert.equal(api.snapshot().hudOpen, true, 'Alt+Shift+P must open HUD');

    // While focus is in an INPUT element, Alt+Shift+P must be ignored
    sb.document.activeElement = new MiniEl('input');
    keyHandlers.forEach(fn => fn({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyP', key: 'P', preventDefault() {} }));
    assert.equal(api.snapshot().hudOpen, true, 'Alt+Shift+P must not toggle HUD while typing in INPUT');

    // Clear focus -> Alt+Shift+P closes HUD
    sb.document.activeElement = null;
    keyHandlers.forEach(fn => fn({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyP', key: 'P', preventDefault() {} }));
    assert.equal(api.snapshot().hudOpen, false, 'Second Alt+Shift+P must collapse HUD');

    // 12e. Proxy profile chips rendered from backend status
    assert.match(sr.getElementById('proxyProfileBar')?.innerHTML || '', /Clash/, 'Proxy profile chip must render in Studio');
  } finally {
    api.dispose();
  }
});

test('13. Long-running self-healing: route-switch requestBusy/scanBusy deadlock fix, CSRF 401/403 refresh, Cookie forwarding & stale quota recovery', async () => {
  const http = require('node:http');
  const localApi = require('./local-api');

  // 13a. Backend local-api.js: multiline __APP_CONFIG__ parsing, Set-Cookie forwarding & 401 CSRF auto-refresh retry
  const parsedMultiline = localApi.extractAppConfigFromHtml('<script>window.__APP_CONFIG__ = {\n  "csrfToken": "tok_multi_1",\n  "note": "a;b"\n}</script>');
  assert.equal(parsedMultiline?.csrfToken, 'tok_multi_1', 'Must parse multiline __APP_CONFIG__ containing semicolons without trailing semicolon');

  let getCount = 0;
  let postCount = 0;
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      getCount += 1;
      const csrfVal = getCount === 1 ? 'csrf_v1' : 'csrf_v2';
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': [`ag_sess=session_${getCount}; Path=/; HttpOnly`]
      });
      res.end(`<html><script>window.__APP_CONFIG__ = {\n  "csrfToken": "${csrfVal}"\n}</script></html>`);
      return;
    }
    if (req.method === 'POST' && req.url.includes('GetUserStatus')) {
      postCount += 1;
      const gotCsrf = req.headers['x-codeium-csrf-token'];
      const gotCookie = String(req.headers.cookie || '');
      if (postCount === 1) {
        assert.equal(gotCsrf, 'csrf_v1');
        assert.match(gotCookie, /ag_sess=session_1/, 'Must forward Set-Cookie from GET / on POST RPC');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end('{"code":"unauthenticated"}');
        return;
      }
      assert.equal(gotCsrf, 'csrf_v2', 'Must retry with freshly refreshed CSRF after 401');
      assert.match(gotCookie, /ag_sess=session_2/, 'Must update forwarded Cookie on retry');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, userStatus: { email: 'test@example.com' } }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const client = await localApi.connect({ origin: `http://127.0.0.1:${port}`, fallbackDiscover: false });
    const data = await client.call('GetUserStatus', {});
    assert.equal(data.ok, true);
    assert.equal(getCount, 2, 'Should refresh GET / once after 401');
    assert.equal(postCount, 2, 'Should retry POST once after 401');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  // 13b. Renderer: in-flight route switch MUST NOT deadlock requestBusy/scanBusy, stale CSRF 403 auto-recovers,
  //      and stale multi-window quota + backend auth error MUST recover via same-origin direct RPC
  const built = buildRenderer({ rootDir });
  const coreCode = fs.readFileSync(path.join(rootDir, 'meter-core.js'), 'utf8');
  const rendererCode = fs.readFileSync(built.targetFile, 'utf8');

  class MiniClassList {
    constructor() { this.set = new Set(); }
    add(...names) { names.forEach(n => this.set.add(n)); }
    remove(...names) { names.forEach(n => this.set.delete(n)); }
    toggle(name, force) {
      if (force === undefined) {
        if (this.set.has(name)) { this.set.delete(name); return false; }
        this.set.add(name); return true;
      }
      if (force) this.set.add(name); else this.set.delete(name);
      return Boolean(force);
    }
    contains(name) { return this.set.has(name); }
  }
  class MiniEl {
    constructor(tag = 'div', id = '') {
      this.tagName = String(tag).toUpperCase();
      this.id = id;
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = new MiniClassList();
      this.children = [];
      this.attributes = new Map();
      this.textContent = '';
      this.hidden = false;
      this.shadowRoot = null;
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
    appendChild(c) { this.children.push(c); return c; }
    remove() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
    addEventListener() {}
    removeEventListener() {}
    attachShadow() {
      const nodesById = new Map();
      const sr = {
        activeElement: null,
        set innerHTML(html) {
          this._html = String(html || '');
          const re = /id=["']([^"']+)["']/g;
          let m;
          while ((m = re.exec(this._html)) !== null) {
            if (!nodesById.has(m[1])) nodesById.set(m[1], new MiniEl('div', m[1]));
          }
        },
        get innerHTML() { return this._html || ''; },
        getElementById: (id) => nodesById.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => []
      };
      this.shadowRoot = sr;
      return sr;
    }
    getBoundingClientRect() { return { left: 10, top: 10, width: 100, height: 30, right: 110, bottom: 40 }; }
  }

  const routeA = '11111111-1111-1111-1111-111111111111';
  const routeB = '22222222-2222-2222-2222-222222222222';
  let releaseRouteAFetch = null;
  let releaseRouteAScan = null;
  let routeBScanCalls = 0;
  let quotaFailBackend = false;

  const bodyEl = new MiniEl('body');
  const locObj = {
    protocol: 'https:', hostname: '127.0.0.1', origin: 'https://127.0.0.1:43210',
    href: `https://127.0.0.1:43210/c/${routeA}`,
    pathname: `/c/${routeA}`
  };
  const sb = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, URL, URLSearchParams, TextDecoder, TextEncoder, AbortController,
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
    location: locObj,
    localStorage: { getItem: () => null, setItem: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '#38bdf8' }),
    __APP_CONFIG__: { csrfToken: 'expired-csrf' },
    fetch: async (url, init) => {
      const u = String(url);
      if (u === '/') {
        return { ok: true, status: 200, text: async () => '<script>window.__APP_CONFIG__ = {"csrfToken": "fresh-csrf-ok"}</script>' };
      }
      const hdrCsrf = init?.headers?.['x-codeium-csrf-token'];
      if (hdrCsrf === 'expired-csrf') {
        return { ok: false, status: 403, json: async () => ({ error: 'forbidden' }) };
      }
      if (u.includes('GetCascadeTrajectoryGeneratorMetadata')) {
        const bodyObj = JSON.parse(init?.body || '{}');
        if (bodyObj.cascadeId === routeA) {
          await new Promise(resolve => { releaseRouteAFetch = resolve; });
          return { ok: true, status: 200, json: async () => ({ generatorMetadata: [] }) };
        }
        if (bodyObj.cascadeId === routeB) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              generatorMetadata: [{
                stepIndices: [1],
                chatModel: {
                  model: 'MODEL_GEMINI_3_1_PRO',
                  usage: { inputTokens: 15000, cacheReadTokens: 35000, outputTokens: 1200 },
                  chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 512000 } }
                }
              }]
            })
          };
        }
      }
      if (u.includes('RetrieveUserQuotaSummary')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            groups: [{
              groupId: 'gemini_main',
              displayName: 'Gemini Models',
              buckets: [
                { bucketId: '5h', remainingFraction: 0.95, resetTime: new Date(Date.now() + 4 * 3600000).toISOString() },
                { bucketId: 'weekly', remainingFraction: 0.99, resetTime: new Date(Date.now() + 6 * 86400000).toISOString() }
              ]
            }]
          })
        };
      }
      if (u.includes('GetUserStatus')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userStatus: {
              cascadeModelConfigData: {
                clientModelConfigs: [{
                  modelOrAlias: { model: 'MODEL_GEMINI_3_1_PRO' },
                  label: 'Gemini 3.1 Pro',
                  quotaInfo: { remainingFraction: 0.95, resetTime: new Date(Date.now() + 4 * 3600000).toISOString() }
                }]
              }
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    },
    contextMeterAPI: {
      getSettings: async () => ({ ok: true, uiPreferences: {}, contextPreferences: {} }),
      saveSettings: async () => ({ ok: true }),
      getQuota: async () => {
        if (quotaFailBackend) {
          return { ok: true, data: { ok: false, error: '本地鉴权失败或已失效', errorKind: 'auth' } };
        }
        return {
          ok: true,
          data: {
            ok: true,
            snapshot: {
              pools: [{
                key: 'shared_gemini_main',
                label: 'Gemini Models',
                sourceType: 'quota_summary_and_configs',
                remainingFraction: 0.9,
                buckets: [
                  { windowKey: '5h', remainingFraction: 0.9, resetAtMs: Date.now() - 60000 },
                  { windowKey: 'weekly', remainingFraction: 0.98, resetAtMs: Date.now() + 5 * 86400000 }
                ]
              }]
            }
          }
        };
      },
      getTokenHistory: async () => ({ ok: true, data: { daily: {}, speedRecords: [] } }),
      getContextUnlockStatus: async () => ({ ok: true, data: { status: 'unsupported', isPlatformSupported: false } }),
      getEnhanceStatus: async () => ({ ok: true, data: { summary: { promptTier: 0, chineseTitleEnabled: false } } }),
      getModulesStatus: async () => ({ ok: true, data: { modules: {} } }),
      getRuntimeInfo: async () => ({ ok: true, backendSource: 'electron-ipc', backendVersion: '0.10.0' }),
      scan: async (id) => {
        if (id === routeA) {
          await new Promise(resolve => { releaseRouteAScan = resolve; });
          return { ok: true, data: { session: { files: [] } } };
        }
        if (id === routeB) {
          routeBScanCalls += 1;
          return { ok: true, data: { session: { files: [], steps: 3 } } };
        }
        return { ok: true, data: { session: { files: [] } } };
      }
    },
    document: {
      hidden: false,
      activeElement: null,
      body: bodyEl,
      documentElement: bodyEl,
      createElement: (t) => new MiniEl(t),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {}
    },
    addEventListener() {},
    removeEventListener() {}
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(coreCode, sb, { filename: 'meter-core.js' });
  vm.runInContext(rendererCode, sb, { filename: 'meter-renderer.js' });
  await new Promise(r => setTimeout(r, 40));
  const api = sb.__AGContextMeter;

  try {
    // Tick on Route A starts in-flight pollTrajectory + runSessionScan (both stay hung)
    api.tickForTest();
    await new Promise(r => setTimeout(r, 40));

    // Switch to Route B WHILE Route A's poll & scan are still hung!
    locObj.pathname = `/c/${routeB}`;
    locObj.href = `https://127.0.0.1:43210/c/${routeB}`;
    api.tickForTest();
    // Release old Route A hung promises AFTER switching
    if (releaseRouteAFetch) releaseRouteAFetch();
    if (releaseRouteAScan) releaseRouteAScan();
    await new Promise(r => setTimeout(r, 60));

    // Route B MUST have recovered from expired CSRF via GET / AND NOT deadlocked on requestBusy/scanBusy!
    const snap = api.snapshot();
    assert.equal(snap.route, routeB);
    assert.ok(Number(snap.latest?.used || 0) >= 50000, 'Route B must populate context tokens after in-flight route switch + 403 CSRF refresh');
    assert.ok(routeBScanCalls >= 1, 'Route B scan must run without being permanently blocked by stale Route A scanBusy');

    // Now simulate backend quota failing with '本地鉴权失败或已失效' while stale multi-window snapshot exists
    quotaFailBackend = true;
    await api.syncQuotaFromHostForTest(true);
    const qState = api.getModelQuotaStateForTest();
    assert.equal(qState.error, '', 'Stale multi-window quota + backend auth error must self-heal via same-origin direct RPC');
    assert.ok(qState.pools.length >= 1, 'Healed quota pools must be populated');
  } finally {
    if (releaseRouteAFetch) releaseRouteAFetch();
    if (releaseRouteAScan) releaseRouteAScan();
    api.dispose();
  }
});
