// child.js - 子アプリのメインロジック（複数親対応）

let childData = null;
let setupScanner = null;
let rewardScanner = null;
let addParentScanner = null;
const AVATARS = ['🦁','🐱','🐶','🐰','🦊','🐼','🐸','🐧','🦄','🐲','🌟','🚀'];

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  childData = Store.getChildData();
  if (processUrlHash()) return;
  if (!childData) showSetup();
  else showApp();
});

// ハッシュ変更時も処理（アプリ開いたままURLが開かれた場合）
window.addEventListener('hashchange', () => {
  processUrlHash();
});

function processUrlHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return false;
  history.replaceState(null, '', window.location.pathname);
  try {
    const jsonStr = QR.fromBase64(hash);
    const data = JSON.parse(jsonStr);
    handleIncomingQR(data);
    return true;
  } catch(e) {
    console.error('Hash parse failed:', e);
    return false;
  }
}

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
    setTimeout(() => onRewardScanned(data), 300);
    return;
  }

  // 称号レベル同期QR
  if (data.t === 'levels') {
    if (!childData) { showSetup(); showToast('まず登録をしてね', 'error'); return; }
    showApp();
    applyLevelsFromQR(data);
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
    levels: JSON.parse(JSON.stringify(Store.DEFAULT_LEVELS)),
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

  const level = Store.calcLevel(childData.totalEarned, getChildLevels());
  const nextLevel = Store.getNextLevel(childData.totalEarned, getChildLevels());
  childData.level = level.level;
  document.getElementById('levelBadge').textContent = `${level.icon || '🏆'} Lv.${level.level} ${level.title}`;
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
  renderTrophies();
}

