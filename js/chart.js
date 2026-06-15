// chart.js - 共通グラフ描画モジュール（親・子で共用）

const Chart = {

  // --- 週ごとデータ集計 ---
  getWeeklyData(weeks, history) {
    const now = new Date();
    const result = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - w * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

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

  // --- 共通折れ線グラフ描画（2軸：金額 + 回数） ---
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

    // テーマカラー取得（CSS変数 or デフォルト）
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

    // 折れ線描画
    function drawLine(values, maxVal, color) {
      if (data.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      values.forEach((v, i) => {
        const x = pad.left + (cw / (data.length - 1)) * i;
        const y = pad.top + ch - (v / maxVal) * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // ドット
      values.forEach((v, i) => {
        const x = pad.left + (cw / (data.length - 1)) * i;
        const y = pad.top + ch - (v / maxVal) * ch;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }

    drawLine(amounts, maxAmt, amtColor);
    drawLine(counts, maxCnt, cntColor);
  }
};
