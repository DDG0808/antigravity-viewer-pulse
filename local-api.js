'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const LOOPBACK_IPV4 = [127, 0, 0, 1].join('.');
const DEFAULT_FALLBACK_CDP_PORTS = [9222, 9223, 9229, 9333];
const ELIGIBLE_CDP_TARGET_TYPES = new Set(['page', 'other', 'webview']);

function getAppDataDir() {
  if (process.env.APPDATA) return process.env.APPDATA;
  return process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : path.join(os.homedir(), '.config');
}

function isLoopbackHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.trim().toLowerCase();
  return h === LOOPBACK_IPV4 || h === 'localhost' || h === '::1' || h === '[::1]';
}

function normalizeLoopbackOrigin(rawOrigin) {
  if (!rawOrigin || typeof rawOrigin !== 'string') return null;
  try {
    const parsed = new URL(rawOrigin.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!isLoopbackHost(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isAntigravityHubUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (!isLoopbackHost(parsed.hostname)) return false;
    if (/^\/devtools\b/i.test(parsed.pathname || '')) return false;
    return true;
  } catch {
    return false;
  }
}

function isAntigravityFallbackWorkbenchUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const s = rawUrl.trim();
  if (!s || /^devtools:/i.test(s) || /^chrome-extension:/i.test(s) || /^data:/i.test(s) || /^about:/i.test(s)) {
    return false;
  }
  if (/devtools/i.test(s)) return false;
  return /^(?:vscode-file|app):\/\//i.test(s) || /workbench\.html/i.test(s);
}

function extractTargetOrigin(rawUrl) {
  const norm = normalizeLoopbackOrigin(rawUrl);
  if (norm) return norm;
  try {
    const u = new URL(String(rawUrl || '').trim());
    if (u.origin && u.origin !== 'null') return u.origin;
    return `${u.protocol}//${u.host || 'antigravity-local'}`;
  } catch {
    return null;
  }
}

/**
 * 从 CDP `/json/list` 目标数组中筛选 Antigravity 主会话窗口目标。
 * 同时兼容传统 BrowserWindow (`type: "page"`) 与新版 Electron BaseWindow + WebContentsView (`type: "other"` / `"webview"`)。
 */
function selectAntigravityTargets(pages) {
  if (!Array.isArray(pages)) return [];
  const candidates = pages.filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (!item.webSocketDebuggerUrl || typeof item.webSocketDebuggerUrl !== 'string') return false;
    const t = String(item.type || '').toLowerCase();
    if (!ELIGIBLE_CDP_TARGET_TYPES.has(t)) return false;
    const url = String(item.url || '').trim();
    if (!url || url.startsWith('data:') || url.startsWith('about:') || url.startsWith('devtools://') || url.startsWith('chrome-extension://')) {
      return false;
    }
    return true;
  });

  const rankType = (item) => {
    const t = String(item.type || '').toLowerCase();
    if (t === 'page') return 0;
    if (t === 'other') return 1;
    return 2;
  };

  const dedupeNestedTargets = (list) => {
    const sorted = [...list].sort((a, b) => rankType(a) - rankType(b));
    const selectedIds = new Set(sorted.map(item => item.id).filter(Boolean));
    const seenWs = new Set();
    const out = [];
    for (const item of sorted) {
      if (item.parentId && selectedIds.has(item.parentId)) continue;
      if (seenWs.has(item.webSocketDebuggerUrl)) continue;
      seenWs.add(item.webSocketDebuggerUrl);
      out.push(item);
    }
    return out;
  };

  const hubTargets = candidates.filter(item => isAntigravityHubUrl(item.url));
  if (hubTargets.length > 0) {
    return dedupeNestedTargets(hubTargets);
  }

  const workbenchTargets = candidates.filter(item => isAntigravityFallbackWorkbenchUrl(item.url));
  return dedupeNestedTargets(workbenchTargets);
}

