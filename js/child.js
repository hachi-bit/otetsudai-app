// child.js - 子アプリのメインロジック（複数親対応）

let childData = null;
let setupScanner = null;
let rewardScanner = null;
let addParentScanner = null;
const AVATARS = ['🦁','🐱','🐶','🐰','🦊','🐼','🐸','🐧','🦄','🐲','🌟','🚀'];

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  childData = Store.getChildData();
  if (!childData) {
    showSetup();
  } else {
    showApp();
  }
});

// ========== セットアップ（親のQRをスキャンして初回登録） ==========
function showSetup() {
  document.getElementById('setupScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

async function startSetupScan() {
  const statusEl = document.getElementById('setupStatus');
  statusEl.textContent = 'カメラを起動しています...';
  try {
    setupScanner = await QR.startScanner('setupScanArea', onSetupScanned, (err) => {
      statusEl.textContent = err;
    });
  } catch (e) {
    statusEl.textContent = 'カメラの起動に失敗しました。';
  }
}

function onSetupScanned(data) {
  QR.stopScanner(setupScanner); setupScanner = null;

  if (data.t !== 'reg' && data.t !== 'restore') {
    document.getElementById('setupStatus').textContent = 'これは登録用QRではありません。もう一度やりなおしてね。';
    return;
  }

  const balance = data.bal || 0;
  const isRestore = data.t === 'restore';
  Store.setRole('child');
  childData = {
    role: 'child',
    childId: data.cid,
    name: data.n,
    avatar: data.a || '⭐',
    balance: balance,
    totalEarned: balance,
    level: 1,
    history: [],
    parents: [{ pid: data.pid, name: data.pn || '親' }],
    familyToken: data.ft,
    scannedSeqs: [],
    restoredAt: isRestore ? Date.now() : null,
  };
  Store.setChildData(childData);

  const msg = data.t === 'restore'
    ? `${data.a || '⭐'} ${data.n} を復元しました！（残高: ${balance}円）`
    : `${data.a || '⭐'} ${data.n} とうろくかんりょう！`;
  showToast(msg, 'success');
  showApp();
}

// ========== アプリ表示 ==========
function showApp() {
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  render();
}

// ========== 描画 ==========
function render() {
  if (!childData) return;

  document.getElementById('avatarDisplay').textContent = childData.avatar;
  document.getElementById('childNameDisplay').textContent = childData.name;

  const level = Store.calcLevel(childData.totalEarned);
  const nextLevel = Store.getNextLevel(childData.totalEarned);
  childData.level = level.level;
  document.getElementById('levelBadge').textContent = `Lv.${level.level} ${level.title}`;
  document.getElementById('balanceDisplay').textContent = childData.balance.toLocaleString();

  if (nextLevel) {
    const progress = ((childData.totalEarned - level.threshold) / (nextLevel.threshold - level.threshold)) * 100;
    document.getElementById('expBarFill').style.width = Math.min(100, progress) + '%';
    document.getElementById('expCurrent').textContent = `${childData.totalEarned}円`;
    document.getElementById('expNext').textContent = `つぎ: ${nextLevel.threshold}円`;
  } else {
    document.getElementById('expBarFill').style.width = '100%';
    document.getElementById('expCurrent').textContent = `${childData.totalEarned}円`;
    document.getElementById('expNext').textContent = 'MAX!';
  }

  renderRecentHistory();
  renderSettings();
}

function renderRecentHistory() {
  const container = document.getElementById('recentHistory');
  const recent = [...childData.history].reverse().slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><p>まだりれきがないよ<br>おてつだいしてごほうびをもらおう！</p></div>';
    return;
  }
  container.innerHTML = `<div class="history-card">${recent.map(h => historyItemHTML(h)).join('')}</div>`;
}

function renderFullHistory() {
  const container = document.getElementById('fullHistory');
  const all = [...childData.history].reverse();
  if (all.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><p>まだりれきがないよ</p></div>';
    return;
  }
  container.innerHTML = `<div class="history-card">${all.map(h => historyItemHTML(h)).join('')}</div>`;
}

function historyItemHTML(h) {
  const parentName = getParentName(h.parentId);
  return `<div class="history-item">
    <div class="history-icon">${h.icon || '⭐'}</div>
    <div class="history-info">
      <div class="history-chore">${escHtml(h.chore)}</div>
      <div class="history-meta">${parentName ? escHtml(parentName) + ' · ' : ''}${formatDate(h.timestamp)}</div>
    </div>
    <div class="history-amount">+${h.amount}円</div>
  </div>`;
}

function renderSettings() {
  const level = Store.calcLevel(childData.totalEarned);
  document.getElementById('settingsName').textContent = `${childData.avatar} ${childData.name}`;
  document.getElementById('settingsLevel').textContent = `Lv.${level.level} ${level.title}（累計 ${childData.totalEarned}円）`;

  // アバターピッカー
  const picker = document.getElementById('settingsAvatarPicker');
  picker.innerHTML = AVATARS.map(a => `
    <div style="font-size:1.8rem;width:48px;height:48px;display:flex;align-items:center;justify-content:center;
      background:${a === childData.avatar ? 'rgba(251,191,36,0.2)' : 'var(--c-surface)'};
      border:2px solid ${a === childData.avatar ? 'var(--c-primary)' : 'var(--c-border)'};
      border-radius:50%;cursor:pointer;" onclick="changeAvatar('${a}')">${a}</div>
  `).join('');

  const parentList = document.getElementById('settingsParentList');
  if (!childData.parents || childData.parents.length === 0) {
    parentList.innerHTML = '<p style="font-weight:700;">未接続</p>';
  } else {
    parentList.innerHTML = childData.parents.map(p =>
      `<p style="font-weight:700;margin-bottom:4px;">✅ ${escHtml(p.name)}</p>`
    ).join('');
  }
}

function changeAvatar(avatar) {
  childData.avatar = avatar;
  Store.setChildData(childData);
  render();
  showToast(`アバターを ${avatar} にへんこうしました！`, 'success');
}

function getParentName(pid) {
  if (!childData.parents || !pid) return null;
  const p = childData.parents.find(x => x.pid === pid);
  return p ? p.name : null;
}

// ========== 親追加（設定から） ==========
function openAddParentScan() {
  document.getElementById('addParentModal').classList.add('active');
  setTimeout(async () => {
    try {
      addParentScanner = await QR.startScanner('addParentReader', onAddParentScanned, (err) => {
        showToast(err, 'error');
        closeAddParentScan();
      });
    } catch (e) {
      showToast('カメラの起動に失敗しました', 'error');
      closeAddParentScan();
    }
  }, 300);
}

function closeAddParentScan() {
  document.getElementById('addParentModal').classList.remove('active');
  QR.stopScanner(addParentScanner); addParentScanner = null;
  document.getElementById('addParentReader').innerHTML = '';
}

function onAddParentScanned(data) {
  closeAddParentScan();

  if (data.t !== 'reg' && data.t !== 'restore') {
    showToast('これは登録用QRではありません', 'error');
    return;
  }

  if (data.cid !== childData.childId) {
    showToast('このQRはべつのこども用です', 'error');
    return;
  }

  if (data.ft !== childData.familyToken) {
    showToast('ファミリートークンが一致しません。正しい共有QRから登録してください。', 'error');
    return;
  }

  if (childData.parents.some(p => p.pid === data.pid)) {
    showToast(`${data.pn || '親'}はすでに登録されています`, 'error');
    return;
  }

  childData.parents.push({ pid: data.pid, name: data.pn || '親' });

  // 復元QRの場合は残高を加算 + restoredAt更新
  if (data.t === 'restore' && data.bal > 0) {
    childData.balance += data.bal;
    childData.totalEarned += data.bal;
    childData.restoredAt = Date.now();
    showToast(`${data.pn || '親'}を追加し、${data.bal}円を復元しました！`, 'success');
  } else {
    showToast(`${data.pn || '親'}を追加しました！`, 'success');
  }

  Store.setChildData(childData);
  render();
}

// ========== 報酬QRスキャン ==========
function openScanRewardModal() {
  document.getElementById('scanRewardModal').classList.add('active');
  setTimeout(async () => {
    try {
      rewardScanner = await QR.startScanner('scanRewardReader', onRewardScanned, (err) => {
        showToast(err, 'error');
        closeScanRewardModal();
      });
    } catch (e) {
      showToast('カメラの起動に失敗しました', 'error');
      closeScanRewardModal();
    }
  }, 300);
}

function closeScanRewardModal() {
  document.getElementById('scanRewardModal').classList.remove('active');
  QR.stopScanner(rewardScanner); rewardScanner = null;
  document.getElementById('scanRewardReader').innerHTML = '';
}

async function onRewardScanned(data) {
  closeScanRewardModal();

  // childIdチェック（共通）
  if (data.cid && data.cid !== childData.childId) {
    showToast('このQRはべつのこども用です', 'error');
    return;
  }

  // 単品QR
  if (data.t === 'rwd') {
    return processRewardItems([{
      ch: data.ch, ci: data.ci, amt: data.amt, seq: data.seq, ts: data.ts
    }], data.pid, data.pn);
  }

  // バッチQR
  if (data.t === 'batch' && Array.isArray(data.items)) {
    return processRewardItems(data.items, data.pid, data.pn);
  }

  showToast('ごほうびQRではありません', 'error');
}

async function processRewardItems(items, pid, pn) {
  // 登録済み親チェック
  if (!childData.parents.some(p => p.pid === pid)) {
    showToast('登録されていないおやからのQRです', 'error');
    return;
  }

  // 受取済み & 復元前をフィルタ
  const newItems = items.filter(it => {
    const seqKey = `${pid}_${it.seq}`;
    if (childData.scannedSeqs && childData.scannedSeqs.includes(seqKey)) return false;
    // 復元後は、復元日時より前の報酬を弾く
    if (childData.restoredAt && it.ts < childData.restoredAt) return false;
    return true;
  });

  if (!newItems.length) {
    showToast('すべて受取ずみです', 'error');
    return;
  }

  const prevLevel = Store.calcLevel(childData.totalEarned);
  let totalAdded = 0;

  newItems.forEach(it => {
    childData.balance += it.amt;
    childData.totalEarned += it.amt;
    totalAdded += it.amt;
    childData.history.push({
      chore: it.ch, icon: it.ci || '⭐', amount: it.amt,
      timestamp: it.ts, seq: it.seq, parentId: pid, parentName: pn
    });
    if (!childData.scannedSeqs) childData.scannedSeqs = [];
    childData.scannedSeqs.push(`${pid}_${it.seq}`);
  });

  Store.setChildData(childData);

  const newLevel = Store.calcLevel(childData.totalEarned);
  const didLevelUp = newLevel.level > prevLevel.level;
  const skipped = items.length - newItems.length;

  // 成功モーダル表示
  let detailHtml = '';
  if (newItems.length === 1) {
    document.getElementById('receiveChore').textContent = `${newItems[0].ci || '⭐'} ${newItems[0].ch}`;
    document.getElementById('receiveAmount').textContent = `+${newItems[0].amt}円`;
  } else {
    document.getElementById('receiveChore').innerHTML =
      newItems.map(it => `<div style="display:flex;justify-content:space-between;font-size:0.95rem;margin:2px 0;"><span>${it.ci || '⭐'} ${it.ch}</span><span>+${it.amt}円</span></div>`).join('');
    document.getElementById('receiveAmount').textContent = `合計 +${totalAdded}円`;
  }

  if (skipped > 0) {
    document.getElementById('receiveChore').innerHTML += `<div style="font-size:0.8rem;color:var(--c-text-sub);margin-top:8px;">（${skipped}件は受取ずみのためスキップ）</div>`;
  }

  document.getElementById('receiveSuccessModal').classList.add('active');
  setTimeout(() => Confetti.burst(document.body), 200);
  if (didLevelUp) setTimeout(() => Confetti.levelUp(document.body, newLevel), 1200);

  render();
}

function closeReceiveSuccess() {
  document.getElementById('receiveSuccessModal').classList.remove('active');
}

// ========== タブ切り替え ==========
function showTab(tab) {
  ['home','history','settings','chart'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = (t === tab) ? 'block' : 'none';
    const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'history') renderFullHistory();
  if (tab === 'chart') renderCharts();
}

// ========== データリセット ==========
function confirmReset() {
  if (!confirm('すべてのアカウントデータを削除しますか？\nおかね・りれきも全部消えます。')) return;
  if (!confirm('本当に？')) return;
  Store.clearAll();
  location.href = 'index.html';
}

// ========== ユーティリティ ==========
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  setTimeout(() => el.classList.remove('show'), 2500);
}
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// ========== グラフ描画 ==========

