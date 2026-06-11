// parent.js - 親アプリのメインロジック

// ========== 状態 ==========
let parentData = null;
let selectedChildId = null;
let selectedChoreId = null;
let currentAmount = 0;
let childScanner = null;

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  parentData = Store.getParentData();
  if (!parentData) {
    Store.setRole('parent');
    parentData = Store.initParent();
  }
  render();
});

// ========== 描画 ==========
function render() {
  renderChildren();
  renderChores();
  renderHistory();
  renderSettings();
}

function renderChildren() {
  const container = document.getElementById('childrenList');
  if (parentData.children.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👶</div>
        <p>まだこどもが登録されていません<br>下のボタンからQRを読み取って追加しよう</p>
      </div>`;
    document.getElementById('choreSection').style.display = 'none';
    return;
  }

  container.innerHTML = parentData.children.map(child => `
    <div class="card child-card ${selectedChildId === child.childId ? 'selected' : ''}"
         onclick="selectChild('${child.childId}')">
      <div class="child-avatar">${child.avatar}</div>
      <div class="child-info">
        <div class="child-name">${escHtml(child.name)}</div>
        <div class="child-balance">送った合計: ${child.expectedBalance}円（${child.sentHistory.length}回）</div>
      </div>
      <div class="child-arrow">›</div>
    </div>
  `).join('');
}

function renderChores() {
  const grid = document.getElementById('choreGrid');
  const allChores = [...parentData.choreTemplates, ...parentData.customChores];

  grid.innerHTML = allChores.map(chore => `
    <div class="chore-item ${selectedChoreId === chore.id ? 'selected' : ''}"
         onclick="selectChore('${chore.id}')">
      <div class="chore-icon">${chore.icon}</div>
      <div class="chore-name">${escHtml(chore.name)}</div>
      <div class="chore-amount">${chore.amount}円</div>
    </div>
  `).join('');
}

function renderHistory() {
  const container = document.getElementById('historyList');
  // 全子供の送信履歴を統合して時系列逆順
  const allHistory = [];
  parentData.children.forEach(child => {
    child.sentHistory.forEach(h => {
      allHistory.push({ ...h, childName: child.name, childAvatar: child.avatar });
    });
  });
  allHistory.sort((a, b) => b.timestamp - a.timestamp);

  if (allHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>まだ送信りれきがありません</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="card">${allHistory.map(h => `
    <div class="history-item">
      <div class="history-icon">${h.icon || '⭐'}</div>
      <div class="history-info">
        <div class="history-chore">${escHtml(h.chore)}</div>
        <div class="history-meta">${h.childAvatar} ${escHtml(h.childName)} · ${formatDate(h.timestamp)}</div>
      </div>
      <div class="history-amount">+${h.amount}円</div>
    </div>
  `).join('')}</div>`;
}

function renderSettings() {
  document.getElementById('parentIdDisplay').textContent = parentData.parentId;

  // 子供リスト
  const childList = document.getElementById('settingsChildrenList');
  if (parentData.children.length === 0) {
    childList.innerHTML = '<p style="color:var(--p-text-sub);font-size:0.9rem;">登録なし</p>';
  } else {
    childList.innerHTML = parentData.children.map((child, i) => `
      <div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span style="font-size:1.5rem;">${child.avatar}</span>
        <span style="flex:1;font-weight:700;">${escHtml(child.name)}</span>
        <span style="font-size:0.8rem;color:var(--p-text-sub);">累計 ${child.expectedBalance}円</span>
        <button class="header-btn" onclick="removeChild(${i})" title="削除" style="color:var(--p-danger);">✕</button>
      </div>
    `).join('');
  }

  // お手伝いテンプレリスト
  const choreList = document.getElementById('settingsChoreList');
  const customs = parentData.customChores || [];
  if (customs.length === 0) {
    choreList.innerHTML = '<p style="color:var(--p-text-sub);font-size:0.9rem;">カスタム項目なし（デフォルトテンプレートは常に表示されます）</p>';
  } else {
    choreList.innerHTML = customs.map((ch, i) => `
      <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:1.3rem;">${ch.icon}</span>
        <span style="flex:1;font-weight:600;">${escHtml(ch.name)}</span>
        <span style="font-size:0.85rem;color:var(--p-text-sub);">${ch.amount}円</span>
        <button class="header-btn" onclick="removeCustomChore(${i})" title="削除" style="color:var(--p-danger);">✕</button>
      </div>
    `).join('');
  }
}

// ========== 子供選択 ==========
function selectChild(childId) {
  selectedChildId = childId;
  selectedChoreId = null;
  currentAmount = 0;
  document.getElementById('choreSection').style.display = 'block';
  const child = parentData.children.find(c => c.childId === childId);
  document.getElementById('choreSectionTitle').textContent = `🧹 ${child.name}のおてつだいを選ぶ`;
  document.getElementById('amountSection').style.display = 'none';
  render();
  // スクロール
  document.getElementById('choreSection').scrollIntoView({ behavior: 'smooth' });
}

// ========== お手伝い選択 ==========
function selectChore(choreId) {
  selectedChoreId = choreId;
  const allChores = [...parentData.choreTemplates, ...parentData.customChores];
  const chore = allChores.find(c => c.id === choreId);
  if (chore) {
    currentAmount = chore.amount;
    document.getElementById('amountValue').textContent = currentAmount;
    document.getElementById('amountSection').style.display = 'block';
  }
  renderChores();
}

// ========== 金額調整 ==========
function adjustAmount(delta) {
  currentAmount = Math.max(10, currentAmount + delta);
  document.getElementById('amountValue').textContent = currentAmount;
}

// ========== 報酬QR生成 ==========
async function generateRewardQR() {
  if (!selectedChildId || !selectedChoreId || currentAmount <= 0) {
    showToast('子ども・お手伝い・金額を選んでください', 'error');
    return;
  }

  const child = parentData.children.find(c => c.childId === selectedChildId);
  const allChores = [...parentData.choreTemplates, ...parentData.customChores];
  const chore = allChores.find(c => c.id === selectedChoreId);
  if (!child || !chore) return;

  const seq = child.sentHistory.length + 1;
  const timestamp = Date.now();
  const newExpectedBalance = child.expectedBalance + currentAmount;

  const hash = await OteCrypto.createRewardHash(
    parentData.parentId,
    child.childId,
    currentAmount,
    timestamp,
    seq,
    parentData.secret
  );

  const qrData = {
    t: 'rwd',
    pid: parentData.parentId,
    cid: child.childId,
    ch: chore.name,
    ci: chore.icon,
    amt: currentAmount,
    ts: timestamp,
    seq: seq,
    eb: newExpectedBalance,
    h: hash
  };

  // 履歴に追加
  child.sentHistory.push({
    chore: chore.name,
    icon: chore.icon,
    amount: currentAmount,
    timestamp: timestamp,
    seq: seq,
    hash: hash
  });
  child.expectedBalance = newExpectedBalance;
  Store.setParentData(parentData);

  // モーダル表示
  document.getElementById('rewardSummary').innerHTML = `
    <div>${child.avatar} <span class="reward-child">${escHtml(child.name)}</span></div>
    <div style="margin-top:4px;">${chore.icon} ${escHtml(chore.name)}</div>
    <div class="reward-amount" style="margin-top:8px;">${currentAmount}円</div>
  `;

  const modal = document.getElementById('rewardQRModal');
  modal.classList.add('active');

  // QR生成
  setTimeout(() => {
    QR.generate('rewardQRDisplay', qrData, 200);
  }, 100);

  // 状態リセット
  selectedChoreId = null;
  currentAmount = 0;
  document.getElementById('amountSection').style.display = 'none';
  render();
}

function closeRewardQRModal() {
  document.getElementById('rewardQRModal').classList.remove('active');
  document.getElementById('rewardQRDisplay').innerHTML = '';
}

// ========== 子供QRスキャン ==========
function openScanChildModal() {
  document.getElementById('scanChildModal').classList.add('active');
  setTimeout(async () => {
    try {
      childScanner = await QR.startScanner('scanChildReader', onChildScanned, (err) => {
        showToast(err, 'error');
        closeScanChildModal();
      });
    } catch (e) {
      showToast('カメラの起動に失敗しました', 'error');
      closeScanChildModal();
    }
  }, 300);
}

function closeScanChildModal() {
  document.getElementById('scanChildModal').classList.remove('active');
  QR.stopScanner(childScanner);
  childScanner = null;
  document.getElementById('scanChildReader').innerHTML = '';
}

function onChildScanned(data) {
  closeScanChildModal();

  if (data.t !== 'reg') {
    showToast('これは子ども登録QRではありません', 'error');
    return;
  }

  // 重複チェック
  if (parentData.children.some(c => c.childId === data.cid)) {
    showToast(`${data.n}はすでに登録されています`, 'error');
    return;
  }

  // 子供を追加
  parentData.children.push({
    childId: data.cid,
    name: data.n,
    avatar: data.a || '👦',
    registeredAt: new Date().toISOString(),
    sentHistory: [],
    expectedBalance: 0
  });
  Store.setParentData(parentData);

  showToast(`${data.a || '👦'} ${data.n}を追加しました！`, 'success');
  render();
}

// ========== カスタムお手伝い追加 ==========
function openAddChoreModal() {
  document.getElementById('newChoreIcon').value = '⭐';
  document.getElementById('newChoreName').value = '';
  document.getElementById('newChoreAmount').value = '100';
  document.getElementById('addChoreModal').classList.add('active');
}

function closeAddChoreModal() {
  document.getElementById('addChoreModal').classList.remove('active');
}

function addCustomChore() {
  const icon = document.getElementById('newChoreIcon').value.trim() || '⭐';
  const name = document.getElementById('newChoreName').value.trim();
  const amount = parseInt(document.getElementById('newChoreAmount').value) || 100;

  if (!name) {
    showToast('名前を入力してください', 'error');
    return;
  }

  if (!parentData.customChores) parentData.customChores = [];

  parentData.customChores.push({
    id: 'c_' + Date.now(),
    name: name,
    icon: icon,
    amount: Math.max(10, amount)
  });
  Store.setParentData(parentData);
  closeAddChoreModal();
  showToast(`${icon} ${name}を追加しました`, 'success');
  render();
}

function removeCustomChore(index) {
  if (!confirm('このカスタム項目を削除しますか？')) return;
  parentData.customChores.splice(index, 1);
  Store.setParentData(parentData);
  render();
}

// ========== 子供削除 ==========
function removeChild(index) {
  const child = parentData.children[index];
  if (!confirm(`${child.name}を登録から削除しますか？\n送信りれきも消えます。`)) return;
  parentData.children.splice(index, 1);
  if (selectedChildId === child.childId) {
    selectedChildId = null;
    document.getElementById('choreSection').style.display = 'none';
  }
  Store.setParentData(parentData);
  render();
}

// ========== データリセット ==========
function confirmReset() {
  if (!confirm('すべてのデータを削除しますか？\nこの操作は取り消せません。')) return;
  if (!confirm('本当に削除しますか？')) return;
  Store.clearAll();
  location.href = 'index.html';
}

// ========== タブ切り替え ==========
function showTab(tab) {
  ['home', 'history', 'settings'].forEach(t => {
    document.getElementById('tab-' + t).style.display = (t === tab) ? 'block' : 'none';
    const tabBtn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'history') renderHistory();
  if (tab === 'settings') renderSettings();
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
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}
