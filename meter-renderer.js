(function () {
  'use strict';

  const METER_VERSION = '0.10.0';
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

  shadow.innerHTML = `<style>\n/* Antigravity Pulse — Spatial Bento HUD Shadow DOM Stylesheet */
:host {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif;
  --font-mono: "SF Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --spring: cubic-bezier(0.22, 1, 0.36, 1);
  --spring-snappy: cubic-bezier(0.32, 0.72, 0, 1);

  --accent: #6366f1;
  --accent-2: #38bdf8;
  --accent-glow: rgba(99, 102, 241, 0.24);
  --emerald: #10b981;
  --amber: #f59e0b;
  --rose: #f43f5e;
  --violet: #a855f7;

  --h1: rgba(99, 102, 241, 0.24);
  --h2: rgba(99, 102, 241, 0.48);
  --h3: rgba(99, 102, 241, 0.76);
  --h4: #818cf8;

  /* Default Theme: Obsidian (深空黑曜) */
  --hud-bg: rgba(13, 15, 22, 0.86);
  --hud-sheet: rgba(15, 17, 25, 0.97);
  --tile-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.052) 0%, rgba(255, 255, 255, 0.018) 100%);
  --tile-hover: linear-gradient(180deg, rgba(255, 255, 255, 0.078) 0%, rgba(255, 255, 255, 0.032) 100%);
  --well-bg: rgba(0, 0, 0, 0.34);
  --pill-bg: rgba(255, 255, 255, 0.068);
  --pill-active: rgba(255, 255, 255, 0.14);

  --line: rgba(255, 255, 255, 0.078);
  --line-hi: rgba(255, 255, 255, 0.16);
  --rim: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  --shadow: 0 36px 90px -12px rgba(0, 0, 0, 0.84), 0 0 0 1px rgba(255, 255, 255, 0.085);

  --fg-1: #f8fafc;
  --fg-2: #94a3b8;
  --fg-3: #64748b;
  --toast-bg: #f8fafc;
  --toast-fg: #090a0f;
  --track: rgba(255, 255, 255, 0.09);
  --h0: rgba(255, 255, 255, 0.045);

  --hud-top: 46px;
  --hud-right: 14px;
  --hud-drawer-top: 38px;

  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  font-family: var(--font-sans);
  color: var(--fg-1);
  line-height: 1.35;
  -webkit-app-region: no-drag;
  user-select: none;
  z-index: 9999;
}

:host([data-dock="floating"]) {
  position: fixed;
  top: 7px;
  right: 136px;
  z-index: 2147483000;
}

:host([data-theme="alabaster"]) {
  --hud-bg: rgba(250, 251, 254, 0.88);
  --hud-sheet: rgba(255, 255, 255, 0.98);
  --tile-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.68) 100%);
  --tile-hover: #ffffff;
  --well-bg: rgba(15, 23, 42, 0.05);
  --pill-bg: rgba(15, 23, 42, 0.058);
  --pill-active: #ffffff;

  --line: rgba(15, 23, 42, 0.08);
  --line-hi: rgba(15, 23, 42, 0.15);
  --rim: inset 0 1px 0 rgba(255, 255, 255, 1);
  --shadow: 0 30px 72px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.085);

  --fg-1: #0f172a;
  --fg-2: #475569;
  --fg-3: #64748b;
  --toast-bg: #0f172a;
  --toast-fg: #f8fafc;
  --track: rgba(15, 23, 42, 0.09);
  --h0: rgba(15, 23, 42, 0.052);
}

:host([data-theme="pitch"]) {
  --hud-bg: rgba(5, 5, 7, 0.95);
  --hud-sheet: rgba(8, 8, 11, 0.99);
  --tile-bg: rgba(255, 255, 255, 0.03);
  --tile-hover: rgba(255, 255, 255, 0.052);
  --well-bg: rgba(255, 255, 255, 0.035);
  --pill-bg: rgba(255, 255, 255, 0.065);
  --pill-active: rgba(255, 255, 255, 0.15);

  --line: rgba(255, 255, 255, 0.085);
  --line-hi: rgba(255, 255, 255, 0.19);
  --rim: inset 0 1px 0 rgba(255, 255, 255, 0.075);
  --shadow: 0 40px 100px rgba(0, 0, 0, 0.96), 0 0 0 1px rgba(255, 255, 255, 0.1);

  --fg-1: #ffffff;
  --fg-2: #a1a1aa;
  --fg-3: #71717a;
  --toast-bg: #ffffff;
  --toast-fg: #050507;
  --track: rgba(255, 255, 255, 0.11);
  --h0: rgba(255, 255, 255, 0.042);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}

button, input {
  font-family: inherit;
  -webkit-app-region: no-drag;
}

button:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent-2);
  outline-offset: 2px;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--line-hi); border-radius: 99px; }

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

[hidden] { display: none !important; }

/* ==================== 顶栏核心：灵动同心双环胶囊 (Dynamic Island) ==================== */
.island-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.dynamic-island {
  height: 28px;
  padding: 0 10px 0 8px;
  border-radius: 999px;
  background: var(--pill-bg);
  border: 1px solid var(--line);
  box-shadow: var(--rim);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--fg-1);
  transition: all 0.22s var(--spring);
  white-space: nowrap;
}

.dynamic-island:hover {
  border-color: var(--line-hi);
  background: var(--pill-active);
  transform: translateY(-0.5px);
}

.dynamic-island.active {
  border-color: var(--accent);
  box-shadow: 0 0 20px -4px var(--accent-glow), var(--rim);
}

.dynamic-island[data-state="warn"] {
  border-color: rgba(245, 158, 11, 0.52);
}

.dynamic-island[data-state="crit"] {
  border-color: rgba(244, 63, 94, 0.65);
  box-shadow: 0 0 16px rgba(244, 63, 94, 0.26);
}

.concentric-dial {
  width: 18px;
  height: 18px;
  transform: rotate(-90deg);
  flex-shrink: 0;
}

.concentric-dial circle {
  transition: stroke-dashoffset 0.5s var(--spring), stroke 0.28s ease;
}

.island-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  font-size: 11.5px;
  font-weight: 600;
}

.island-stat small {
  font-size: 10px;
  font-weight: 500;
  color: var(--fg-2);
}

.island-divider {
  width: 1px;
  height: 11px;
  background: var(--line-hi);
  opacity: 0.55;
}

.island-wave {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--fg-2);
}

.wave-bars {
  display: inline-flex;
  align-items: center;
  gap: 1.5px;
  height: 11px;
}

.wave-bars i {
  width: 2px;
  border-radius: 99px;
  background: var(--fg-3);
  height: 4px;
  transition: height 0.18s ease, background 0.2s ease;
}

:host([data-streaming="true"]) .wave-bars i {
  background: var(--emerald);
}
:host([data-streaming="true"]) .wave-bars i:nth-child(1) { animation: wbar 0.7s infinite 0.0s ease-in-out; }
:host([data-streaming="true"]) .wave-bars i:nth-child(2) { animation: wbar 0.7s infinite 0.15s ease-in-out; }
:host([data-streaming="true"]) .wave-bars i:nth-child(3) { animation: wbar 0.7s infinite 0.3s ease-in-out; }

@keyframes wbar {
  0%, 100% { height: 3px; }
  50% { height: 11px; }
}

/* 4-Stage Responsive Collapse for Narrow Titlebars */
:host([data-layout="compact"]) .island-wave,
:host([data-layout="compact"]) .island-divider {
  display: none;
}

:host([data-layout="minimal"]) .island-wave,
:host([data-layout="minimal"]) .island-divider,
:host([data-layout="minimal"]) .island-quota-sub {
  display: none;
}

:host([data-layout="ring-only"]) .island-wave,
:host([data-layout="ring-only"]) .island-divider,
:host([data-layout="ring-only"]) .island-stat {
  display: none;
}
:host([data-layout="ring-only"]) .dynamic-island {
  padding: 0 5px;
}

/* 悬停微浮窗 Glance Tooltip */
.glance-tooltip {
  position: fixed;
  top: var(--hud-top, 44px);
  right: var(--hud-right, 14px);
  width: 248px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--hud-bg);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  backdrop-filter: blur(28px) saturate(190%);
  border: 1px solid var(--line-hi);
  box-shadow: var(--shadow);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px) scale(0.98);
  transition: opacity 0.18s var(--spring), transform 0.18s var(--spring);
  z-index: 2147483640;
}

.island-anchor:hover .glance-tooltip:not(.hidden-tip) {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.glance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
  margin-bottom: 6px;
}
.glance-row:last-child { margin-bottom: 0; }
.glance-lbl { color: var(--fg-2); }

/* ==================== Spatial Bento HUD 主舞台 ==================== */
.pulse-hud {
  position: fixed;
  top: var(--hud-top, 46px);
  right: var(--hud-right, 14px);
  width: min(724px, calc(100vw - 24px));
  height: min(562px, calc(100vh - 58px));
  border-radius: 22px;
  background: var(--hud-bg);
  -webkit-backdrop-filter: blur(42px) saturate(200%);
  backdrop-filter: blur(42px) saturate(200%);
  box-shadow: var(--shadow), var(--rim);
  display: flex;
  overflow: hidden;
  z-index: 2147483645;
  transform-origin: top right;
  transition:
    opacity 0.24s var(--spring),
    transform 0.28s var(--spring),
    width 0.28s var(--spring),
    height 0.28s var(--spring),
    top 0.28s var(--spring),
    right 0.28s var(--spring),
    border-radius 0.28s var(--spring);
}

.pulse-hud::before {
  content: "";
  position: absolute;
  width: 340px;
  height: 340px;
  top: -120px;
  left: 20px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
  transition: background 0.4s ease;
}

.pulse-hud.closed {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: scale(0.94) translateY(-10px);
}

/* 右侧贴边常驻抽屉模式 */
:host([data-mode="drawer"]) .pulse-hud {
  top: var(--hud-drawer-top, 38px);
  right: 0;
  width: min(692px, 95vw);
  height: calc(100vh - var(--hud-drawer-top, 38px));
  border-radius: 0;
  border-left: 1px solid var(--line-hi);
}

:host([data-mode="drawer"]) .pulse-hud.closed {
  transform: translateX(100%);
}

/* 左侧 62px 空间导航纵轨 */
.hud-nav-rail {
  position: relative;
  z-index: 2;
  width: 62px;
  padding: 14px 0;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.rail-btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  transition: all 0.2s var(--spring);
}

.rail-btn span {
  font-size: 9.5px;
  font-weight: 550;
  letter-spacing: -0.01em;
}

.rail-btn:hover {
  color: var(--fg-1);
  background: var(--pill-bg);
}

.rail-btn.active {
  color: var(--fg-1);
  background: var(--pill-active);
  border-color: var(--line-hi);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18), var(--rim);
}

.rail-btn.active svg {
  stroke: var(--accent);
}

.rail-mini-btn {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--fg-2);
  display: grid;
  place-items: center;
  cursor: pointer;
  position: relative;
  transition: all 0.16s ease;
}

.rail-mini-btn:hover {
  color: var(--fg-1);
  background: var(--pill-bg);
}

.badge-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 6px var(--emerald);
}

/* 右侧空间主画布 */
.hud-canvas {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 15px 18px;
  overflow: hidden;
}

.canvas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.header-context {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.header-title {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--fg-1);
  white-space: nowrap;
}

.model-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 99px;
  background: var(--pill-bg);
  border: 1px solid var(--line);
  font-size: 11px;
  color: var(--fg-2);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-capsule i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--emerald);
  flex-shrink: 0;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 重启提示胶囊按钮 */
.restart-pill {
  height: 24px;
  padding: 0 9px;
  border-radius: 99px;
  border: 1px solid rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.14);
  color: var(--amber);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.16s ease;
}
.restart-pill:hover {
  background: rgba(245, 158, 11, 0.24);
}

/* 丝滑胶囊分段器 */
.seg-bar {
  display: inline-flex;
  padding: 2.5px;
  border-radius: 9px;
  background: var(--well-bg);
  border: 1px solid var(--line);
  gap: 2px;
}

.seg-item {
  height: 22px;
  padding: 0 8.5px;
  border: none;
  border-radius: 6.5px;
  background: transparent;
  color: var(--fg-2);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s var(--spring-snappy);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.seg-item:hover {
  color: var(--fg-1);
}

.seg-item.on {
  background: var(--pill-active);
  color: var(--fg-1);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

/* 空间视图 */
.space-view {
  display: none;
  flex: 1;
  min-height: 0;
  animation: spaceEnter 0.22s var(--spring);
}

.space-view.active {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

@keyframes spaceEnter {
  from { opacity: 0; transform: scale(0.988) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.tile {
  position: relative;
  background: var(--tile-bg);
  border: 1px solid var(--line);
  box-shadow: var(--rim);
  border-radius: 16px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.tile.interactive {
  cursor: pointer;
}

.tile.interactive:hover {
  border-color: var(--line-hi);
  background: var(--tile-hover);
}

.tile-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-num {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--fg-1);
}

.hero-unit {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fg-2);
  margin-left: 3px;
  letter-spacing: 0;
}

.tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2.5px 8px;
  border-radius: 99px;
  background: rgba(16, 185, 129, 0.14);
  color: var(--emerald);
  white-space: nowrap;
}
.tag.warn { background: rgba(245, 158, 11, 0.16); color: var(--amber); }
.tag.crit { background: rgba(244, 63, 94, 0.17); color: var(--rose); }
.tag.neutral { background: var(--pill-bg); color: var(--fg-2); font-weight: 500; }

.ghost-link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 0;
  white-space: nowrap;
}
.ghost-link:hover { filter: brightness(1.18); }

/* ==================== SPACE 1: 实时驾驶舱 ==================== */
.cockpit-top-grid {
  display: grid;
  grid-template-columns: 1.24fr 0.96fr;
  gap: 11px;
  flex: 1.15;
  min-height: 0;
}

.ctx-main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 2px 0;
}

.ctx-budget-pill {
  margin-top: 9px;
  height: 24px;
  padding: 0 9.5px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: var(--well-bg);
  color: var(--fg-2);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s var(--spring);
}

.ctx-budget-pill strong {
  color: var(--fg-1);
  font-weight: 650;
}

.ctx-budget-pill .jump-hint {
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 10.5px;
  font-weight: 550;
  margin-left: 2px;
}

.ctx-budget-pill:hover {
  border-color: var(--line-hi);
  background: var(--pill-bg);
  transform: translateY(-0.5px);
}

.arc-gauge-wrap {
  position: relative;
  width: 100px;
  height: 100px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.arc-gauge-wrap svg {
  width: 100px;
  height: 100px;
  transform: rotate(-90deg);
}

.arc-gauge-wrap circle {
  transition: stroke-dashoffset 0.55s var(--spring), stroke 0.28s ease;
}

.arc-center {
  position: absolute;
  text-align: center;
}

.dna-track {
  height: 7px;
  border-radius: 99px;
  background: var(--well-bg);
  display: flex;
  gap: 2px;
  overflow: hidden;
}

.dna-seg {
  height: 100%;
  min-width: 3px;
  border-radius: 3px;
  cursor: pointer;
  transition: opacity 0.18s ease, width 0.35s var(--spring);
}

.dna-track:hover .dna-seg { opacity: 0.32; }
.dna-track .dna-seg:hover { opacity: 1; }

.cache-strip {
  padding: 8px 11px;
  border-radius: 11px;
  background: var(--well-bg);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.cache-strip:hover {
  border-color: var(--line-hi);
  background: var(--pill-bg);
}

.cache-drill-link {
  font-size: 10.5px;
  font-weight: 550;
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
  transition: filter 0.16s ease, transform 0.16s ease;
}

.cache-strip:hover .cache-drill-link {
  filter: brightness(1.18);
  transform: translateX(1px);
}

.cache-strip[data-cache-state="drop"] {
  border-color: rgba(244, 63, 94, 0.48);
  background: rgba(244, 63, 94, 0.08);
}

.cache-strip[data-cache-state="drop"] .cache-drill-link {
  color: var(--rose);
  font-weight: 650;
}

.audit-sess-banner {
  padding: 9px 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.cache-bar {
  height: 4px;
  border-radius: 99px;
  background: var(--track);
  overflow: hidden;
}

.cache-bar i {
  display: block;
  height: 100%;
  width: 0%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--accent-2), var(--emerald));
  transition: width 0.45s var(--spring), background 0.25s ease;
}

.quota-trio {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.pool-mini-card {
  padding: 9px 11px;
  border-radius: 13px;
  background: var(--well-bg);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all 0.18s var(--spring);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}

.pool-mini-card:hover,
.pool-mini-card.selected {
  border-color: var(--line-hi);
  background: var(--pill-bg);
  transform: translateY(-1px);
}

.pool-bucket-stack {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.pool-bucket-row {
  display: flex;
  flex-direction: column;
  gap: 2.5px;
}

.pool-bucket-hdr {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
  font-size: 10px;
  line-height: 1.2;
}

.thin-bar {
  height: 3.5px;
  border-radius: 99px;
  background: var(--track);
  overflow: hidden;
}

.thin-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width 0.45s var(--spring);
}

/* ==================== SPACE 2: 模型预算引擎 ==================== */
.models-split {
  display: grid;
  grid-template-columns: 214px 1fr;
  gap: 11px;
  flex: 1;
  min-height: 0;
}

.vendor-rail {
  background: var(--tile-bg);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 9px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow-y: auto;
  min-height: 0;
}

.m-row-btn {
  padding: 8px 10px;
  border-radius: 11px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-1);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  transition: all 0.16s ease;
}

.m-row-btn:hover { background: var(--pill-bg); }
.m-row-btn.on {
  background: var(--pill-active);
  border-color: var(--line-hi);
}

.scrubber-box {
  background: var(--well-bg);
  border: 1px solid var(--line);
  border-radius: 13px;
  padding: 12px 14px;
}

.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 99px;
  background: var(--track);
  outline: none;
  margin: 11px 0 8px;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  cursor: grab;
  transition: transform 0.15s ease;
}

.range-slider::-webkit-slider-thumb:active {
  transform: scale(1.14);
  cursor: grabbing;
}

.detent-marks {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
}

.detent-marks button {
  border: none;
  background: transparent;
  color: var(--fg-2);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  padding: 2.5px 6px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.detent-marks button:hover,
.detent-marks button.on {
  color: var(--fg-1);
  background: var(--pill-bg);
}

.pipeline-3 {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 6px;
  background: var(--well-bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 8px 12px;
}

.pipe-node { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pipe-node small { font-size: 9.5px; color: var(--fg-3); }
.pipe-node strong { font-size: 11.5px; color: var(--fg-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pipe-arrow { color: var(--fg-3); font-size: 10.5px; }

/* ==================== SPACE 3: 脉搏热力图与订阅账本 ==================== */
.heat-matrix {
  display: grid;
  grid-template-columns: repeat(var(--hm-cols, 36), 1fr);
  gap: 2.5px;
  padding: 4px 0;
  align-content: center;
  flex: 1;
}

.hm-col {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 2.5px;
}

.hm-dot {
  aspect-ratio: 1;
  border-radius: 2.5px;
  background: var(--h0);
  cursor: pointer;
  transition: transform 0.14s ease;
}

.hm-dot:hover {
  transform: scale(1.38);
  z-index: 3;
  box-shadow: 0 0 0 1px var(--fg-1);
}

.hm-dot[data-v="1"] { background: var(--h1); }
.hm-dot[data-v="2"] { background: var(--h2); }
.hm-dot[data-v="3"] { background: var(--h3); }
.hm-dot[data-v="4"] { background: var(--h4); }

.nav-step-btn {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--well-bg);
  color: var(--fg-2);
  font-size: 11px;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
}
.nav-step-btn:hover:not(:disabled) {
  color: var(--fg-1);
  border-color: var(--line-hi);
}
.nav-step-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* ==================== SPACE 4: 内核增强工坊 2x2 Bento ==================== */
.studio-bento {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.apple-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 99px;
  border: none;
  background: var(--track);
  cursor: pointer;
  transition: background 0.22s ease;
  flex-shrink: 0;
}

.apple-toggle::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.32);
  transition: transform 0.22s var(--spring-snappy);
}

.apple-toggle.on { background: var(--emerald); }
.apple-toggle.on::after { transform: translateX(16px); }

.topo-nodes {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 11px;
  background: var(--well-bg);
  border: 1px solid var(--line);
  font-size: 10px;
}

.topo-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fg-2);
  font-weight: 500;
}

.topo-step i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg-3);
}

.topo-step.ok { color: var(--fg-1); }
.topo-step.ok i { background: var(--emerald); box-shadow: 0 0 6px var(--emerald); }
.topo-step.fail { color: var(--rose); }
.topo-step.fail i { background: var(--rose); }

.theme-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.th-card {
  padding: 7px 6px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--well-bg);
  color: var(--fg-2);
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: all 0.16s ease;
}

.th-card:hover { color: var(--fg-1); }
.th-card.on {
  border-color: var(--accent);
  color: var(--fg-1);
  background: var(--pill-active);
}

.chroma-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}

.c-dot {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.16s ease;
}

.c-dot:hover { transform: scale(1.15); }
.c-dot.on { border-color: var(--fg-1); transform: scale(1.12); }

/* ==================== 二级毛玻璃滑入覆层 (Glass Sheet) ==================== */
.glass-sheet {
  position: absolute;
  inset: 0;
  background: var(--hud-sheet);
  -webkit-backdrop-filter: blur(36px);
  backdrop-filter: blur(36px);
  z-index: 30;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 11px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(16px);
  transition: opacity 0.22s var(--spring), transform 0.24s var(--spring), visibility 0.22s ease;
  overflow-y: auto;
}

.glass-sheet.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0);
}

.action-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--line-hi);
  background: var(--pill-bg);
  color: var(--fg-1);
  font-size: 11px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.16s ease;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  background: var(--pill-active);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.action-btn.primary {
  background: var(--accent);
  border-color: transparent;
  color: #ffffff;
}
.action-btn.primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.clean-field {
  height: 28px;
  padding: 0 9px;
  border-radius: 8px;
  border: 1px solid var(--line-hi);
  background: var(--well-bg);
  color: var(--fg-1);
  font-size: 11.5px;
  outline: none;
  user-select: text;
}

.clean-field:focus {
  border-color: var(--accent);
}

/* 42 国汇率搜索网格 */
.country-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  max-height: 196px;
  overflow-y: auto;
  padding-right: 2px;
}

.country-pill {
  padding: 7px 9px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--well-bg);
  color: var(--fg-1);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.country-pill:hover,
.country-pill.on {
  border-color: var(--accent);
  background: var(--pill-active);
}

.file-audit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  max-height: 132px;
  overflow-y: auto;
}

.file-audit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--pill-bg);
  font-size: 11px;
}

.file-audit-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg-1);
}

/* ==================== v0.10.0 新增交互组件样式 ==================== */
.snap-pill-btn {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--pill-bg);
  color: var(--fg-2);
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.16s ease;
}

.snap-pill-btn:hover {
  border-color: var(--line-hi);
  background: var(--pill-active);
  color: var(--fg-1);
}

.mini-export-btn {
  height: 20px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--pill-bg);
  color: var(--fg-2);
  font-size: 9.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-export-btn:hover {
  border-color: var(--accent);
  color: var(--fg-1);
  background: var(--pill-active);
}

.model-rank-panel {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
  min-height: 0;
  max-height: 158px;
  overflow-y: auto;
  padding-right: 2px;
}

.model-rank-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 8px;
  border-radius: 8px;
  background: var(--well-bg);
  border: 1px solid var(--line);
}

.model-rank-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.proxy-profile-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.proxy-profile-chip {
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--well-bg);
  color: var(--fg-2);
  font-size: 10px;
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 150px;
  transition: all 0.15s ease;
}

.proxy-profile-chip:hover {
  border-color: var(--line-hi);
  color: var(--fg-1);
}

.proxy-profile-chip.active {
  border-color: var(--accent);
  background: var(--accent-glow);
  color: var(--fg-1);
}

.proxy-profile-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proxy-profile-del {
  font-size: 11px;
  line-height: 1;
  opacity: 0.65;
  padding: 0 1px;
}

.proxy-profile-del:hover {
  opacity: 1;
  color: var(--rose);
}

.proxy-profile-editor {
  display: flex;
  gap: 5px;
  align-items: center;
}

.turn-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-height: 0;
  max-height: 152px;
  overflow-y: auto;
  padding-right: 2px;
}

.turn-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 7px;
  border-radius: 8px;
  background: var(--pill-bg);
  border: 1px solid transparent;
  font-size: 10.5px;
}

.turn-row.compacted {
  border-color: rgba(245, 158, 11, 0.48);
  background: rgba(245, 158, 11, 0.08);
}

.turn-row.cache-drop {
  border-color: rgba(244, 63, 94, 0.45);
  background: rgba(244, 63, 94, 0.08);
}

.turn-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.turn-row-sub {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  color: var(--fg-2);
}

.turn-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 99px;
  font-size: 9.5px;
  font-weight: 600;
}

.turn-badge.compact {
  background: rgba(245, 158, 11, 0.2);
  color: var(--amber);
}

.turn-badge.drop {
  background: rgba(244, 63, 94, 0.18);
  color: var(--rose);
}

.turn-badge.hit {
  background: rgba(16, 185, 129, 0.15);
  color: var(--emerald);
}

/* 轻反馈胶囊 Toast */
.hud-toast {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  padding: 6px 14px;
  border-radius: 99px;
  background: var(--toast-bg);
  color: var(--toast-fg);
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  opacity: 0;
  pointer-events: none;
  transition: all 0.22s var(--spring);
  z-index: 80;
  max-width: 86%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}\n</style>\n<!-- Antigravity Pulse — Spatial Bento HUD Shadow DOM Template -->
<div class="island-anchor" id="islandAnchor">
  <div class="dynamic-island" id="dynamicIsland" data-state="normal" role="button" tabindex="0" aria-label="Antigravity Pulse" title="Antigravity Pulse (Alt+Shift+P)">
    <svg class="concentric-dial" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="var(--track)" stroke-width="2"></circle>
      <circle id="dialCtx" cx="10" cy="10" r="7.5" fill="none" stroke="var(--accent)" stroke-width="2"
        stroke-linecap="round" stroke-dasharray="47.12" stroke-dashoffset="47.12"></circle>
      <circle cx="10" cy="10" r="4.3" fill="none" stroke="var(--track)" stroke-width="1.8"></circle>
      <circle id="dialQuota" cx="10" cy="10" r="4.3" fill="none" stroke="var(--emerald)" stroke-width="1.8"
        stroke-linecap="round" stroke-dasharray="27.02" stroke-dashoffset="0"></circle>
    </svg>

    <span class="island-stat mono">
      <span id="islandCtxPct">--%</span>
      <small class="island-quota-sub" id="islandQuotaSub">· --%</small>
    </span>

    <span class="island-divider"></span>

    <span class="island-wave">
      <span class="wave-bars"><i></i><i></i><i></i></span>
      <span class="mono" id="islandTps">--</span>
      <small>tok/s</small>
    </span>
  </div>

  <!-- 悬停极简微浮窗 -->
  <div class="glance-tooltip" id="glanceTip">
    <div class="glance-row">
      <span class="glance-lbl" data-i18n="tipCtx">上下文窗口</span>
      <strong class="mono" id="tipCtxVal">-- / --</strong>
    </div>
    <div class="glance-row">
      <span class="glance-lbl" id="tipPoolLbl">共享额度池</span>
      <strong class="mono" id="tipQuotaVal" style="color:var(--emerald)">--%</strong>
    </div>
    <div class="glance-row">
      <span class="glance-lbl" data-i18n="tipCache">缓存命中率</span>
      <strong class="mono" id="tipCacheVal" style="color:var(--emerald)">--%</strong>
    </div>
    <div class="glance-row">
      <span class="glance-lbl" data-i18n="tipToday">今日累计</span>
      <strong class="mono" id="tipTodayVal">0 tok · $0.00</strong>
    </div>
  </div>
</div>

<!-- ==================== Spatial Bento HUD 主舞台 ==================== -->
<section class="pulse-hud closed" id="pulseHud" aria-label="Antigravity Pulse Spatial HUD">
  <!-- 左侧 62px 空间导航纵轨 -->
  <nav class="hud-nav-rail">
    <div class="nav-group">
      <button class="rail-btn active" type="button" data-space="cockpit" title="实时总览驾驶舱">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/></svg>
        <span data-i18n="navCockpit">总览</span>
      </button>

      <button class="rail-btn" type="button" data-space="budget" title="模型独立预算与底座解锁">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
        <span data-i18n="navBudget">预算</span>
      </button>

      <button class="rail-btn" type="button" data-space="ledger" title="Token 脉搏热力图与订阅账本">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-5 4 3 5-7"/></svg>
        <span data-i18n="navLedger">账本</span>
      </button>

      <button class="rail-btn" type="button" data-space="studio" title="内核增强、免 TUN 拓扑与主题工坊">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        <span data-i18n="navStudio">工坊</span>
      </button>
    </div>

    <div class="nav-group">
      <button class="rail-mini-btn" id="btnOpenUpdateSheet" type="button" title="版本检查与热更新 (v0.10.0)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 21h14"/></svg>
        <i class="badge-dot" id="updateBadgeDot" hidden></i>
      </button>
      <button class="rail-mini-btn" id="btnToggleDock" type="button" title="切换悬浮玻璃窗 / 右侧贴边抽屉">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      </button>
      <button class="rail-mini-btn" id="btnHideHud" type="button" title="收起面板 (Esc / Alt+Shift+P)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
  </nav>

  <!-- 右侧空间主画布 -->
  <div class="hud-canvas">
    <div class="canvas-header">
      <div class="header-context">
        <span class="header-title" id="spaceHeading" data-i18n="headCockpit">实时驾驶舱</span>
        <span class="model-capsule mono" id="activeModelPill"><i></i><span id="activeModelTxt">等待会话...</span></span>
      </div>

      <div class="header-tools">
        <button class="restart-pill" id="btnRestartBanner" type="button" hidden>
          <span>↻</span><span data-i18n="restartNow">重启生效</span>
        </button>
        <button class="snap-pill-btn" id="btnCopySnapshot" type="button" title="一键复制当前会话遥测 Markdown 摘要 (Alt+Shift+P 呼出面板)">
          <span data-i18n="copySnapBtn">复制摘要</span>
        </button>
        <div class="seg-bar" id="panelLangSeg">
          <button class="seg-item on" type="button" data-plang="zh-CN">简</button>
          <button class="seg-item" type="button" data-plang="zh-TW">繁</button>
          <button class="seg-item" type="button" data-plang="en">EN</button>
        </div>
      </div>
    </div>

    <!-- ==================== SPACE 1: 实时总览驾驶舱 ==================== -->
    <div class="space-view active" id="space-cockpit">
      <div class="cockpit-top-grid">
        <!-- 左卡：上下文圆环 + 快捷档位 + DNA 6 段光带 -->
        <div class="tile">
          <div class="tile-label">
            <span data-i18n="ctxWindowTitle">会话上下文窗口</span>
            <span class="tag neutral" id="ctxHealthTag">待机中</span>
          </div>

          <div class="ctx-main-row">
            <div style="min-width:0;flex:1">
              <div class="hero-num mono"><span id="heroUsedVal">0</span><span class="hero-unit" id="heroUsedUnit">tok</span></div>
              <div>
                <button class="ctx-budget-pill mono" id="btnJumpBudget" type="button" title="前往「预算」空间调整模型上下文上限">
                  <span data-i18n="limitLabel">上限</span>
                  <strong id="heroLimitLbl">256K</strong>
                  <span class="jump-hint" data-i18n="jumpHintBudget">预算 ›</span>
                </button>
              </div>
              <div style="font-size:11px;color:var(--fg-2);margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="mono" id="sessionCostTxt">本轮 $0.000 · 会话 $0.00</div>
            </div>

            <div class="arc-gauge-wrap">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="41" fill="none" stroke="var(--track)" stroke-width="7.2"></circle>
                <circle id="heroCtxCircle" cx="50" cy="50" r="41" fill="none" stroke="var(--accent)" stroke-width="7.2"
                  stroke-linecap="round" stroke-dasharray="257.61" stroke-dashoffset="257.61"></circle>
              </svg>
              <div class="arc-center">
                <div class="mono" style="font-size:18px;font-weight:700;letter-spacing:-0.03em" id="heroPctTxt">0.0%</div>
                <div style="font-size:9.5px;color:var(--fg-3)" id="heroSourceMode">等待响应</div>
              </div>
            </div>
          </div>

          <div class="cache-strip" id="cacheTelemetryBox" data-cache-state="idle" data-open-sheet="auditSheet" title="当前展示整个会话的累计缓存命中率，点击查看最近一次模型请求明细">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px">
              <span style="display:inline-flex;align-items:baseline;gap:5px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                <span style="color:var(--fg-2)" data-i18n="cacheHitLabel">会话命中</span>
                <strong class="mono" style="font-size:12.5px;color:var(--fg-2)" id="heroCacheHitPct">--%</strong>
                <span class="mono" style="color:var(--fg-3);font-size:10px" id="heroCacheSessSub">· 等待请求</span>
              </span>
              <span class="cache-drill-link" id="cacheStateBadge" data-i18n="latestReqJump">最近请求 ›</span>
            </div>
            <div class="cache-bar"><i id="cacheHitBarFill" style="width:0%"></i></div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:10.5px;gap:8px">
              <span style="color:var(--fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="dnaReadout">上下文构成 · 悬停色带查看占比</span>
              <button class="ghost-link" type="button" data-open-sheet="auditSheet"><span id="auditLinkTxt">双账本与附件</span> ›</button>
            </div>
            <div class="dna-track" id="dnaTrack">
              <div class="dna-seg" data-seg="sys" style="width:20%;background:#64748b"></div>
              <div class="dna-seg" data-seg="chat" style="width:20%;background:var(--accent)"></div>
              <div class="dna-seg" data-seg="think" style="width:15%;background:var(--violet)"></div>
              <div class="dna-seg" data-seg="tool" style="width:25%;background:var(--accent-2)"></div>
              <div class="dna-seg" data-seg="ckpt" style="width:10%;background:var(--amber)"></div>
              <div class="dna-seg" data-seg="file" style="width:10%;background:var(--emerald)"></div>
            </div>
          </div>
        </div>

        <!-- 右卡：实时流式速率曲线 + 首字延迟 + 决斗榜入口 -->
        <div class="tile">
          <div class="tile-label">
            <span data-i18n="streamTelemetry">流式生成遥测</span>
            <button class="ghost-link" type="button" data-open-sheet="speedSheet"><span data-i18n="speedDuelLink">多模型测速决斗</span> ›</button>
          </div>

          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:3px;gap:6px">
            <div class="hero-num mono"><span id="heroTpsVal">--</span><span class="hero-unit">tok/s</span></div>
            <span class="tag neutral" id="tpsDeltaTag">等待生成</span>
          </div>

          <canvas id="waveCanvas" width="268" height="70" style="width:100%;height:70px;margin:4px 0"></canvas>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:8px;border-top:1px solid var(--line)">
            <div>
              <div style="font-size:9.5px;color:var(--fg-3)">TTFT</div>
              <div class="mono" style="font-size:12.5px;font-weight:600;margin-top:2px" id="heroTtftVal">--</div>
            </div>
            <div>
              <div style="font-size:9.5px;color:var(--fg-3)" data-i18n="roundOutput">本轮输出</div>
              <div class="mono" style="font-size:12.5px;font-weight:600;margin-top:2px" id="heroOutTok">--</div>
            </div>
            <div>
              <div style="font-size:9.5px;color:var(--fg-3)" data-i18n="roundDur">总耗时</div>
              <div class="mono" style="font-size:12.5px;color:var(--fg-1);font-weight:600;margin-top:2px" id="heroDurSec">--</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 下半区：共享模型额度池三联卡 -->
      <div class="tile" style="padding:12px 15px">
        <div class="tile-label" style="margin-bottom:8px">
          <span style="display:flex;align-items:center;gap:8px;min-width:0">
            <span data-i18n="sharedPoolsTitle">共享模型额度池</span>
            <span class="mono" style="color:var(--fg-3);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="quotaMetaLine">尚未同步配额</span>
          </span>
          <button class="ghost-link" id="btnSyncQuotaNow" type="button">↻ <span data-i18n="syncQuotaBtn">同步配额</span></button>
        </div>

        <div class="quota-trio" id="quotaTrioGrid">
          <div class="pool-mini-card selected">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11.5px;font-weight:600">Gemini 主力池</span>
              <span class="mono" style="font-size:10px;color:var(--fg-3)">同步中</span>
            </div>
            <div class="pool-bucket-stack">
              <div class="pool-bucket-row">
                <div class="pool-bucket-hdr mono"><span style="color:var(--fg-2)">5h · --:--</span><strong style="color:var(--fg-2)">--%</strong></div>
                <div class="thin-bar"><i style="width:0%;background:var(--emerald)"></i></div>
              </div>
              <div class="pool-bucket-row">
                <div class="pool-bucket-hdr mono"><span style="color:var(--fg-2)">周 · --</span><strong style="color:var(--fg-2)">--%</strong></div>
                <div class="thin-bar"><i style="width:0%;background:var(--emerald)"></i></div>
              </div>
            </div>
          </div>
          <div class="pool-mini-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11.5px;font-weight:600">Claude / 第三方池</span>
              <span class="mono" style="font-size:10px;color:var(--fg-3)">同步中</span>
            </div>
            <div class="pool-bucket-stack">
              <div class="pool-bucket-row">
                <div class="pool-bucket-hdr mono"><span style="color:var(--fg-2)">5h · --:--</span><strong style="color:var(--fg-2)">--%</strong></div>
                <div class="thin-bar"><i style="width:0%;background:var(--amber)"></i></div>
              </div>
              <div class="pool-bucket-row">
                <div class="pool-bucket-hdr mono"><span style="color:var(--fg-2)">周 · --</span><strong style="color:var(--fg-2)">--%</strong></div>
                <div class="thin-bar"><i style="width:0%;background:var(--amber)"></i></div>
              </div>
            </div>
          </div>
          <div class="pool-mini-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11.5px;font-weight:600">Gemini Argon</span>
              <span class="mono" style="font-size:10px;color:var(--fg-3)">同步中</span>
            </div>
            <div class="pool-bucket-stack">
              <div class="pool-bucket-row">
                <div class="pool-bucket-hdr mono"><span style="color:var(--fg-2)">周 · --</span><strong style="color:var(--fg-2)">--%</strong></div>
                <div class="thin-bar"><i style="width:0%;background:var(--accent-2)"></i></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== SPACE 2: 模型独立预算与磁吸滑轨引擎 ==================== -->
    <div class="space-view" id="space-budget">
      <div class="models-split">
        <div class="vendor-rail">
          <div class="seg-bar" style="width:100%;display:grid;grid-template-columns:1fr 1fr;margin-bottom:4px" id="budgetScopeSeg">
            <button class="seg-item on" type="button" data-bscope="per_model" data-i18n="scopePerModel">按模型独立</button>
            <button class="seg-item" type="button" data-bscope="unified" data-i18n="scopeUnified">全局统一</button>
          </div>
          <div id="budgetModelList" style="display:flex;flex-direction:column;gap:4px"></div>
        </div>

        <div class="tile" style="gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div style="min-width:0">
              <div style="font-size:10px;color:var(--fg-3)" data-i18n="selectedModelBudget">当前选中模型预算配置</div>
              <div style="font-size:15.5px;font-weight:700;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="bModelTitle">Gemini 3.1 Pro</div>
            </div>
            <span class="tag neutral" id="binaryUnlockBadge">检测底座中...</span>
          </div>

          <div class="scrubber-box">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <span style="font-size:10.5px;color:var(--fg-2)" id="budgetHintRange">拖动滑轨或输入精确预算 (16,384 – 2,097,152)</span>
              <div style="display:flex;align-items:center;gap:5px">
                <input class="clean-field mono" id="exactTokenInput" type="number" min="16384" max="2097152" step="1024" value="256000" style="width:104px;text-align:right;font-weight:600" />
                <span style="font-size:10px;color:var(--fg-3)">tok</span>
              </div>
            </div>

            <input class="range-slider" id="budgetSlider" type="range" min="16384" max="2097152" step="1024" value="256000" />

            <div class="detent-marks" id="detentBtns">
              <button type="button" data-det="default" data-i18n="detDefault">默认 256K</button>
              <button type="button" data-det="128000">128K</button>
              <button type="button" data-det="512000">512K</button>
              <button type="button" data-det="max" data-i18n="detMax">理论最大</button>
              <button type="button" data-det="1048576">1M</button>
              <button type="button" data-det="dynamic">2M DYN</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            <div class="scrubber-box" style="padding:8px 10px">
              <div style="font-size:9.5px;color:var(--fg-3)" data-i18n="specTotalWin">模型总窗口</div>
              <div class="mono" style="font-size:12.5px;font-weight:650;margin-top:2px" id="bSpecWin">1,048,576</div>
            </div>
            <div class="scrubber-box" style="padding:8px 10px">
              <div style="font-size:9.5px;color:var(--fg-3)" data-i18n="specMaxOut">最大输出上限</div>
              <div class="mono" style="font-size:12.5px;font-weight:650;margin-top:2px" id="bSpecOut">65,536</div>
            </div>
            <div class="scrubber-box" style="padding:8px 10px">
              <div style="font-size:9.5px;color:var(--fg-3)" data-i18n="specMaxInput">理论最大输入</div>
              <div class="mono" style="font-size:12.5px;font-weight:650;margin-top:2px" id="bSpecMax">983,040</div>
            </div>
          </div>

          <div class="pipeline-3">
            <div class="pipe-node"><small data-i18n="pipeSaved">本地目标</small><strong class="mono" id="pipeSaved">256,000</strong></div>
            <span class="pipe-arrow">──▶</span>
            <div class="pipe-node"><small data-i18n="pipeSent">请求注入</small><strong class="mono" id="pipeSent">待发送</strong></div>
            <span class="pipe-arrow">──▶</span>
            <div class="pipe-node"><small data-i18n="pipeAdopted">服务端采用</small><strong class="mono" style="color:var(--emerald)" id="pipeAdopted">待核验</strong></div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <button class="ghost-link" style="color:var(--fg-3)" id="btnRestoreBin" type="button" data-i18n="restoreBin">还原官方原版二进制</button>
            <div style="display:flex;gap:7px">
              <button class="action-btn" id="btnSaveOnly" type="button" data-i18n="savePrefOnly">保存偏好</button>
              <button class="action-btn primary" id="btnApplyBudget" type="button" data-i18n="saveAndSyncBin">保存并解锁底座</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== SPACE 3: 脉搏热力图、42国订阅与 API 三分类精算 ==================== -->
    <div class="space-view" id="space-ledger">
      <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:11px">
        <div class="tile" style="padding:12px 15px">
          <div class="tile-label">
            <span data-i18n="totalProcessedTok">累计处理 Token (含缓存读取)</span>
            <div class="seg-bar" id="ledgerSrcSeg">
              <button class="seg-item on" type="button" data-lsrc="all" data-i18n="srcAll">全部</button>
              <button class="seg-item" type="button" data-lsrc="desktop" data-i18n="srcDesktop">桌面</button>
              <button class="seg-item" type="button" data-lsrc="cli">CLI</button>
            </div>
          </div>
          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:5px;gap:8px">
            <div class="hero-num mono"><span id="ledgerTotalVal">0</span><span class="hero-unit" id="ledgerTotalUnit">tok</span></div>
            <div style="text-align:right" class="mono">
              <div style="font-size:11px;color:var(--fg-2)" id="ledgerSubTotals">今日 0 · 本月 0</div>
              <div style="font-size:10px;color:var(--emerald);margin-top:2px" id="ledgerCacheSummary">缓存命中 --% · 省 $0.00</div>
            </div>
          </div>
        </div>

        <div class="tile interactive" style="padding:12px 15px" data-open-sheet="subSheet">
          <div class="tile-label">
            <span data-i18n="subVsApiTitle">订阅实付 vs API 零售价值</span>
            <span class="ghost-link"><span data-i18n="fxConfigLink">42 国汇率与权益</span> ›</span>
          </div>
          <div style="margin-top:6px">
            <div class="mono" style="font-size:21px;font-weight:650;color:var(--emerald)" id="roiMultTxt">点击配置订阅价值</div>
            <div class="mono" style="font-size:10.5px;color:var(--fg-2);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="subSummaryLine">API 等效累计 $0.00</div>
          </div>
        </div>
      </div>

      <div class="tile" style="flex:1;min-height:0;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;font-weight:600" data-i18n="activityPulse">活跃脉搏</span>
            <button class="nav-step-btn" id="btnHmPrev" type="button" title="上一周期">‹</button>
            <span class="mono" style="font-size:10.5px;color:var(--fg-2)" id="hmPeriodLbl">近 52 周</span>
            <button class="nav-step-btn" id="btnHmNext" type="button" title="下一周期">›</button>
            <button class="ghost-link" id="btnRefreshHistory" type="button" title="刷新历史账本">↻</button>
            <button class="mini-export-btn mono" id="btnExportCsv" type="button" title="导出账本为 CSV 表格">CSV</button>
            <button class="mini-export-btn mono" id="btnExportJson" type="button" title="导出账本为 JSON 快照">JSON</button>
          </div>

          <div style="display:flex;gap:5px;align-items:center">
            <div class="seg-bar" id="heatModeSeg">
              <button class="seg-item on" type="button" data-hm="daily" data-i18n="hmDay">日</button>
              <button class="seg-item" type="button" data-hm="weekly" data-i18n="hmWeek">周</button>
              <button class="seg-item" type="button" data-hm="monthly" data-i18n="hmMonth">月</button>
              <button class="seg-item" type="button" data-hm="yearly" data-i18n="hmYear">年</button>
              <button class="seg-item" type="button" data-hm="cum" data-i18n="hmCum">累计</button>
            </div>
            <div class="seg-bar" id="ledgerBottomToggle">
              <button class="seg-item on" type="button" data-lbot="sum" data-i18n="botSummary">周期</button>
              <button class="seg-item" type="button" data-lbot="api" data-i18n="botApi">计价</button>
              <button class="seg-item" type="button" data-lbot="models" data-i18n="botModels">排行</button>
            </div>
          </div>
        </div>

        <div id="hmDailyWrap" class="heat-matrix"></div>
        <svg id="hmAltSvg" viewBox="0 0 600 108" width="100%" height="108" style="display:none;flex:1"></svg>
        <div id="ledgerModelsPanel" class="model-rank-panel" style="display:none"></div>

        <div id="ledgerSumStrip" style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--line);font-size:10.5px;gap:8px">
          <span class="mono" style="color:var(--fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="hmHoverTxt">悬停色块查看当日输入 / 缓存 / 输出与美元折算</span>
          <span class="mono" style="color:var(--fg-3);white-space:nowrap" id="hmActiveSummary">活跃 0 天 · 日均 $0.00</span>
        </div>

        <div id="ledgerApiStrip" style="display:none;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--line);font-size:10.5px;gap:8px">
          <div style="display:flex;gap:12px;flex-wrap:wrap" class="mono" id="apiBreakdownNums">
            <span>输入: <strong>$0.00</strong></span>
            <span>缓存 10%: <strong style="color:var(--emerald)">$0.00</strong></span>
            <span>输出: <strong>$0.00</strong></span>
          </div>
          <div class="seg-bar" id="valuationModeSeg">
            <button class="seg-item on" type="button" data-vmode="actual" data-i18n="vmodeActual">实际混合</button>
            <button class="seg-item" type="button" data-vmode="gemini-3.1-pro" data-i18n="vmodeG31">按 G3.1 Pro</button>
            <button class="seg-item" type="button" data-vmode="claude-opus-4-6-thinking" data-i18n="vmodeOpus">按 Opus 4.6</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== SPACE 4: 内核工坊 2x2 Bento ==================== -->
    <div class="space-view" id="space-studio">
      <div class="studio-bento">
        <!-- 左上：防幻觉提示词精简 Lv.0-Lv.4 + 中文会话标题 -->
        <div class="tile">
          <div class="tile-label">
            <span data-i18n="promptRuleTitle">提示词防幻觉精简</span>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:10.5px" data-i18n="zhChatTitle">中文标题</span>
              <button class="apple-toggle" id="toggleZhTitle" type="button" aria-label="中文会话标题"></button>
            </div>
          </div>

          <div class="seg-bar" style="width:100%;display:grid;grid-template-columns:repeat(5,1fr)" id="ruleTierSeg">
            <button class="seg-item on" type="button" data-rtier="0">Lv.0</button>
            <button class="seg-item" type="button" data-rtier="1">Lv.1</button>
            <button class="seg-item" type="button" data-rtier="2">Lv.2</button>
            <button class="seg-item" type="button" data-rtier="3">Lv.3</button>
            <button class="seg-item" type="button" data-rtier="4">Lv.4</button>
          </div>

          <div style="font-size:10.5px;color:var(--fg-2);line-height:1.45" id="ruleImpactText">
            <strong>Lv.0 官方原版：</strong>保持宿主原始提示词字节不变。
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <button class="ghost-link" style="color:var(--fg-3)" id="btnResetEnhance" type="button" data-i18n="restoreOfficial">恢复官方原版</button>
            <button class="action-btn primary" id="btnApplyEnhance" type="button" data-i18n="applyEnhance">应用增强补丁</button>
          </div>
        </div>

        <!-- 右上：免 TUN 本地代理四层拓扑 -->
        <div class="tile">
          <div class="tile-label">
            <span data-i18n="noTunProxyTitle">免 TUN 进程级代理通道</span>
            <button class="apple-toggle" id="toggleProxyMod" type="button" aria-label="启用免 TUN 代理"></button>
          </div>

          <div class="topo-nodes" id="proxyTopoBar">
            <span class="topo-step" id="topoStep1"><i></i>格式</span>
            <span style="color:var(--fg-3)">─</span>
            <span class="topo-step" id="topoStep2"><i></i>握手</span>
            <span style="color:var(--fg-3)">─</span>
            <span class="topo-step" id="topoStep3"><i></i>公网</span>
            <span style="color:var(--fg-3)">─</span>
            <span class="topo-step" id="topoStep4"><i></i>会话</span>
          </div>

          <div style="display:flex;gap:6px">
            <input class="clean-field mono" id="proxyUrlInput" type="text" placeholder="http://localhost:7897" style="flex:1;min-width:0" aria-label="本地代理地址" />
            <button class="action-btn" id="btnPingTopo" type="button" data-i18n="diag4Layer">四层诊断</button>
          </div>

          <div class="proxy-profile-bar" id="proxyProfileBar"></div>
          <div class="proxy-profile-editor" id="proxyProfileEditor" hidden>
            <input class="clean-field" id="proxyProfileNameInput" type="text" maxlength="32" placeholder="预设名称 (如 Clash / 住宅节点)" style="flex:1;min-width:0;height:24px;font-size:10.5px" />
            <button class="action-btn primary" id="btnConfirmSaveProfile" type="button" style="height:24px;padding:0 9px;font-size:10px" data-i18n="saveProfileConfirm">保存</button>
            <button class="action-btn" id="btnCancelSaveProfile" type="button" style="height:24px;padding:0 8px;font-size:10px" data-i18n="cancelBtn">取消</button>
          </div>
        </div>

        <!-- 左下：桌面壳层汉化、品牌词热同步与服务控制 -->
        <div class="tile">
          <div class="tile-label">
            <span data-i18n="shellAndBrandTitle">壳层汉化与左上角品牌</span>
            <button class="ghost-link" id="btnReloadLs" type="button" data-i18n="reloadLs">重启语言服务</button>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--fg-2)" data-i18n="shellMenuLang">桌面菜单语言</span>
            <div class="seg-bar" id="shellLangSeg">
              <button class="seg-item on" type="button" data-slang="en">English</button>
              <button class="seg-item" type="button" data-slang="zh-CN">简体中文</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--fg-2)" data-i18n="topLeftBrand">左上角品牌词</span>
            <div class="seg-bar" id="brandWordSeg">
              <button class="seg-item on" type="button" data-bword="english">Antigravity</button>
              <button class="seg-item" type="button" data-bword="hidden" data-i18n="brandHide">隐藏</button>
              <button class="seg-item" type="button" data-bword="translated" data-i18n="brandTranslated">反重力</button>
            </div>
          </div>
        </div>

        <!-- 右下：材质主题与 5 大高定色阶 -->
        <div class="tile">
          <div class="tile-label">
            <span data-i18n="materialAndChroma">材质主题与热力色阶</span>
            <button class="ghost-link" id="btnOpenRepo" type="button">GitHub ›</button>
          </div>

          <div class="theme-cards" id="themeCards">
            <button class="th-card on" type="button" data-th="obsidian" data-i18n="thObsidian">深空黑曜</button>
            <button class="th-card" type="button" data-th="alabaster" data-i18n="thAlabaster">云白磨砂</button>
            <button class="th-card" type="button" data-th="pitch" data-i18n="thPitch">极夜纯黑</button>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--fg-2)" data-i18n="accentChroma">强调色与 5 档色阶</span>
            <div class="chroma-dots" id="chromaDots">
              <button class="c-dot on" type="button" style="background:#6366f1" data-chroma="#6366f1|#38bdf8|rgba(99,102,241,0.24)|#818cf8" title="电光靛 Indigo"></button>
              <button class="c-dot" type="button" style="background:#10b981" data-chroma="#10b981|#34d399|rgba(16,185,129,0.24)|#6ee7b7" title="翡翠绿 Emerald"></button>
              <button class="c-dot" type="button" style="background:#f59e0b" data-chroma="#f59e0b|#fbbf24|rgba(245,158,11,0.24)|#fcd34d" title="流金珀 Amber"></button>
              <button class="c-dot" type="button" style="background:#ec4899" data-chroma="#ec4899|#f472b6|rgba(236,72,153,0.24)|#f9a8d4" title="霓虹粉 Rose"></button>
              <button class="c-dot" type="button" style="background:#0ea5e9" data-chroma="#0ea5e9|#22d3ee|rgba(14,165,233,0.24)|#7dd3fc" title="冰川青 Cyan"></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== GLASS SHEET 1: 双账本对账与全格式附件扫描 ==================== -->
    <div class="glass-sheet" id="auditSheet">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <div style="font-size:14px;font-weight:650" data-i18n="auditSheetTitle">会话缓存总览与最近一次请求对账</div>
          <div style="font-size:10.5px;color:var(--fg-2)" data-i18n="auditSheetSub">先看整个会话累计缓存复用效率，再向下核对最近一次模型请求、自动压缩时间线与附件</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="action-btn" id="btnCopyAuditSnap" type="button" data-i18n="copySnapBtn">复制摘要</button>
          <button class="action-btn" type="button" data-close-sheet="auditSheet" data-i18n="backToCockpit">返回驾驶舱</button>
        </div>
      </div>

      <!-- 第一层：整个会话累计缓存总览横幅 -->
      <div class="scrubber-box audit-sess-banner" id="auditSessionCacheCard">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap">
            <span style="font-size:11.5px;font-weight:600;color:var(--fg-1)" data-i18n="audSessTitle">整段会话缓存命中率</span>
            <strong class="mono" style="font-size:17px;font-weight:700;color:var(--emerald)" id="audSessCachePct">--%</strong>
            <span class="tag neutral mono" id="audSessTurnTag">0 轮请求</span>
            <span class="tag warn mono" id="audCompactionTag" hidden>压缩 0 次</span>
          </div>
          <div class="mono" style="font-size:11.5px;font-weight:600;color:var(--emerald);white-space:nowrap" id="audSessSavedBadge">累计省 $0.00</div>
        </div>
        <div class="cache-bar" style="height:5px"><i id="audSessCacheBar" style="width:0%"></i></div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:var(--fg-2);gap:8px" class="mono">
          <span id="audSessTokDetail">累计缓存读取 -- / 会话总输入 --</span>
          <span style="color:var(--fg-3)" id="audSessTrendHint">向下查看最近一次请求明细 ↓</span>
        </div>
      </div>

      <!-- 第二层：最近一次模型请求 vs 轮次压缩时间线 / 归档附件明细 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;flex:1;min-height:0">
        <div class="scrubber-box" style="display:flex;flex-direction:column;justify-content:space-between;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <span style="font-size:11.5px;font-weight:600;color:var(--accent)" data-i18n="audLatestTitle">最近一次模型请求 (单轮返回)</span>
            <span class="tag neutral mono" id="audLatestTurnBadge">最新轮</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:5.5px;font-size:11px" id="auditServerGrid">
            <span style="color:var(--fg-2)">请求状态</span><strong id="audStatus">等待数据</strong>
            <span style="color:var(--fg-2)">本次缓存命中率</span><strong class="mono" style="color:var(--emerald)" id="audCacheRate">--</strong>
            <span style="color:var(--fg-2)">本次新输入 / 缓存</span><strong class="mono" id="audCacheSplit">--</strong>
            <span style="color:var(--fg-2)">本次输入 + 输出</span><strong class="mono" id="audActualTok">--</strong>
            <span style="color:var(--fg-2)">客户端估算值</span><strong class="mono" id="audEstTok">--</strong>
            <span style="color:var(--fg-2)">请求预算 / 思考档</span><strong class="mono" id="audSentLim">--</strong>
            <span style="color:var(--fg-2)">报错服务端限制</span><strong class="mono" id="audErrorLim">无超限</strong>
          </div>
          <div style="font-size:10px;color:var(--fg-3)" class="mono" id="audRuntimeLine">通道: 检测中...</div>
        </div>

        <div class="scrubber-box" style="display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-height:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <div class="seg-bar" id="audRightSeg">
              <button class="seg-item on" type="button" data-aright="timeline" data-i18n="audTimelineTab">轮次时间线</button>
              <button class="seg-item" type="button" data-aright="files" data-i18n="audAttachTab">附件明细</button>
            </div>
            <span class="mono" style="font-size:10px;color:var(--fg-3)" id="audStepStats">0 步</span>
          </div>
          <div class="turn-timeline-list" id="auditTimelineList">
            <div style="font-size:11px;color:var(--fg-3);padding:12px 0;text-align:center">完成首次模型响应后自动绘制轮次压缩与缓存波动轨迹</div>
          </div>
          <div class="file-audit-list" id="auditFileList" style="display:none">
            <div style="font-size:11px;color:var(--fg-3);padding:12px 0;text-align:center">当前会话暂无外部附件或尚未完成扫描</div>
          </div>
          <button class="action-btn primary" id="btnSheetRescan" type="button" data-i18n="btnRescanTxt">↻ 重新扫描整段归档与附件</button>
        </div>
      </div>
    </div>

    <!-- ==================== GLASS SHEET 2: 多模型测速决斗与趋势 ==================== -->
    <div class="glass-sheet" id="speedSheet">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
          <span style="font-size:14px;font-weight:650" data-i18n="speedSheetTitle">本机实测性能基准与单模型趋势</span>
          <div class="seg-bar" id="duelMetricSeg">
            <button class="seg-item on" type="button" data-dm="tps" data-i18n="dmTps">输出 tok/s</button>
            <button class="seg-item" type="button" data-dm="ttft" data-i18n="dmTtft">首字 TTFT</button>
            <button class="seg-item" type="button" data-dm="dur" data-i18n="dmDur">单轮耗时</button>
          </div>
        </div>
        <button class="action-btn" type="button" data-close-sheet="speedSheet" data-i18n="btnBack">返回</button>
      </div>

      <div class="scrubber-box" id="duelBarsBox" style="display:flex;flex-direction:column;gap:9px;max-height:195px;overflow-y:auto"></div>

      <div class="scrubber-box" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:120px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg-2)">
          <span id="duelTrendTitle">当前模型近轮真实流式速率轨迹</span>
          <span class="mono" id="duelTrendMedian">样本采集中</span>
        </div>
        <svg id="duelTrendSvg" viewBox="0 0 580 92" width="100%" height="92"></svg>
      </div>
    </div>

    <!-- ==================== GLASS SHEET 3: 42 国订阅汇率与获取权益配置 ==================== -->
    <div class="glass-sheet" id="subSheet">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <div style="font-size:14px;font-weight:650" data-i18n="subSheetTitle">AI 订阅地区、汇率折算与获取方式</div>
          <div style="font-size:10.5px;color:var(--fg-2)" data-i18n="subSheetSub">内置 42 个国家/地区汇率预设与家庭共享 / 教育 / 硬件赠送模式</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="clean-field" id="countrySearchInput" type="text" placeholder="搜索国家/货币 (如 TR, 土耳其, USD)" style="width:186px" />
          <button class="action-btn primary" id="btnSaveSubConfig" type="button" data-close-sheet="subSheet" data-i18n="btnSaveBack">保存并返回</button>
        </div>
      </div>

      <div class="seg-bar" style="flex-wrap:wrap" id="acqModeSeg">
        <button class="seg-item on" type="button" data-acq="paid_pro" data-i18n="acqPro">Google AI Pro 自付</button>
        <button class="seg-item" type="button" data-acq="paid_ultra" data-i18n="acqUltra">AI Ultra 自付</button>
        <button class="seg-item" type="button" data-acq="family_share" data-i18n="acqFamily">家庭组拼车</button>
        <button class="seg-item" type="button" data-acq="free_edu" data-i18n="acqEdu">学生/Pixel 赠送 ($0)</button>
        <button class="seg-item" type="button" data-acq="free_tier" data-i18n="acqFree">免费层级 ($0)</button>
      </div>

      <div class="country-grid" id="countryGrid"></div>

      <div class="scrubber-box" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-size:11.5px;font-weight:600" data-i18n="customSubFeeTitle">自定义实付月费与币种</div>
          <div style="font-size:10px;color:var(--fg-3)" id="subConversionPreview">折合人民币约 ¥0.00 / 月</div>
        </div>
        <div style="display:flex;gap:7px;align-items:center">
          <span class="tag neutral mono" id="selectedCurrencyTag">USD $</span>
          <input class="clean-field mono" id="subPriceInput" type="number" step="0.01" min="0" value="19.99" style="width:98px;text-align:right;font-weight:600" />
        </div>
      </div>
    </div>

    <!-- ==================== GLASS SHEET 4: 在线版本检查与 Live-Host 热更新 ==================== -->
    <div class="glass-sheet" id="updateSheet">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:14px;font-weight:650" data-i18n="updateSheetTitle">版本状态与 Live-Host 免重启热更新</div>
          <div style="font-size:10.5px;color:var(--fg-2)" class="mono" id="runtimeVerDiag">Pulse v0.10.0</div>
        </div>
        <button class="action-btn" type="button" data-close-sheet="updateSheet" data-i18n="btnClose">关闭</button>
      </div>

      <div class="scrubber-box" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="tag neutral" id="updateStateTag">当前版本 v0.10.0</span>
            <button class="ghost-link" id="btnCheckUpdateNow" type="button" data-i18n="btnCheckReleaseNow">↻ 立即检查 GitHub Release</button>
          </div>
          <div style="font-size:11.5px;line-height:1.65;color:var(--fg-2);margin-top:10px;white-space:pre-line" id="updateNotesBox">• Spatial Bento HUD 全新同心双环灵动岛与零滚动驾驶舱架构
• 支持 Antigravity 2.31+ 共享额度池、请求级上下文预算磁吸注入与三态对账
• 支持 42 国多币种订阅回本率精算、底座 1M/2M 解锁与免 TUN 进程级代理诊断</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--fg-2)">
            <span data-i18n="autoUpdateStartupLbl">启动时自动检查更新</span>
            <button class="apple-toggle on" id="toggleAutoUpdate" type="button" aria-label="自动检查更新"></button>
          </div>
          <div style="display:flex;gap:8px">
            <button class="action-btn" id="btnHardRestartHost" type="button" data-i18n="btnSmoothRestart">平滑重启客户端</button>
            <button class="action-btn primary" id="btnRunHotReload" type="button" disabled>暂无可用更新</button>
          </div>
        </div>
      </div>
    </div>

    <div class="hud-toast" id="hudToast" role="status" aria-live="polite">已更新</div>
  </div>
</section>`;

// Antigravity Pulse — Spatial Bento Multi-Language Dictionary & Error Localizer
const PULSE_I18N = {
  'zh-CN': {
    navCockpit: '总览',
    navBudget: '预算',
    navLedger: '账本',
    navStudio: '工坊',
    headCockpit: '实时驾驶舱',
    headBudget: '模型预算引擎',
    headLedger: '用量脉搏与账本',
    headStudio: '内核增强工坊',
    tipCtx: '上下文窗口',
    tipQuota: '共享额度池',
    tipCache: '会话命中率',
    tipToday: '今日累计',
    cacheHitLabel: '会话命中',
    latestReqJump: '最近请求 ›',
    restartNow: '重启生效',
    ctxWindowTitle: '会话上下文窗口',
    limitLabel: '上限',
    dynShort: '动态',
    actualMeasured: '实测占用',
    estimatedMode: '本地估算',
    streamTelemetry: '流式生成遥测',
    speedDuelLink: '多模型测速决斗',
    roundOutput: '本轮输出',
    roundDur: '总耗时',
    sharedPoolsTitle: '共享模型额度池',
    syncQuotaBtn: '同步配额',
    scopePerModel: '按模型独立',
    scopeUnified: '全局统一',
    selectedModelBudget: '当前选中模型预算配置',
    specTotalWin: '模型总窗口',
    specMaxOut: '最大输出上限',
    specMaxInput: '理论最大输入',
    pipeSaved: '本地目标',
    pipeSent: '请求注入',
    pipeAdopted: '服务端采用',
    restoreBin: '还原官方原版二进制',
    savePrefOnly: '保存偏好',
    saveAndSyncBin: '保存并解锁底座',
    totalProcessedTok: '累计处理 Token (含缓存读取)',
    srcAll: '全部',
    srcDesktop: '桌面',
    subVsApiTitle: '订阅实付 vs API 零售价值',
    fxConfigLink: '42 国汇率与权益',
    activityPulse: '活跃脉搏',
    hmDay: '日',
    hmWeek: '周',
    hmMonth: '月',
    hmYear: '年',
    hmCum: '累计',
    botSummary: '周期',
    botApi: '计价',
    promptRuleTitle: '提示词防幻觉精简',
    zhChatTitle: '中文标题',
    restoreOfficial: '恢复官方原版',
    applyEnhance: '应用增强补丁',
    noTunProxyTitle: '免 TUN 进程级代理通道',
    diag4Layer: '四层诊断',
    shellAndBrandTitle: '壳层汉化与左上角品牌',
    reloadLs: '重启语言服务',
    shellMenuLang: '桌面菜单语言',
    topLeftBrand: '左上角品牌词',
    brandHide: '隐藏',
    materialAndChroma: '材质主题与热力色阶',
    thObsidian: '深空黑曜',
    thAlabaster: '云白磨砂',
    thPitch: '极夜纯黑',
    accentChroma: '强调色与 5 档色阶',
    auditSheetTitle: '会话缓存总览与最近一次请求对账',
    auditSheetSub: '先看整个会话累计缓存复用效率，再向下核对最近一次模型请求与本地附件',
    backToCockpit: '返回驾驶舱',
    audSessTitle: '整段会话缓存命中率',
    audLatestTitle: '最近一次模型请求 (单轮返回)',
    audAttachTitle: '归档累计与附件明细',
    btnRescanTxt: '↻ 重新扫描整段归档与附件',
    speedSheetTitle: '本机实测性能基准与单模型趋势',
    dmTps: '输出 tok/s',
    dmTtft: '首字 TTFT',
    dmDur: '单轮耗时',
    btnBack: '返回',
    subSheetTitle: 'AI 订阅地区、汇率折算与获取方式',
    subSheetSub: '内置 42 个国家/地区汇率预设与家庭共享 / 教育 / 硬件赠送模式',
    btnSaveBack: '保存并返回',
    acqPro: 'Google AI Pro 自付',
    acqUltra: 'AI Ultra 自付',
    acqFamily: '家庭组拼车',
    acqEdu: '学生/Pixel 赠送 ($0)',
    acqFree: '免费层级 ($0)',
    customSubFeeTitle: '自定义实付月费与币种',
    updateSheetTitle: '版本状态与 Live-Host 免重启热更新',
    btnClose: '关闭',
    btnCheckReleaseNow: '↻ 立即检查 GitHub Release',
    autoUpdateStartupLbl: '启动时自动检查更新',
    btnSmoothRestart: '平滑重启客户端',
    jumpHintBudget: '预算 ›',
    detDefault: '默认 256K',
    detMax: '理论最大',
    vmodeActual: '实际混合',
    vmodeG31: '按 G3.1 Pro',
    vmodeOpus: '按 Opus 4.6',
    brandTranslated: '反重力',
    chartEmptyHistory: '暂无该周期历史消费记录',
    duelEmptyBars: '尚无实测流式生成样本，完成一轮模型对话后自动记录各模型速率与首字延迟',
    duelEmptyTrend: '等待首条有效流式样本...',
    duelTrendCurveTitle: '{model} 近 {count} 轮实测曲线',
    duelTrendMedianFmt: '中位数 {tps} tok/s · TTFT {ttft} · n={count}',
    idleMode: '待机',
    waitingGen: '等待生成',
    streamingNow: '流式生成中…',
    measuringNow: '生成测算中…',
    measuredRound: '本轮实测',
    measuredHistory: '上轮实测',
    tagWeekShort: '周',
    tagDayShort: '日',
    tagQuotaShort: '额度',
    unlockReadyInject: '请求级注入就绪',
    unlockPendingRestart: '底座已修补 · 待重启生效',
    unlockDynamicActive: '底座已解锁 DYN',
    unlockStock256k: '官方默认 256K 锁 (点右下解锁)',
    copySnapBtn: '复制摘要',
    botModels: '排行',
    saveProfileConfirm: '保存',
    cancelBtn: '取消',
    addProfileBtn: '+ 存为预设',
    audTimelineTab: '轮次时间线',
    audAttachTab: '附件明细',
    emptyModelRank: '暂无已计价模型消费记录，完成对话后自动归集排行'
  },
  'zh-TW': {
    navCockpit: '總覽',
    navBudget: '預算',
    navLedger: '帳本',
    navStudio: '工坊',
    headCockpit: '即時駕駛艙',
    headBudget: '模型預算引擎',
    headLedger: '用量脈搏與帳本',
    headStudio: '核心增強工坊',
    tipCtx: '上下文視窗',
    tipQuota: '共享額度池',
    tipCache: '會話命中率',
    tipToday: '今日累計',
    cacheHitLabel: '會話命中',
    latestReqJump: '最近請求 ›',
    restartNow: '重啟生效',
    ctxWindowTitle: '會話上下文視窗',
    limitLabel: '上限',
    dynShort: '動態',
    actualMeasured: '實測佔用',
    estimatedMode: '本機估算',
    streamTelemetry: '串流生成遙測',
    speedDuelLink: '多模型測速對決',
    roundOutput: '本輪輸出',
    roundDur: '總耗時',
    sharedPoolsTitle: '共享模型額度池',
    syncQuotaBtn: '同步配額',
    scopePerModel: '按模型獨立',
    scopeUnified: '全域統一',
    selectedModelBudget: '目前選取模型預算設定',
    specTotalWin: '模型總視窗',
    specMaxOut: '最大輸出上限',
    specMaxInput: '理論最大輸入',
    pipeSaved: '本機目標',
    pipeSent: '請求注入',
    pipeAdopted: '伺服器採用',
    restoreBin: '還原官方原版二進位',
    savePrefOnly: '儲存偏好',
    saveAndSyncBin: '儲存並解鎖底座',
    totalProcessedTok: '累計處理 Token (含快取讀取)',
    srcAll: '全部',
    srcDesktop: '桌面',
    subVsApiTitle: '訂閱實付 vs API 零售價值',
    fxConfigLink: '42 國匯率與權益',
    activityPulse: '活躍脈搏',
    hmDay: '日',
    hmWeek: '週',
    hmMonth: '月',
    hmYear: '年',
    hmCum: '累計',
    botSummary: '週期',
    botApi: '計價',
    promptRuleTitle: '提示詞防幻覺精簡',
    zhChatTitle: '中文標題',
    restoreOfficial: '恢復官方原版',
    applyEnhance: '套用增強修補',
    noTunProxyTitle: '免 TUN 程序級代理通道',
    diag4Layer: '四層診斷',
    shellAndBrandTitle: '殼層漢化與左上角品牌',
    reloadLs: '重啟語言服務',
    shellMenuLang: '桌面選單語言',
    topLeftBrand: '左上角品牌詞',
    brandHide: '隱藏',
    materialAndChroma: '材質主題與熱力色階',
    thObsidian: '深空黑曜',
    thAlabaster: '雲白磨砂',
    thPitch: '極夜純黑',
    accentChroma: '強調色與 5 檔色階',
    auditSheetTitle: '會話快取總覽與最近一次請求對帳',
    auditSheetSub: '先看整個會話累計快取複用效率，再向下核對最近一次模型請求與本機附件',
    backToCockpit: '返回駕駛艙',
    audSessTitle: '整段會話快取命中率',
    audLatestTitle: '最近一次模型請求 (單輪返回)',
    audAttachTitle: '歸檔累計與附件明細',
    btnRescanTxt: '↻ 重新掃描整段歸檔與附件',
    speedSheetTitle: '本機實測效能基準與單模型趨勢',
    dmTps: '輸出 tok/s',
    dmTtft: '首字 TTFT',
    dmDur: '單輪耗時',
    btnBack: '返回',
    subSheetTitle: 'AI 訂閱地區、匯率折算與取得方式',
    subSheetSub: '內建 42 個國家/地區匯率預設與家庭共享 / 教育 / 硬體贈送模式',
    btnSaveBack: '儲存並返回',
    acqPro: 'Google AI Pro 自付',
    acqUltra: 'AI Ultra 自付',
    acqFamily: '家庭組共享',
    acqEdu: '學生/Pixel 贈送 ($0)',
    acqFree: '免費層級 ($0)',
    customSubFeeTitle: '自訂實付月費與幣別',
    updateSheetTitle: '版本狀態與 Live-Host 免重啟熱更新',
    btnClose: '關閉',
    btnCheckReleaseNow: '↻ 立即檢查 GitHub Release',
    autoUpdateStartupLbl: '啟動時自動檢查更新',
    btnSmoothRestart: '平滑重啟用戶端',
    jumpHintBudget: '預算 ›',
    detDefault: '預設 256K',
    detMax: '理論最大',
    vmodeActual: '實際混合',
    vmodeG31: '按 G3.1 Pro',
    vmodeOpus: '按 Opus 4.6',
    brandTranslated: '反重力',
    chartEmptyHistory: '暫無該週期歷史消費紀錄',
    duelEmptyBars: '尚無實測串流生成樣本，完成一輪對話後自動記錄速率與首字延遲',
    duelEmptyTrend: '等待首條有效串流樣本...',
    duelTrendCurveTitle: '{model} 近 {count} 輪實測曲線',
    duelTrendMedianFmt: '中位數 {tps} tok/s · TTFT {ttft} · n={count}',
    idleMode: '待機',
    waitingGen: '等待生成',
    streamingNow: '串流生成中…',
    measuringNow: '生成測算中…',
    measuredRound: '本輪實測',
    measuredHistory: '上輪實測',
    tagWeekShort: '週',
    tagDayShort: '日',
    tagQuotaShort: '額度',
    unlockReadyInject: '請求級注入就緒',
    unlockPendingRestart: '底座已修補 · 待重啟生效',
    unlockDynamicActive: '底座已解鎖 DYN',
    unlockStock256k: '官方預設 256K 鎖 (點右下解鎖)',
    copySnapBtn: '複製摘要',
    botModels: '排行',
    saveProfileConfirm: '儲存',
    cancelBtn: '取消',
    addProfileBtn: '+ 存為預設',
    audTimelineTab: '輪次時間線',
    audAttachTab: '附件明細',
    emptyModelRank: '暫無已計價模型消費紀錄，完成對話後自動歸集排行'
  },
  'en': {
    navCockpit: 'Live',
    navBudget: 'Budget',
    navLedger: 'Ledger',
    navStudio: 'Studio',
    headCockpit: 'Live Cockpit',
    headBudget: 'Budget Engine',
    headLedger: 'Pulse & Ledger',
    headStudio: 'Kernel Studio',
    tipCtx: 'Context Window',
    tipQuota: 'Shared Pool',
    tipCache: 'Session Cache',
    tipToday: 'Today Total',
    cacheHitLabel: 'Session Hit',
    latestReqJump: 'Latest Req ›',
    restartNow: 'Restart Needed',
    ctxWindowTitle: 'Session Context Window',
    limitLabel: 'Cap',
    dynShort: 'DYN',
    actualMeasured: 'Measured',
    estimatedMode: 'Estimated',
    streamTelemetry: 'Stream Telemetry',
    speedDuelLink: 'Model Speed Duel',
    roundOutput: 'Output',
    roundDur: 'Duration',
    sharedPoolsTitle: 'Shared Quota Pools',
    syncQuotaBtn: 'Sync Quota',
    scopePerModel: 'Per Model',
    scopeUnified: 'Unified',
    selectedModelBudget: 'Selected Model Context Budget',
    specTotalWin: 'Total Window',
    specMaxOut: 'Max Output',
    specMaxInput: 'Max Input Cap',
    pipeSaved: 'Saved Target',
    pipeSent: 'Request Proto',
    pipeAdopted: 'Host Adopted',
    restoreBin: 'Restore Official Binary',
    savePrefOnly: 'Save Pref',
    saveAndSyncBin: 'Save & Unlock Base',
    totalProcessedTok: 'Total Tokens (incl. Cache Read)',
    srcAll: 'All',
    srcDesktop: 'App',
    subVsApiTitle: 'Subscription vs API Retail Value',
    fxConfigLink: '42-Region FX & Plan',
    activityPulse: 'Activity Pulse',
    hmDay: 'Day',
    hmWeek: 'Wk',
    hmMonth: 'Mo',
    hmYear: 'Yr',
    hmCum: 'Curve',
    botSummary: 'Stats',
    botApi: 'Pricing',
    promptRuleTitle: 'Prompt Anti-Hallucination Tier',
    zhChatTitle: 'ZH Title',
    restoreOfficial: 'Restore Official',
    applyEnhance: 'Apply Patch',
    noTunProxyTitle: 'No-TUN Process Proxy',
    diag4Layer: '4-Stage Check',
    shellAndBrandTitle: 'Shell Locale & Brand Word',
    reloadLs: 'Reload LS',
    shellMenuLang: 'App Shell',
    topLeftBrand: 'Brand Word',
    brandHide: 'Hide',
    materialAndChroma: 'Material Theme & Palette',
    thObsidian: 'Obsidian',
    thAlabaster: 'Alabaster',
    thPitch: 'Pitch OLED',
    accentChroma: 'Accent & 5-Step Scale',
    auditSheetTitle: 'Session Cache Overview & Latest Request Audit',
    auditSheetSub: 'Review cumulative session cache efficiency above, and inspect the latest model call & attachments below',
    backToCockpit: 'Back to Live',
    audSessTitle: 'Session Cache Hit Rate',
    audLatestTitle: 'Latest Model Request (Single Turn)',
    audAttachTitle: 'Archive & Attachments',
    btnRescanTxt: '↻ Rescan Archive & Attachments',
    speedSheetTitle: 'Measured Speed Benchmark & Model Trend',
    dmTps: 'Output tok/s',
    dmTtft: 'TTFT',
    dmDur: 'Duration',
    btnBack: 'Back',
    subSheetTitle: 'Subscription Region, FX & Plan Mode',
    subSheetSub: '42 regional FX presets with family sharing, student/hardware perks & free tier',
    btnSaveBack: 'Save & Back',
    acqPro: 'Google AI Pro',
    acqUltra: 'AI Ultra',
    acqFamily: 'Family Share',
    acqEdu: 'Student / Pixel ($0)',
    acqFree: 'Free Tier ($0)',
    customSubFeeTitle: 'Custom Monthly Fee & Currency',
    updateSheetTitle: 'Version Status & Live-Host Hot Update',
    btnClose: 'Close',
    btnCheckReleaseNow: '↻ Check GitHub Release',
    autoUpdateStartupLbl: 'Auto-check updates on startup',
    btnSmoothRestart: 'Relaunch Client',
    jumpHintBudget: 'Budget ›',
    detDefault: 'Default 256K',
    detMax: 'Max Cap',
    vmodeActual: 'Actual Mix',
    vmodeG31: 'As G3.1 Pro',
    vmodeOpus: 'As Opus 4.6',
    brandTranslated: 'Translated',
    chartEmptyHistory: 'No token usage recorded in this period',
    duelEmptyBars: 'No streaming speed samples yet — complete a chat turn to record model tok/s & TTFT',
    duelEmptyTrend: 'Waiting for first valid streaming sample...',
    duelTrendCurveTitle: '{model} · Last {count} Measured Turns',
    duelTrendMedianFmt: 'Median {tps} tok/s · TTFT {ttft} · n={count}',
    idleMode: 'Idle',
    waitingGen: 'Waiting',
    streamingNow: 'Streaming…',
    measuringNow: 'Measuring…',
    measuredRound: 'Measured',
    measuredHistory: 'Last Measured',
    tagWeekShort: 'Wk',
    tagDayShort: 'Day',
    tagQuotaShort: 'Pool',
    unlockReadyInject: 'Request Injection Ready',
    unlockPendingRestart: 'Patched · Restart Needed',
    unlockDynamicActive: 'Base Unlocked DYN',
    unlockStock256k: 'Default 256K Cap (Unlock Below)',
    copySnapBtn: 'Snapshot',
    botModels: 'Models',
    saveProfileConfirm: 'Save',
    cancelBtn: 'Cancel',
    addProfileBtn: '+ Save Preset',
    audTimelineTab: 'Timeline',
    audAttachTab: 'Files',
    emptyModelRank: 'No priced model usage yet — rankings appear automatically after chat turns'
  }
};

const PROMPT_TIER_DESCRIPTIONS = {
  'zh-CN': {
    0: '<strong>Lv.0 官方原版：</strong>100% 保持官方原始提示词字节，不做任何覆写。',
    1: '<strong>Lv.1 基础去重：</strong>仅清理重复冗长示例段落，完整保留全部系统说明。',
    2: '<strong>Lv.2 紧凑契约：</strong>精简寒暄客套话术，显著降低每轮固定输入 Token 开销。',
    3: '<strong>Lv.3 深度核证：</strong>保留完整工具契约，强制“未读源码不臆测、未跑测试不报通过”。',
    4: '<strong>Lv.4 极简铁律：</strong>等长字节对齐净除非核心说教，最大化释放有效上下文预算。'
  },
  'zh-TW': {
    0: '<strong>Lv.0 官方原版：</strong>100% 保持官方原始提示詞位元組，不做任何覆寫。',
    1: '<strong>Lv.1 基礎去重：</strong>僅清理重複冗長範例段落，完整保留全部系統說明。',
    2: '<strong>Lv.2 緊湊契約：</strong>精簡客套話術，顯著降低每輪固定輸入 Token 開銷。',
    3: '<strong>Lv.3 深度核證：</strong>保留完整工具契約，強制「未讀檔案不臆測、未跑測試不報通過」。',
    4: '<strong>Lv.4 極簡鐵律：</strong>等長對齊淨除非核心模板，最大化釋放有效上下文空間。'
  },
  'en': {
    0: '<strong>Lv.0 Official:</strong> Preserves 100% original prompt bytes untouched.',
    1: '<strong>Lv.1 Dedupe:</strong> Trims repetitive verbose examples while keeping all guidance.',
    2: '<strong>Lv.2 Compact:</strong> Strips filler boilerplate to cut per-turn fixed input tokens.',
    3: '<strong>Lv.3 Verified:</strong> Keeps full tool schemas; enforces read-before-edit & test-before-claim.',
    4: '<strong>Lv.4 Minimalist:</strong> Byte-aligned minimal ruleset maximizing usable context headroom.'
  }
};

function normalizePulseLang(raw) {
  const s = String(raw || '').trim();
  if (s === 'zh-TW' || s.toLowerCase() === 'zh-tw' || s.toLowerCase() === 'zh-hant') return 'zh-TW';
  if (s === 'en' || s.toLowerCase().startsWith('en')) return 'en';
  return 'zh-CN';
}

function translatePulseKey(lang, key, vars = null) {
  const effLang = normalizePulseLang(lang);
  const dict = PULSE_I18N[effLang] || PULSE_I18N['zh-CN'];
  let text = dict[key] !== undefined ? dict[key] : (PULSE_I18N['zh-CN'][key] || key);
  if (vars && typeof vars === 'object') {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
    }
  }
  return text;
}

(function (root) {
  'use strict';

  const DEFAULT_MIN_TOKENS = 16384;
  const DEFAULT_MAX_TOKENS = 2097152;
  const STOCK_DEFAULT_CLAMP_TOKENS = 256000;
  const DEFAULT_CONFIRM_TIMEOUT_MS = 45000;

  // 来自宿主 bundle E.Model 的已知静态枚举值（动态 PLACEHOLDER_M* 由 cascadeModelConfigs 解析）
  const STATIC_MODEL_ENUM_MAP = {
    235: 'chat_20706',
    246: 'google_gemini_2_5_pro',
    269: 'chat_23310',
    281: 'claude_4_sonnet',
    282: 'claude_4_sonnet_thinking',
    290: 'claude_4_opus',
    291: 'claude_4_opus_thinking',
    312: 'google_gemini_2_5_flash',
    313: 'google_gemini_2_5_flash_thinking',
    327: 'google_gemini_for_google_2_5_pro',
    328: 'google_gemini_nemosreef',
    329: 'google_gemini_2_5_flash_thinking_tools',
    330: 'google_gemini_2_5_flash_lite',
    331: 'google_gemini_2_5_pro_eval',
    332: 'google_gemini_2_5_flash_image_preview',
    333: 'claude_4_5_sonnet',
    334: 'claude_4_5_sonnet_thinking',
    335: 'google_gemini_computer_use_experimental',
    336: 'google_gemini_horizondawn',
    337: 'google_gemini_pureprism',
    338: 'google_gemini_gentleisland',
    339: 'google_gemini_rainsong',
    340: 'claude_4_5_haiku',
    341: 'claude_4_5_haiku_thinking',
    342: 'openai_gpt_oss_120b_medium',
    343: 'google_gemini_orionfire',
    346: 'google_jarvis_proxy',
    347: 'google_gemini_cosmicforge',
    348: 'google_gemini_riftrunner',
    349: 'google_jarvis_v4s',
    350: 'google_gemini_infinityjet',
    351: 'google_gemini_infinitybloom',
    352: 'google_gemini_riftrunner_thinking_low',
    353: 'google_gemini_riftrunner_thinking_high',
    354: 'google_gemini_example_gemax_sampler'
  };

  /**
   * 规范化 Protobuf 枚举前缀：将 "MODEL_PLACEHOLDER_M37" 与 "PLACEHOLDER_M37" 对齐
   */
  function stripModelEnumPrefix(raw) {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    return s.replace(/^MODEL_/i, '');
  }

  /**
   * 从通用数值编号转成 E.Model 枚举名（支持 1000+ 为 PLACEHOLDER_M{n-1000}）
   */
  function modelEnumNumberToName(num) {
    const n = Number(num);
    if (!Number.isInteger(n) || n <= 0) return null;
    if (STATIC_MODEL_ENUM_MAP[n]) return STATIC_MODEL_ENUM_MAP[n].toUpperCase();
    if (n >= 1000 && n < 2000) return `PLACEHOLDER_M${n - 1000}`;
    return null;
  }

  /**
   * 判断 URL / RPC 方法是否为允许注入上下文预算的目标 RPC
   * 事实核对：StartCascadeRequest 不含 cascade_config，仅 SendUserCascadeMessage 携带
   */
  function isTargetBudgetRpc(urlOrProcedure) {
    if (!urlOrProcedure) return false;
    const s = String(urlOrProcedure);
    if (s.includes('StartCascade')) return false;
    return s.includes('SendUserCascadeMessage');
  }

  // =========================================================================
  // 1. Protobuf Binary Wire 编解码器（零依赖精准读写 SendUserCascadeMessageRequest）
  //    真实 Schema 核验结果：
  //    - SendUserCascadeMessageRequest: 1 = cascade_id (string), 5 = cascade_config (CascadeConfig)
  //    - CascadeConfig: 1 = planner_config (CascadePlannerConfig), 2 = checkpoint_config (CheckpointConfig)
  //    - CascadePlannerConfig: 1 = plan_model (enum), 15 = requested_model (ModelOrAlias: 1=model, 2=alias),
  //                            27 = custom_model_info_override (ModelInfo), 28 = model_name (string)
  //    - CheckpointConfig: 1 = token_threshold, 2 = is_sync, 5 = max_token_limit (uint32),
  //                        11 = max_output_tokens, 36 = context_window (string)
  // =========================================================================

  function readVarint(bytes, offset) {
    let result = 0n;
    let shift = 0n;
    let pos = offset;
    while (pos < bytes.length) {
      const b = bytes[pos++];
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return { value: result, nextOffset: pos };
      }
      shift += 7n;
      if (shift > 70n) throw new Error('Invalid protobuf varint overflow');
    }
    throw new Error('Truncated protobuf varint');
  }

  function writeVarint(num) {
    let v = typeof num === 'bigint' ? num : BigInt(num);
    if (v < 0n) v = BigInt.asUintN(64, v);
    const out = [];
    while (v >= 0x80n) {
      out.push(Number((v & 0x7fn) | 0x80n));
      v >>= 7n;
    }
    out.push(Number(v));
    return new Uint8Array(out);
  }

  function concatUint8Arrays(chunks) {
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }

  function encodeVarintField(fieldNumber, value) {
    const tag = writeVarint((fieldNumber << 3) | 0);
    const val = writeVarint(value);
    return concatUint8Arrays([tag, val]);
  }

  function encodeLengthDelimitedField(fieldNumber, payloadBytes) {
    const tag = writeVarint((fieldNumber << 3) | 2);
    const len = writeVarint(payloadBytes.length);
    return concatUint8Arrays([tag, len, payloadBytes]);
  }

  /**
   * 严格解析单层 Protobuf 消息字段，保留每个字段的原始完整切片（tag+value）
   */
  function parseProtoFields(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new Error('Expected Uint8Array');
    const fields = [];
    let pos = 0;
    while (pos < bytes.length) {
      const start = pos;
      const tagInfo = readVarint(bytes, pos);
      pos = tagInfo.nextOffset;
      const tagNum = Number(tagInfo.value);
      const fieldNumber = tagNum >>> 3;
      const wireType = tagNum & 0x07;
      if (fieldNumber <= 0) throw new Error(`Invalid protobuf field number: ${fieldNumber}`);

      let valueStart = pos;
      let valueEnd = pos;
      let varintValue = null;
      let sliceValue = null;

      if (wireType === 0) {
        const vInfo = readVarint(bytes, pos);
        varintValue = vInfo.value;
        pos = vInfo.nextOffset;
        valueEnd = pos;
      } else if (wireType === 1) {
        if (pos + 8 > bytes.length) throw new Error('Truncated 64-bit field');
        pos += 8;
        valueEnd = pos;
      } else if (wireType === 2) {
        const lenInfo = readVarint(bytes, pos);
        const len = Number(lenInfo.value);
        pos = lenInfo.nextOffset;
        if (!Number.isSafeInteger(len) || len < 0 || pos + len > bytes.length) {
          throw new Error('Truncated length-delimited field');
        }
        valueStart = pos;
        sliceValue = bytes.subarray(pos, pos + len);
        pos += len;
        valueEnd = pos;
      } else if (wireType === 5) {
        if (pos + 4 > bytes.length) throw new Error('Truncated 32-bit field');
        pos += 4;
        valueEnd = pos;
      } else {
        throw new Error(`Unsupported protobuf wire type: ${wireType}`);
      }

      fields.push({
        fieldNumber,
        wireType,
        varintValue,
        bytesValue: sliceValue,
        rawField: bytes.subarray(start, valueEnd)
      });
    }
    return fields;
  }

  function decodeUtf8Strict(bytes) {
    if (!(bytes instanceof Uint8Array) || !bytes.length) return '';
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  /**
   * 从二进制 SendUserCascadeMessageRequest 提取 cascadeId、模型标识与既有 checkpointConfig
   */
  function extractProtoSendMessageMetadata(bytes) {
    const topFields = parseProtoFields(bytes);
    let cascadeId = null;
    let planModelEnum = null;
    let requestedModelEnum = null;
    let modelName = null;
    let customModelOverrideRaw = null;
    let existingMaxTokenLimit = null;
    let existingContextWindow = null;

    for (const f of topFields) {
      if (f.fieldNumber === 1 && f.wireType === 2 && f.bytesValue) {
        try { cascadeId = decodeUtf8Strict(f.bytesValue); } catch {}
      } else if (f.fieldNumber === 5 && f.wireType === 2 && f.bytesValue) {
        const cfgFields = parseProtoFields(f.bytesValue);
        for (const cf of cfgFields) {
          if (cf.fieldNumber === 1 && cf.wireType === 2 && cf.bytesValue) {
            const plannerFields = parseProtoFields(cf.bytesValue);
            for (const pf of plannerFields) {
              if (pf.fieldNumber === 1 && pf.wireType === 0 && pf.varintValue !== null) {
                planModelEnum = Number(pf.varintValue);
              } else if (pf.fieldNumber === 15 && pf.wireType === 2 && pf.bytesValue) {
                const moaFields = parseProtoFields(pf.bytesValue);
                for (const mf of moaFields) {
                  if (mf.fieldNumber === 1 && mf.wireType === 0 && mf.varintValue !== null) {
                    requestedModelEnum = Number(mf.varintValue);
                  } else if (mf.fieldNumber === 2 && mf.wireType === 0 && mf.varintValue !== null) {
                    requestedModelEnum = Number(mf.varintValue);
                  }
                }
              } else if (pf.fieldNumber === 27 && pf.wireType === 2 && pf.bytesValue) {
                try {
                  const overrideFields = parseProtoFields(pf.bytesValue);
                  for (const ofield of overrideFields) {
                    if (ofield.wireType === 2 && ofield.bytesValue) {
                      // 单个子字段 UTF-8 解码隔离，防止非文本二进制子字段中断循环导致错过 field 15 枚举值
                      try {
                        const s = decodeUtf8Strict(ofield.bytesValue);
                        if (s && !customModelOverrideRaw && /^[\x20-\x7e]{2,128}$/.test(s)) {
                          customModelOverrideRaw = s;
                        }
                      } catch {}
                    } else if (ofield.fieldNumber === 15 && ofield.wireType === 0 && ofield.varintValue !== null) {
                      if (planModelEnum === null) planModelEnum = Number(ofield.varintValue);
                    }
                  }
                } catch {}
              } else if (pf.fieldNumber === 28 && pf.wireType === 2 && pf.bytesValue) {
                try { modelName = decodeUtf8Strict(pf.bytesValue); } catch {}
              }
            }
          } else if (cf.fieldNumber === 2 && cf.wireType === 2 && cf.bytesValue) {
            const cpFields = parseProtoFields(cf.bytesValue);
            for (const cpf of cpFields) {
              if (cpf.fieldNumber === 5 && cpf.wireType === 0 && cpf.varintValue !== null) {
                existingMaxTokenLimit = Number(cpf.varintValue);
              } else if (cpf.fieldNumber === 36 && cpf.wireType === 2 && cpf.bytesValue) {
                try { existingContextWindow = decodeUtf8Strict(cpf.bytesValue); } catch {}
              }
            }
          }
        }
      }
    }

    return {
      cascadeId,
      planModelEnum,
      requestedModelEnum,
      modelName,
      customModelOverrideRaw,
      existingMaxTokenLimit,
      existingContextWindow
    };
  }

  /**
   * 无损重写二进制 SendUserCascadeMessageRequest 中的 cascade_config(5).checkpoint_config(2).max_token_limit(5)
   * @param {Uint8Array} bytes
   * @param {{ mode: 'fixed'|'dynamic'|'default', limitTokens?: number|null }} action
   */
  function rewriteProtoSendMessageCheckpointLimit(bytes, action) {
    const topFields = parseProtoFields(bytes);
    const isFixed = action?.mode === 'fixed' && Number.isSafeInteger(action?.limitTokens) && action.limitTokens > 0;

    // 重建 CheckpointConfig bytes：保留所有非 field 5 (max_token_limit) 的字段
    const buildCheckpointBytes = (existingCpBytes) => {
      const kept = [];
      if (existingCpBytes) {
        const cpFields = parseProtoFields(existingCpBytes);
        for (const cpf of cpFields) {
          if (cpf.fieldNumber === 5) continue;
          kept.push(cpf.rawField);
        }
      }
      if (isFixed) {
        kept.push(encodeVarintField(5, action.limitTokens));
      }
      if (!kept.length) return null;
      return concatUint8Arrays(kept);
    };

    // 重建 CascadeConfig bytes：保留所有非 field 2 (checkpoint_config) 的字段
    const buildCascadeConfigBytes = (existingCfgBytes) => {
      const kept = [];
      let mergedCp = null;
      if (existingCfgBytes) {
        const cfgFields = parseProtoFields(existingCfgBytes);
        for (const cf of cfgFields) {
          if (cf.fieldNumber === 2 && cf.wireType === 2 && cf.bytesValue) {
            mergedCp = mergedCp ? concatUint8Arrays([mergedCp, cf.bytesValue]) : cf.bytesValue;
            continue;
          }
          kept.push(cf.rawField);
        }
      }
      const nextCpBytes = buildCheckpointBytes(mergedCp);
      if (nextCpBytes) {
        kept.push(encodeLengthDelimitedField(2, nextCpBytes));
      }
      if (!kept.length) return null;
      return concatUint8Arrays(kept);
    };

    const outFields = [];
    let mergedCascadeCfg = null;
    for (const f of topFields) {
      if (f.fieldNumber === 5 && f.wireType === 2 && f.bytesValue) {
        mergedCascadeCfg = mergedCascadeCfg ? concatUint8Arrays([mergedCascadeCfg, f.bytesValue]) : f.bytesValue;
        continue;
      }
      outFields.push(f.rawField);
    }

    if (mergedCascadeCfg || isFixed) {
      const nextCfgBytes = buildCascadeConfigBytes(mergedCascadeCfg);
      if (nextCfgBytes) {
        outFields.push(encodeLengthDelimitedField(5, nextCfgBytes));
      }
    }

    return concatUint8Arrays(outFields);
  }

  // =========================================================================
  // 2. 多传输格式解包与回包（JSON / Lcc WebSocket JSON / 5-byte Envelope / Protobuf Binary）
  // =========================================================================

  function toUint8Array(body) {
    if (!body) return null;
    if (body instanceof Uint8Array) return body;
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(body)) {
      return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    }
    return null;
  }

  function looksLikeJsonText(text) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  /**
   * 统一解包外发请求体或 WebSocket 文本帧
   * @param {any} body
   * @param {{ channel?: string, urlOrProcedure?: string, contentType?: string }} [meta]
   */
  function unpackTransportPayload(body, meta = {}) {
    if (!body) return null;
    const channel = meta.channel || 'http';
    const contentType = String(meta.contentType || '').toLowerCase();
    const urlOrProc = String(meta.urlOrProcedure || '');

    if (typeof body === 'string') {
      if (!looksLikeJsonText(body)) return null;
      let parsed = null;
      try {
        parsed = JSON.parse(body.trim());
      } catch {
        return null;
      }
      // 宿主 Lcc WebSocket JSON 封装：{ streamId, type: "start", procedure, stream, headers, payload }
      if (parsed && typeof parsed === 'object' && parsed.type === 'start' && typeof parsed.procedure === 'string' && parsed.payload && typeof parsed.payload === 'object') {
        return {
          format: 'ws_lcc_json',
          procedure: parsed.procedure,
          envelope: parsed,
          payload: parsed.payload
        };
      }
      return { format: 'json_string', payload: parsed };
    }

    const raw = toUint8Array(body);
    if (!raw || raw.length === 0) return null;

    // 优先判断是否为 5 字节 Connect / gRPC-Web Envelope：[flags(1B), uint32BE length(4B)] + body
    const expectsProtoContentType = contentType.includes('proto') || contentType.includes('grpc');
    if (raw.length >= 5) {
      const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const flags = view.getUint8(0);
      const declaredLen = view.getUint32(1, false);
      if (raw.length === 5 + declaredLen || (raw.length > 5 + declaredLen && (flags === 0 || flags === 1 || flags === 2))) {
        if ((flags & 1) !== 0) {
          return { format: 'compressed_unsupported', flags, uninjectableReason: 'unsupported_compressed_frame' };
        }
        const inner = raw.subarray(5, 5 + declaredLen);
        let decodedText = null;
        try {
          decodedText = new TextDecoder('utf-8', { fatal: true }).decode(inner);
        } catch {}
        if (!expectsProtoContentType && decodedText && looksLikeJsonText(decodedText)) {
          try {
            return { format: 'connect_envelope', flags, payload: JSON.parse(decodedText.trim()) };
          } catch {}
        }
        try {
          const protoMeta = extractProtoSendMessageMetadata(inner);
          return { format: 'connect_proto_envelope', flags, rawInner: inner, trailing: raw.subarray(5 + declaredLen), protoMeta };
        } catch {}
      }
    }

    // 尝试纯 UTF-8 JSON 二进制体
    if (!expectsProtoContentType) {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
        if (looksLikeJsonText(text)) {
          const parsed = JSON.parse(text.trim());
          if (parsed && typeof parsed === 'object' && parsed.type === 'start' && typeof parsed.procedure === 'string' && parsed.payload) {
            return {
              format: 'ws_lcc_json_binary',
              procedure: parsed.procedure,
              envelope: parsed,
              payload: parsed.payload
            };
          }
          return { format: 'raw_binary_json', payload: parsed };
        }
      } catch {}
    }

    // 尝试原始二进制 Protobuf（仅当 URL/类型表明是目标 Protobuf RPC，避免对任意二进制误解析）
    if (expectsProtoContentType || isTargetBudgetRpc(urlOrProc)) {
      try {
        const protoMeta = extractProtoSendMessageMetadata(raw);
        return { format: 'raw_binary_proto', rawBytes: raw, protoMeta };
      } catch {
        return { format: 'unparseable_binary', uninjectableReason: 'invalid_protobuf_wire' };
      }
    }

    return null;
  }

  function packTransportPayload(unpacked, nextData) {
    if (!unpacked) return null;
    if (unpacked.format === 'json_string') {
      return JSON.stringify(nextData);
    }
    if (unpacked.format === 'ws_lcc_json') {
      return JSON.stringify({ ...unpacked.envelope, payload: nextData });
    }
    if (unpacked.format === 'ws_lcc_json_binary') {
      return new TextEncoder().encode(JSON.stringify({ ...unpacked.envelope, payload: nextData }));
    }
    if (unpacked.format === 'raw_binary_json') {
      return new TextEncoder().encode(JSON.stringify(nextData));
    }
    if (unpacked.format === 'connect_envelope') {
      const bytes = new TextEncoder().encode(JSON.stringify(nextData));
      const out = new Uint8Array(5 + bytes.length);
      const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
      view.setUint8(0, unpacked.flags || 0);
      view.setUint32(1, bytes.length, false);
      out.set(bytes, 5);
      return out;
    }
    if (unpacked.format === 'connect_proto_envelope' && nextData instanceof Uint8Array) {
      const tailLen = unpacked.trailing ? unpacked.trailing.length : 0;
      const out = new Uint8Array(5 + nextData.length + tailLen);
      const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
      view.setUint8(0, unpacked.flags || 0);
      view.setUint32(1, nextData.length, false);
      out.set(nextData, 5);
      if (tailLen > 0) out.set(unpacked.trailing, 5 + nextData.length);
      return out;
    }
    if (unpacked.format === 'raw_binary_proto' && nextData instanceof Uint8Array) {
      return nextData;
    }
    return null;
  }

  // =========================================================================
  // 2.5 模型能力参考、当前客户端运行策略解析、可调范围与统一模式逐模型预测
  // =========================================================================

  /**
   * 严格解析底座解锁/运行策略状态，将“磁盘检测模式”与“当前运行态确认状态”彻底分离
   * 绝不将 null / partial / pending_restart / runtime_unconfirmed 当作已运行的 dynamic 或 256K
   */
  function resolveRuntimeUnlockPolicy(unlockStatus) {
    if (!unlockStatus || typeof unlockStatus !== 'object') {
      return {
        policyKnown: false,
        runtimeState: 'unknown',
        diskMode: 'unknown',
        diskLimitTokens: null,
        runtimeMode: 'unknown',
        runtimeLimitTokens: null,
        currentClientLimitTokens: null,
        isDynamicUnlocked: null,
        diskVsRuntimeMismatch: false,
        status: null
      };
    }

    const status = typeof unlockStatus.status === 'string' ? unlockStatus.status : null;
    const gate3a = unlockStatus.gate3a && typeof unlockStatus.gate3a === 'object' ? unlockStatus.gate3a : null;
    const runtimeEvidence = unlockStatus.runtimeEvidence && typeof unlockStatus.runtimeEvidence === 'object'
      ? unlockStatus.runtimeEvidence
      : null;

    // 1. 解析磁盘/配置态策略（读取真实 fixed 固定值，绝不一律退化为 256,000）
    let diskMode = 'unknown';
    let diskLimitTokens = null;
    const rawConfMode = unlockStatus.configuredMode;
    const rawClampState = gate3a?.clampState || null;

    if (rawConfMode === 'dynamic' || (!rawConfMode && rawClampState === 'DYN')) {
      diskMode = 'dynamic';
    } else if (rawConfMode === 'fixed' || (!rawConfMode && rawClampState === 'CONST')) {
      const rawLim = Number(unlockStatus.configuredLimitTokens ?? gate3a?.limit);
      if (Number.isSafeInteger(rawLim) && rawLim > 0) {
        diskMode = 'fixed';
        diskLimitTokens = rawLim;
      } else {
        diskMode = 'unknown';
      }
    } else if (
      rawConfMode === 'default' ||
      (!rawConfMode && rawClampState === 'ORIG') ||
      (!rawConfMode && status === 'not_patched')
    ) {
      diskMode = 'default';
      diskLimitTokens = STOCK_DEFAULT_CLAMP_TOKENS;
    } else if (rawConfMode === 'partial' || status === 'partial_match') {
      diskMode = 'partial';
    }

    // 2. 判定运行态确认级别（磁盘修改后尚未重启、进程未确认、部分匹配、未知均不可直接冒充已运行生效）
    let runtimeState = 'unknown';
    let policyKnown = false;
    let diskVsRuntimeMismatch = false;

    if (status === 'partial_match' || diskMode === 'partial') {
      runtimeState = 'partial';
    } else if (status === 'failed' || status === 'unsupported' || diskMode === 'unknown') {
      runtimeState = 'unknown';
    } else if (status === 'patched_pending_restart' || runtimeEvidence?.restartDetected === false) {
      runtimeState = 'pending_restart';
      diskVsRuntimeMismatch = true;
    } else if (status === 'patched_runtime_unconfirmed') {
      runtimeState = 'runtime_unconfirmed';
      diskVsRuntimeMismatch = true;
    } else if (status === 'patched_loaded' || status === 'not_patched' || !status) {
      // 无否定状态且非待重启时，若传入明确策略（patched_loaded / not_patched / 或直接传入策略对象）则认定策略已知
      runtimeState = 'confirmed';
      policyKnown = true;
    }

    const runtimeMode = policyKnown ? diskMode : 'unknown';
    const runtimeLimitTokens = policyKnown ? diskLimitTokens : null;
    const currentClientLimitTokens = policyKnown && (runtimeMode === 'default' || runtimeMode === 'fixed')
      ? runtimeLimitTokens
      : null;
    const isDynamicUnlocked = policyKnown ? (runtimeMode === 'dynamic') : null;

    return {
      policyKnown,
      runtimeState,
      diskMode,
      diskLimitTokens,
      runtimeMode,
      runtimeLimitTokens,
      currentClientLimitTokens,
      isDynamicUnlocked,
      diskVsRuntimeMismatch,
      status
    };
  }

  /**
   * 从产品及其成员（含 GetAvailableModels / Step.metadata.modelInfo）汇总真实能力元数据，
   * 并严格分离：模型理论能力上限、当前客户端限制、当前策略默认预算、当前环境可采纳范围
   * 仅采信结构化字段（maxTokens / maxOutputTokens）；不做型号名字猜测或硬编码
   */
  function deriveModelCapabilitySummary(product, unlockStatus = null, modelCapabilitiesById = null) {
    const members = Array.isArray(product?.members) ? product.members : [];
    const capById = modelCapabilitiesById && typeof modelCapabilitiesById === 'object' ? modelCapabilitiesById : null;

    const findCapForMember = (m) => {
      if (!capById || !m) return null;
      const candidates = [m.modelId, m.modelOrAlias?.model, m.label]
        .filter(Boolean)
        .map(v => stripModelEnumPrefix(v).toLowerCase());
      for (const k of candidates) {
        if (k && capById[k]) return capById[k];
      }
      return null;
    };

    const tierDetails = [];
    for (const m of members) {
      const extCap = findCapForMember(m);
      const maxTokens = Number.isSafeInteger(Number(m?.maxTokens)) && Number(m.maxTokens) > 0
        ? Number(m.maxTokens)
        : (Number.isSafeInteger(Number(extCap?.maxTokens)) && Number(extCap.maxTokens) > 0 ? Number(extCap.maxTokens) : null);
      const rawOut = m?.maxOutputTokens ?? extCap?.maxOutputTokens;
      const maxOutputTokens = rawOut !== null && rawOut !== undefined && Number.isSafeInteger(Number(rawOut)) && Number(rawOut) >= 0
        ? Number(rawOut)
        : null;
      const thinkingBudget = m?.thinkingBudget ?? extCap?.thinkingBudget ?? null;
      const thinkingLevel = m?.thinkingLevel || extCap?.thinkingLevel || null;
      const capabilitySource = m?.capabilitySource || extCap?.capabilitySource || null;
      if (maxTokens !== null || maxOutputTokens !== null || thinkingLevel || thinkingBudget !== null) {
        tierDetails.push({
          modelId: m.modelId || null,
          effort: m.effort || null,
          maxTokens,
          maxOutputTokens,
          thinkingBudget,
          thinkingLevel,
          capabilitySource
        });
      }
    }

    const withWindow = tierDetails.filter(t => t.maxTokens !== null);
    const withOutput = tierDetails.filter(t => t.maxOutputTokens !== null);
    const uniqueWindows = Array.from(new Set(withWindow.map(t => t.maxTokens)));
    const uniqueOutputs = Array.from(new Set(withOutput.map(t => t.maxOutputTokens)));

    const maxTokens = uniqueWindows.length > 0 ? Math.min(...uniqueWindows) : null;
    const maxOutputTokens = uniqueOutputs.length > 0 ? Math.max(...uniqueOutputs) : null;
    const hasTierVariance = uniqueWindows.length > 1 || uniqueOutputs.length > 1;
    const sources = Array.from(new Set(tierDetails.map(t => t.capabilitySource).filter(Boolean)));

    const runtimePolicy = resolveRuntimeUnlockPolicy(unlockStatus);
    const isDynamicUnlocked = runtimePolicy.isDynamicUnlocked;
    const currentClientLimitTokens = runtimePolicy.currentClientLimitTokens;

    // 1. 模型理论能力上限与动态基准（仅依据模型结构化元数据，不受客户端状态左右）
    let modelTheoreticalMaxTokens = null;
    let dynamicDefaultBudget = null;
    if (maxTokens !== null && maxOutputTokens !== null && maxTokens > maxOutputTokens) {
      const reserve = Math.max(maxOutputTokens, 40000);
      dynamicDefaultBudget = maxTokens > reserve ? (maxTokens - reserve) : 0;
      modelTheoreticalMaxTokens = Math.min(DEFAULT_MAX_TOKENS, maxTokens - maxOutputTokens);
    }

    // 2. 当前策略默认预算（未携带自定义 maxTokenLimit 时的当前运行态默认结果）：
    //    依据二进制核实：
    //    - utils.GetCheckpointConfig 在 default(ORIG) 下按 min(dynamicDefault, 256000) 钳位；
    //    - 在 fixed(CONST=N) 下直接改写为 N，并经 ClampCheckpointConfigForModelInfo 钳位至 <= maxTokens - maxOutputTokens；
    //    - 在 dynamic(DYN) 下采用 dynamicDefault；
    //    - 在未知 / 部分匹配 / 待重启 / 运行未确认状态下必须保持 null（不可猜测或直接套用 983040 / 256000）
    let currentStrategyDefaultBudget = null;
    if (runtimePolicy.policyKnown) {
      if (runtimePolicy.runtimeMode === 'dynamic') {
        currentStrategyDefaultBudget = dynamicDefaultBudget;
      } else if (runtimePolicy.runtimeMode === 'default') {
        currentStrategyDefaultBudget = dynamicDefaultBudget !== null
          ? Math.min(dynamicDefaultBudget, STOCK_DEFAULT_CLAMP_TOKENS)
          : null;
      } else if (runtimePolicy.runtimeMode === 'fixed' && runtimePolicy.runtimeLimitTokens !== null) {
        const fixedVal = Math.min(DEFAULT_MAX_TOKENS, runtimePolicy.runtimeLimitTokens);
        if (modelTheoreticalMaxTokens !== null) {
          currentStrategyDefaultBudget = Math.min(fixedVal, modelTheoreticalMaxTokens);
        } else if (maxTokens !== null) {
          currentStrategyDefaultBudget = Math.min(fixedVal, maxTokens);
        } else {
          currentStrategyDefaultBudget = fixedVal;
        }
      }
    }
    const effectiveDefaultBudget = currentStrategyDefaultBudget;

    // 3. 当前环境下可确认的安全可调上限（与参考卡、最大可用按钮、预设/校验和统一预测一致）：
    //    虽然局部合并链中请求显式 maxTokenLimit 优先级高于默认基座，但未开启 Dynamic 并经实机确认前，
    //    下游覆盖与服务端策略限制仍可能将实际预算束缚于 currentClientLimitTokens
    let maxAdjustableTokens = null;
    if (runtimePolicy.policyKnown) {
      if (runtimePolicy.runtimeMode === 'dynamic') {
        maxAdjustableTokens = modelTheoreticalMaxTokens;
      } else if ((runtimePolicy.runtimeMode === 'default' || runtimePolicy.runtimeMode === 'fixed') && currentClientLimitTokens !== null) {
        const clientCap = Math.min(DEFAULT_MAX_TOKENS, currentClientLimitTokens);
        maxAdjustableTokens = modelTheoreticalMaxTokens !== null
          ? Math.min(modelTheoreticalMaxTokens, clientCap)
          : clientCap;
      }
    }

    let formulaNote = null;
    if (maxTokens !== null && maxOutputTokens !== null && maxTokens > maxOutputTokens) {
      formulaNote = '模型理论输入上限 = maxTokens - maxOutputTokens（动态默认按 max(maxOutputTokens, 40,000) 预留）';
    } else if (maxTokens !== null && maxOutputTokens === null) {
      formulaNote = 'IDE 仅返回总窗口但缺少 maxOutputTokens，无法推导模型理论输入上限';
    }

    let policyNote = null;
    if (runtimePolicy.runtimeState === 'pending_restart') {
      policyNote = '磁盘配置已变更但运行中的客户端尚未重启，当前运行策略与可采纳上限待确认';
    } else if (runtimePolicy.runtimeState === 'runtime_unconfirmed') {
      policyNote = '仅检测到磁盘配置，尚未确认运行中进程已加载该策略';
    } else if (runtimePolicy.runtimeState === 'partial') {
      policyNote = '检测到当前环境处于部分异常状态，运行策略上限未知';
    } else if (runtimePolicy.runtimeState === 'unknown') {
      policyNote = '尚未获取或无法确认当前客户端运行策略，默认预算及目标采纳范围标为未知';
    } else if (runtimePolicy.runtimeMode === 'fixed' && currentClientLimitTokens !== null) {
      policyNote = `当前客户端运行于固定限制 ${currentClientLimitTokens.toLocaleString('en-US')} tokens`;
    } else if (runtimePolicy.runtimeMode === 'default') {
      policyNote = '当前客户端运行于默认 256,000 tokens 限制';
    } else if (runtimePolicy.runtimeMode === 'dynamic') {
      policyNote = '当前客户端已开启 Dynamic 动态跟随，按模型自身上限裁剪';
    }

    const rangeMin = maxAdjustableTokens !== null
      ? Math.min(DEFAULT_MIN_TOKENS, maxAdjustableTokens)
      : DEFAULT_MIN_TOKENS;
    const rangeMax = maxAdjustableTokens;

    return {
      productKey: product?.productKey || null,
      productLabel: product?.productLabel || null,
      maxTokens,
      maxOutputTokens,
      modelTheoreticalMaxTokens,
      dynamicDefaultBudget,
      currentClientLimitTokens,
      currentStrategyDefaultBudget,
      effectiveDefaultBudget,
      maxAdjustableTokens,
      rangeMin,
      rangeMax,
      hasMetadata: maxTokens !== null && maxOutputTokens !== null,
      hasPartialMetadata: (maxTokens !== null) !== (maxOutputTokens !== null),
      hasTierVariance,
      tierDetails,
      sources,
      runtimePolicy,
      isDynamicUnlocked,
      formulaNote,
      policyNote
    };
  }

  /**
   * 评估当前输入/预设在对应模型能力与当前客户端运行策略下的合法性及可采纳值
   * 绝不静默篡改用户数值并报成功，也不混淆模型能力上限与客户端策略上限
   */
  function evaluateLimitInput(rawVal, capSummary = null, unlockStatus = null, serviceLimit = null) {
    const rawStr = typeof rawVal === 'number' ? String(rawVal) : String(rawVal ?? '').trim().replace(/[,\s_]/g, '');
    if (!/^\d+$/.test(rawStr)) {
      return { ok: false, reasonCode: 'not_integer', limitTokens: null };
    }
    const num = Number(rawStr);
    if (!Number.isSafeInteger(num) || num <= 0) {
      return { ok: false, reasonCode: 'not_integer', limitTokens: null };
    }
    if (num < DEFAULT_MIN_TOKENS || num > DEFAULT_MAX_TOKENS) {
      return {
        ok: false,
        reasonCode: 'out_of_engineering_range',
        limitTokens: num,
        min: DEFAULT_MIN_TOKENS,
        max: DEFAULT_MAX_TOKENS
      };
    }

    const warnings = [];
    const policy = arguments.length >= 3
      ? resolveRuntimeUnlockPolicy(unlockStatus)
      : (capSummary?.runtimePolicy || resolveRuntimeUnlockPolicy(null));
    const modelMaxAllowed = capSummary?.modelTheoreticalMaxTokens ?? null;
    const clientLimit = policy.policyKnown ? policy.currentClientLimitTokens : null;

    let exceedsModelLimit = false;
    const modelCapped = modelMaxAllowed !== null ? Math.min(num, modelMaxAllowed) : num;
    if (modelMaxAllowed !== null && num > modelMaxAllowed) {
      exceedsModelLimit = true;
      warnings.push({
        code: 'exceeds_model_limit',
        limitTokens: num,
        maxAllowed: modelMaxAllowed,
        adoptableTokens: policy.policyKnown && clientLimit !== null
          ? Math.min(modelCapped, clientLimit)
          : (policy.policyKnown ? modelCapped : null)
      });
    }

    let exceedsClientPolicy = false;
    let requiresDynamicUnlock = false;
    if (!policy.policyKnown) {
      warnings.push({
        code: 'unconfirmed_runtime_policy',
        limitTokens: num,
        runtimeState: policy.runtimeState,
        diskMode: policy.diskMode,
        diskLimitTokens: policy.diskLimitTokens
      });
    } else if (clientLimit !== null && num > clientLimit) {
      exceedsClientPolicy = true;
      if (policy.runtimeMode === 'default') {
        requiresDynamicUnlock = true;
        warnings.push({
          code: 'requires_dynamic_unlock',
          limitTokens: num,
          stockCap: clientLimit
        });
      } else if (policy.runtimeMode === 'fixed') {
        warnings.push({
          code: 'exceeds_fixed_client_limit',
          limitTokens: num,
          fixedCap: clientLimit
        });
      }
    }

    let adoptableTokens = null;
    if (policy.policyKnown) {
      if (policy.runtimeMode === 'dynamic') {
        adoptableTokens = modelCapped;
      } else if (clientLimit !== null) {
        adoptableTokens = Math.min(modelCapped, clientLimit);
      }
    }

    const sLimit = Number(serviceLimit || 0);
    if (sLimit > 0 && num > sLimit) {
      warnings.push({
        code: 'exceeds_service_limit',
        limitTokens: num,
        serviceLimit: sLimit
      });
    }

    if (num < 65536) {
      warnings.push({
        code: 'below_recommended_floor',
        limitTokens: num
      });
    }

    return {
      ok: true,
      limitTokens: num,
      exceedsModelLimit,
      exceedsClientPolicy,
      clientPolicyLimit: clientLimit,
      runtimeState: policy.runtimeState,
      policyKnown: policy.policyKnown,
      adoptableTokens,
      requiresDynamicUnlock,
      warnings
    };
  }

  /**
   * 统一预算模式下，为每个模型预测当前运行策略下的可采纳结果
   * 严格区分“预测值”与“运行已确认”，绝不把未知/待重启/default/fixed 错判为 exact
   */
  function projectUnifiedBudgetForProducts(unifiedPref, products = [], unlockStatus = null, modelCapabilitiesById = null) {
    const mode = unifiedPref?.mode || 'default';
    const rawLimit = mode === 'fixed' && Number.isSafeInteger(Number(unifiedPref?.limitTokens))
      ? Number(unifiedPref.limitTokens)
      : null;
    const policy = resolveRuntimeUnlockPolicy(unlockStatus);
    const unresolvedOutcome = policy.runtimeState === 'pending_restart'
      ? 'pending_restart_unconfirmed'
      : (policy.runtimeState === 'partial'
        ? 'partial_policy_unconfirmed'
        : (policy.runtimeState === 'runtime_unconfirmed' ? 'runtime_unconfirmed' : 'unknown_policy'));

    return (Array.isArray(products) ? products : []).map(prod => {
      const cap = deriveModelCapabilitySummary(prod, unlockStatus, modelCapabilitiesById);
      const modelCap = cap.modelTheoreticalMaxTokens;
      const clientCap = policy.policyKnown ? policy.currentClientLimitTokens : null;

      if (mode === 'default') {
        if (!policy.policyKnown) {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: unresolvedOutcome,
            projectedTokens: null
          };
        }
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'client_default',
          projectedTokens: cap.effectiveDefaultBudget
        };
      }

      if (mode === 'dynamic') {
        if (!policy.policyKnown) {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: unresolvedOutcome,
            projectedTokens: null
          };
        }
        if (policy.runtimeMode === 'default' || policy.runtimeMode === 'fixed') {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: 'clamped_by_client_policy',
            clientLimitTokens: clientCap,
            projectedTokens: cap.effectiveDefaultBudget
          };
        }
        if (cap.dynamicDefaultBudget === null) {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: 'unknown_cap',
            projectedTokens: null
          };
        }
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'dynamic_follow',
          projectedTokens: cap.dynamicDefaultBudget
        };
      }

      if (!rawLimit) {
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'invalid_target',
          projectedTokens: null
        };
      }

      if (!policy.policyKnown) {
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: unresolvedOutcome,
          targetTokens: rawLimit,
          exceedsModelLimit: modelCap !== null && rawLimit > modelCap,
          projectedTokens: null
        };
      }

      if (policy.runtimeMode === 'dynamic') {
        if (modelCap === null) {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: 'unknown_cap',
            targetTokens: rawLimit,
            projectedTokens: null
          };
        }
        if (rawLimit > modelCap) {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: 'clamped_to_model_max',
            targetTokens: rawLimit,
            projectedTokens: modelCap
          };
        }
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'exact',
          targetTokens: rawLimit,
          projectedTokens: rawLimit
        };
      }

      // runtimeMode === 'default' (256,000) 或 'fixed' (N)
      if (modelCap !== null && rawLimit > modelCap) {
        if (clientCap !== null && clientCap < modelCap && rawLimit > clientCap) {
          return {
            productKey: prod.productKey,
            productLabel: prod.productLabel,
            vendor: prod.vendor,
            capability: cap,
            outcome: 'clamped_by_client_policy',
            targetTokens: rawLimit,
            clientLimitTokens: clientCap,
            modelTheoreticalMaxTokens: modelCap,
            projectedTokens: clientCap
          };
        }
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'clamped_to_model_max',
          targetTokens: rawLimit,
          clientLimitTokens: clientCap,
          projectedTokens: modelCap
        };
      }

      if (clientCap !== null && rawLimit > clientCap) {
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'exceeds_client_policy',
          targetTokens: rawLimit,
          clientLimitTokens: clientCap,
          modelTheoreticalMaxTokens: modelCap,
          projectedTokens: modelCap !== null ? Math.min(modelCap, clientCap) : clientCap
        };
      }

      if (modelCap === null) {
        return {
          productKey: prod.productKey,
          productLabel: prod.productLabel,
          vendor: prod.vendor,
          capability: cap,
          outcome: 'unknown_cap',
          targetTokens: rawLimit,
          clientLimitTokens: clientCap,
          projectedTokens: null
        };
      }

      return {
        productKey: prod.productKey,
        productLabel: prod.productLabel,
        vendor: prod.vendor,
        capability: cap,
        outcome: 'exact',
        targetTokens: rawLimit,
        clientLimitTokens: clientCap,
        projectedTokens: rawLimit
      };
    });
  }

  // =========================================================================
  // 3. 请求模型提取（严禁回退至插件配置面板选中项或全局历史快照）
  // =========================================================================

  function matchConfigByCandidate(candidate, knownConfigs) {
    if (!Array.isArray(knownConfigs) || !knownConfigs.length || candidate === null || candidate === undefined) {
      return null;
    }
    if (typeof candidate === 'number') {
      const byValue = knownConfigs.find(c => Number(c?.value) === candidate);
      if (byValue) return byValue;
      const enumName = modelEnumNumberToName(candidate);
      if (enumName) {
        return matchConfigByCandidate(enumName, knownConfigs);
      }
      return null;
    }
    const rawStr = String(candidate).trim();
    if (!rawStr) return null;
    const rawLower = rawStr.toLowerCase();
    const strippedLower = stripModelEnumPrefix(rawStr).toLowerCase();
    return knownConfigs.find(c => {
      const fields = [c?.modelId, c?.model, c?.modelOrAlias?.model, c?.modelOrAlias?.alias, c?.modelAlias, c?.label];
      for (const f of fields) {
        if (f === null || f === undefined) continue;
        const fl = String(f).trim().toLowerCase();
        if (!fl) continue;
        if (fl === rawLower || stripModelEnumPrefix(fl) === strippedLower) return true;
      }
      if (/^\d+$/.test(rawStr) && Number(c?.value) === Number(rawStr)) return true;
      return false;
    }) || null;
  }

  function normalizeResolvedCandidate(rawCandidate, knownConfigs, groupFn, resolveStableFn) {
    if (rawCandidate === null || rawCandidate === undefined) return null;
    const matchedCfg = matchConfigByCandidate(rawCandidate, knownConfigs);
    if (matchedCfg) {
      const mId = matchedCfg.modelId || matchedCfg.model || matchedCfg.modelOrAlias?.model || matchedCfg.label;
      const lbl = matchedCfg.label || matchedCfg.modelDisplayName || mId;
      const g = groupFn({ modelId: mId, label: lbl, modelOrAlias: matchedCfg.modelOrAlias, effort: matchedCfg.effort });
      if (g?.productKey) {
        return {
          productKey: g.productKey,
          productLabel: g.productLabel,
          modelId: (resolveStableFn ? resolveStableFn(matchedCfg, knownConfigs) : null) || String(mId || '').toLowerCase(),
          rawCandidate
        };
      }
    }

    let strVal = null;
    if (typeof rawCandidate === 'number') {
      strVal = modelEnumNumberToName(rawCandidate);
    } else if (typeof rawCandidate === 'string') {
      strVal = rawCandidate.trim();
    }
    if (!strVal) return null;

    // 去除 Protobuf enum 前缀并美化可读名称用于分组兜底
    const stripped = stripModelEnumPrefix(strVal);
    if (/^PLACEHOLDER_M\d+$/i.test(stripped)) {
      // 未能在已知目录中找到具体产品名时，按准确占位 ID 分组而不是跨模型猜测
      const g = groupFn({ modelId: stripped.toLowerCase(), label: stripped.toLowerCase() });
      return {
        productKey: g?.productKey || `product:other:${stripped.toLowerCase()}`,
        productLabel: g?.productLabel || stripped.toLowerCase(),
        modelId: stripped.toLowerCase(),
        rawCandidate
      };
    }

    const readable = stripped.includes('_') && stripped === stripped.toUpperCase()
      ? stripped.toLowerCase().replace(/_/g, '-')
      : stripped;
    const g = groupFn({ modelId: readable, label: readable });
    if (!g?.productKey) return null;
    return {
      productKey: g.productKey,
      productLabel: g.productLabel,
      modelId: (resolveStableFn ? resolveStableFn(readable, knownConfigs) : null) || readable.toLowerCase(),
      rawCandidate
    };
  }

  /**
   * 从出站请求对象 / 二进制元数据提取实际模型产品键
   * @param {object} requestOrProtoMeta
   * @param {{
   *   isProtoMeta?: boolean,
   *   knownConfigs?: Array,
   *   verifiedConversationBindings?: Record<string, { productKey: string, modelId?: string }>,
   *   groupProduct?: Function,
   *   resolveStableModelId?: Function
   * }} [options]
   */
  function resolveRequestModel(requestOrProtoMeta, options = {}) {
    if (!requestOrProtoMeta || typeof requestOrProtoMeta !== 'object') {
      return { resolved: false, reason: 'invalid_payload', cascadeId: null };
    }

    const knownConfigs = Array.isArray(options.knownConfigs) ? options.knownConfigs : [];
    const bindings = options.verifiedConversationBindings || {};
    const groupFn = typeof options.groupProduct === 'function'
      ? options.groupProduct
      : (input) => {
        const s = String(input?.label || input?.modelId || 'unknown').trim();
        const low = s.toLowerCase().replace(/[^a-z0-9.\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
        return { productKey: `product:other:${low || 'unknown'}`, productLabel: s, vendor: '其他', effort: null };
      };
    const resolveStableFn = typeof options.resolveStableModelId === 'function' ? options.resolveStableModelId : null;

    if (options.isProtoMeta) {
      const cascadeId = requestOrProtoMeta.cascadeId || null;
      const candidates = [
        { source: 'customModelInfoOverride', value: requestOrProtoMeta.customModelOverrideRaw },
        { source: 'modelName', value: requestOrProtoMeta.modelName },
        { source: 'requestedModel', value: requestOrProtoMeta.requestedModelEnum },
        { source: 'planModel', value: requestOrProtoMeta.planModelEnum }
      ];
      for (const c of candidates) {
        if (c.value === null || c.value === undefined || c.value === 0 || c.value === '') continue;
        const norm = normalizeResolvedCandidate(c.value, knownConfigs, groupFn, resolveStableFn);
        if (norm) return { resolved: true, source: `proto_${c.source}`, cascadeId, ...norm };
      }
      if (cascadeId && bindings[cascadeId]?.productKey) {
        return {
          resolved: true,
          source: 'verified_conversation_binding',
          cascadeId,
          productKey: bindings[cascadeId].productKey,
          productLabel: bindings[cascadeId].productLabel || bindings[cascadeId].productKey,
          modelId: bindings[cascadeId].modelId || bindings[cascadeId].productKey
        };
      }
      return { resolved: false, reason: 'unidentifiable_request_model', cascadeId };
    }

    const payload = requestOrProtoMeta;
    const cascadeId = payload.cascadeId || payload.cascade_id || null;
    const cfg = payload.cascadeConfig || payload.cascade_config || {};
    const planner = cfg.plannerConfig || cfg.planner_config || payload.plannerConfig || payload.planner_config || {};

    const override = planner.customModelInfoOverride || planner.custom_model_info_override || {};
    const reqModelObj = planner.requestedModel || planner.requested_model || {};
    const candidates = [
      { source: 'customModelInfoOverride', value: override.model || override.modelId || override.label },
      { source: 'modelName', value: planner.modelName || planner.model_name },
      { source: 'requestedModel', value: reqModelObj.model || reqModelObj.alias || (reqModelObj.choice?.case ? reqModelObj.choice.value : null) },
      { source: 'planModel', value: planner.planModel ?? planner.plan_model }
    ];

    for (const c of candidates) {
      if (c.value === null || c.value === undefined || c.value === 0 || c.value === '') continue;
      const norm = normalizeResolvedCandidate(c.value, knownConfigs, groupFn, resolveStableFn);
      if (norm) return { resolved: true, source: c.source, cascadeId, ...norm };
    }

    if (cascadeId && bindings[cascadeId]?.productKey) {
      return {
        resolved: true,
        source: 'verified_conversation_binding',
        cascadeId,
        productKey: bindings[cascadeId].productKey,
        productLabel: bindings[cascadeId].productLabel || bindings[cascadeId].productKey,
        modelId: bindings[cascadeId].modelId || bindings[cascadeId].productKey
      };
    }

    return { resolved: false, reason: 'unidentifiable_request_model', cascadeId };
  }

  // =========================================================================
  // 4. 预算偏好查询与请求篡改（支持对象/JSON/Protobuf、保护 $typeName 与默认清理）
  // =========================================================================

  function findPreferenceForProduct(productKey, contextPreferencesMap) {
    if (!productKey || !contextPreferencesMap || typeof contextPreferencesMap !== 'object') return null;
    if (contextPreferencesMap[productKey]) return contextPreferencesMap[productKey];
    const pSlug = String(productKey).replace(/^product:[^:]+:/, '').toLowerCase();
    for (const [k, pref] of Object.entries(contextPreferencesMap)) {
      if (!pref) continue;
      const kSlug = String(k).replace(/^product:[^:]+:/, '').toLowerCase();
      if (kSlug && kSlug === pSlug) return pref;
    }
    return null;
  }

  function resolveBudgetPolicy(options = {}) {
    const scopeMode = options.scopeMode === 'per_model' ? 'per_model' : 'unified';
    const pref = scopeMode === 'unified'
      ? (options.unifiedPreference || { mode: 'default', limitTokens: null })
      : findPreferenceForProduct(options.productKey, options.contextPreferencesMap);
    if (!pref) {
      return { mode: 'default', limitTokens: null, hasExplicitPref: false };
    }
    const mode = pref.mode === 'fixed' || pref.mode === 'dynamic' ? pref.mode : 'default';
    if (mode === 'fixed') {
      const limit = Number(pref.limitTokens);
      const minTokens = Number(options.minTokens || DEFAULT_MIN_TOKENS);
      const maxTokens = Number(options.maxTokens || DEFAULT_MAX_TOKENS);
      if (Number.isSafeInteger(limit) && limit >= minTokens && limit <= maxTokens) {
        return { mode: 'fixed', limitTokens: limit, hasExplicitPref: true };
      }
      return { mode: 'invalid_fixed', limitTokens: limit, hasExplicitPref: true };
    }
    return { mode, limitTokens: null, hasExplicitPref: true };
  }

  /**
   * 在 JS 请求对象上注入/清理 CheckpointConfig.maxTokenLimit（支持 Snake/Camel 单套与 @bufbuild/protobuf v2 $typeName）
   */
  function applyBudgetPolicyToObject(payload, policy) {
    if (!payload || typeof payload !== 'object' || !policy) {
      return { modified: false, appliedMode: 'passthrough', sentLimitTokens: null };
    }

    const usesProtoBufTypeName = Boolean(
      payload.$typeName
      || payload.cascadeConfig?.$typeName
      || payload.cascadeConfig?.plannerConfig?.$typeName
      || payload.cascadeConfig?.checkpointConfig?.$typeName
    );
    const isSnake = Boolean(payload.cascade_config && !payload.cascadeConfig);

    if (policy.mode === 'fixed' && Number.isSafeInteger(policy.limitTokens)) {
      if (isSnake) {
        payload.cascade_config = payload.cascade_config || {};
        payload.cascade_config.checkpoint_config = payload.cascade_config.checkpoint_config || {};
        payload.cascade_config.checkpoint_config.max_token_limit = policy.limitTokens;
      } else {
        if (!payload.cascadeConfig) {
          payload.cascadeConfig = usesProtoBufTypeName ? { $typeName: 'exa.cortex_pb.CascadeConfig' } : {};
        }
        if (!payload.cascadeConfig.checkpointConfig) {
          payload.cascadeConfig.checkpointConfig = usesProtoBufTypeName ? { $typeName: 'exa.cortex_pb.CheckpointConfig' } : {};
        } else if (usesProtoBufTypeName && !payload.cascadeConfig.checkpointConfig.$typeName) {
          payload.cascadeConfig.checkpointConfig.$typeName = 'exa.cortex_pb.CheckpointConfig';
        }
        payload.cascadeConfig.checkpointConfig.maxTokenLimit = policy.limitTokens;
      }
      return { modified: true, appliedMode: 'fixed', sentLimitTokens: policy.limitTokens };
    }

    // dynamic 或 default：必须清除任何残留固定阈值，绝不保留上一次遗留的 fixed 值
    let cleared = false;
    if (payload.cascadeConfig?.checkpointConfig && payload.cascadeConfig.checkpointConfig.maxTokenLimit !== undefined) {
      delete payload.cascadeConfig.checkpointConfig.maxTokenLimit;
      cleared = true;
    }
    if (payload.cascade_config?.checkpoint_config && payload.cascade_config.checkpoint_config.max_token_limit !== undefined) {
      delete payload.cascade_config.checkpoint_config.max_token_limit;
      cleared = true;
    }
    return {
      modified: cleared,
      appliedMode: policy.mode === 'dynamic' ? 'dynamic' : 'default',
      sentLimitTokens: null
    };
  }

  /**
   * 一体化拦截变换（支持 client_object / HTTP JSON / WebSocket Lcc / Envelope / Protobuf Binary）
   */
  function transformOutgoingSendRequest(input, context = {}) {
    const channel = context.channel || 'http';
    const urlOrProcedure = context.urlOrProcedure || '';

    // 1. 先检查 RPC 通道目标
    if (channel !== 'ws_frame' && urlOrProcedure && !isTargetBudgetRpc(urlOrProcedure)) {
      return { handled: false, passthrough: true, reason: 'non_target_rpc' };
    }

    // 2. 如果是客户端装饰器直传对象
    if (channel === 'client_object') {
      if (!input || typeof input !== 'object') {
        return { handled: false, passthrough: true, reason: 'invalid_client_request' };
      }
      const resolved = resolveRequestModel(input, context);
      const scopeMode = context.scopeMode === 'per_model' ? 'per_model' : 'unified';
      if (!resolved.resolved && scopeMode !== 'unified') {
        return {
          handled: true,
          passthrough: true,
          modified: false,
          uninjectable: true,
          reason: resolved.reason || 'unidentifiable_request_model',
          cascadeId: resolved.cascadeId || null,
          productKey: null
        };
      }
      const policy = resolveBudgetPolicy({
        scopeMode,
        unifiedPreference: context.unifiedPreference,
        contextPreferencesMap: context.contextPreferencesMap,
        productKey: resolved.productKey,
        minTokens: context.minTokens,
        maxTokens: context.maxTokens
      });
      if (policy.mode === 'invalid_fixed') {
        return {
          handled: true,
          passthrough: true,
          modified: false,
          uninjectable: true,
          reason: 'invalid_fixed_limit',
          cascadeId: resolved.cascadeId || null,
          productKey: resolved.productKey || null
        };
      }
      const applied = applyBudgetPolicyToObject(input, policy);
      return {
        handled: true,
        passthrough: policy.mode === 'default' && !applied.modified,
        modified: applied.modified,
        uninjectable: false,
        channel,
        cascadeId: resolved.cascadeId || input.cascadeId || input.cascade_id || null,
        productKey: resolved.productKey || (scopeMode === 'unified' ? '__unified__' : null),
        productLabel: resolved.productLabel || null,
        modelId: resolved.modelId || null,
        modelSource: resolved.source || null,
        scopeMode,
        targetMode: policy.mode,
        targetLimitTokens: policy.limitTokens,
        sentMode: applied.appliedMode,
        sentLimitTokens: applied.sentLimitTokens,
        output: input
      };
    }

    // 3. 传输层帧/请求体（WebSocket / Fetch / XHR）
    const unpacked = unpackTransportPayload(input, { channel, urlOrProcedure, contentType: context.contentType });
    if (!unpacked) {
      return { handled: false, passthrough: true, reason: 'unrecognized_body' };
    }

    // WebSocket Lcc 帧需在解包后检验 procedure
    if (channel === 'ws_frame') {
      if (!unpacked.procedure || !isTargetBudgetRpc(unpacked.procedure)) {
        return { handled: false, passthrough: true, reason: 'non_target_ws_procedure' };
      }
    }

    if (unpacked.uninjectableReason) {
      return {
        handled: true,
        passthrough: true,
        modified: false,
        uninjectable: true,
        reason: unpacked.uninjectableReason,
        channel,
        cascadeId: null,
        productKey: null
      };
    }

    const isProto = unpacked.format === 'connect_proto_envelope' || unpacked.format === 'raw_binary_proto';
    const resolved = isProto
      ? resolveRequestModel(unpacked.protoMeta, { ...context, isProtoMeta: true })
      : resolveRequestModel(unpacked.payload, { ...context, isProtoMeta: false });

    const scopeMode = context.scopeMode === 'per_model' ? 'per_model' : 'unified';
    if (!resolved.resolved && scopeMode !== 'unified') {
      return {
        handled: true,
        passthrough: true,
        modified: false,
        uninjectable: true,
        reason: resolved.reason || 'unidentifiable_request_model',
        channel,
        cascadeId: resolved.cascadeId || null,
        productKey: null
      };
    }

    const policy = resolveBudgetPolicy({
      scopeMode,
      unifiedPreference: context.unifiedPreference,
      contextPreferencesMap: context.contextPreferencesMap,
      productKey: resolved.productKey,
      minTokens: context.minTokens,
      maxTokens: context.maxTokens
    });
    if (policy.mode === 'invalid_fixed') {
      return {
        handled: true,
        passthrough: true,
        modified: false,
        uninjectable: true,
        reason: 'invalid_fixed_limit',
        channel,
        cascadeId: resolved.cascadeId || null,
        productKey: resolved.productKey || null
      };
    }

    if (isProto) {
      const srcBytes = unpacked.format === 'connect_proto_envelope' ? unpacked.rawInner : unpacked.rawBytes;
      const hadExisting = unpacked.protoMeta?.existingMaxTokenLimit !== null && unpacked.protoMeta?.existingMaxTokenLimit !== undefined;
      let nextProtoBytes = srcBytes;
      let modified = false;
      if (policy.mode === 'fixed') {
        nextProtoBytes = rewriteProtoSendMessageCheckpointLimit(srcBytes, { mode: 'fixed', limitTokens: policy.limitTokens });
        modified = true;
      } else if (hadExisting) {
        nextProtoBytes = rewriteProtoSendMessageCheckpointLimit(srcBytes, { mode: policy.mode, limitTokens: null });
        modified = true;
      }
      const packed = modified ? packTransportPayload(unpacked, nextProtoBytes) : input;
      return {
        handled: true,
        passthrough: !modified,
        modified,
        uninjectable: false,
        channel,
        format: unpacked.format,
        cascadeId: resolved.cascadeId || null,
        productKey: resolved.productKey || (scopeMode === 'unified' ? '__unified__' : null),
        productLabel: resolved.productLabel || null,
        modelId: resolved.modelId || null,
        modelSource: resolved.source || null,
        scopeMode,
        targetMode: policy.mode,
        targetLimitTokens: policy.limitTokens,
        sentMode: policy.mode === 'fixed' ? 'fixed' : (policy.mode === 'dynamic' ? 'dynamic' : 'default'),
        sentLimitTokens: policy.mode === 'fixed' ? policy.limitTokens : null,
        output: packed || input
      };
    }

    const applied = applyBudgetPolicyToObject(unpacked.payload, policy);
    const packed = applied.modified ? packTransportPayload(unpacked, unpacked.payload) : input;
    return {
      handled: true,
      passthrough: !applied.modified,
      modified: Boolean(applied.modified && packed),
      uninjectable: false,
      channel,
      format: unpacked.format,
      cascadeId: resolved.cascadeId || unpacked.payload?.cascadeId || unpacked.payload?.cascade_id || null,
      productKey: resolved.productKey || (scopeMode === 'unified' ? '__unified__' : null),
      productLabel: resolved.productLabel || null,
      modelId: resolved.modelId || null,
      modelSource: resolved.source || null,
      scopeMode,
      targetMode: policy.mode,
      targetLimitTokens: policy.limitTokens,
      sentMode: applied.appliedMode,
      sentLimitTokens: applied.sentLimitTokens,
      output: packed || input
    };
  }

  // =========================================================================
  // 5. 发送追踪、因果观测与严格状态机 (杜绝时间戳造假与假确认)
  // =========================================================================

  function makeScopeKey(convoId, productKey) {
    return `${convoId || '__no_conv__'}::${productKey || '__no_product__'}`;
  }

  function createContextBudgetTracker(options = {}) {
    const confirmTimeoutMs = Number(options.confirmTimeoutMs || DEFAULT_CONFIRM_TIMEOUT_MS);
    const nowFn = typeof options.now === 'function' ? options.now : () => Date.now();
    let seqCounter = 0;

    // 按 (convoId, productKey) 隔离保存最近发送记录，防止并发会话/快速切换互相覆盖
    const dispatchesByScope = new Map();
    const dispatchesById = new Map();
    // 仅在无活跃会话上下文时辅助查询按产品的最近发送，不跨会话冒用确认
    const dispatchesByProduct = new Map();
    // 按 (convoId, productKey) 隔离保存真实观测快照
    const observationsByScope = new Map();
    // 已验证的会话->模型绑定（仅来自明确请求的响应或该会话真实 metadata）
    const verifiedConversationBindings = Object.create(null);

    function recordConversationBinding(convoId, binding) {
      if (!convoId || !binding?.productKey) return;
      verifiedConversationBindings[convoId] = {
        productKey: binding.productKey,
        productLabel: binding.productLabel || binding.productKey,
        modelId: binding.modelId || binding.productKey,
        updatedAt: nowFn()
      };
    }

    function getBaselineForScope(convoId, productKey) {
      const obs = observationsByScope.get(makeScopeKey(convoId, productKey));
      if (!obs) return { callId: null, stepCount: -1, obsTs: 0 };
      return {
        callId: obs.callId || null,
        stepCount: Number.isFinite(obs.stepCount) ? obs.stepCount : -1,
        obsTs: Number(obs.ts || 0)
      };
    }

    function beginDispatch(info = {}) {
      const seq = ++seqCounter;
      const timestamp = Number(info.timestamp || nowFn());
      const convoId = info.cascadeId || info.convoId || null;
      const productKey = info.productKey || null;
      const dispatchId = `disp_${seq}_${timestamp}`;

      if (convoId && productKey && productKey !== '__unified__') {
        recordConversationBinding(convoId, {
          productKey,
          productLabel: info.productLabel,
          modelId: info.modelId
        });
      }

      const baseline = getBaselineForScope(convoId, productKey);
      // 严禁在诊断追踪中落盘任何用户对话内容或凭证信息，仅保留结构化预算追踪字段
      const sanitizedPrefSnapshot = info.prefSnapshot && typeof info.prefSnapshot === 'object'
        ? {
          mode: info.prefSnapshot.mode || 'default',
          limitTokens: info.prefSnapshot.mode === 'fixed' && Number.isSafeInteger(Number(info.prefSnapshot.limitTokens))
            ? Number(info.prefSnapshot.limitTokens)
            : null
        }
        : {
          mode: info.targetMode || 'default',
          limitTokens: info.targetLimitTokens ?? null
        };
      const record = {
        dispatchId,
        seq,
        cascadeId: convoId,
        convoId,
        productKey,
        modelId: info.modelId || null,
        scopeMode: info.scopeMode || 'per_model',
        prefSnapshot: sanitizedPrefSnapshot,
        targetMode: info.targetMode || 'default',
        targetLimitTokens: info.targetLimitTokens ?? null,
        sentMode: info.sentMode || info.targetMode || 'default',
        sentLimitTokens: info.sentLimitTokens ?? null,
        channel: info.channel || 'http',
        transport: info.channel || 'http',
        status: info.status || 'dispatched',
        errorMessage: info.errorMessage ? String(info.errorMessage).slice(0, 160) : null,
        reason: info.reason || null,
        baselineCallId: baseline.callId,
        baselineStepCount: baseline.stepCount,
        baselineObsTs: baseline.obsTs,
        timestamp
      };

      const sKey = makeScopeKey(convoId, productKey);
      dispatchesByScope.set(sKey, record);
      dispatchesById.set(dispatchId, record);
      if (dispatchesById.size > 200) {
        const oldestKey = dispatchesById.keys().next().value;
        if (oldestKey) dispatchesById.delete(oldestKey);
      }
      if (productKey && productKey !== '__unified__') {
        dispatchesByProduct.set(productKey, record);
      }
      return record;
    }

    function updateDispatchStatus(dispatchId, patch = {}) {
      const rec = dispatchesById.get(dispatchId);
      if (!rec) return null;
      Object.assign(rec, patch);
      return rec;
    }

    /**
     * 记录后端真实观测，绝不在旧快照上用 Date.now() 刷新 ts
     */
    function recordObservation(obsInput = {}) {
      const convoId = obsInput.convoId || obsInput.cascadeId || null;
      const productKey = obsInput.productKey || null;
      if (!productKey) return null;

      const sKey = makeScopeKey(convoId, productKey);
      const prev = observationsByScope.get(sKey);
      const budget = Number(obsInput.budget || 0);
      const serviceLimit = Number(obsInput.serviceLimit || 0);
      const modelHardLimit = Number(obsInput.modelHardLimit || 0);
      const callId = obsInput.callId || null;
      const stepCount = Number.isFinite(Number(obsInput.stepCount)) ? Number(obsInput.stepCount) : -1;
      const explicitTs = Number(obsInput.ts || 0);

      // 判定是否为“新步骤 / 新响应”，而非同一快照反复轮询（绝不因 poll 时间戳增加而推进旧快照 ts）
      const sameCall = callId ? prev?.callId === callId : prev?.callId === null;
      const sameStep = stepCount === prev?.stepCount;
      const downgradedMissingCall = Boolean(
        prev &&
        !callId &&
        prev.callId &&
        (stepCount < 0 || prev.stepCount < 0 || stepCount <= prev.stepCount)
      );
      const isSameSnapshot = Boolean(
        prev &&
        prev.budget === budget &&
        prev.serviceLimit === serviceLimit &&
        prev.modelHardLimit === modelHardLimit &&
        (
          (sameCall && sameStep && (!explicitTs || callId !== null || stepCount >= 0 || explicitTs <= prev.ts)) ||
          downgradedMissingCall
        )
      );

      if (isSameSnapshot) {
        return prev;
      }

      const nextTs = explicitTs > 0 ? explicitTs : nowFn();
      const next = {
        convoId,
        productKey,
        modelId: obsInput.modelId || prev?.modelId || null,
        modelLabel: obsInput.modelLabel || prev?.modelLabel || null,
        effort: obsInput.effort || prev?.effort || null,
        budget,
        serviceLimit,
        modelHardLimit,
        callId,
        stepCount,
        ts: nextTs
      };
      observationsByScope.set(sKey, next);

      if (convoId && productKey !== '__unified__') {
        recordConversationBinding(convoId, {
          productKey,
          productLabel: next.modelLabel,
          modelId: next.modelId
        });
      }
      return next;
    }

    function getScopedObservation(convoId, productKey) {
      if (!productKey) return null;
      if (convoId) {
        return observationsByScope.get(makeScopeKey(convoId, productKey)) || null;
      }
      // 无活跃会话时不臆测，可按最新 matching scope 返回但标注 convoId
      let latest = null;
      for (const obs of observationsByScope.values()) {
        if (obs.productKey === productKey && (!latest || obs.ts > latest.ts)) {
          latest = obs;
        }
      }
      return latest;
    }

    function getScopedDispatch(convoId, productKey, scopeMode = 'per_model') {
      if (convoId) {
        const direct = dispatchesByScope.get(makeScopeKey(convoId, productKey));
        if (direct) return direct;
        if (scopeMode === 'unified') {
          const unifiedRec = dispatchesByScope.get(makeScopeKey(convoId, '__unified__'));
          if (unifiedRec) return unifiedRec;
        }
        return null;
      }
      if (productKey && dispatchesByProduct.has(productKey)) {
        return dispatchesByProduct.get(productKey);
      }
      return null;
    }

    function isPostDispatchObservation(dispatch, obs) {
      if (!dispatch || !obs) return false;
      if (dispatch.convoId && obs.convoId && dispatch.convoId !== obs.convoId) return false;
      if (obs.ts < dispatch.timestamp) return false;
      const changedCall = Boolean(obs.callId && obs.callId !== dispatch.baselineCallId);
      const advancedStep = obs.stepCount >= 0 && obs.stepCount > dispatch.baselineStepCount;
      if (changedCall || advancedStep) return true;
      // 若 callId 与发送前基线完全相同且步骤未增长，说明仍是旧快照（即便 scannedAt/ts 更新也绝非新响应）
      if (obs.callId && dispatch.baselineCallId && obs.callId === dispatch.baselineCallId) {
        return false;
      }
      // 若双方均有明确步数基线且未前进，同样禁止仅靠轮询时间戳伪确认
      if (dispatch.baselineStepCount >= 0 && obs.stepCount >= 0 && obs.stepCount <= dispatch.baselineStepCount) {
        return false;
      }
      return obs.ts > dispatch.baselineObsTs;
    }

    function evaluateStatus(params = {}) {
      const product = params.product || null;
      const scopeMode = params.scopeMode === 'per_model' ? 'per_model' : 'unified';
      const activePref = params.pref || { mode: 'default', limitTokens: null };
      const activeConvId = params.activeConvId || null;
      const now = Number(params.now || nowFn());

      if (!product) {
        return {
          status: 'unconfirmed',
          convoId: activeConvId || '—',
          targetMode: activePref?.mode || 'default',
          targetLimit: activePref?.mode === 'fixed' ? Number(activePref?.limitTokens) : null,
          dispatched: null,
          observation: null,
          diagnosisCode: 'missing_product'
        };
      }

      const targetMode = activePref?.mode || 'default';
      const targetLimit = targetMode === 'fixed' && Number.isSafeInteger(Number(activePref?.limitTokens))
        ? Number(activePref.limitTokens)
        : null;

      const rawDispatched = getScopedDispatch(activeConvId, product.productKey, scopeMode);
      const obs = getScopedObservation(activeConvId || rawDispatched?.convoId || null, product.productKey);
      const obsBudget = Number(obs?.budget || 0);
      const serviceLimit = Number(obs?.serviceLimit || 0);
      const modelHardLimit = Number(params.modelHardLimit || obs?.modelHardLimit || 0);

      // 先校验最近发送记录是否匹配“当前保存的新目标”（含从固定改默认、从失败目标改新值），不匹配则不误报旧结果
      const matchesCurrentTarget = Boolean(
        rawDispatched &&
        rawDispatched.targetMode === targetMode &&
        (targetMode !== 'fixed' || rawDispatched.targetLimitTokens === targetLimit)
      );
      const dispatched = matchesCurrentTarget ? rawDispatched : null;
      const effectiveConvoId = dispatched?.convoId || obs?.convoId || activeConvId || '—';

      if (!dispatched) {
        if (targetMode === 'default') {
          return {
            status: 'default',
            convoId: effectiveConvoId,
            targetMode,
            targetLimit: null,
            dispatched: null,
            observation: obs,
            diagnosisCode: 'default_pending_dispatch'
          };
        }
        return {
          status: 'saved_pending_dispatch',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          dispatched: null,
          observation: obs,
          diagnosisCode: 'awaiting_next_send'
        };
      }

      if (dispatched.status === 'send_failed') {
        return {
          status: 'send_failed',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          dispatched,
          observation: obs,
          diagnosisCode: 'dispatch_failed',
          errorMessage: dispatched.errorMessage || '请求发送失败'
        };
      }
      if (dispatched.status === 'aborted') {
        return {
          status: 'aborted',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          dispatched,
          observation: obs,
          diagnosisCode: 'dispatch_aborted'
        };
      }
      if (dispatched.status === 'uninjectable') {
        return {
          status: 'uninjectable',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          dispatched,
          observation: obs,
          diagnosisCode: dispatched.reason || 'uninjectable'
        };
      }

      const hasPostObs = isPostDispatchObservation(dispatched, obs);
      if (!hasPostObs || obsBudget <= 0) {
        if (now - dispatched.timestamp > confirmTimeoutMs) {
          return {
            status: 'timeout_unconfirmed',
            convoId: effectiveConvoId,
            targetMode,
            targetLimit,
            dispatched,
            observation: obs,
            diagnosisCode: 'confirm_timeout'
          };
        }
        return {
          status: 'dispatched_pending_confirm',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          dispatched,
          observation: obs,
          diagnosisCode: 'awaiting_backend_obs'
        };
      }

      if (targetMode === 'default') {
        return {
          status: 'default',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit: null,
          dispatched,
          observation: obs,
          diagnosisCode: 'default_confirmed'
        };
      }

      if (targetMode === 'dynamic') {
        return {
          status: 'confirmed',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit: null,
          dispatched,
          observation: obs,
          diagnosisCode: 'dynamic_observed'
        };
      }

      // 精确整数比对，不随便放宽到 ±5% 或 ±64 掩盖差值
      if (obsBudget === targetLimit) {
        return {
          status: 'confirmed',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          dispatched,
          observation: obs,
          diagnosisCode: 'exact_match'
        };
      }

      // 仅当存在明确的服务端或 ModelInfo 硬上限证据且目标超出该上限时，才判定为受模型上限限制
      const knownCap = (serviceLimit > 0 ? serviceLimit : 0) || (modelHardLimit > 0 ? modelHardLimit : 0);
      if (knownCap > 0 && targetLimit > knownCap && obsBudget <= knownCap) {
        return {
          status: 'clamped_by_model_limit',
          convoId: effectiveConvoId,
          targetMode,
          targetLimit,
          knownCap,
          dispatched,
          observation: obs,
          diagnosisCode: 'server_or_model_cap'
        };
      }

      return {
        status: 'mismatch',
        convoId: effectiveConvoId,
        targetMode,
        targetLimit,
        dispatched,
        observation: obs,
        diagnosisCode: 'budget_mismatch_unknown_reason'
      };
    }

    function clearConversation(convoId) {
      if (!convoId) return;
      for (const k of Array.from(dispatchesByScope.keys())) {
        if (k.startsWith(`${convoId}::`)) dispatchesByScope.delete(k);
      }
      for (const k of Array.from(observationsByScope.keys())) {
        if (k.startsWith(`${convoId}::`)) observationsByScope.delete(k);
      }
      delete verifiedConversationBindings[convoId];
    }

    function exportAllObservationsByProduct() {
      const out = {};
      for (const obs of observationsByScope.values()) {
        if (!obs.productKey) continue;
        const prev = out[obs.productKey];
        if (!prev || obs.ts > prev.ts) out[obs.productKey] = obs;
      }
      return out;
    }

    function exportDiagnosticTraces() {
      return Array.from(dispatchesById.values()).map(rec => {
        const obs = getScopedObservation(rec.convoId, rec.productKey);
        const postMatched = obs && isPostDispatchObservation(rec, obs);
        return {
          dispatchSeq: rec.seq,
          dispatchId: rec.dispatchId,
          convoId: rec.convoId || null,
          productKey: rec.productKey || null,
          modelId: rec.modelId || null,
          scopeMode: rec.scopeMode,
          prefSnapshot: rec.prefSnapshot || null,
          sentMode: rec.sentMode,
          sentLimitTokens: rec.sentLimitTokens,
          transport: rec.transport || rec.channel || null,
          status: rec.status,
          observedBudget: postMatched ? (obs.budget || null) : null,
          observedAt: postMatched ? (obs.ts || null) : null,
          timestamp: rec.timestamp
        };
      });
    }

    return {
      beginDispatch,
      updateDispatchStatus,
      recordObservation,
      recordConversationBinding,
      getScopedDispatch,
      getScopedObservation,
      evaluateStatus,
      clearConversation,
      exportAllObservationsByProduct,
      exportDiagnosticTraces,
      verifiedConversationBindings
    };
  }

  const api = {
    DEFAULT_MIN_TOKENS,
    DEFAULT_MAX_TOKENS,
    STOCK_DEFAULT_CLAMP_TOKENS,
    DEFAULT_CONFIRM_TIMEOUT_MS,
    STATIC_MODEL_ENUM_MAP,
    stripModelEnumPrefix,
    modelEnumNumberToName,
    isTargetBudgetRpc,
    readVarint,
    writeVarint,
    encodeVarintField,
    encodeLengthDelimitedField,
    parseProtoFields,
    extractProtoSendMessageMetadata,
    rewriteProtoSendMessageCheckpointLimit,
    unpackTransportPayload,
    packTransportPayload,
    resolveRuntimeUnlockPolicy,
    deriveModelCapabilitySummary,
    evaluateLimitInput,
    projectUnifiedBudgetForProducts,
    resolveRequestModel,
    findPreferenceForProduct,
    resolveBudgetPolicy,
    applyBudgetPolicyToObject,
    transformOutgoingSendRequest,
    createContextBudgetTracker
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.__AGContextBudgetEngine = api;
  }
})(globalThis);