function getCandidatePortSources(options = {}) {
  const appData = options.appDataDir || getAppDataDir();
  const isTestMode = process.env.AG_METER_TEST_MODE === '1' || process.env.NODE_ENV === 'test';
  if (isTestMode && !options.allowTestPorts) {
    const isIsolatedTemp = String(appData || '').toLowerCase().includes(os.tmpdir().toLowerCase());
    if (!isIsolatedTemp && !options.port) {
      return { isolated: true, candidates: [] };
    }
  }

  const seenPorts = new Set();
  const candidates = [];
  const addPort = (portVal, source) => {
    const n = Number(portVal);
    if (!Number.isInteger(n) || n <= 0 || n > 65535 || seenPorts.has(n)) return;
    seenPorts.add(n);
    candidates.push({ port: n, source });
  };

  if (options.port) addPort(options.port, 'explicit-option');
  if (process.env.AG_CDP_PORT) addPort(process.env.AG_CDP_PORT, 'env:AG_CDP_PORT');

  const portFiles = [
    path.join(appData, 'Antigravity', 'DevToolsActivePort'),
    path.join(appData, 'Google', 'Antigravity', 'DevToolsActivePort'),
    path.join(appData, 'Antigravity IDE', 'DevToolsActivePort')
  ];
  if (!isTestMode) {
    portFiles.push(path.join(os.homedir(), '.antigravity', 'DevToolsActivePort'));
  }

  for (const portFile of portFiles) {
    try {
      if (!fs.existsSync(portFile)) continue;
      const rawFirstLine = String(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0] || '').trim();
      const parsedPort = Number(rawFirstLine);
      if (Number.isInteger(parsedPort) && parsedPort > 0) {
        addPort(parsedPort, `file:${portFile}`);
      }
    } catch {}
  }

  const fallbackPorts = Array.isArray(options.fallbackPorts)
    ? options.fallbackPorts
    : (isTestMode ? [] : DEFAULT_FALLBACK_CDP_PORTS);
  for (const fp of fallbackPorts) {
    addPort(fp, `fallback:${fp}`);
  }

  return { isolated: false, candidates };
}

function fetchCdpJsonList(port, timeoutMs = 1800) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: LOOPBACK_IPV4,
      port: Number(port),
      path: '/json/list',
      agent: false
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) {
            reject(new Error('Invalid /json/list payload'));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/**
 * 统一探测本地运行中的 Antigravity CDP 端口与主窗口目标列表。
 * 自动跳过客户端升级后遗留的失效 DevToolsActivePort，并兼容回环备用端口与 WebContentsView 目标类型。
 */
async function discoverCdpTargets(options = {}) {
  const { isolated, candidates } = getCandidatePortSources(options);
  if (isolated) {
    return {
      ok: false,
      port: null,
      portSource: null,
      allTargets: [],
      matchedTargets: [],
      origins: [],
      stalePorts: [],
      reason: 'test_mode_isolated'
    };
  }

  if (!candidates.length) {
    return {
      ok: false,
      port: null,
      portSource: null,
      allTargets: [],
      matchedTargets: [],
      origins: [],
      stalePorts: [],
      reason: 'cdp_not_enabled'
    };
  }

  const stalePorts = [];
  let reachableEmpty = null;
  const fetchListFn = typeof options._fetchJsonList === 'function' ? options._fetchJsonList : fetchCdpJsonList;

  for (const cand of candidates) {
    const isFallback = String(cand.source || '').startsWith('fallback:');
    const timeoutMs = options.timeoutMs || (isFallback ? 950 : 2200);
    try {
      const pages = await fetchListFn(cand.port, timeoutMs);
      const matchedTargets = selectAntigravityTargets(pages);
      if (matchedTargets.length > 0) {
        const origins = Array.from(new Set(
          matchedTargets.map(item => extractTargetOrigin(item.url)).filter(Boolean)
        ));
        return {
          ok: true,
          port: cand.port,
          portSource: cand.source,
          allTargets: pages,
          matchedTargets,
          origins,
          stalePorts,
          reason: null
        };
      }
      if (!reachableEmpty) {
        reachableEmpty = { port: cand.port, source: cand.source, pages };
      }
    } catch (err) {
      stalePorts.push({
        port: cand.port,
        source: cand.source,
        error: err?.code || err?.message || 'unreachable'
      });
    }
  }

  if (reachableEmpty) {
    return {
      ok: false,
      port: reachableEmpty.port,
      portSource: reachableEmpty.source,
      allTargets: reachableEmpty.pages,
      matchedTargets: [],
      origins: [],
      stalePorts,
      reason: 'no_page_targets'
    };
  }

  const hadActivePortFile = stalePorts.some(s => String(s.source || '').startsWith('file:'));
  return {
    ok: false,
    port: null,
    portSource: stalePorts[0]?.source || null,
    allTargets: [],
    matchedTargets: [],
    origins: [],
    stalePorts,
    reason: hadActivePortFile ? 'cdp_port_unreachable' : 'cdp_not_enabled'
  };
}

function encodeClientWsFrame(opcode, payloadBuf) {
  const len = payloadBuf.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(6);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 0x80 | len;
    mask.copy(header, 2);
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(8);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.allocUnsafe(14);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
    mask.copy(header, 10);
  }
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) {
    masked[i] = payloadBuf[i] ^ mask[i & 3];
  }
  return Buffer.concat([header, masked]);
}