function renderCharts() {
  if (!childData || !childData.history) return;
  renderWeeklyChart();
  renderMonthlyChart();
}

// --- 週ごとデータ集計 ---
function getWeeklyData(weeks) {
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
    childData.history.forEach(h => {
      const d = new Date(h.timestamp);
      if (d >= weekStart && d <= weekEnd) { amount += h.amount; count++; }
    });

    const m = weekStart.getMonth() + 1;
    const d = weekStart.getDate();
    result.push({ label: `${m}/${d}~`, amount, count });
  }
  return result;
}

// --- 月ごとデータ集計 ---
function getMonthlyData(months) {
  const now = new Date();
  const result = [];
  for (let m = months - 1; m >= 0; m--) {
    const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = target.getFullYear();
    const month = target.getMonth();

    let amount = 0, count = 0;
    childData.history.forEach(h => {
      const d = new Date(h.timestamp);
      if (d.getFullYear() === year && d.getMonth() === month) { amount += h.amount; count++; }
    });

    result.push({ label: `${month + 1}月`, amount, count });
  }
  return result;
}

// --- 週ごとグラフ描画 ---
function renderWeeklyChart() {
  const data = getWeeklyData(8);
  const thisWeek = data[data.length - 1];
  const lastWeek = data[data.length - 2];
  const diff = thisWeek.amount - lastWeek.amount;
  const diffSign = diff >= 0 ? '+' : '';
  document.getElementById('weeklyChartSummary').innerHTML =
    `<span style="color:var(--c-primary);font-weight:800;">今週: ${thisWeek.amount}円（${thisWeek.count}回）</span>` +
    `<span style="color:var(--c-text-sub);margin-left:8px;">先週比 ${diffSign}${diff}円</span>`;
  drawChart('weeklyChart', data);
}

