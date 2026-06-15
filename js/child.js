// child.js - 子アプリのメインロジック（複数親対応）

let childData = null;
let setupScanner = null;
let rewardScanner = null;
let addParentScanner = null;
const AVATARS = ['🦁','🐱','🐶','🐰','🦊','🐼','🐸','🐧','🦄','🐲','🌟','🚀'];

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  childData = Store.getChildData();

  // URLハッシュにQRデータがあるかチェック
  const hash = window.location.hash.substring(1);
  if (hash) {
    // ハッシュをクリア（履歴に残さない）
    history.replaceState(null, '', window.location.pathname);
    try {
      const data = QR.parseQRText(hash.startsWith('http') ? hash : 'x#' + hash);
      // ↑ hashだけの場合はparseQRTextのBase64パスで処理
      handleIncomingQR(data);
      return;
    } catch(e) {
      // ハッシュ解析失敗 → 通常フローへ
      try {
        const jsonStr = QR.fromBase64(hash);
        const data = JSON.parse(jsonStr);
        handleIncomingQR(data);
        return;
      } catch(e2) {}
    }
  }

  // 通常フロー
  if (!childData) showSetup();
  else showApp();
});

// ========== URL経由のQRデータ処理 ==========
function handleIncomingQR(data) {
  if (!data || !data.t) { normalBoot(); return; }

  // 登録・復元QR
  if (data.t === 'reg' || data.t === 'restore') {
    if (!childData) {
      // 初回登録
      onSetupScanned(data);
    } else if (data.cid === childData.childId) {
      // 追加の親
      showApp();
      onAddParentScanned(data);
    } else {
      showApp();
      showToast('このQRはべつのこども用です', 'error');
    }
    return;
  }

  // 報酬・バッチQR
  if (data.t === 'rwd' || data.t === 'batch') {
    if (!childData) {
      showSetup();
      showToast('まず登録をしてね', 'error');
      return;
    }
    showApp();
    // 少し遅延させてUIが描画されてから処理
    setTimeout(() => onRewardScanned(data), 300);
    return;
  }

  normalBoot();
}

function normalBoot() {
  if (!childData) showSetup();
  else showApp();
}

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
  document.getElementById('childVersionDisplay').textContent = `おてつだい手帳 ${APP_VERSION}`;

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
  Chart.renderWeekly('weeklyChart', 'weeklyChartSummary', childData.history);
  Chart.renderMonthly('monthlyChart', 'monthlyChartSummary', childData.history);
}
