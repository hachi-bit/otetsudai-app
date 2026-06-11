// child.js - 子アプリのメインロジック

// ========== 状態 ==========
let childData = null;
let setupScanner = null;
let rewardScanner = null;

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  childData = Store.getChildData();

  if (!childData) {
    showSetup();
  } else {
    showApp();
  }
});

// ========== セットアップ（親のQRをスキャンして登録） ==========
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
    statusEl.textContent = 'カメラの起動に失敗しました。カメラの許可を確認してください。';
  }
}

function onSetupScanned(data) {
  QR.stopScanner(setupScanner);
  setupScanner = null;

  if (data.t !== 'reg') {
    document.getElementById('setupStatus').textContent = 'これは登録用QRではありません。もう一度やりなおしてね。';
    return;
  }

  // 親のQRから情報を取得して子アプリをセットアップ
  Store.setRole('child');
  childData = {
    role: 'child',
    childId: data.cid,
    name: data.n,
    avatar: data.a || '⭐',
    balance: 0,
    totalEarned: 0,
    level: 1,
    history: [],
    parentId: data.pid,
    scannedSeqs: [],
  };
  Store.setChildData(childData);

  showToast(`${data.a || '⭐'} ${data.n} とうろくかんりょう！`, 'success');
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

  // プロフィール
  document.getElementById('avatarDisplay').textContent = childData.avatar;
  document.getElementById('childNameDisplay').textContent = childData.name;

  // レベル
  const level = Store.calcLevel(childData.totalEarned);
  const nextLevel = Store.getNextLevel(childData.totalEarned);
  childData.level = level.level;
  document.getElementById('levelBadge').textContent = `Lv.${level.level} ${level.title}`;

  // 残高
  document.getElementById('balanceDisplay').textContent = childData.balance.toLocaleString();

  // 経験値バー
  if (nextLevel) {
    const prevThreshold = level.threshold;
    const progress = ((childData.totalEarned - prevThreshold) / (nextLevel.threshold - prevThreshold)) * 100;
    document.getElementById('expBarFill').style.width = Math.min(100, progress) + '%';
    document.getElementById('expCurrent').textContent = `${childData.totalEarned}円`;
    document.getElementById('expNext').textContent = `つぎ: ${nextLevel.threshold}円`;
  } else {
    document.getElementById('expBarFill').style.width = '100%';
    document.getElementById('expCurrent').textContent = `${childData.totalEarned}円`;
    document.getElementById('expNext').textContent = 'MAX!';
  }

  renderRecentHistory();

  // 設定
  document.getElementById('settingsName').textContent = `${childData.avatar} ${childData.name}`;
  document.getElementById('settingsLevel').textContent = `Lv.${level.level} ${level.title}（累計 ${childData.totalEarned}円）`;
  document.getElementById('settingsParent').textContent = childData.parentId ? '接続済み ✅' : '未接続';
}

function renderRecentHistory() {
  const container = document.getElementById('recentHistory');
  const recent = [...childData.history].reverse().slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <p>まだりれきがないよ<br>おてつだいしてごほうびをもらおう！</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="history-card">${recent.map(h => `
    <div class="history-item">
      <div class="history-icon">${h.icon || '⭐'}</div>
      <div class="history-info">
        <div class="history-chore">${escHtml(h.chore)}</div>
        <div class="history-meta">${formatDate(h.timestamp)}</div>
      </div>
      <div class="history-amount">+${h.amount}円</div>
    </div>
  `).join('')}</div>`;
}

function renderFullHistory() {
  const container = document.getElementById('fullHistory');
  const all = [...childData.history].reverse();

  if (all.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <p>まだりれきがないよ</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="history-card">${all.map(h => `
    <div class="history-item">
      <div class="history-icon">${h.icon || '⭐'}</div>
      <div class="history-info">
        <div class="history-chore">${escHtml(h.chore)}</div>
        <div class="history-meta">${formatDate(h.timestamp)}</div>
      </div>
      <div class="history-amount">+${h.amount}円</div>
    </div>
  `).join('')}</div>`;
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
  QR.stopScanner(rewardScanner);
  rewardScanner = null;
  document.getElementById('scanRewardReader').innerHTML = '';
}

async function onRewardScanned(data) {
  closeScanRewardModal();

  if (data.t !== 'rwd') {
    showToast('ごほうびQRではありません', 'error');
    return;
  }

  if (data.cid !== childData.childId) {
    showToast('このQRはべつのこども用です', 'error');
    return;
  }

  // 重複スキャンチェック
  const seqKey = `${data.pid}_${data.seq}`;
  if (childData.scannedSeqs && childData.scannedSeqs.includes(seqKey)) {
    showToast('このQRはもう読み取りずみです', 'error');
    return;
  }

  // 残高加算
  const prevLevel = Store.calcLevel(childData.totalEarned);

  childData.balance += data.amt;
  childData.totalEarned += data.amt;
  childData.history.push({
    chore: data.ch, icon: data.ci || '⭐', amount: data.amt,
    timestamp: data.ts, seq: data.seq, parentId: data.pid
  });

  if (!childData.scannedSeqs) childData.scannedSeqs = [];
  childData.scannedSeqs.push(seqKey);
  Store.setChildData(childData);

  // レベルアップチェック
  const newLevel = Store.calcLevel(childData.totalEarned);
  const didLevelUp = newLevel.level > prevLevel.level;

  // 成功モーダル
  document.getElementById('receiveChore').textContent = `${data.ci || '⭐'} ${data.ch}`;
  document.getElementById('receiveAmount').textContent = `+${data.amt}円`;
  document.getElementById('receiveSuccessModal').classList.add('active');

  setTimeout(() => Confetti.burst(document.body), 200);
  if (didLevelUp) {
    setTimeout(() => Confetti.levelUp(document.body, newLevel), 1200);
  }

  render();
}

function closeReceiveSuccess() {
  document.getElementById('receiveSuccessModal').classList.remove('active');
}

// ========== タブ切り替え ==========
function showTab(tab) {
  ['home', 'history', 'settings'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = (t === tab) ? 'block' : 'none';
    const tabBtn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'history') renderFullHistory();
}

// ========== データリセット ==========
function confirmReset() {
  if (!confirm('すべてのデータを削除しますか？\nおかねやりれきも全部消えます。')) return;
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

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
