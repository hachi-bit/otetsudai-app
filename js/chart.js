// chart.js - 共通グラフ描画モジュール（親・子で共用）
// タップで詳細表示対応

const Chart = {

  // 描画済みデータポイントの座標を保持（タップ判定用）
  _chartData: {},

  // --- 週ごとデータ集計（日曜始まり） ---
  getWeeklyData(weeks, history) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const thisSunday = new Date(now);
    thisSunday.setDate(now.getDate() - dayOfWeek);
    thisSunday.setHours(0, 0, 0, 0);

    const result = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date(thisSunday);
      weekStart.setDate(thisSunday.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      let amount = 0, count = 0;
      history.forEach(h => {
        const ts = h.timestamp || h.ts;
        const d = new Date(ts);
        if (d >= weekStart && d <= weekEnd) { amount += (h.amount || h.amt || 0); count++; }
      });

      const m = weekStart.getMonth() + 1;
      const d = weekStart.getDate();
      result.push({ label: `${m}/${d}~`, amount, count });
    }
    return result;
  },

  // --- 月ごとデータ集計 ---
  getMonthlyData(months, history) {
    const now = new Date();
    const result = [];
    for (let m = months - 1; m >= 0; m--) {
      const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = target.getFullYear();
      const month = target.getMonth();

      let amount = 0, count = 0;
      history.forEach(h => {
        const ts = h.timestamp || h.ts;
        const d = new Date(ts);
        if (d.getFullYear() === year && d.getMonth() === month) { amount += (h.amount || h.amt || 0); count++; }
      });

      result.push({ label: `${month + 1}月`, amount, count });
    }
    return result;
  },

  // --- 週ごとグラフ描画 ---
  renderWeekly(chartId, summaryId, history) {
    const data = this.getWeeklyData(8, history);
    const thisWeek = data[data.length - 1];
    const lastWeek = data[data.length - 2];
    const diff = thisWeek.amount - lastWeek.amount;
    const diffSign = diff >= 0 ? '+' : '';
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl) {
      summaryEl.innerHTML =
        `<span style="color:var(--chart-primary, #fbbf24);font-weight:800;">今週: ${thisWeek.amount}円（${thisWeek.count}回）</span>` +
        `<span style="color:var(--chart-sub, #999);margin-left:8px;">先週比 ${diffSign}${diff}円</span>`;
    }
    this.drawChart(chartId, data);
  },

  // --- 月ごとグラフ描画 ---
  renderMonthly(chartId, summaryId, history) {
    const data = this.getMonthlyData(6, history);
    const thisMonth = data[data.length - 1];
    const lastMonth = data[data.length - 2];
    const diff = thisMonth.amount - lastMonth.amount;
    const diffSign = diff >= 0 ? '+' : '';
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl) {
      summaryEl.innerHTML =
        `<span style="color:var(--chart-primary, #fbbf24);font-weight:800;">今月: ${thisMonth.amount}円（${thisMonth.count}回）</span>` +
        `<span style="color:var(--chart-sub, #999);margin-left:8px;">先月比 ${diffSign}${diff}円</span>`;
    }
    this.drawChart(chartId, data);
  },

  // --- 共通折れ線グラフ描画（2軸：金額 + 回数）+ タップ対応 ---
  drawChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight || 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 16, right: 40, bottom: 32, left: 40 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const amounts = data.map(d => d.amount);
    const counts = data.map(d => d.count);
    const maxAmt = Math.max(...amounts, 100);
    const maxCnt = Math.max(...counts, 1);

    // テーマカラー取得
    const style = getComputedStyle(canvas);
    const gridColor = style.getPropertyValue('--chart-grid').trim() || 'rgba(200,200,200,0.2)';
    const labelColor = style.getPropertyValue('--chart-label').trim() || 'rgba(150,150,150,0.6)';
    const amtColor = style.getPropertyValue('--chart-amount').trim() || '#fbbf24';
    const cntColor = style.getPropertyValue('--chart-count').trim() || '#a78bfa';

    // グリッド線
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }

    // X軸ラベル
    ctx.fillStyle = labelColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      const x = pad.left + (cw / (data.length - 1 || 1)) * i;
      ctx.fillText(d.label, x, h - 8);
    });

    // Y軸ラベル（左: 金額）
    ctx.textAlign = 'right';
    ctx.fillStyle = amtColor + '80';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxAmt / 4 * (4 - i));
      ctx.fillText(val, pad.left - 4, pad.top + (ch / 4) * i + 3);
    }

    // Y軸ラベル（右: 回数）
    ctx.textAlign = 'left';
    ctx.fillStyle = cntColor + '80';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxCnt / 4 * (4 - i));
      ctx.fillText(val, w - pad.right + 4, pad.top + (ch / 4) * i + 3);
    }

    // データポイントの座標を記録
    const points = [];
    function calcX(i) { return pad.left + (cw / (data.length - 1 || 1)) * i; }
    function calcY(v, max) { return pad.top + ch - (v / max) * ch; }

    data.forEach((d, i) => {
      points.push({
        x: calcX(i),
        label: d.label,
        amount: d.amount,
        count: d.count
      });
    });

    // 折れ線描画
    function drawLine(values, maxVal, color) {
      if (data.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      values.forEach((v, i) => {
        const x = calcX(i);
        const y = calcY(v, maxVal);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      values.forEach((v, i) => {
        const x = calcX(i);
        const y = calcY(v, maxVal);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }

    drawLine(amounts, maxAmt, amtColor);
    drawLine(counts, maxCnt, cntColor);

    // タップ用のデータとイベント登録
    this._chartData[canvasId] = { points, pad, ch, maxAmt, maxCnt, amtColor, cntColor };
    canvas.onclick = null;
    canvas.onclick = (e) => this._onChartTap(e, canvasId);
  },

  // --- タップ時の処理 ---
  _onChartTap(e, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const chartInfo = this._chartData[canvasId];
    if (!chartInfo) return;

    // 最も近いデータポイントを探す
    let closest = null;
    let minDist = Infinity;
    chartInfo.points.forEach(p => {
      const dist = Math.abs(p.x - tapX);
      if (dist < minDist) { minDist = dist; closest = p; }
    });

    if (!closest || minDist > 40) {
      this._hideTooltip(canvasId);
      return;
    }

    // ツールチップ表示
    this._showTooltip(canvasId, closest, rect);
  },

  // --- ツールチップ表示 ---
  _showTooltip(canvasId, point, canvasRect) {
    let tooltip = document.getElementById(canvasId + '_tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = canvasId + '_tooltip';
      tooltip.style.cssText = 'position:absolute;padding:8px 12px;border-radius:8px;font-size:0.8rem;font-weight:700;pointer-events:none;z-index:50;transition:opacity 0.15s,transform 0.15s;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
      const parent = document.getElementById(canvasId).parentElement;
      parent.style.position = 'relative';
      parent.appendChild(tooltip);
    }

    const chartInfo = this._chartData[canvasId];
    const bg = getComputedStyle(document.body).backgroundColor || '#1e1650';
    tooltip.style.background = bg;
    tooltip.style.border = `1px solid ${chartInfo.amtColor}`;
    tooltip.style.color = getComputedStyle(document.body).color || '#fff';

    tooltip.innerHTML = `
      <div style="text-align:center;margin-bottom:4px;opacity:0.7;">${point.label}</div>
      <div style="color:${chartInfo.amtColor};">💰 ${point.amount}円</div>
      <div style="color:${chartInfo.cntColor};">📋 ${point.count}回</div>
    `;

    // 位置計算（canvas内の相対位置）
    const canvas = document.getElementById(canvasId);
    const parentRect = canvas.parentElement.getBoundingClientRect();
    let left = point.x - 50;
    if (left < 0) left = 0;
    if (left + 100 > canvas.clientWidth) left = canvas.clientWidth - 100;

    tooltip.style.left = left + 'px';
    tooltip.style.bottom = (canvas.clientHeight + 8) + 'px';
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';

    // 3秒後に自動非表示
    clearTimeout(tooltip._hideTimer);
    tooltip._hideTimer = setTimeout(() => this._hideTooltip(canvasId), 3000);
  },

  // --- ツールチップ非表示 ---
  _hideTooltip(canvasId) {
    const tooltip = document.getElementById(canvasId + '_tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
    }
  }
};
