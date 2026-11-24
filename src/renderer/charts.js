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
