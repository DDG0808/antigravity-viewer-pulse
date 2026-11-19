// Antigravity Pulse — Retina Canvas Waveform, 5-Mode Activity Matrix & Speed Duel SVG Engine

function escapeSvgText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const w = 268;
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
  ctx.scale(dpr, dpr);
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
  grad.addColorStop(0, isStreaming ? 'rgba(16, 185, 129, 0.28)' : 'rgba(56, 189, 248, 0.22)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
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

function renderAlternateHistorySvg(svgEl, mode, buckets, onHoverBucket) {
  if (!svgEl) return;
  const rows = Array.isArray(buckets) ? buckets : [];
  if (!rows.length) {
    svgEl.innerHTML = `<text x="300" y="58" text-anchor="middle" fill="var(--fg-3)" font-size="11">暂无该周期历史消费记录</text>`;
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
    const stepX = cumRows.length > 1 ? w / (cumRows.length - 1) : 0;
    const pts = cumRows.map((r, idx) => {
      const x = (padX + idx * stepX).toFixed(1);
      const y = (96 - (r.cumTotal / maxCum) * 78).toFixed(1);
      return `${x},${y}`;
    });
    const firstX = padX;
    const lastX = (padX + (cumRows.length - 1) * stepX).toFixed(1);
    svgEl.innerHTML =
      `<polygon points="${firstX},102 ${pts.join(' ')} ${lastX},102" fill="var(--accent-glow)"></polygon>` +
      `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
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

function renderSpeedDuelView(barsContainer, trendSvg, trendTitleEl, trendMedianEl, speedGroups, metric = 'tps', focusModelKey = '', onSelectGroup = null) {
  if (!barsContainer || !trendSvg) return;
  const list = Array.isArray(speedGroups) ? speedGroups : [];

  if (!list.length) {
    barsContainer.innerHTML = `<div style="font-size:11.5px;color:var(--fg-3);padding:16px 0;text-align:center">尚无实测流式生成样本，完成一轮模型对话后自动记录各模型速率与首字延迟</div>`;
    trendSvg.innerHTML = `<text x="290" y="50" text-anchor="middle" fill="var(--fg-3)" font-size="11">等待首条有效流式样本...</text>`;
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

  const maxMetric = Math.max(0.1, ...sorted.map(item => getMetricValue(item)));

  barsContainer.innerHTML = sorted.map(item => {
    const key = item.modelExactId || item.key || item.modelLabel;
    const label = item.modelLabel || item.label || key;
    const rawVal = getMetricValue(item);
    const pct = Math.max(6, Math.min(100, (rawVal / maxMetric) * 100));
    const formatted = metric === 'tps'
      ? `${rawVal.toFixed(1)} tok/s`
      : (rawVal > 0 ? `${rawVal.toFixed(2)}s` : '--');
    const isSel = focusModelKey && (key === focusModelKey || label === focusModelKey);
    return `
      <div data-duel-model="${escapeSvgText(key)}" style="cursor:pointer;padding:3px 5px;border-radius:7px;${isSel ? 'background:var(--pill-bg)' : ''}">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
          <span style="font-weight:600">${escapeSvgText(label)} <small style="color:var(--fg-3);font-weight:400">(n=${item.count || 0})</small></span>
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
  if (trendTitleEl) {
    trendTitleEl.textContent = `${focusLabel} 近 ${samples.length} 轮实测曲线`;
  }
  if (trendMedianEl) {
    trendMedianEl.textContent = `中位数 ${Number(focusItem.medianTps || 0).toFixed(1)} tok/s · TTFT ${focusItem.medianTtft != null ? focusItem.medianTtft + 's' : '--'} · n=${focusItem.count || samples.length}`;
  }

  const sampleMetric = (s) => {
    if (metric === 'tps') return Number(s.tps || 0);
    if (metric === 'ttft') return Number(s.ttftSec ?? s.ttft ?? 0);
    return Number(s.durationSec ?? s.dur ?? 0);
  };

  if (samples.length < 2) {
    const singleVal = samples[0] ? `${Number(samples[0].tps || 0).toFixed(1)} tok/s` : '--';
    trendSvg.innerHTML = `<circle cx="290" cy="44" r="4" fill="var(--accent-2)"></circle><text x="290" y="70" text-anchor="middle" fill="var(--fg-2)" font-size="11" font-family="var(--font-mono)">${escapeSvgText(singleVal)}</text>`;
    return;
  }

  const vals = samples.map(sampleMetric);
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