// Antigravity Pulse — Retina Canvas Waveform, 5-Mode Activity Matrix & Speed Duel SVG Engine

function escapeSvgText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgba(colorStr, alpha) {
  const s = String(colorStr || '').trim();
  const hexMatch = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }
  return `rgba(56, 189, 248, ${alpha})`;
}

function formatCompactTokens(val) {
  const n = Number(val) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function drawStreamWaveform(canvas, hostEl, points, isStreaming = false) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = (typeof globalThis !== 'undefined' && globalThis.devicePixelRatio) ? Math.min(globalThis.devicePixelRatio, 3) : 2;
  let w = 268;
  try {
    // 优先读取 clientWidth 避免高频流式刷新触发强制同步布局，缺失时再回退 getBoundingClientRect
    if (Number.isFinite(canvas.clientWidth) && canvas.clientWidth >= 120) {
      w = Math.round(canvas.clientWidth);
    } else if (typeof canvas.getBoundingClientRect === 'function') {
      const rect = canvas.getBoundingClientRect();
      if (rect && Number.isFinite(rect.width) && rect.width >= 120) {
        w = Math.round(rect.width);
      }
    }
  } catch {}
  const h = 70;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  const cleanPts = Array.isArray(points)
    ? points.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
    : [];

  let accent = '#38bdf8';
  try {
    const cs = getComputedStyle(hostEl || canvas);
    accent = cs.getPropertyValue('--accent-2').trim() || '#38bdf8';
  } catch {}

  ctx.save();
  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else {
    ctx.scale(dpr, dpr);
  }
  ctx.clearRect(0, 0, w, h);

  if (cleanPts.length === 0) {
    const baseY = isStreaming ? h - 22 : h - 14;
    ctx.beginPath();
    ctx.setLineDash?.(isStreaming ? [5, 4] : [3, 5]);
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.strokeStyle = isStreaming ? 'rgba(16, 185, 129, 0.55)' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash?.([]);
    ctx.beginPath();
    ctx.arc(w - 5, baseY, isStreaming ? 3.8 : 2.8, 0, Math.PI * 2);
    ctx.fillStyle = isStreaming ? '#10b981' : 'rgba(148, 163, 184, 0.45)';
    ctx.fill();
    ctx.restore();
    return;
  }

  const rawPts = cleanPts.length === 1 ? [cleanPts[0], cleanPts[0]] : cleanPts;
  const maxVal = Math.max(40, ...rawPts.map(v => v * 1.15));
  const minVal = 0;
  const span = Math.max(1, maxVal - minVal);

  const stepX = w / (rawPts.length - 1);
  const coords = rawPts.map((v, idx) => {
    const norm = Math.max(0.10, Math.min(0.92, (v - minVal) / span));
    return [idx * stepX, h - norm * (h - 16) - 6];
  });

  ctx.beginPath();
  ctx.moveTo(coords[0][0], coords[0][1]);
  for (let i = 1; i < coords.length; i++) {
    const xc = (coords[i - 1][0] + coords[i][0]) / 2;
    const yc = (coords[i - 1][1] + coords[i][1]) / 2;
    ctx.quadraticCurveTo(coords[i - 1][0], coords[i - 1][1], xc, yc);
  }
  const last = coords[coords.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.strokeStyle = isStreaming ? '#10b981' : accent;
  ctx.lineWidth = 2.1;
  ctx.stroke();

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isStreaming ? 'rgba(16, 185, 129, 0.28)' : hexToRgba(accent, 0.22));
  grad.addColorStop(1, isStreaming ? 'rgba(16, 185, 129, 0.0)' : hexToRgba(accent, 0));
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(Math.max(4, last[0] - 2), last[1], isStreaming ? 4 : 3.2, 0, Math.PI * 2);
  ctx.fillStyle = isStreaming ? '#10b981' : accent;
  ctx.fill();
  ctx.restore();
}