function renderTrophies() {
  const shelf = document.getElementById('trophyShelf');
  if (!shelf || !childData) return;
  const earned = childData.totalEarned || 0;
  const levels = getChildLevels() || Store.DEFAULT_LEVELS;
  // threshold=0（初期称号）は棚に並べる必要がないので除外
  const displayLevels = levels.filter(lv => lv.threshold > 0);

  if (displayLevels.length === 0) { shelf.innerHTML = ''; return; }

  // 現在の到達段階（最後にクリアしたトロフィーのインデックス）を求める
  let currentIndex = -1;
  displayLevels.forEach((lv, i) => { if (earned >= lv.threshold) currentIndex = i; });
  if (currentIndex === -1) currentIndex = 0; // まだ1つも達成してなければ先頭を基準に

  // 現在地を中心に5個のウィンドウを計算（端では詰めてスライド）
  const WINDOW = 5;
  const total = displayLevels.length;
  let start = currentIndex - Math.floor(WINDOW / 2);
  start = Math.max(0, Math.min(start, total - WINDOW));
  if (start < 0) start = 0;
  const end = Math.min(total, start + WINDOW);
  const visible = displayLevels.slice(start, end);

  shelf.innerHTML = visible.map(lv => {
    const unlocked = earned >= lv.threshold;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;
      opacity:${unlocked ? '1' : '0.25'};
      filter:${unlocked ? 'none' : 'grayscale(1)'};
      transition:all 0.3s;">
      <span style="font-size:2rem;${unlocked ? 'animation:trophyPulse 2s ease infinite;' : ''}">${lv.icon || '🏆'}</span>
      <span style="font-size:0.6rem;color:${unlocked ? 'var(--c-primary)' : 'var(--c-text-sub)'};font-weight:700;">${esc(lv.title)}</span>
      <span style="font-size:0.55rem;color:var(--c-text-sub);">${lv.threshold}円</span>
    </div>`;
  }).join('');
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
  const level = Store.calcLevel(childData.totalEarned, getChildLevels());
  document.getElementById('settingsName').textContent = `${childData.avatar} ${childData.name}`;
  document.getElementById('settingsLevel').textContent = `${level.icon || '🏆'} Lv.${level.level} ${level.title}（累計 ${childData.totalEarned}円）`;
  document.getElementById('childVersionDisplay').textContent = `おてつだい手帳 ${APP_VERSION}`;

  // 称号一覧表示
  const levelsInfo = document.getElementById('settingsLevelsInfo');
  if (levelsInfo) {
    const cl = getChildLevels() || Store.DEFAULT_LEVELS;
    levelsInfo.innerHTML = cl.map(lv => {
      const unlocked = childData.totalEarned >= lv.threshold;
      return `<div style="opacity:${unlocked ? '1' : '0.5'};margin-bottom:2px;">${lv.icon || '🏆'} Lv${lv.level} ${esc(lv.title)}（${lv.threshold}円〜）${unlocked ? ' ✓' : ''}</div>`;
    }).join('');
  }

  // アイコンピッカー
  const picker = document.getElementById('settingsAvatarPicker');
  let avatarHtml = AVATARS.map(a => `
    <div style="font-size:1.8rem;width:48px;height:48px;display:flex;align-items:center;justify-content:center;
      background:${a === childData.avatar ? 'rgba(251,191,36,0.2)' : 'var(--c-surface)'};
      border:2px solid ${a === childData.avatar ? 'var(--c-primary)' : 'var(--c-border)'};
      border-radius:50%;cursor:pointer;" onclick="changeAvatar('${a}')">${a}</div>
  `).join('');

  avatarHtml += `
    <div style="width:100%;margin-top:8px;text-align:center;">
      <p style="font-size:0.75rem;color:var(--c-text-sub);margin-bottom:6px;">すきなえもじをアイコンにできるよ！</p>
      <div style="display:flex;gap:8px;justify-content:center;align-items:center;">
        <input type="text" id="customEmojiInput" maxlength="2" placeholder="😎"
          style="width:56px;height:56px;font-size:2rem;text-align:center;border-radius:50%;
          background:var(--c-surface);border:2px solid var(--c-border);color:var(--c-text);">
        <button onclick="applyCustomEmoji()" style="background:var(--c-primary);color:#1e1650;border:none;
          padding:8px 16px;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;">けってい</button>
      </div>
    </div>`;
  picker.innerHTML = avatarHtml;

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
  showToast(`アイコンを ${avatar} にへんこうしました！`, 'success');
}

function applyCustomEmoji() {
  const input = document.getElementById('customEmojiInput');
  if (!input) return;
  const emoji = input.value.trim();
  if (!emoji) { showToast('えもじを入力してね','error'); return; }
  childData.avatar = emoji;
  Store.setChildData(childData);
  render();
  showToast(`アイコンを ${emoji} にへんこうしました！`, 'success');
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

  const prevLevel = Store.calcLevel(childData.totalEarned, getChildLevels());
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

  const newLevel = Store.calcLevel(childData.totalEarned, getChildLevels());
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
  setTimeout(() => Confetti.burst(document.body, totalAdded), 200);

  // レベルアップ（称号獲得）演出
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
  if (!childData) return;
  const input = prompt(`アカウントを削除するには「${childData.name}」と入力してください`);
  if (input === null) return;
  if (input.trim() !== childData.name) { showToast('名前が一致しません','error'); return; }
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

// ========== 称号レベル同期 ==========

function applyLevelsFromQR(data) {
  if (!data.items || !Array.isArray(data.items)) { showToast('称号データが不正です','error'); return; }

  // 既存の称号（なければデフォルトから開始）
  const existing = (childData.levels && childData.levels.length > 0)
    ? [...childData.levels]
    : JSON.parse(JSON.stringify(Store.DEFAULT_LEVELS));

  let added = 0, updated = 0;
  data.items.forEach(it => {
    const icon = it.ic || '🏆';
    const idx = existing.findIndex(lv => lv.threshold === it.th);
    if (idx >= 0) {
      // 同じ金額の称号が既にある → 上書き
      existing[idx].title = it.ti;
      existing[idx].icon = icon;
      updated++;
    } else {
      // 新規追加
      existing.push({ level: 0, threshold: it.th, title: it.ti, icon });
      added++;
    }
  });

  // 金額順にソート → レベル番号を振り直す
  existing.sort((a, b) => a.threshold - b.threshold);
  existing.forEach((lv, i) => lv.level = i + 1);

  childData.levels = existing;
  Store.setChildData(childData);

  const parts = [];
  if (added > 0) parts.push(`${added}件追加`);
  if (updated > 0) parts.push(`${updated}件更新`);
  showToast(`称号を同期しました！（${parts.join('・')}）`, 'success');
  render();
}

// --- アプリ内称号スキャン ---
let levelsScanner = null;
function openLevelsScan() {
  document.getElementById('levelsScanModal').classList.add('active');
  setTimeout(async () => {
    try {
      levelsScanner = await QR.startScanner('levelsScanReader', onLevelsScanned, (err) => {
        showToast(err,'error'); closeLevelsScan();
      });
    } catch(e) { showToast('カメラ起動失敗','error'); closeLevelsScan(); }
  }, 300);
}
function closeLevelsScan() {
  document.getElementById('levelsScanModal').classList.remove('active');
  QR.stopScanner(levelsScanner); levelsScanner = null;
  document.getElementById('levelsScanReader').innerHTML = '';
}
function onLevelsScanned(data) {
  closeLevelsScan();
  if (data.t !== 'levels') { showToast('称号QRではありません','error'); return; }
  applyLevelsFromQR(data);
}

function getChildLevels() {
  // 旧データ（levels: null）の移行対応
  if (childData && (!childData.levels || childData.levels.length === 0)) {
    childData.levels = JSON.parse(JSON.stringify(Store.DEFAULT_LEVELS));
    Store.setChildData(childData);
  }
  return childData ? childData.levels : null;
}

// ========== グラフ描画 ==========

function renderCharts() {
  if (!childData || !childData.history) return;
  Chart.renderWeekly('weeklyChart', 'weeklyChartSummary', childData.history);
  Chart.renderMonthly('monthlyChart', 'monthlyChartSummary', childData.history);
}