// --- 月ごとグラフ描画 ---
function renderMonthlyChart() {
  const data = getMonthlyData(6);
  const thisMonth = data[data.length - 1];
  const lastMonth = data[data.length - 2];
  const diff = thisMonth.amount - lastMonth.amount;
  const diffSign = diff >= 0 ? '+' : '';
  document.getElementById('monthlyChartSummary').innerHTML =
    `<span style="color:var(--c-primary);font-weight:800;">今月: ${thisMonth.amount}円（${thisMonth.count}回）</span>` +
    `<span style="color:var(--c-text-sub);margin-left:8px;">先月比 ${diffSign}${diff}円</span>`;
  drawChart('monthlyChart', data);
}

// --- 共通グラフ描画（2軸折れ線） ---
function drawChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // 高解像度対応
  const w = canvas.clientWidth;
  const h = canvas.clientHeight || 200;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // 描画領域
  const pad = { top: 16, right: 40, bottom: 32, left: 40 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  // クリア
  ctx.clearRect(0, 0, w, h);

  const amounts = data.map(d => d.amount);
  const counts = data.map(d => d.count);
  const maxAmt = Math.max(...amounts, 100);
  const maxCnt = Math.max(...counts, 1);

  // グリッド線
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
  }

  // X軸ラベル
  ctx.fillStyle = 'rgba(240,236,255,0.4)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    const x = pad.left + (cw / (data.length - 1 || 1)) * i;
    ctx.fillText(d.label, x, h - 8);
  });

  // Y軸ラベル（左: 金額）
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(251,191,36,0.5)';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxAmt / 4 * (4 - i));
    const y = pad.top + (ch / 4) * i;
    ctx.fillText(val, pad.left - 4, y + 3);
  }

  // Y軸ラベル（右: 回数）
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(167,139,250,0.5)';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxCnt / 4 * (4 - i));
    const y = pad.top + (ch / 4) * i;
    ctx.fillText(val, w - pad.right + 4, y + 3);
  }

  // 折れ線描画関数
  function drawLine(values, maxVal, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    values.forEach((v, i) => {
      const x = pad.left + (cw / (data.length - 1 || 1)) * i;
      const y = pad.top + ch - (v / maxVal) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ドット
    values.forEach((v, i) => {
      const x = pad.left + (cw / (data.length - 1 || 1)) * i;
      const y = pad.top + ch - (v / maxVal) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // 金額ライン（ゴールド）
  drawLine(amounts, maxAmt, '#fbbf24');
  // 回数ライン（パープル）
  drawLine(counts, maxCnt, '#a78bfa');
}