function renderDailyHeatmapGrid(containerEl, dailySeries, onHoverDay) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  const list = Array.isArray(dailySeries) ? dailySeries : [];
  const totalCols = Math.max(24, Math.ceil(list.length / 7));
  containerEl.style.setProperty('--hm-cols', String(totalCols));

  const maxTok = list.reduce((m, d) => Math.max(m, Number(d?.total || 0)), 0);

  for (let w = 0; w < totalCols; w++) {
    const col = document.createElement('div');
    col.className = 'hm-col';
    for (let r = 0; r < 7; r++) {
      const idx = w * 7 + r;
      const item = list[idx] || null;
      const dot = document.createElement('div');
      dot.className = 'hm-dot';
      const tot = Number(item?.total || 0);
      let lv = 0;
      if (tot > 0 && maxTok > 0) {
        const ratio = tot / maxTok;
        lv = ratio >= 0.72 ? 4 : ratio >= 0.42 ? 3 : ratio >= 0.16 ? 2 : 1;
      }
      dot.dataset.v = String(lv);
      if (item && typeof onHoverDay === 'function') {
        dot.addEventListener('mouseenter', () => onHoverDay(item));
      }
      col.appendChild(dot);
    }
    containerEl.appendChild(col);
  }
}

function renderAlternateHistorySvg(svgEl, mode, buckets, onHoverBucket, lang = 'zh-CN') {
  if (!svgEl) return;
  const rows = Array.isArray(buckets) ? buckets : [];
  if (!rows.length) {
    const emptyMsg = typeof translatePulseKey === 'function'
      ? translatePulseKey(lang, 'chartEmptyHistory')
      : '暂无该周期历史消费记录';
    svgEl.innerHTML = `<text x="300" y="58" text-anchor="middle" fill="var(--fg-3)" font-size="11">${escapeSvgText(emptyMsg)}</text>`;
    return;
  }

  if (mode === 'cum') {
    let running = 0;
    const cumRows = rows.map(r => {
      running += Number(r.total || 0);
      return { ...r, cumTotal: running };
    });
    const maxCum = Math.max(1, running);
    const padX = 16;
    const w = 568;
    const isSingle = cumRows.length === 1;
    const stepX = !isSingle ? w / (cumRows.length - 1) : 0;
    const coords = cumRows.map((r, idx) => {
      const x = isSingle ? (padX + w / 2) : (padX + idx * stepX);
      const y = 96 - (r.cumTotal / maxCum) * 78;
      return { x, y, r };
    });
    const pts = isSingle
      ? [`${padX},${coords[0].y.toFixed(1)}`, `${(padX + w).toFixed(1)},${coords[0].y.toFixed(1)}`]
      : coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`);
    const firstX = padX;
    const lastX = (padX + w).toFixed(1);
    const hitW = Math.max(8, w / Math.max(1, cumRows.length));
    const hitZones = coords.map((c, i) => {
      const hx = Math.max(0, c.x - hitW / 2).toFixed(1);
      return `<rect data-cidx="${i}" x="${hx}" y="8" width="${hitW.toFixed(1)}" height="96" fill="transparent" style="cursor:pointer"></rect>`;
    }).join('');
    const singleDot = isSingle
      ? `<circle cx="${coords[0].x.toFixed(1)}" cy="${coords[0].y.toFixed(1)}" r="4" fill="var(--accent)"></circle>`
      : '';
    svgEl.innerHTML =
      `<polygon points="${firstX},102 ${pts.join(' ')} ${lastX},102" fill="var(--accent-glow)"></polygon>` +
      `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>` +
      singleDot +
      hitZones;
    if (typeof onHoverBucket === 'function') {
      svgEl.querySelectorAll('rect[data-cidx]').forEach(rect => {
        rect.addEventListener('mouseenter', () => {
          const item = cumRows[Number(rect.getAttribute('data-cidx'))];
          if (item) onHoverBucket({ ...item, total: item.cumTotal });
        });
      });
    }
    return;
  }

  const maxVal = Math.max(1, ...rows.map(r => Number(r.total || 0)));
  const count = rows.length;
  const slotW = 568 / Math.max(1, count);
  const barW = Math.max(6, Math.min(28, slotW * 0.62));

  svgEl.innerHTML = rows.map((r, i) => {
    const val = Number(r.total || 0);
    const bh = val > 0 ? Math.max(5, (val / maxVal) * 80) : 2;
    const x = (16 + i * slotW + (slotW - barW) / 2).toFixed(1);
    const y = (96 - bh).toFixed(1);
    const fill = val > 0 ? 'var(--h3)' : 'var(--h0)';
    return `<rect data-bidx="${i}" x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3.5" fill="${fill}" style="cursor:pointer"></rect>` +
      (count <= 14 ? `<text x="${(Number(x) + barW / 2).toFixed(1)}" y="106" text-anchor="middle" fill="var(--fg-3)" font-size="8.5" font-family="var(--font-mono)">${escapeSvgText(r.shortLabel || '')}</text>` : '');
  }).join('');

  if (typeof onHoverBucket === 'function') {
    svgEl.querySelectorAll('rect[data-bidx]').forEach(rect => {
      rect.addEventListener('mouseenter', () => {
        const item = rows[Number(rect.getAttribute('data-bidx'))];
        if (item) onHoverBucket(item);
      });
    });
  }
}