/**
 * 纯原生 Socket RFC6455 CDP WebSocket 会话客户端：
 * 1. 直接通过本机 TCP Socket 发送标准 Upgrade 握手且不带 Origin 头，完全绕过全局 HTTP 代理与 Chromium Origin 403 拦截；
 * 2. 完整支持 7-bit / 16-bit / 64-bit 掩码帧分片与重组（稳定承载 300KB+ 渲染包注入），零外部 WebSocket 依赖。
 */
function openCdpSession(wsUrl, timeoutMs = 4500, wsOptions = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(wsUrl);
    } catch {
      reject(new Error(`Invalid CDP WebSocket URL: ${wsUrl}`));
      return;
    }

    const wsKey = crypto.randomBytes(16).toString('base64');
    const port = Number(parsed.port) || (parsed.protocol === 'wss:' ? 443 : 80);
    const hostname = parsed.hostname === 'localhost' ? LOOPBACK_IPV4 : parsed.hostname;
    const reqPath = `${parsed.pathname || '/'}${parsed.search || ''}`;

    let settled = false;
    let upgraded = false;
    let closed = false;
    let seq = 0;
    let rxBuf = Buffer.alloc(0);
    let fragments = [];
    const pending = new Map();

    const failAllPending = (err) => {
      for (const [, item] of pending) {
        clearTimeout(item.timer);
        item.reject(err);
      }
      pending.clear();
    };

    const socket = typeof wsOptions._createConnection === 'function'
      ? wsOptions._createConnection({ port, hostname })
      : net.connect(port, hostname);
    if (typeof socket.setNoDelay === 'function') socket.setNoDelay(true);

    const connectTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { socket.destroy(); } catch {}
        reject(new Error('CDP WebSocket handshake timeout'));
      }
    }, timeoutMs);

    const buildSession = () => ({
      call(method, params = {}, callTimeoutMs = 6000) {
        if (closed || socket.destroyed) {
          return Promise.reject(new Error('CDP session is closed'));
        }
        return new Promise((resCall, rejCall) => {
          const id = ++seq;
          const timer = setTimeout(() => {
            pending.delete(id);
            rejCall(new Error('CDP eval timeout'));
          }, callTimeoutMs);
          pending.set(id, { resolve: resCall, reject: rejCall, timer });
          try {
            const payload = Buffer.from(JSON.stringify({ id, method, params }), 'utf8');
            socket.write(encodeClientWsFrame(0x01, payload));
          } catch (writeErr) {
            clearTimeout(timer);
            pending.delete(id);
            rejCall(writeErr);
          }
        });
      },
      evaluate(expression, evalTimeoutMs = 6000, extraParams = {}) {
        return this.call('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
          ...extraParams
        }, evalTimeoutMs);
      },
      close() {
        if (closed) return;
        closed = true;
        rxBuf = Buffer.alloc(0);
        fragments = [];
        failAllPending(new Error('CDP session closed locally'));
        socket.removeAllListeners('data');
        if (!socket.destroyed) {
          try {
            socket.write(encodeClientWsFrame(0x08, Buffer.alloc(0)));
            socket.end();
          } catch {}
          setTimeout(() => {
            try { socket.destroy(); } catch {}
          }, 60).unref?.();
        }
      }
    });

    const MAX_WS_PAYLOAD_BYTES = 32 * 1024 * 1024;
    let fragmentsBytes = 0;

    const parseWsFrames = () => {
      while (rxBuf.length >= 2) {
        const b0 = rxBuf[0];
        const b1 = rxBuf[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const isMasked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (rxBuf.length < 4) return;
          payloadLen = rxBuf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rxBuf.length < 10) return;
          payloadLen = Number(rxBuf.readBigUInt64BE(2));
          offset = 10;
        }

        if (!Number.isSafeInteger(payloadLen) || payloadLen < 0 || payloadLen > MAX_WS_PAYLOAD_BYTES) {
          closed = true;
          rxBuf = Buffer.alloc(0);
          fragments = [];
          try { socket.destroy(); } catch {}
          failAllPending(new Error('CDP WebSocket frame exceeds maximum safe size'));
          return;
        }

        const maskOffset = offset;
        if (isMasked) offset += 4;
        if (rxBuf.length < offset + payloadLen) return;

        const framePayload = Buffer.from(rxBuf.subarray(offset, offset + payloadLen));
        if (isMasked) {
          const maskBytes = rxBuf.subarray(maskOffset, maskOffset + 4);
          for (let i = 0; i < framePayload.length; i++) {
            framePayload[i] ^= maskBytes[i & 3];
          }
        }
        rxBuf = rxBuf.subarray(offset + payloadLen);

        if (opcode === 0x09) {
          if (!closed && !socket.destroyed) {
            try { socket.write(encodeClientWsFrame(0x0a, framePayload)); } catch {}
          }
          continue;
        }
        if (opcode === 0x08) {
          closed = true;
          try { socket.end(); } catch {}
          failAllPending(new Error('CDP WebSocket closed by peer'));
          return;
        }
        if (opcode === 0x0a) {
          continue;
        }
        if (opcode === 0x01 || opcode === 0x00) {
          fragmentsBytes += framePayload.length;
          if (fragmentsBytes > MAX_WS_PAYLOAD_BYTES) {
            closed = true;
            fragments = [];
            fragmentsBytes = 0;
            try { socket.destroy(); } catch {}
            failAllPending(new Error('CDP WebSocket reassembled message exceeds maximum safe size'));
            return;
          }
          fragments.push(framePayload);
          if (fin) {
            const fullText = Buffer.concat(fragments).toString('utf8');
            fragments = [];
            fragmentsBytes = 0;
            try {
              const msg = JSON.parse(fullText);
              if (msg && msg.id !== undefined && pending.has(msg.id)) {
                const entry = pending.get(msg.id);
                pending.delete(msg.id);
                clearTimeout(entry.timer);
                entry.resolve(msg);
              }
            } catch {}
          }
        }
      }
    };

    socket.on('connect', () => {
      const handshake =
        `GET ${reqPath} HTTP/1.1\r\n` +
        `Host: ${parsed.hostname}:${port}\r\n` +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${wsKey}\r\n` +
        'Sec-WebSocket-Version: 13\r\n\r\n';
      socket.write(handshake);
    });

    socket.on('data', (chunk) => {
      if (!chunk || !chunk.length) return;
      rxBuf = rxBuf.length ? Buffer.concat([rxBuf, chunk]) : chunk;

      if (!upgraded) {
        const headerEnd = rxBuf.indexOf('\r\n\r\n');
        if (headerEnd < 0) return;
        const headerText = rxBuf.subarray(0, headerEnd).toString('latin1');
        rxBuf = rxBuf.subarray(headerEnd + 4);
        const statusMatch = headerText.match(/^HTTP\/\d\.\d\s+(\d{3})/i);
        const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
        clearTimeout(connectTimer);
        if (statusCode !== 101) {
          settled = true;
          closed = true;
          try { socket.destroy(); } catch {}
          reject(new Error(`CDP WebSocket upgrade rejected (HTTP ${statusCode || 'invalid'})`));
          return;
        }
        upgraded = true;
        if (!settled) {
          settled = true;
          resolve(buildSession());
        }
      }

      if (upgraded && rxBuf.length > 0) {
        parseWsFrames();
      }
    });

    socket.on('error', (err) => {
      clearTimeout(connectTimer);
      closed = true;
      if (!settled) {
        settled = true;
        reject(err);
      } else {
        failAllPending(err);
      }
    });

    socket.on('close', () => {
      clearTimeout(connectTimer);
      closed = true;
      if (!settled) {
        settled = true;
        reject(new Error('CDP WebSocket closed before handshake completed'));
      } else {
        failAllPending(new Error('CDP WebSocket connection closed'));
      }
    });
  });
}

function request(url, body, token) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? https : http).request(
      url,
      {
        agent: false,
        rejectUnauthorized: false,
        method: body ? 'POST' : 'GET',
        headers: body ? {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': token
        } : {}
      },
      response => {
        let text = '';
        response.on('data', chunk => { text += chunk; });
        response.on('end', () => (
          response.statusCode === 200
            ? resolve(text)
            : reject(new Error(`HTTP ${response.statusCode}: ${text.slice(0, 200)}`))
        ));
      }
    );
    req.setTimeout(20000, () => req.destroy(new Error('Local API timeout')));
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

async function connectOrigin(rawOrigin, page = null, origins = null) {
  const origin = normalizeLoopbackOrigin(rawOrigin);
  if (!origin) {
    throw new Error('非法的本机回环页面地址');
  }
  const html = await request(origin + '/');
  const m = html.match(/window\.__APP_CONFIG__\s*=\s*(.*?);/);
  if (!m) throw new Error('未能提取宿主 CSRF 令牌');
  const token = JSON.parse(m[1]).csrfToken;
  return {
    origin,
    page,
    origins: Array.isArray(origins) && origins.length ? origins : [origin],
    call: async (method, body) => JSON.parse(
      await request(`${origin}/exa.language_server_pb.LanguageServerService/${method}`, body, token)
    )
  };
}

async function connect(options = {}) {
  const explicitOrigin = normalizeLoopbackOrigin(options?.origin);
  if (explicitOrigin) {
    return connectOrigin(explicitOrigin, null, [explicitOrigin]);
  }
  const discovery = await discoverCdpTargets(options);
  if (!discovery.ok || !discovery.matchedTargets.length) {
    throw new Error(`Antigravity window not found (${discovery.reason || 'unavailable'})`);
  }
  const hubTarget = discovery.matchedTargets.find(item => normalizeLoopbackOrigin(item.url)) || discovery.matchedTargets[0];
  const targetOrigin = normalizeLoopbackOrigin(hubTarget.url);
  if (!targetOrigin) {
    throw new Error('Antigravity Hub loopback origin not found');
  }
  const origins = Array.from(new Set(
    discovery.matchedTargets.map(item => normalizeLoopbackOrigin(item.url)).filter(Boolean)
  ));
  return connectOrigin(targetOrigin, hubTarget, origins);
}

module.exports = {
  LOOPBACK_IPV4,
  isLoopbackHost,
  normalizeLoopbackOrigin,
  isAntigravityHubUrl,
  isAntigravityFallbackWorkbenchUrl,
  extractTargetOrigin,
  selectAntigravityTargets,
  discoverCdpTargets,
  openCdpSession,
  connect,
  connectOrigin,
  getAppDataDir
};