function renderSpeedDuelView(barsContainer, trendSvg, trendTitleEl, trendMedianEl, speedGroups, metric = 'tps', focusModelKey = '', onSelectGroup = null, lang = 'zh-CN') {
  if (!barsContainer || !trendSvg) return;
  const list = Array.isArray(speedGroups) ? speedGroups : [];
  const tr = (k, vars) => (typeof translatePulseKey === 'function' ? translatePulseKey(lang, k, vars) : k);

  if (!list.length) {
    barsContainer.innerHTML = `<div style="font-size:11.5px;color:var(--fg-3);padding:16px 0;text-align:center">${escapeSvgText(tr('duelEmptyBars'))}</div>`;
    trendSvg.innerHTML = `<text x="290" y="50" text-anchor="middle" fill="var(--fg-3)" font-size="11">${escapeSvgText(tr('duelEmptyTrend'))}</text>`;
    if (trendMedianEl) trendMedianEl.textContent = 'n = 0';
    return;
  }

  const getMetricValue = (item) => {
    if (metric === 'tps') return Number(item.medianTps ?? 0);
    if (metric === 'ttft') return Number(item.medianTtft ?? 0);
    return Number(item.medianDuration ?? item.medianDur ?? 0);
  };

  const sorted = [...list].filter(item => getMetricValue(item) > 0 || metric === 'tps').sort((a, b) => {
    if (metric === 'tps') return getMetricValue(b) - getMetricValue(a);
    const va = getMetricValue(a) || 9999;
    const vb = getMetricValue(b) || 9999;
    return va - vb;
  }).slice(0, 8);

  if (!sorted.length) {
    barsContainer.innerHTML = `<div style="font-size:11.5px;color:var(--fg-3);padding:16px 0;text-align:center">${escapeSvgText(tr('duelEmptyBars'))}</div>`;
    trendSvg.innerHTML = `<text x="290" y="50" text-anchor="middle" fill="var(--fg-3)" font-size="11">${escapeSvgText(tr('duelEmptyTrend'))}</text>`;
    if (trendTitleEl) trendTitleEl.textContent = '--';
    if (trendMedianEl) trendMedianEl.textContent = 'n = 0';
    return;
  }

  const maxMetric = Math.max(0.1, ...sorted.map(item => getMetricValue(item)));

  barsContainer.innerHTML = sorted.map(item => {
    const key = item.modelExactId || item.key || item.modelLabel;
    const label = item.modelLabel || item.label || key;
    const safeCount = Math.max(0, Math.trunc(Number(item.count) || 0));
    const rawVal = getMetricValue(item);
    const pct = Math.max(6, Math.min(100, (rawVal / maxMetric) * 100));
    const formatted = metric === 'tps'
      ? `${rawVal.toFixed(1)} tok/s`
      : (rawVal > 0 ? `${rawVal.toFixed(2)}s` : '--');
    const isSel = focusModelKey && (key === focusModelKey || label === focusModelKey);
    return `
      <div data-duel-model="${escapeSvgText(key)}" style="cursor:pointer;padding:3px 5px;border-radius:7px;${isSel ? 'background:var(--pill-bg)' : ''}">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
          <span style="font-weight:600">${escapeSvgText(label)} <small style="color:var(--fg-3);font-weight:400">(n=${safeCount})</small></span>
          <span class="mono" style="color:var(--accent-2)">${formatted}</span>
        </div>
        <div class="thin-bar"><i style="width:${pct.toFixed(1)}%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></i></div>
      </div>`;
  }).join('');

  if (typeof onSelectGroup === 'function') {
    barsContainer.querySelectorAll('[data-duel-model]').forEach(row => {
      row.addEventListener('click', () => onSelectGroup(row.getAttribute('data-duel-model')));
    });
  }

  const focusItem = sorted.find(x => {
    const k = x.modelExactId || x.key || '';
    const l = x.modelLabel || x.label || '';
    return focusModelKey && (k === focusModelKey || l === focusModelKey || l.toLowerCase() === String(focusModelKey).toLowerCase());
  }) || sorted[0];

  const focusLabel = focusItem.modelLabel || focusItem.label || '';
  const samples = Array.isArray(focusItem?.samples) ? focusItem.samples.slice(-16) : [];
  const safeFocusCount = Math.max(0, Math.trunc(Number(focusItem.count) || samples.length));
  if (trendTitleEl) {
    trendTitleEl.textContent = tr('duelTrendCurveTitle', { model: focusLabel, count: samples.length });
  }
  if (trendMedianEl) {
    trendMedianEl.textContent = tr('duelTrendMedianFmt', {
      tps: Number(focusItem.medianTps || 0).toFixed(1),
      ttft: focusItem.medianTtft != null ? `${focusItem.medianTtft}s` : '--',
      count: safeFocusCount
    });
  }

  const sampleMetric = (s) => {
    if (metric === 'tps') return Number(s.tps || 0);
    if (metric === 'ttft') return Number(s.ttftSec ?? s.ttft ?? 0);
    return Number(s.durationSec ?? s.dur ?? 0);
  };

  // 过滤缺失该指标的样本（例如无 TTFT 计时字段的轮次），避免在折线图上画成 0.00s 假尖峰
  const validVals = samples.map(sampleMetric).filter(v => Number.isFinite(v) && v > 0);
  if (validVals.length < 2) {
    const singleVal = validVals.length === 1
      ? (metric === 'tps' ? `${validVals[0].toFixed(1)} tok/s` : `${validVals[0].toFixed(2)}s`)
      : '--';
    trendSvg.innerHTML = `<circle cx="290" cy="44" r="4" fill="var(--accent-2)"></circle><text x="290" y="70" text-anchor="middle" fill="var(--fg-2)" font-size="11" font-family="var(--font-mono)">${escapeSvgText(singleVal)}</text>`;
    return;
  }

  const vals = validVals;
  const minV = Math.min(...vals);
  const maxV = Math.max(minV + 0.1, ...vals);
  const stepX = 540 / (vals.length - 1);
  const pts = vals.map((v, idx) => {
    const x = (20 + idx * stepX).toFixed(1);
    const y = (78 - ((v - minV) / (maxV - minV)) * 60).toFixed(1);
    return `${x},${y}`;
  });

  trendSvg.innerHTML =
    `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>` +
    pts.map(p => {
      const [cx, cy] = p.split(',');
      return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="var(--accent-2)"></circle>`;
    }).join('');
}

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
    activeRequestToken: 0,
    activeRequestCtrl: null,
    requestStartedAt: 0,
    activeScanToken: 0,
    activeScanCtrl: null,
    scanStartedAt: 0,
    liveCsrfToken: '',
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
    lastInjectedDispatchId: null,
    lastInjectedFailed: false,
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
    proxyProfiles: [],
    activeProxyProfileId: null,
    proxyProfileEditorOpen: false,
    proxyDiag: { configValid: null, proxyReachable: null, internetReachable: null, modelCallVerified: null },
    auditRightTab: 'timeline',
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

  /**
   * 跨环境剪贴板写入：优先 Clipboard API，降级至隐藏 textarea + execCommand，兼容受限 Electron 渲染进程
   */
  async function copyTextToClipboard(text) {
    const str = String(text ?? '');
    if (!str) return false;
    try {
      if (globalThis.navigator?.clipboard && typeof globalThis.navigator.clipboard.writeText === 'function') {
        await globalThis.navigator.clipboard.writeText(str);
        return true;
      }
    } catch {}
    try {
      if (document && typeof document.createElement === 'function' && document.body && typeof document.execCommand === 'function') {
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);
        ta.select();
        const ok = Boolean(document.execCommand('copy'));
        ta.remove();
        return ok;
      }
    } catch {}
    return false;
  }

  // ==================== Dual-Transport Backend Bridge ====================
  // 在全局单例上固化原始传输层引用，防止多次热重载叠加包装链
  if (!globalThis.__agOrigFetch && typeof globalThis.fetch === 'function') {
    globalThis.__agOrigFetch = globalThis.fetch.bind(globalThis);
  }
  const origFetch = globalThis.__agOrigFetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);

  // ==================== Live CSRF Sniffing & Self-Healing ====================
  let csrfRefreshPromise = null;

  function captureCsrfToken(raw) {
    const val = typeof raw === 'string' ? raw.trim() : '';
    if (!val || val.length > 512) return;
    state.liveCsrfToken = val;
    try {
      if (globalThis.__APP_CONFIG__ && typeof globalThis.__APP_CONFIG__ === 'object') {
        globalThis.__APP_CONFIG__.csrfToken = val;
      }
    } catch {}
  }

  function getActiveCsrfToken() {
    return String(state.liveCsrfToken || globalThis.__APP_CONFIG__?.csrfToken || '').trim();
  }

  function extractHeaderCI(hdrs, targetLower) {
    if (!hdrs) return '';
    if (typeof hdrs.get === 'function') return String(hdrs.get(targetLower) || '');
    if (Array.isArray(hdrs)) {
      for (const pair of hdrs) {
        if (Array.isArray(pair) && String(pair[0] || '').toLowerCase() === targetLower) {
          return String(pair[1] || '');
        }
      }
      return '';
    }
    for (const [k, v] of Object.entries(hdrs)) {
      if (String(k).toLowerCase() === targetLower) return String(v || '');
    }
    return '';
  }

  function extractCsrfFromHtmlSafe(html) {
    const src = String(html || '');
    const anchor = src.match(/window\.__APP_CONFIG__\s*=\s*/);
    if (anchor && typeof anchor.index === 'number') {
      const startIdx = src.indexOf('{', anchor.index + anchor[0].length);
      if (startIdx >= 0) {
        let depth = 0;
        let inStr = false;
        let escaped = false;
        for (let i = startIdx; i < src.length; i++) {
          const ch = src[i];
          if (inStr) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inStr = false;
            continue;
          }
          if (ch === '"') { inStr = true; continue; }
          if (ch === '{') depth += 1;
          else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
              try {
                const parsed = JSON.parse(src.slice(startIdx, i + 1));
                if (parsed?.csrfToken) return String(parsed.csrfToken).trim();
              } catch {}
              break;
            }
          }
        }
      }
    }
    const m = src.match(/window\.__APP_CONFIG__\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed?.csrfToken) return String(parsed.csrfToken).trim();
      } catch {}
    }
    return '';
  }

  /**
   * 当语言服务重启、休眠唤醒或令牌轮换导致 401/403 时，同源重拉首页提取最新 CSRF 令牌（单飞去重）
   */
  async function refreshCsrfTokenFromHost(signal = null) {
    if (!origFetch || state.disposed) return '';
    if (csrfRefreshPromise) return csrfRefreshPromise;
    csrfRefreshPromise = (async () => {
      try {
        const r = await origFetch('/', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          ...(signal ? { signal } : {})
        });
        if (!r || !r.ok) return '';
        const html = typeof r.text === 'function' ? await r.text() : '';
        const fresh = extractCsrfFromHtmlSafe(html);
        if (fresh) {
          captureCsrfToken(fresh);
          return fresh;
        }
      } catch {}
      return '';
    })().finally(() => {
      csrfRefreshPromise = null;
    });
    return csrfRefreshPromise;
  }

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
        // 按实际弹窗宽度（692px 或视口留白）反算右偏移上限，防止窄窗口下浮层溢出左边界
        const hudW = Math.min(692, vw - 20);
        const maxRightPx = Math.max(10, vw - hudW - 10);
        const rightPx = Math.max(10, Math.min(maxRightPx, Math.round(vw - rect.right)));
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
    if (typeof budgetEngine.resolveRuntimeUnlockPolicy === 'function') {
      const policy = budgetEngine.resolveRuntimeUnlockPolicy(u);
      return Boolean(policy && policy.mode === 'dynamic' && policy.pendingRestart !== true);
    }
    if (u.status === 'not_patched' || u.status === 'patched_pending_restart' || u.status === 'partial_match' || u.status === 'failed') return false;
    return Boolean(u.configuredMode === 'dynamic' || u.unlocked === true || u.status === 'unlocked');
  }

  function isBinaryUnlocked() {
    const u = state.unlockStatus;
    if (!u || !isBinaryUnlockSupportedOnHost()) return false;
    if (u.status === 'not_patched' || u.status === 'partial_match' || u.status === 'failed') return false;
    if (typeof budgetEngine.resolveRuntimeUnlockPolicy === 'function') {
      const policy = budgetEngine.resolveRuntimeUnlockPolicy(u);
      if (policy && policy.pendingRestart !== true) {
        if (policy.mode === 'dynamic') return true;
        if (policy.mode === 'fixed' && Number(policy.limitTokens) > 256000) return true;
      }
    }
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
    state.lastInjectedDispatchId = dispatchId;
    state.lastInjectedFailed = false;
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
      // 仅当该帧确认为 SendUserCascadeMessage 请求（probe.handled === true）且会话一致时才消费去重标记，避免无关 WS 心跳帧误清空标记
      if (!probe || probe.handled !== true) return false;
      if (probe.cascadeId && lastDecoratorDispatch.cascadeId && probe.cascadeId !== lastDecoratorDispatch.cascadeId) {
        return false;
      }
      lastDecoratorDispatch = null;
      return true;
    } catch {
      return false;
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

  function extractContentTypeHeader(hdrs) {
    if (!hdrs) return '';
    if (typeof hdrs.get === 'function') return hdrs.get('content-type') || '';
    if (Array.isArray(hdrs)) {
      for (const pair of hdrs) {
        if (Array.isArray(pair) && String(pair[0] || '').toLowerCase() === 'content-type') {
          return String(pair[1] || '');
        }
      }
      return '';
    }
    return hdrs['content-type'] || hdrs['Content-Type'] || '';
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
          if (state.lastInjectedDispatchId === failedId) {
            state.lastInjectedFailed = true;
          }
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
          // 被动嗅探宿主自身发出的最新 CSRF 令牌，无需额外请求即可与宿主保持同步
          try {
            const sniffed = extractHeaderCI(init?.headers, 'x-codeium-csrf-token') ||
              (input && typeof input === 'object' ? extractHeaderCI(input.headers, 'x-codeium-csrf-token') : '');
            if (sniffed) captureCsrfToken(sniffed);
          } catch {}
          const urlStr = typeof input === 'string'
            ? input
            : (typeof URL !== 'undefined' && input instanceof URL ? input.href : (input?.url || ''));
          const isSendRpc = (typeof budgetEngine.isTargetBudgetRpc === 'function' && budgetEngine.isTargetBudgetRpc(urlStr)) ||
            urlStr.includes('SendUserCascadeMessage');
          if (isSendRpc) {
            if (init && init.body) {
              const ct = extractContentTypeHeader(init.headers);
              init = { ...init, body: tryRewriteSendBody(init.body, 'fetch', urlStr, ct) };
            } else if (input && typeof input === 'object' && typeof input.clone === 'function' && typeof input.arrayBuffer === 'function') {
              try {
                const ct = extractContentTypeHeader(input.headers);
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
          // 快速预筛：跳过无关文本帧（心跳/LSP）与过短二进制帧，避免高频 WS 通信触发 DOM 查询与重解析
          let shouldInspect = false;
          if (typeof data === 'string') {
            shouldInspect = data.includes('SendUserCascadeMessage') ||
              data.includes('cascadeConfig') ||
              data.includes('checkpointConfig') ||
              data.includes('cascadeId');
          } else if (data instanceof ArrayBuffer) {
            shouldInspect = data.byteLength >= 16;
          } else if (ArrayBuffer.isView(data)) {
            shouldInspect = data.byteLength >= 16;
          }
          const next = shouldInspect ? tryRewriteSendBody(data, 'ws_frame', this?.url || '') : data;
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
            const lowerName = String(name || '').toLowerCase();
            if (lowerName === 'content-type') {
              this.__pulseCt = String(value || '');
            } else if (lowerName === 'x-codeium-csrf-token' && value) {
              captureCsrfToken(String(value));
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
    const myToken = ++state.activeRequestToken;
    const ctrl = new AbortController();
    state.requestBusy = true;
    state.requestStartedAt = Date.now();
    state.activeRequestCtrl = ctrl;
    controllers.add(ctrl);
    const tid = setTimeout(() => ctrl.abort(), 12000);
    try {
      let csrf = getActiveCsrfToken();
      if (!csrf) {
        csrf = await refreshCsrfTokenFromHost(ctrl.signal);
      }
      if (!csrf || gen !== state.generation || state.disposed) return;

      // On initial load of a conversation, fetch full metadata (offset 0) so we get ALL session calls & speed telemetry!
      let offset = state.sessionCallsMap.size === 0 ? 0 : Math.max(0, state.count - 6);
      const fetchWithOffset = async (off, allowRetryAuth = true) => {
        const r = await origFetch('/exa.language_server_pb.LanguageServerService/GetCascadeTrajectoryGeneratorMetadata', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'x-codeium-csrf-token': csrf
          },
          body: JSON.stringify({ cascadeId: id, generatorMetadataOffset: off, includeMessages: false }),
          signal: ctrl.signal
        });
        if ((r.status === 401 || r.status === 403) && allowRetryAuth && !ctrl.signal.aborted) {
          const fresh = await refreshCsrfTokenFromHost(ctrl.signal);
          if (fresh) {
            csrf = fresh;
            return fetchWithOffset(off, false);
          }
        }
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
      // 增量拉取尾部轨迹时沿用上一轮有效上下文，防止尾部刚好是报错/重试帧时丢失已有 actual/budget
      let prevCtx = offset > 0 ? state.latest : null;

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
      if (state.activeRequestCtrl === ctrl) state.activeRequestCtrl = null;
      // 仅按当前请求令牌释放锁，彻底杜绝切换会话后旧请求漏释或误释新请求锁
      if (state.activeRequestToken === myToken) {
        state.requestBusy = false;
        state.requestStartedAt = 0;
      }
      if (gen === state.generation && !state.disposed) {
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
    const myToken = ++state.activeScanToken;
    const scanCtrl = new AbortController();
    state.scanBusy = true;
    state.scanStartedAt = Date.now();
    state.activeScanCtrl = scanCtrl;
    controllers.add(scanCtrl);
    let scanTid = null;
    try {
      const scanPromise = callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.scan === 'function'
          ? () => globalThis.contextMeterAPI.scan(id, force)
          : null,
        liveRoute: '/scan',
        body: { id, force },
        signal: scanCtrl.signal
      });
      // 为 IPC/Live 归档扫描施加 35s 兜底超时，防止休眠唤醒导致挂起后 scanBusy 永久卡死
      const timeoutPromise = new Promise((_, reject) => {
        scanTid = setTimeout(() => {
          try { scanCtrl.abort(); } catch {}
          reject(new Error('归档扫描超时'));
        }, 35000);
      });
      const res = await Promise.race([scanPromise, timeoutPromise]);
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
      if (gen === state.generation && !state.disposed) {
        state.scanError = e?.message || '';
      }
    } finally {
      clearTimeout(scanTid);
      controllers.delete(scanCtrl);
      if (state.activeScanCtrl === scanCtrl) state.activeScanCtrl = null;
      if (state.activeScanToken === myToken) {
        state.scanBusy = false;
        state.scanStartedAt = 0;
      }
      if (gen === state.generation && !state.disposed) {
        state.scanNext = Date.now() + (document.hidden ? 60000 : 22000);
        renderCockpit();
        renderAuditSheet();
        renderBudgetSpace();
      }
    }
  }

  async function fetchAvailableModels() {
    if (!origFetch) return;
    let csrf = getActiveCsrfToken();
    if (!csrf) csrf = await refreshCsrfTokenFromHost();
    if (!csrf) return;
    try {
      const doReq = async (allowRetry = true) => {
        const res = await origFetch('/exa.language_server_pb.LanguageServerService/GetAvailableModels', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'x-codeium-csrf-token': csrf
          },
          body: JSON.stringify({ forceRefresh: false })
        });
        if ((res.status === 401 || res.status === 403) && allowRetry) {
          const fresh = await refreshCsrfTokenFromHost();
          if (fresh) {
            csrf = fresh;
            return doReq(false);
          }
        }
        return res;
      };
      const res = await doReq(true);
      if (!res || !res.ok) return;
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
    if (!origFetch || state.disposed) return null;
    const qCtrl = new AbortController();
    controllers.add(qCtrl);
    const qTid = setTimeout(() => qCtrl.abort(), 12000);
    try {
      let csrf = getActiveCsrfToken();
      if (!csrf) csrf = await refreshCsrfTokenFromHost(qCtrl.signal);
      if (!csrf) return null;
      const callRpc = async (method, allowRetry = true) => {
        const r = await origFetch(`/exa.language_server_pb.LanguageServerService/${method}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'x-codeium-csrf-token': csrf
          },
          body: '{}',
          signal: qCtrl.signal
        });
        if (r && (r.status === 401 || r.status === 403) && allowRetry && !qCtrl.signal.aborted) {
          const fresh = await refreshCsrfTokenFromHost(qCtrl.signal);
          if (fresh) {
            csrf = fresh;
            return callRpc(method, false);
          }
        }
        if (!r || !r.ok) return null;
        return await r.json();
      };
      const [uSet, qSet] = await Promise.allSettled([
        callRpc('GetUserStatus', true),
        callRpc('RetrieveUserQuotaSummary', true)
      ]);
      const userStatusRes = uSet.status === 'fulfilled' ? uSet.value : null;
      const quotaSummaryRes = qSet.status === 'fulfilled' ? qSet.value : null;
      const hasGroups = Array.isArray(quotaSummaryRes?.response?.groups || quotaSummaryRes?.groups) &&
        (quotaSummaryRes?.response?.groups || quotaSummaryRes?.groups).length > 0;
      const hasConfigs = Array.isArray(userStatusRes?.userStatus?.cascadeModelConfigData?.clientModelConfigs);
      if (!hasGroups && !hasConfigs) return null;
      return { userStatusRes, quotaSummaryRes, hasGroups };
    } catch {
      return null;
    } finally {
      clearTimeout(qTid);
      controllers.delete(qCtrl);
    }
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

    // 当后端额度拉取鉴权/网络失败、缺少多窗口（5h+周）分桶或旧缓存桶已过重置时间时，启用带实时浏览器 Cookie 的同源 RPC 自愈兜底
    try {
      const nowMs = Date.now();
      const curView = computeEffectiveQuotaView(nowMs);
      const hasMultiWindowSummary = Array.isArray(curView?.pools) && curView.pools.some(p =>
        p.sourceType === 'quota_summary_and_configs' ||
        (Array.isArray(p.buckets) && (p.buckets.length > 1 || p.buckets.some(b => b.windowKey === 'weekly' || /week|7d/i.test(String(b.windowShort || b.bucketId || '')))))
      );
      const hasExpiredResetBucket = Array.isArray(curView?.pools) && curView.pools.some(p =>
        Array.isArray(p.buckets) && p.buckets.some(b => Number.isFinite(Number(b?.resetAtMs)) && Number(b.resetAtMs) <= nowMs)
      );
      const needsDirectHeal = Boolean(state.quotaError) || !hasMultiWindowSummary || hasExpiredResetBucket || !curView?.pools?.length;
      if (needsDirectHeal && typeof core.buildModelQuotaSnapshot === 'function') {
        const direct = await fetchDirectQuotaRpcSupplement();
        if (direct && (direct.hasGroups || !curView?.pools?.length || Boolean(state.quotaError) || hasExpiredResetBucket)) {
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
    // 并发拉取 4 个互不依赖的后端状态接口，消除串行往返叠加延迟
    const [uSet, eSet, mSet, rSet] = await Promise.allSettled([
      callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getContextUnlockStatus === 'function'
          ? () => globalThis.contextMeterAPI.getContextUnlockStatus({})
          : null,
        liveRoute: '/context-unlock-status',
        body: {}
      }),
      callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getEnhanceStatus === 'function'
          ? () => globalThis.contextMeterAPI.getEnhanceStatus({})
          : null,
        liveRoute: '/enhance-status',
        body: {}
      }),
      callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getModulesStatus === 'function'
          ? () => globalThis.contextMeterAPI.getModulesStatus()
          : null,
        liveRoute: '/modules-status',
        body: {}
      }),
      callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.getRuntimeInfo === 'function'
          ? () => globalThis.contextMeterAPI.getRuntimeInfo()
          : null,
        liveRoute: '/runtime-info',
        body: {}
      })
    ]);

    const uRes = uSet.status === 'fulfilled' ? uSet.value : null;
    if (uRes?.ok && uRes.data) {
      state.unlockStatus = uRes.data;
      if (uRes.data.status === 'patched_pending_restart') {
        state.restartRequired = true;
      }
    }

    const eRes = eSet.status === 'fulfilled' ? eSet.value : null;
    if (eRes?.ok && eRes.data) {
      // getEnhanceStatusAsync 将摘要字段挂载在 data.summary 下，同时兼容平铺结构
      const es = (eRes.data.summary && typeof eRes.data.summary === 'object') ? eRes.data.summary : eRes.data;
      if (es.promptTier !== null && es.promptTier !== undefined && Number.isFinite(Number(es.promptTier))) {
        state.promptTier = Number(es.promptTier);
      }
      if (typeof es.chineseTitleEnabled === 'boolean') {
        state.zhChatTitle = es.chineseTitleEnabled;
      } else if (typeof es.chineseTitle === 'boolean') {
        state.zhChatTitle = es.chineseTitle;
      }
      if (es.pendingLsRestart === true) {
        state.restartRequired = true;
      }
    }

    const mRes = mSet.status === 'fulfilled' ? mSet.value : null;
    if (mRes?.ok && mRes.data?.modules) {
      const mods = mRes.data.modules;
      state.proxyEnabled = Boolean(mods.proxy?.enabled);
      if (mods.proxy?.proxyUrl) state.proxyUrl = mods.proxy.proxyUrl;
      state.proxyProfiles = Array.isArray(mods.proxy?.profiles) ? mods.proxy.profiles : [];
      state.activeProxyProfileId = typeof mods.proxy?.activeProfileId === 'string' ? mods.proxy.activeProfileId : null;
      state.shellLanguage = mods.chinese?.language || (mods.chinese?.enabled ? 'zh-CN' : 'en');
      state.brandTitle = mods.chinese?.brandTitle || 'english';
      if (mRes.runtime?.proxyNeedsRestart || mRes.runtime?.chineseNeedsRestart) {
        state.restartRequired = true;
      }
    }

    const rRes = rSet.status === 'fulfilled' ? rSet.value : null;
    if (rRes?.ok) {
      state.backendSource = rRes.backendSource || state.backendSource;
      state.backendVersion = rRes.backendVersion || state.backendVersion;
    }

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

  function formatCacheSavedText(usdVal, posPrefix = '省', negPrefix = '净增') {
    const val = Number(usdVal) || 0;
    const abs = Math.abs(val);
    const digits = abs >= 0.01 ? abs.toFixed(2) : abs.toFixed(3);
    if (val < -0.0005) return `${negPrefix} $${digits}`;
    return `${posPrefix} $${digits}`;
  }

  function computeSessionCacheStats() {
    const getCallCacheWrite = (c) => Math.max(0, Number(c?.cacheWriteTokens ?? c?.cacheCreationInputTokens ?? 0));
    const promptCalls = (state.sessionCalls || []).filter(c => {
      const inp = Math.max(0, Number(c?.inputTokens || 0));
      const cap = Math.max(0, Number(c?.cacheReadTokens ?? c?.cacheTokens ?? 0));
      const cw = getCallCacheWrite(c);
      return (inp + cap + cw) > 0;
    });

    if (promptCalls.length > 0) {
      let sessFreshInp = 0;
      let sessCacheRead = 0;
      let sessCacheWrite = 0;
      let sessSavedUSD = 0;
      for (const c of promptCalls) {
        sessFreshInp += Math.max(0, Number(c.inputTokens || 0));
        sessCacheRead += Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
        sessCacheWrite += getCallCacheWrite(c);
        sessSavedUSD += computeCallCacheSavedUSD(c);
      }
      const last = promptCalls[promptCalls.length - 1];
      const roundFreshInp = Math.max(0, Number(last.inputTokens || 0));
      const roundCacheRead = Math.max(0, Number(last.cacheReadTokens ?? last.cacheTokens ?? 0));
      const roundCacheWrite = getCallCacheWrite(last);
      const roundPromptTotal = roundFreshInp + roundCacheRead + roundCacheWrite;
      const roundHitPct = roundPromptTotal > 0 ? (roundCacheRead / roundPromptTotal) * 100 : null;
      const roundSavedUSD = computeCallCacheSavedUSD(last);
      const sessPromptTotal = sessFreshInp + sessCacheRead + sessCacheWrite;
      const sessHitPct = sessPromptTotal > 0 ? (sessCacheRead / sessPromptTotal) * 100 : null;

      let cacheDropDetected = false;
      let prevHitPct = null;
      if (promptCalls.length >= 2) {
        const prev = promptCalls[promptCalls.length - 2];
        const pInp = Math.max(0, Number(prev.inputTokens || 0));
        const pCap = Math.max(0, Number(prev.cacheReadTokens ?? prev.cacheTokens ?? 0));
        const pCw = getCallCacheWrite(prev);
        const pTot = pInp + pCap + pCw;
        if (pTot > 0) {
          prevHitPct = (pCap / pTot) * 100;
          // 发生 Antigravity 自动压缩时上下文前缀重建属于正常现象，不误报为异常缓存断流
          const isCompacted = Boolean(pTot >= 12000 && roundPromptTotal > 0 && roundPromptTotal < pTot * 0.72);
          if (!isCompacted && prevHitPct >= 45 && roundPromptTotal >= 6000 && roundHitPct !== null && roundHitPct < 10) {
            cacheDropDetected = true;
          }
        }
      }

      return {
        promptTurnCount: promptCalls.length,
        roundFreshInp: roundFreshInp + roundCacheWrite,
        roundCacheRead,
        roundCacheWrite,
        roundHitPct,
        roundSavedUSD,
        sessFreshInp: sessFreshInp + sessCacheWrite,
        sessCacheRead,
        sessCacheWrite,
        sessHitPct,
        sessSavedUSD,
        cacheDropDetected,
        prevHitPct
      };
    }

    // Fallback to state.latest (core.summarize sets latest.input = freshInput + cacheRead + cacheWrite)
    const l = state.latest;
    const latestTotalPrompt = Number(l?.input || 0);
    if (l && !l.estimated && latestTotalPrompt > 0) {
      const cap = Math.min(latestTotalPrompt, Math.max(0, Number(l.cached || 0)));
      const cw = Math.min(Math.max(0, latestTotalPrompt - cap), Math.max(0, Number(l.cacheWrite || 0)));
      const fresh = Math.max(0, latestTotalPrompt - cap - cw);
      const hitPct = (cap / latestTotalPrompt) * 100;
      const saved = computeCallCacheSavedUSD({
        model: l.modelId || l.model || '',
        inputTokens: fresh,
        cacheReadTokens: cap,
        cacheWriteTokens: cw,
        outputTokens: Math.max(0, Number(l.output || 0))
      });
      return {
        promptTurnCount: 1,
        roundFreshInp: fresh + cw,
        roundCacheRead: cap,
        roundCacheWrite: cw,
        roundHitPct: hitPct,
        roundSavedUSD: saved,
        sessFreshInp: fresh + cw,
        sessCacheRead: cap,
        sessCacheWrite: cw,
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
      roundCacheWrite: 0,
      roundHitPct: null,
      roundSavedUSD: 0,
      sessFreshInp: 0,
      sessCacheRead: 0,
      sessCacheWrite: 0,
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
        healthTag.className = latest ? 'tag' : (state.requestError ? 'tag warn' : 'tag neutral');
        healthTag.textContent = latest
          ? `充裕 · 剩余 ${formatK(remTok)}`
          : (state.route ? (state.requestError ? `重连中 (${state.requestError})` : '等待模型响应') : '未进入会话');
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
      const savedLabel = formatCacheSavedText(cacheStats.sessSavedUSD, '省', '净增');
      if (heroCachePctEl) { heroCachePctEl.textContent = `${sessPct.toFixed(1)}%`; heroCachePctEl.style.color = sessColor; }
      if (heroCacheSubEl) heroCacheSubEl.textContent = `· ${savedLabel}`;
      if (cacheBarFillEl) cacheBarFillEl.style.width = `${Math.min(100, Math.max(4, sessPct)).toFixed(1)}%`;

      if (cacheStats.cacheDropDetected) {
        if (cacheBox) cacheBox.dataset.cacheState = 'drop';
        if (cacheBadgeEl) cacheBadgeEl.textContent = '⚠️ 最近断流 ›';
        if (tipCacheEl) { tipCacheEl.textContent = `${sessPct.toFixed(1)}% · ⚠️ 本轮断流`; tipCacheEl.style.color = 'var(--rose)'; }
      } else {
        if (cacheBox) cacheBox.dataset.cacheState = sessPct >= 50 ? 'good' : 'low';
        if (cacheBadgeEl) cacheBadgeEl.textContent = t('latestReqJump');
        if (tipCacheEl) { tipCacheEl.textContent = `${sessPct.toFixed(1)}% · ${savedLabel}`; tipCacheEl.style.color = sessColor; }
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
    if (dialQuota) {
      if (primary.pct !== null) {
        dialQuota.style.strokeDashoffset = (27.02 * (1 - primary.pct / 100)).toFixed(2);
        const qColor = primary.pct <= 15 ? 'var(--rose)' : primary.pct <= 35 ? 'var(--amber)' : 'var(--emerald)';
        dialQuota.setAttribute('stroke', qColor);
      } else {
        // 选中无权限或缺失配额池时将外环重置为灰态，防止残留上一个池子的绿色进度
        dialQuota.style.strokeDashoffset = '27.02';
        dialQuota.setAttribute('stroke', 'var(--fg-3)');
      }
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
      ? (state.lastInjectedLimit ? { mode: state.lastInjectedMode, limitTokens: state.lastInjectedLimit, failed: state.lastInjectedFailed } : null)
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
      } else if (state.unlockStatus?.status === 'partial_match') {
        binBadge.className = 'tag warn';
        binBadge.textContent = '底座部分匹配（建议还原重装）';
      } else if (state.unlockStatus?.status === 'failed' || state.unlockStatus?.status === 'unknown') {
        binBadge.className = 'tag warn';
        binBadge.textContent = '底座状态异常';
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

  function formatModelRankLabel(modelKey) {
    const raw = String(modelKey || '').trim();
    if (!raw) return 'Unknown Model';
    const pricingLabel = core.MODEL_PRICING_TABLE?.[raw]?.label;
    if (pricingLabel) return pricingLabel;
    const grouped = groupProductSafe({ modelId: raw, label: raw });
    if (grouped?.label && grouped.productKey !== 'unknown') return grouped.label;
    return raw;
  }

  /**
   * 汇总当前账本来源下各模型的 API 花费、Token 量与占比，按花费降序排列
   */
  function buildModelCostRanking(srcCostEst) {
    const rawByModel = (srcCostEst && srcCostEst.byModel && typeof srcCostEst.byModel === 'object')
      ? srcCostEst.byModel
      : {};
    const rows = [];
    for (const [modelKey, info] of Object.entries(rawByModel)) {
      if (!info || typeof info !== 'object') continue;
      const requests = Math.max(0, Number(info.requests || 0));
      const costUSD = Math.max(0, Number(info.costUSD || 0));
      const tokens = Math.max(0, Number(info.tokens || 0));
      if (requests === 0 && tokens === 0 && costUSD === 0) continue;
      rows.push({
        modelKey,
        label: formatModelRankLabel(modelKey),
        requests,
        costUSD: Number(costUSD.toFixed(6)),
        tokens
      });
    }

    // 当持久账本尚无模型分项且当前非纯 CLI 视图时，回退汇总当前活跃会话的调用明细
    if (rows.length === 0 && state.ledgerSource !== 'cli' && state.sessionCalls.length > 0) {
      const map = new Map();
      for (const c of state.sessionCalls) {
        const key = String(c.modelKey || groupProductSafe({ modelId: c.modelExactId || c.model, label: c.modelLabel || c.model }).productKey || 'unknown');
        const cur = map.get(key) || { modelKey: key, label: formatModelRankLabel(c.modelLabel || key), requests: 0, costUSD: 0, tokens: 0 };
        const inp = Math.max(0, Number(c.inputTokens || 0));
        const cap = Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
        const cw = Math.max(0, Number(c.cacheWriteTokens ?? c.cacheCreationInputTokens ?? 0));
        const out = Math.max(0, Number(c.outputTokens || 0));
        cur.requests += 1;
        cur.costUSD = Number((cur.costUSD + Math.max(0, Number(c.costUSD || 0))).toFixed(6));
        cur.tokens += Math.max(0, Number(c.totalTokens || (inp + cap + cw + out)));
        map.set(key, cur);
      }
      rows.push(...map.values());
    }

    const totalCost = rows.reduce((s, r) => s + r.costUSD, 0);
    const totalTokens = rows.reduce((s, r) => s + r.tokens, 0);
    rows.sort((a, b) => (b.costUSD - a.costUSD) || (b.tokens - a.tokens) || a.label.localeCompare(b.label));
    return rows.map((r) => ({
      ...r,
      sharePct: totalCost > 0
        ? Number(((r.costUSD / totalCost) * 100).toFixed(1))
        : (totalTokens > 0 ? Number(((r.tokens / totalTokens) * 100).toFixed(1)) : 0)
    }));
  }

  function renderModelCostRanking(panelEl, items) {
    if (!panelEl) return;
    if (!items.length) {
      panelEl.innerHTML = `<div style="font-size:11px;color:var(--fg-3);padding:18px 0;text-align:center">${escapeSvgText(t('emptyModelRank'))}</div>`;
      return;
    }
    panelEl.innerHTML = items.map((item) => {
      const barW = Math.max(2, Math.min(100, Number(item.sharePct || 0))).toFixed(1);
      return `
        <div class="model-rank-row">
          <div class="model-rank-hdr">
            <span style="font-weight:600;color:var(--fg-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeSvgText(item.label)} <small class="mono" style="color:var(--fg-3);font-weight:400">(${item.requests} 次)</small></span>
            <span class="mono" style="color:var(--fg-1);white-space:nowrap"><strong>$${item.costUSD.toFixed(2)}</strong> · ${formatCompactTokens(item.tokens)} · <span style="color:var(--emerald)">${item.sharePct.toFixed(1)}%</span></span>
          </div>
          <div class="thin-bar"><i style="width:${barW}%;background:linear-gradient(90deg,var(--accent),var(--emerald))"></i></div>
        </div>
      `;
    }).join('');
  }

  /**
   * 构建账本导出载荷（支持带 UTF-8 BOM 的 CSV 表格与完整结构化 JSON 快照）
   */
  function buildLedgerExportData(format = 'csv') {
    const fmt = String(format || 'csv').toLowerCase() === 'json' ? 'json' : 'csv';
    const nowLocal = new Date();
    const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
    let days = getFilteredDailySeries();
    if (days.length === 0 && state.ledgerSource !== 'cli' && state.sessionCalls.length > 0) {
      let inp = 0; let cap = 0; let out = 0; let tot = 0; let cost = 0;
      for (const c of state.sessionCalls) {
        const ci = Math.max(0, Number(c.inputTokens || 0));
        const cc = Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
        const cw = Math.max(0, Number(c.cacheWriteTokens ?? c.cacheCreationInputTokens ?? 0));
        const co = Math.max(0, Number(c.outputTokens || 0));
        inp += ci + cw;
        cap += cc;
        out += co;
        tot += Number(c.totalTokens || (ci + cc + cw + co));
        cost += Math.max(0, Number(c.costUSD || 0));
      }
      if (tot > 0) {
        days = [{ date: todayStr, input: inp, cache: cap, output: out, total: tot, costUSD: Number(cost.toFixed(6)) }];
      }
    }

    const srcCostEst = state.historyData?.costEstimateBySource?.[state.ledgerSource] || state.historyData?.costEstimate || null;
    const modelBreakdown = buildModelCostRanking(srcCostEst);
    let totalTokens = 0; let inputTokens = 0; let cacheReadTokens = 0; let outputTokens = 0; let estimatedCostUSD = 0; let activeDays = 0;
    const enrichedDaily = days.map((d) => {
      totalTokens += d.total;
      inputTokens += d.input;
      cacheReadTokens += d.cache;
      outputTokens += d.output;
      estimatedCostUSD += d.costUSD;
      if (d.total > 0) activeDays += 1;
      const promptTot = d.input + d.cache;
      const hitPct = promptTot > 0 ? Number(((d.cache / promptTot) * 100).toFixed(1)) : 0;
      return {
        date: d.date,
        source: state.ledgerSource,
        totalTokens: Math.round(d.total),
        inputTokens: Math.round(d.input),
        cacheReadTokens: Math.round(d.cache),
        outputTokens: Math.round(d.output),
        cacheHitPct: hitPct,
        estimatedCostUSD: Number(d.costUSD.toFixed(4))
      };
    });

    const totalPrompt = inputTokens + cacheReadTokens;
    const summary = {
      activeDays,
      totalTokens: Math.round(totalTokens),
      inputTokens: Math.round(inputTokens),
      cacheReadTokens: Math.round(cacheReadTokens),
      outputTokens: Math.round(outputTokens),
      cacheHitPct: totalPrompt > 0 ? Number(((cacheReadTokens / totalPrompt) * 100).toFixed(1)) : 0,
      estimatedCostUSD: Number((Number(srcCostEst?.pricedCostUSD || 0) || estimatedCostUSD).toFixed(4))
    };

    const baseName = `antigravity-pulse-ledger-${state.ledgerSource}-${todayStr}`;
    if (fmt === 'json') {
      const payload = {
        exportedAt: nowLocal.toISOString(),
        version: METER_VERSION,
        source: state.ledgerSource,
        valuationMode: state.valuationMode,
        summary,
        modelBreakdown,
        daily: enrichedDaily
      };
      return {
        format: 'json',
        filename: `${baseName}.json`,
        mimeType: 'application/json;charset=utf-8',
        content: JSON.stringify(payload, null, 2),
        rowCount: enrichedDaily.length
      };
    }

    const csvCell = (val) => {
      if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
      let s = String(val ?? '');
      // 防止表格软件将文本单元格误解析为公式执行
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = 'date,source,total_tokens,input_tokens,cache_read_tokens,output_tokens,cache_hit_pct,estimated_cost_usd';
    const lines = [header];
    for (const row of enrichedDaily) {
      lines.push([
        csvCell(row.date),
        csvCell(row.source),
        csvCell(row.totalTokens),
        csvCell(row.inputTokens),
        csvCell(row.cacheReadTokens),
        csvCell(row.outputTokens),
        csvCell(row.cacheHitPct),
        csvCell(row.estimatedCostUSD)
      ].join(','));
    }
    // 写入 UTF-8 BOM 确保 Excel 打开中文/UTF-8 编码不乱码
    return {
      format: 'csv',
      filename: `${baseName}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: `\uFEFF${lines.join('\r\n')}\r\n`,
      rowCount: enrichedDaily.length
    };
  }

  async function exportLedgerData(format = 'csv') {
    const exp = buildLedgerExportData(format);
    try {
      if (typeof Blob === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && document?.body) {
        const blob = new Blob([exp.content], { type: exp.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exp.filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch {}
        }, 1500);
        notify(`已导出 ${exp.filename}（共 ${exp.rowCount} 天记录）`);
        return true;
      }
    } catch {}
    const copied = await copyTextToClipboard(exp.content);
    notify(copied ? `当前环境不支持直接下载，已复制 ${exp.format.toUpperCase()} 账本到剪贴板` : '导出失败，请重试');
    return copied;
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

    // state.sessionCalls 仅记录桌面端活跃会话调用，CLI 来源为空时严禁回退掺入桌面端调用
    if (grandTotal === 0 && state.ledgerSource !== 'cli' && state.sessionCalls.length > 0) {
      for (const c of state.sessionCalls) {
        const inp = Math.max(0, Number(c.inputTokens || 0));
        const cap = Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
        const cw = Math.max(0, Number(c.cacheWriteTokens ?? c.cacheCreationInputTokens ?? 0));
        const out = Math.max(0, Number(c.outputTokens || 0));
        const tot = Number(c.totalTokens || (inp + cap + cw + out));
        grandTotal += tot;
        totalInp += inp + cw;
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
    if (el('tipTodayVal') && state.ledgerSource === 'all') {
      const todayRec = days.find(x => x.date === todayStr);
      const todayCost = todayRec?.costUSD ? todayRec.costUSD : state.sessionCostTotal;
      el('tipTodayVal').textContent = `${formatCompactTokens(todayTotal)} · $${todayCost.toFixed(2)}`;
    }

    const ledgerPromptTotal = totalInp + totalCap;
    const ledgerHitPct = ledgerPromptTotal > 0 ? (totalCap / ledgerPromptTotal) * 100 : null;
    const resolveValuationModelKey = (mode) => {
      if (mode === 'claude-opus-4-6-thinking') return 'claude-opus-5-5';
      if (mode === 'gemini-3.1-pro' || mode === 'gemini-3.1-pro-preview') return 'gemini-3.1-pro-preview';
      return 'gemini-4-hydrogen';
    };
    const valModelKey = resolveValuationModelKey(state.valuationMode);
    const ledgerSavedUSD = typeof core.calculateNetCacheSavedUSD === 'function'
      ? core.calculateNetCacheSavedUSD({
          model: valModelKey,
          inputTokens: totalInp,
          cacheReadTokens: totalCap,
          outputTokens: totalOut
        })
      : ((totalCap / 1e6) * (valModelKey === 'claude-opus-5-5' ? (4.00 - 0.20) : (valModelKey === 'gemini-3.1-pro-preview' ? (2.00 - 0.20) : (1.50 - 0.075))));
    if (el('ledgerCacheSummary')) {
      el('ledgerCacheSummary').textContent = ledgerHitPct !== null
        ? `缓存命中 ${ledgerHitPct.toFixed(1)}% · ${formatCacheSavedText(ledgerSavedUSD, '累计省', '累计净增')}`
        : '缓存命中 --% · 省 $0.00';
    }

    const srcCostEst = state.historyData?.costEstimateBySource?.[state.ledgerSource] || state.historyData?.costEstimate || null;
    const pricedActualUSD = Number(srcCostEst?.pricedCostUSD || 0);
    // 统一通过 core.calculateReferenceModelCost 按真实定价表计算折算分项，保证 gemini-3.1-pro / opus / hydrogen 全部精确对齐
    const refCalc = typeof core.calculateReferenceModelCost === 'function'
      ? core.calculateReferenceModelCost(
          { inputTokens: totalInp, cacheTokens: totalCap, outputTokens: totalOut, totalTokens: grandTotal },
          valModelKey
        )
      : null;
    let inpCost = refCalc ? Number(refCalc.inputCostUSD ?? refCalc.breakdownCostUSD?.input ?? 0) : (totalInp * (1.50 / 1e6));
    let capCost = refCalc ? Number(refCalc.cacheCostUSD ?? refCalc.breakdownCostUSD?.cache ?? 0) : (totalCap * (0.075 / 1e6));
    let outCost = refCalc ? Number(refCalc.outputCostUSD ?? refCalc.breakdownCostUSD?.output ?? 0) : (totalOut * (7.50 / 1e6));
    const refSum = inpCost + capCost + outCost;
    const effectiveTotalUSD = state.valuationMode === 'actual'
      ? (pricedActualUSD > 0 ? pricedActualUSD : (totalActualUSD > 0 ? totalActualUSD : refSum))
      : refSum;
    // actual 模式下若存在多模型混合真实账单总价，按比例对齐分项金额使其与折算总额保持一致
    if (state.valuationMode === 'actual' && refSum > 0 && effectiveTotalUSD > 0 && Math.abs(effectiveTotalUSD - refSum) > 0.0001) {
      const scale = effectiveTotalUSD / refSum;
      inpCost *= scale;
      capCost *= scale;
      outCost *= scale;
    }

    if (el('apiBreakdownNums')) {
      const hitTag = ledgerHitPct !== null ? `${ledgerHitPct.toFixed(1)}% 命中` : '0%';
      el('apiBreakdownNums').innerHTML =
        `<span>新输入: <strong>$${inpCost.toFixed(2)}</strong></span>` +
        `<span>缓存 (${hitTag}): <strong style="color:var(--emerald)">$${capCost.toFixed(2)}</strong> <small style="color:var(--emerald)">(${formatCacheSavedText(ledgerSavedUSD, '省', '净增')})</small></span>` +
        `<span>输出: <strong>$${outCost.toFixed(2)}</strong></span>`;
    }

    if (el('hmActiveSummary')) {
      const avg = activeDays > 0 ? effectiveTotalUSD / activeDays : 0;
      el('hmActiveSummary').textContent = `活跃 ${activeDays} 天 · 日均 $${avg.toFixed(2)}`;
    }

    const isFreeMode = state.subAcqMode === 'free_edu' || state.subAcqMode === 'free_tier';
    const effPrice = isFreeMode ? 0 : Number(state.subPrice || 0);
    // 动态从 core.convertToCNY(1, 'USD') 获取统一基准汇率，杜绝与核心汇率表 (6.72) 分叉造成 7.4% 系统偏差
    const usdToCnyRate = typeof core.convertToCNY === 'function'
      ? (Number(core.convertToCNY(1, 'USD')) || 6.72)
      : 6.72;
    const cnyMonthly = typeof core.convertToCNY === 'function'
      ? Number(core.convertToCNY(effPrice, state.subCurrency) || 0)
      : effPrice * usdToCnyRate;
    const usdMonthly = String(state.subCurrency || '').toUpperCase() === 'USD'
      ? effPrice
      : (cnyMonthly / usdToCnyRate);
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
    const modelsPanel = el('ledgerModelsPanel');
    const hoverEl = el('hmHoverTxt');
    const isModelsMode = state.ledgerBottomMode === 'models';

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

    if (isModelsMode) {
      const modelRanking = buildModelCostRanking(srcCostEst);
      if (dailyWrap) dailyWrap.style.display = 'none';
      if (altSvg) altSvg.style.display = 'none';
      if (modelsPanel) {
        modelsPanel.style.display = 'flex';
        renderModelCostRanking(modelsPanel, modelRanking);
      }
      if (hoverEl) {
        hoverEl.textContent = modelRanking.length > 0
          ? `共统计 ${modelRanking.length} 个已计价模型 · 按 API 零售花费降序排列`
          : t('emptyModelRank');
      }
    } else {
      if (modelsPanel) modelsPanel.style.display = 'none';
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
  }

  function redactProxyUrlForDisplay(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      if (parsed.username || parsed.password) {
        parsed.username = '***';
        parsed.password = '';
      }
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return String(rawUrl || '').replace(/\/\/[^/@\s]+@/, '//***@');
    }
  }

  function renderProxyProfiles() {
    const bar = el('proxyProfileBar');
    if (bar) {
      const chipsHtml = (state.proxyProfiles || []).map((prof) => {
        const isActive = prof.id === state.activeProxyProfileId || (
          !state.activeProxyProfileId && String(prof.proxyUrl || '').trim() === String(state.proxyUrl || '').trim()
        );
        const safeUrl = redactProxyUrlForDisplay(prof.proxyUrl);
        return `
          <button class="proxy-profile-chip${isActive ? ' active' : ''}" type="button" data-prof-id="${escapeSvgText(prof.id)}" title="${escapeSvgText(safeUrl)}">
            <span class="proxy-profile-chip-name">${escapeSvgText(prof.name)}</span>
            <span class="proxy-profile-del" data-del-prof="${escapeSvgText(prof.id)}" title="删除此预设">×</span>
          </button>
        `;
      }).join('');
      bar.innerHTML = chipsHtml + `<button class="proxy-profile-chip" type="button" data-add-prof="1">${escapeSvgText(t('addProfileBtn'))}</button>`;
    }
    const editor = el('proxyProfileEditor');
    if (editor) editor.hidden = !state.proxyProfileEditorOpen;
  }

  function renderStudioSpace() {
    el('toggleZhTitle')?.classList.toggle('on', state.zhChatTitle);
    updatePromptTierDescription();

    el('toggleProxyMod')?.classList.toggle('on', state.proxyEnabled);
    const pInput = el('proxyUrlInput');
    if (pInput && shadow.activeElement !== pInput) pInput.value = state.proxyUrl;
    renderProxyProfiles();

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

  /**
   * 按时间顺序构建会话每轮请求轨迹，识别 Antigravity 自动压缩点与非压缩缓存断流
   */
  function buildSessionTurnTimeline(calls) {
    const promptCalls = (Array.isArray(calls) ? calls : []).filter((c) => {
      const inp = Math.max(0, Number(c?.inputTokens || 0));
      const cap = Math.max(0, Number(c?.cacheReadTokens ?? c?.cacheTokens ?? 0));
      const cw = Math.max(0, Number(c?.cacheWriteTokens ?? c?.cacheCreationInputTokens ?? 0));
      return (inp + cap + cw) > 0;
    });

    const turns = [];
    let prevPrompt = 0;
    let prevHitPct = null;
    let compactionCount = 0;
    let cacheDropCount = 0;

    for (let i = 0; i < promptCalls.length; i++) {
      const c = promptCalls[i];
      const inp = Math.max(0, Number(c.inputTokens || 0));
      const cap = Math.max(0, Number(c.cacheReadTokens ?? c.cacheTokens ?? 0));
      const cw = Math.max(0, Number(c.cacheWriteTokens ?? c.cacheCreationInputTokens ?? 0));
      const out = Math.max(0, Number(c.outputTokens || 0));
      const promptTotal = inp + cap + cw;
      const hitPct = promptTotal > 0 ? Number(((cap / promptTotal) * 100).toFixed(1)) : null;

      // 当上一轮上下文超过 12K 且本轮骤降至 72% 以下时，判定触发了 Antigravity 自动压缩
      const compacted = Boolean(prevPrompt >= 12000 && promptTotal > 0 && promptTotal < prevPrompt * 0.72);
      const compactDropPct = compacted ? Math.round((1 - promptTotal / prevPrompt) * 100) : 0;
      if (compacted) compactionCount += 1;

      // 未发生自动压缩但缓存命中率从 >=45% 骤降至 <10% 时，标记为缓存断流重算
      const cacheDrop = Boolean(!compacted && prevHitPct !== null && prevHitPct >= 45 && promptTotal >= 6000 && hitPct !== null && hitPct < 10);
      if (cacheDrop) cacheDropCount += 1;

      const tpsVal = Number(c.tps);
      const ttftVal = Number(c.ttftSec ?? (Number.isFinite(Number(c.ttftMs)) ? Number(c.ttftMs) / 1000 : NaN));
      const durVal = Number(c.durationSec ?? (Number.isFinite(Number(c.durationMs)) ? Number(c.durationMs) / 1000 : NaN));
      const rawModel = c.modelLabel || c.model || c.modelExactId || '';
      const grouped = rawModel ? groupProductSafe({ modelId: c.modelExactId || rawModel, label: rawModel }) : null;
      const modelLabel = (grouped?.label && grouped.productKey !== 'unknown') ? grouped.label : (rawModel || 'Model');

      turns.push({
        turn: i + 1,
        modelLabel,
        promptTotal,
        prevPrompt,
        freshInput: inp + cw,
        cacheRead: cap,
        outputTokens: out,
        hitPct,
        compacted,
        compactDropPct,
        cacheDrop,
        tps: Number.isFinite(tpsVal) && tpsVal > 0 ? Number(tpsVal.toFixed(1)) : null,
        ttftSec: Number.isFinite(ttftVal) && ttftVal >= 0 ? Number(ttftVal.toFixed(2)) : null,
        durationSec: Number.isFinite(durVal) && durVal > 0 ? Number(durVal.toFixed(1)) : null,
        costUSD: Number(c.costUSD || 0)
      });

      prevPrompt = promptTotal;
      prevHitPct = hitPct;
    }

    return { turns, compactionCount, cacheDropCount };
  }

  function renderAuditSheet() {
    const l = state.latest;
    const cs = computeSessionCacheStats();
    const timeline = buildSessionTurnTimeline(state.sessionCalls);
    const scanEstHigh = state.scan?.session?.total?.high || state.scan?.estimatedTotal || null;

    // Layer 1: Whole-Session Cumulative Cache Overview Banner
    if (el('audSessTurnTag')) {
      el('audSessTurnTag').textContent = cs.promptTurnCount > 0 ? `共 ${cs.promptTurnCount} 轮请求` : '0 轮请求';
    }
    if (el('audCompactionTag')) {
      el('audCompactionTag').hidden = timeline.compactionCount === 0;
      el('audCompactionTag').textContent = `压缩 ${timeline.compactionCount} 次`;
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
      if (el('audSessCachePct')) { el('audSessCachePct').textContent = `${cs.sessHitPct.toFixed(1)}%`; el('audSessCachePct').style.color = sessColor; }
      if (el('audSessSavedBadge')) { el('audSessSavedBadge').textContent = formatCacheSavedText(cs.sessSavedUSD, '累计省', '累计净增'); el('audSessSavedBadge').style.color = cs.sessSavedUSD < -0.0005 ? 'var(--amber)' : sessColor; }
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
        rateEl.textContent = `${cs.roundHitPct.toFixed(1)}% · ${formatCacheSavedText(cs.roundSavedUSD, '本次省', '本次净增')}`;
        rateEl.style.color = cs.roundSavedUSD < -0.0005 ? 'var(--amber)' : (cs.roundHitPct >= 50 ? 'var(--emerald)' : 'var(--amber)');
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
    if (el('audStepStats')) el('audStepStats').textContent = `${timeline.turns.length || state.scan?.session?.steps || state.count} 轮 · ${files.length} 附件`;

    qsa('#audRightSeg .seg-item').forEach(b => b.classList.toggle('on', b.dataset.aright === state.auditRightTab));
    const timelineEl = el('auditTimelineList');
    const listEl = el('auditFileList');
    const showTimeline = state.auditRightTab !== 'files';
    if (timelineEl) {
      timelineEl.style.display = showTimeline ? 'flex' : 'none';
      if (!timeline.turns.length) {
        timelineEl.innerHTML = '<div style="font-size:11px;color:var(--fg-3);padding:14px 0;text-align:center">完成首次模型响应后自动绘制轮次压缩与缓存波动轨迹</div>';
      } else {
        timelineEl.innerHTML = [...timeline.turns].reverse().map((item) => {
          const rowCls = item.compacted ? 'turn-row compacted' : (item.cacheDrop ? 'turn-row cache-drop' : 'turn-row');
          let badgeHtml = '';
          if (item.compacted) {
            badgeHtml = `<span class="turn-badge compact">自动压缩 -${item.compactDropPct}% (${formatK(item.prevPrompt)}→${formatK(item.promptTotal)})</span>`;
          } else if (item.cacheDrop) {
            badgeHtml = `<span class="turn-badge drop">缓存断流 ${item.hitPct !== null ? Math.round(item.hitPct) : 0}%</span>`;
          } else if (item.hitPct !== null) {
            badgeHtml = `<span class="turn-badge hit">命中 ${Math.round(item.hitPct)}%</span>`;
          }
          const perfParts = [];
          if (item.ttftSec !== null) perfParts.push(`TTFT ${item.ttftSec.toFixed(1)}s`);
          if (item.tps !== null) perfParts.push(`${item.tps.toFixed(0)} tok/s`);
          else if (item.durationSec !== null) perfParts.push(`${item.durationSec.toFixed(1)}s`);
          const perfTxt = perfParts.length ? perfParts.join(' · ') : (item.costUSD > 0 ? `$${item.costUSD.toFixed(3)}` : '--');
          return `
            <div class="${rowCls}">
              <div class="turn-row-top">
                <span style="font-weight:600;color:var(--fg-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#${item.turn} · ${escapeSvgText(item.modelLabel)}</span>
                ${badgeHtml}
              </div>
              <div class="turn-row-sub mono">
                <span>输入 ${formatK(item.promptTotal)} · 输出 ${formatK(item.outputTokens)}</span>
                <span>${escapeSvgText(perfTxt)}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
    if (listEl) {
      listEl.style.display = showTimeline ? 'none' : 'flex';
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
          : Math.round(price * (r.rateToCNY || 6.72));
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

  qsa('#audRightSeg .seg-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.auditRightTab = btn.dataset.aright === 'files' ? 'files' : 'timeline';
      renderAuditSheet();
    });
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
        if (res.needsRestart) state.restartRequired = true;
        await syncStudioStatuses();
        notify(res.needsRestart ? '已恢复原版二进制，请点击「重启生效」完成加载' : '已无损恢复官方原版二进制文件');
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

  el('btnExportCsv')?.addEventListener('click', () => {
    void exportLedgerData('csv');
  });

  el('btnExportJson')?.addEventListener('click', () => {
    void exportLedgerData('json');
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

  let subPriceSaveTimer = null;
  el('subPriceInput')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 0) {
      state.subPrice = v;
      renderSubscriptionSheet();
      renderLedgerSpace();
      clearTimeout(subPriceSaveTimer);
      subPriceSaveTimer = setTimeout(() => {
        if (!state.disposed) void persistUiAndPlanSettings();
      }, 350);
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
      if (res?.ok) {
        if (res.needsRestart) state.restartRequired = true;
        await syncStudioStatuses();
        notify(res.needsRestart ? `已写入 Lv.${state.promptTier} 增强补丁，重启语言服务或客户端后生效` : `已应用 Lv.${state.promptTier} 提示词增强补丁`);
      } else {
        notify(res?.error || '应用增强失败');
      }
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
        if (res.needsRestart) state.restartRequired = true;
        await syncStudioStatuses();
        notify(res.needsRestart ? '已恢复原版提示词与标题策略，重启客户端后生效' : '已恢复官方原版提示词与标题策略');
      } else {
        notify(res?.error || '恢复失败');
      }
    } catch (e) {
      notify(e?.message || '恢复异常');
    }
  });

  async function persistProxyProfiles(nextProfiles, nextActiveId, nextUrl = state.proxyUrl) {
    const opts = {
      proxyUrl: nextUrl,
      profiles: nextProfiles,
      activeProfileId: nextActiveId || null
    };
    const res = await callBackend({
      ipcFn: typeof globalThis.contextMeterAPI?.toggleModule === 'function'
        ? () => globalThis.contextMeterAPI.toggleModule('proxy', state.proxyEnabled, opts)
        : null,
      liveRoute: '/toggle-module',
      body: { name: 'proxy', enable: state.proxyEnabled, opts }
    });
    if (res?.ok) {
      state.proxyUrl = nextUrl;
      state.proxyProfiles = Array.isArray(res.data?.modules?.proxy?.profiles)
        ? res.data.modules.proxy.profiles
        : nextProfiles;
      state.activeProxyProfileId = res.data?.modules?.proxy?.activeProfileId !== undefined
        ? res.data.modules.proxy.activeProfileId
        : (nextActiveId || null);
      if (res.restartRequired) state.restartRequired = true;
      renderStudioSpace();
      renderCockpit();
      return { ok: true, res };
    }
    return { ok: false, res };
  }

  async function runProxyFourLayerDiag(urlVal, silentStart = false) {
    const targetUrl = String(urlVal || el('proxyUrlInput')?.value?.trim() || state.proxyUrl).trim();
    state.proxyUrl = targetUrl;
    if (!silentStart) notify('正在执行四层代理连通性诊断...');
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.testProxy === 'function'
          ? () => globalThis.contextMeterAPI.testProxy(targetUrl)
          : null,
        liveRoute: '/test-proxy',
        body: { proxyUrl: targetUrl }
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
  }

  el('toggleProxyMod')?.addEventListener('click', async () => {
    const nextEnable = !state.proxyEnabled;
    const urlVal = el('proxyUrlInput')?.value?.trim() || state.proxyUrl;
    state.proxyUrl = urlVal;
    const matchedProf = (state.proxyProfiles || []).find(p => String(p.proxyUrl || '').trim() === urlVal);
    const nextActiveId = matchedProf ? matchedProf.id : null;
    try {
      const res = await callBackend({
        ipcFn: typeof globalThis.contextMeterAPI?.toggleModule === 'function'
          ? () => globalThis.contextMeterAPI.toggleModule('proxy', nextEnable, { proxyUrl: urlVal, activeProfileId: nextActiveId })
          : null,
        liveRoute: '/toggle-module',
        body: { name: 'proxy', enable: nextEnable, opts: { proxyUrl: urlVal, activeProfileId: nextActiveId } }
      });
      if (res?.ok) {
        state.proxyEnabled = nextEnable;
        state.activeProxyProfileId = nextActiveId;
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

  el('btnPingTopo')?.addEventListener('click', () => {
    void runProxyFourLayerDiag(el('proxyUrlInput')?.value?.trim() || state.proxyUrl, false);
  });

  el('proxyProfileBar')?.addEventListener('click', async (e) => {
    const delTarget = e.target?.closest?.('[data-del-prof]');
    if (delTarget) {
      e.stopPropagation();
      const delId = delTarget.dataset.delProf;
      const targetProf = (state.proxyProfiles || []).find(p => p.id === delId);
      const nextProfiles = (state.proxyProfiles || []).filter(p => p.id !== delId);
      const nextActiveId = state.activeProxyProfileId === delId ? null : state.activeProxyProfileId;
      try {
        const out = await persistProxyProfiles(nextProfiles, nextActiveId, state.proxyUrl);
        notify(out.ok ? `已删除代理预设「${targetProf?.name || delId}」` : (out.res?.error || '删除预设失败'));
      } catch (err) {
        notify(err?.message || '删除预设异常');
      }
      return;
    }

    const addBtn = e.target?.closest?.('[data-add-prof]');
    if (addBtn) {
      state.proxyProfileEditorOpen = !state.proxyProfileEditorOpen;
      renderProxyProfiles();
      if (state.proxyProfileEditorOpen) {
        el('proxyProfileNameInput')?.focus?.();
      }
      return;
    }

    const chip = e.target?.closest?.('[data-prof-id]');
    if (chip) {
      const profId = chip.dataset.profId;
      const prof = (state.proxyProfiles || []).find(p => p.id === profId);
      if (!prof) return;
      const pInput = el('proxyUrlInput');
      if (pInput) pInput.value = prof.proxyUrl;
      try {
        const out = await persistProxyProfiles(state.proxyProfiles, prof.id, prof.proxyUrl);
        if (out.ok) {
          notify(`已切换代理预设「${prof.name}」，正在执行四层探测...`);
          void runProxyFourLayerDiag(prof.proxyUrl, true);
        } else {
          notify(out.res?.error || '切换代理预设失败');
        }
      } catch (err) {
        notify(err?.message || '切换代理预设异常');
      }
    }
  });

  const saveCurrentProxyAsProfile = async () => {
    const urlVal = String(el('proxyUrlInput')?.value || state.proxyUrl || '').trim();
    if (!/^(?:https?|socks5h?|socks4):\/\//i.test(urlVal)) {
      notify('请输入合法的代理地址（支持 http / https / socks5）');
      return;
    }
    const nameInput = el('proxyProfileNameInput');
    let name = String(nameInput?.value || '').trim().slice(0, 32);
    if (!name) {
      try {
        const u = new URL(urlVal);
        name = `${u.hostname}${u.port ? ':' + u.port : ''}`.slice(0, 32);
      } catch {
        name = `节点 ${(state.proxyProfiles || []).length + 1}`;
      }
    }
    const existingIdx = (state.proxyProfiles || []).findIndex(
      p => String(p.name || '').trim().toLowerCase() === name.toLowerCase()
    );
    const nextProfiles = [...(state.proxyProfiles || [])];
    let savedId;
    if (existingIdx >= 0) {
      savedId = nextProfiles[existingIdx].id;
      nextProfiles[existingIdx] = { id: savedId, name, proxyUrl: urlVal };
    } else {
      if (nextProfiles.length >= 12) {
        notify('最多支持保存 12 个代理预设，请先删除旧预设');
        return;
      }
      savedId = `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      nextProfiles.push({ id: savedId, name, proxyUrl: urlVal });
    }
    try {
      const out = await persistProxyProfiles(nextProfiles, savedId, urlVal);
      if (out.ok) {
        if (nameInput) nameInput.value = '';
        state.proxyProfileEditorOpen = false;
        renderProxyProfiles();
        notify(`已保存代理预设「${name}」`);
      } else {
        notify(out.res?.error || '保存代理预设失败');
      }
    } catch (err) {
      notify(err?.message || '保存代理预设异常');
    }
  };

  el('btnConfirmSaveProfile')?.addEventListener('click', () => {
    void saveCurrentProxyAsProfile();
  });

  el('proxyProfileNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void saveCurrentProxyAsProfile();
    } else if (e.key === 'Escape') {
      state.proxyProfileEditorOpen = false;
      renderProxyProfiles();
    }
  });

  el('btnCancelSaveProfile')?.addEventListener('click', () => {
    state.proxyProfileEditorOpen = false;
    if (el('proxyProfileNameInput')) el('proxyProfileNameInput').value = '';
    renderProxyProfiles();
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
        if (res?.ok) {
          state.brandTitle = bword;
          if (res.restartRequired) state.restartRequired = true;
          renderStudioSpace();
          renderCockpit();
          notify(res.message || '已同步左上角品牌词配置');
        } else {
          notify(res?.error || '同步品牌词失败');
        }
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

  /**
   * 生成脱敏的会话遥测 Markdown 摘要（不含本地路径、会话 ID 或任何令牌），便于一键分享与排查
   */
  function buildTelemetryMarkdownSnapshot() {
    const activeProd = getProductByKey(state.activeProductKey);
    const activePref = getPreferenceForProduct(activeProd);
    const configuredTok = resolveEffectiveTokensForProduct(activeProd);
    const latest = state.latest;
    const usedTok = Number(latest?.used ?? latest?.actual ?? latest?.estimate ?? 0);
    const adoptedBudget = Number(latest?.budget || 0);
    const isCustomConfigured = activePref && activePref.mode !== 'default';
    const limitTok = isCustomConfigured
      ? configuredTok
      : (adoptedBudget > 0 ? adoptedBudget : configuredTok || 256000);
    const pct = limitTok > 0 ? Math.min(99.9, (usedTok / limitTok) * 100) : 0;

    const cs = computeSessionCacheStats();
    const timeline = buildSessionTurnTimeline(state.sessionCalls);
    const modelName = state.activeModelLabel || activeProd?.label || 'Antigravity';
    const effortPart = state.activeEffort ? ` · ${state.activeEffort}` : '';
    const ctxSource = latest ? (latest.estimated ? '估算' : '实测') : '待采样';

    const cacheHitTxt = cs.sessHitPct !== null ? `${cs.sessHitPct.toFixed(1)}%` : '--%';
    const compactTxt = timeline.compactionCount > 0 ? ` · 自动压缩 ${timeline.compactionCount} 次` : '';
    const speedParts = [];
    if (Number.isFinite(Number(state.liveTps)) && Number(state.liveTps) > 0) speedParts.push(`${Number(state.liveTps).toFixed(1)} tok/s`);
    if (Number.isFinite(Number(state.liveTtft)) && Number(state.liveTtft) >= 0) speedParts.push(`TTFT ${Number(state.liveTtft).toFixed(2)}s`);
    if (Number.isFinite(Number(state.liveOutTok)) && Number(state.liveOutTok) > 0) speedParts.push(`输出 ${formatK(state.liveOutTok)}`);
    const speedTxt = speedParts.length ? speedParts.join(' · ') : '待采样';

    const pools = extractNormalizedPools(Date.now()).slice(0, 3);
    const quotaTxt = pools.length
      ? pools.map((p) => {
          if (p.noPermission) return `${p.label}: 不可用`;
          if (Array.isArray(p.buckets) && p.buckets.length > 0) {
            return `${p.label}: ${p.buckets.map(b => `${b.tag} ${b.pctLabel}`).join(' / ')}`;
          }
          return `${p.label}: ${p.pctLabel}`;
        }).join(' | ')
      : '同步中';

    const nowLocal = new Date();
    const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
    const days = getFilteredDailySeries();
    const todayRec = days.find(d => d.date === todayStr);
    const todayTok = todayRec ? todayRec.total : state.sessionCalls.reduce((s, c) => s + Number(c.totalTokens || 0), 0);
    const todayCost = todayRec?.costUSD ? todayRec.costUSD : state.sessionCostTotal;

    const lines = [
      `### Antigravity Pulse v${METER_VERSION} 会话遥测摘要`,
      `- **当前模型**: ${modelName}${effortPart}`,
      `- **上下文占用**: ${formatK(usedTok)} / ${formatK(limitTok)} (${pct.toFixed(1)}% · ${ctxSource})`,
      `- **会话缓存**: 命中 ${cacheHitTxt} · ${formatCacheSavedText(cs.sessSavedUSD, '累计省', '累计净增')} · ${cs.promptTurnCount} 轮${compactTxt}`,
      `- **最新速度**: ${speedTxt}`,
      `- **额度池**: ${quotaTxt}`,
      `- **今日账本**: ${formatCompactTokens(todayTok)} tok · $${Number(todayCost || 0).toFixed(2)}`
    ];
    return lines.join('\n');
  }

  const copyTelemetrySnapshot = async () => {
    const md = buildTelemetryMarkdownSnapshot();
    const ok = await copyTextToClipboard(md);
    notify(ok ? '已复制会话遥测 Markdown 摘要' : '复制失败，当前环境禁止剪贴板写入');
  };

  el('btnCopySnapshot')?.addEventListener('click', () => {
    void copyTelemetrySnapshot();
  });

  el('btnCopyAuditSnap')?.addEventListener('click', () => {
    void copyTelemetrySnapshot();
  });

  function onDocClick(e) {
    if (!state.hudOpen || state.dockMode === 'drawer') return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.includes(host)) return;
    toggleHud(false);
  }

  function onDocKeydown(e) {
    // Alt+Shift+P (macOS Option+Shift+P) 全局快捷呼出/收起 HUD，避开编辑器 Cmd/Ctrl+Shift+P 命令面板冲突
    const isToggleShortcut = Boolean(
      e && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey &&
      (e.code === 'KeyP' || String(e.key || '').toLowerCase() === 'p')
    );
    if (isToggleShortcut) {
      const activeEl = shadow.activeElement || document.activeElement;
      const tag = String(activeEl?.tagName || '').toUpperCase();
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(activeEl?.isContentEditable);
      if (!isEditable) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        toggleHud(!state.hudOpen);
        return;
      }
    }

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
  let lastTickAt = Date.now();

  function tick() {
    if (state.disposed) return;
    const now = Date.now();
    // 检测到系统休眠唤醒（单次心跳间隔超过 45 秒）时，主动刷新节奏与异常额度状态
    const wokeFromSleep = (now - lastTickAt) > 45000;
    lastTickAt = now;
    if (wokeFromSleep) {
      state.requestNext = 0;
      state.scanNext = 0;
      if (state.quotaError || (now - state.quotaFetchedAt) > 60000) {
        void syncQuotaFromHost(Boolean(state.quotaError));
      }
    }

    // 页面隐藏时跳过频繁的 DOM 布局重排与模型按钮扫描，降低后台 CPU 占用
    if (!document.hidden) {
      ensureHostDocked();
      syncActiveModelIdentity();
    }

    const nextRoute = getActiveConversationId();
    if (nextRoute !== state.route) {
      state.route = nextRoute;
      state.generation += 1;
      // 切换会话时立刻中止上一轮在途请求并递增令牌复位忙锁，彻底根治 requestBusy/scanBusy 永久死锁
      state.activeRequestToken += 1;
      state.activeScanToken += 1;
      if (state.activeRequestCtrl) {
        try { state.activeRequestCtrl.abort(); } catch {}
        state.activeRequestCtrl = null;
      }
      if (state.activeScanCtrl) {
        try { state.activeScanCtrl.abort(); } catch {}
        state.activeScanCtrl = null;
      }
      state.requestBusy = false;
      state.requestStartedAt = 0;
      state.scanBusy = false;
      state.scanStartedAt = 0;
      state.requestError = '';
      state.scanError = '';
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

    // 看门狗兜底：防止系统休眠或半开 Socket 导致 Promise 长期悬挂不落地
    if (state.requestBusy && state.requestStartedAt > 0 && (now - state.requestStartedAt) > 25000) {
      state.activeRequestToken += 1;
      if (state.activeRequestCtrl) {
        try { state.activeRequestCtrl.abort(); } catch {}
        state.activeRequestCtrl = null;
      }
      state.requestBusy = false;
      state.requestStartedAt = 0;
      state.requestNext = 0;
    }
    if (state.scanBusy && state.scanStartedAt > 0 && (now - state.scanStartedAt) > 45000) {
      state.activeScanToken += 1;
      if (state.activeScanCtrl) {
        try { state.activeScanCtrl.abort(); } catch {}
        state.activeScanCtrl = null;
      }
      state.scanBusy = false;
      state.scanStartedAt = 0;
      state.scanNext = 0;
    }

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

  function onVisibilityOrFocusWake() {
    if (state.disposed || document.hidden) return;
    const now = Date.now();
    if (state.requestError || (now - state.requestAt) > 30000) {
      state.requestNext = 0;
    }
    if (state.quotaError || (now - state.quotaFetchedAt) > 60000) {
      void syncQuotaFromHost(Boolean(state.quotaError));
    }
    tick();
  }

  document.addEventListener?.('visibilitychange', onVisibilityOrFocusWake);
  globalThis.addEventListener?.('focus', onVisibilityOrFocusWake);

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
    buildTelemetrySnapshotForTest: () => buildTelemetryMarkdownSnapshot(),
    buildTurnTimelineForTest: (calls) => buildSessionTurnTimeline(calls || state.sessionCalls),
    buildLedgerExportForTest: (fmt) => buildLedgerExportData(fmt),
    setSessionCallsForTest: (calls) => {
      state.sessionCalls = Array.isArray(calls) ? calls : [];
      state.sessionCostTotal = state.sessionCalls.reduce((s, c) => s + Number(c?.costUSD || 0), 0);
      renderAuditSheet();
      renderCockpit();
    },
    setHistoryDataForTest: (data) => {
      state.historyData = data;
      renderLedgerSpace();
    },
    pollTrajectoryForTest: () => pollTrajectory(state.generation, state.route),
    syncQuotaFromHostForTest: (force = false) => syncQuotaFromHost(force),
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
      clearTimeout(subPriceSaveTimer);
      uninstallRequestInterceptor();
      document.removeEventListener?.('click', onDocClick, true);
      document.removeEventListener?.('keydown', onDocKeydown);
      document.removeEventListener?.('visibilitychange', onVisibilityOrFocusWake);
      globalThis.removeEventListener?.('resize', onWinResize);
      globalThis.removeEventListener?.('focus', onVisibilityOrFocusWake);
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
