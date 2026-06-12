// parent.js - 親アプリのメインロジック（複数親対応）

const CHILD_AVATARS = ['🦁','🐱','🐶','🐰','🦊','🐼','🐸','🐧','🦄','🐲','🌟','🚀'];

let parentData = null;
let selectedChildId = null;
let selectedChoreId = null;
let currentAmount = 0;
let selectedAvatar = CHILD_AVATARS[0];
let shareScanner = null;

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  parentData = Store.getParentData();
  if (!parentData) {
    document.getElementById('setupScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
  } else {
    showApp();
  }
});

// ========== 親セットアップ ==========
function completeParentSetup() {
  const name = document.getElementById('setupParentName').value.trim();
  if (!name) { showToast('名前を入力してください', 'error'); return; }
  Store.setRole('parent');
  parentData = Store.initParent(name);
  showApp();
}

function showApp() {
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  render();
}

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
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">👶</div><p>まだこどもが登録されていません<br>下のボタンから追加しよう</p></div>';
    document.getElementById('choreSection').style.display = 'none';
    return;
  }
  container.innerHTML = parentData.children.map(child => `
    <div class="card child-card ${selectedChildId === child.childId ? 'selected' : ''}" onclick="selectChild('${child.childId}')">
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
    <div class="chore-item ${selectedChoreId === chore.id ? 'selected' : ''}" onclick="selectChore('${chore.id}')">
      <div class="chore-icon">${chore.icon}</div>
      <div class="chore-name">${escHtml(chore.name)}</div>
      <div class="chore-amount">${chore.amount}円</div>
    </div>
  `).join('');
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const allHistory = [];
  parentData.children.forEach(child => {
    child.sentHistory.forEach(h => allHistory.push({ ...h, childName: child.name, childAvatar: child.avatar }));
  });
  allHistory.sort((a, b) => b.timestamp - a.timestamp);
  if (allHistory.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>まだ送信りれきがありません</p></div>';
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
  document.getElementById('parentNameDisplay').textContent = parentData.parentName;
  document.getElementById('parentIdDisplay').textContent = parentData.parentId;

  const childList = document.getElementById('settingsChildrenList');
  if (parentData.children.length === 0) {
    childList.innerHTML = '<p style="color:var(--p-text-sub);font-size:0.9rem;">登録なし</p>';
  } else {
    childList.innerHTML = parentData.children.map((child, i) => `
      <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:1.5rem;">${child.avatar}</span>
        <span style="flex:1;font-weight:700;">${escHtml(child.name)}</span>
        <span style="font-size:0.8rem;color:var(--p-text-sub);">累計 ${child.expectedBalance}円</span>
        <div style="width:100%;display:flex;gap:8px;margin-top:4px;">
          <button class="btn btn-secondary" style="flex:1;padding:8px;font-size:0.8rem;" onclick="openShareChildModal(${i})">👨‍👩‍👧 共有</button>
          <button class="btn btn-danger" style="padding:8px;font-size:0.8rem;" onclick="removeChild(${i})">削除</button>
        </div>
      </div>
    `).join('');
  }

  const choreList = document.getElementById('settingsChoreList');
  const customs = parentData.customChores || [];
  if (customs.length === 0) {
    choreList.innerHTML = '<p style="color:var(--p-text-sub);font-size:0.9rem;">カスタム項目なし</p>';
  } else {
    choreList.innerHTML = customs.map((ch, i) => `
      <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:1.3rem;">${ch.icon}</span>
        <span style="flex:1;font-weight:600;">${escHtml(ch.name)}</span>
        <span style="font-size:0.85rem;color:var(--p-text-sub);">${ch.amount}円</span>
        <button class="header-btn" onclick="removeCustomChore(${i})" style="color:var(--p-danger);">✕</button>
      </div>
    `).join('');
  }
}

// ========== 子供選択 & お手伝い選択 ==========
function selectChild(childId) {
  selectedChildId = childId;
  selectedChoreId = null;
  currentAmount = 0;
  document.getElementById('choreSection').style.display = 'block';
  const child = parentData.children.find(c => c.childId === childId);
  document.getElementById('choreSectionTitle').textContent = `🧹 ${child.name}のおてつだいを選ぶ`;
  document.getElementById('amountSection').style.display = 'none';
  render();
  document.getElementById('choreSection').scrollIntoView({ behavior: 'smooth' });
}

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
  const hash = await OteCrypto.createRewardHash(parentData.parentId, child.childId, currentAmount, timestamp, seq, parentData.secret);

  const qrData = {
    t: 'rwd', pid: parentData.parentId, pn: parentData.parentName,
    cid: child.childId, ch: chore.name, ci: chore.icon,
    amt: currentAmount, ts: timestamp, seq: seq, eb: newExpectedBalance, h: hash
  };

  child.sentHistory.push({ chore: chore.name, icon: chore.icon, amount: currentAmount, timestamp, seq, hash });
  child.expectedBalance = newExpectedBalance;
  Store.setParentData(parentData);

  document.getElementById('rewardSummary').innerHTML = `
    <div>${child.avatar} <span class="reward-child">${escHtml(child.name)}</span></div>
    <div style="margin-top:4px;">${chore.icon} ${escHtml(chore.name)}</div>
    <div class="reward-amount" style="margin-top:8px;">${currentAmount}円</div>`;
  document.getElementById('rewardQRModal').classList.add('active');
  setTimeout(() => QR.generate('rewardQRDisplay', qrData, 200), 100);

  selectedChoreId = null; currentAmount = 0;
  document.getElementById('amountSection').style.display = 'none';
  render();
}

function closeRewardQRModal() {
  document.getElementById('rewardQRModal').classList.remove('active');
  document.getElementById('rewardQRDisplay').innerHTML = '';
}

// ========== こども追加モーダル ==========
function openAddChildModal() {
  hideAllAddChildSteps();
  document.getElementById('addChildStep0').style.display = 'block';
  document.getElementById('addChildModal').classList.add('active');
}

function closeAddChildModal() {
  document.getElementById('addChildModal').classList.remove('active');
  document.getElementById('childRegQRDisplay').innerHTML = '';
  QR.stopScanner(shareScanner); shareScanner = null;
  document.getElementById('shareChildReader').innerHTML = '';
}

function backToStep0() {
  hideAllAddChildSteps();
  document.getElementById('addChildStep0').style.display = 'block';
  QR.stopScanner(shareScanner); shareScanner = null;
  document.getElementById('shareChildReader').innerHTML = '';
}

function hideAllAddChildSteps() {
  ['addChildStep0','addChildStep1New','addChildStep1Existing','addChildStep2'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

// --- 新規こども ---
function showAddChildNew() {
  selectedAvatar = CHILD_AVATARS[0];
  document.getElementById('newChildName').value = '';
  hideAllAddChildSteps();
  document.getElementById('addChildStep1New').style.display = 'block';
  renderAvatarPicker();
}

function renderAvatarPicker() {
  const picker = document.getElementById('childAvatarPicker');
  picker.innerHTML = CHILD_AVATARS.map(a => `
    <div style="font-size:1.8rem;width:48px;height:48px;display:flex;align-items:center;justify-content:center;
                background:${a === selectedAvatar ? 'var(--p-primary-light)' : 'var(--p-surface)'};
                border:2px solid ${a === selectedAvatar ? 'var(--p-primary)' : 'var(--p-border)'};
                border-radius:50%;cursor:pointer;" onclick="pickChildAvatar('${a}')">${a}</div>
  `).join('');
}

function pickChildAvatar(avatar) {
  selectedAvatar = avatar;
  renderAvatarPicker();
}

function generateChildRegQR() {
  const name = document.getElementById('newChildName').value.trim();
  if (!name) { showToast('名前を入力してください', 'error'); return; }

  let childId, attempts = 0;
  do { childId = OteCrypto.generateId('c'); attempts++; }
  while (parentData.children.some(c => c.childId === childId) && attempts < 100);

  const familyToken = OteCrypto.generateSecret().substring(0, 32);

  parentData.children.push({
    childId, name, avatar: selectedAvatar, familyToken,
    registeredAt: new Date().toISOString(), sentHistory: [], expectedBalance: 0
  });
  Store.setParentData(parentData);

  showRegQR(childId, name, selectedAvatar, familyToken);
  render();
}

// --- 既存こども（共有QRスキャン） ---
function showAddChildExisting() {
  hideAllAddChildSteps();
  document.getElementById('addChildStep1Existing').style.display = 'block';
  setTimeout(async () => {
    try {
      shareScanner = await QR.startScanner('shareChildReader', onShareChildScanned, (err) => {
        showToast(err, 'error');
        backToStep0();
      });
    } catch (e) {
      showToast('カメラの起動に失敗しました', 'error');
      backToStep0();
    }
  }, 300);
}

function cancelExistingScan() {
  QR.stopScanner(shareScanner); shareScanner = null;
  document.getElementById('shareChildReader').innerHTML = '';
  backToStep0();
}

function onShareChildScanned(data) {
  QR.stopScanner(shareScanner); shareScanner = null;
  document.getElementById('shareChildReader').innerHTML = '';

  if (data.t !== 'share') {
    showToast('これは共有QRではありません', 'error');
    backToStep0();
    return;
  }

  if (parentData.children.some(c => c.childId === data.cid)) {
    showToast(`${data.n}はすでに登録されています`, 'error');
    closeAddChildModal();
    return;
  }

  parentData.children.push({
    childId: data.cid, name: data.n, avatar: data.a, familyToken: data.ft,
    registeredAt: new Date().toISOString(), sentHistory: [], expectedBalance: 0
  });
  Store.setParentData(parentData);

  showToast(`${data.a} ${data.n}の情報を取得しました`, 'success');
  showRegQR(data.cid, data.n, data.a, data.ft);
  render();
}

// --- 共通：登録QR表示 ---
function showRegQR(childId, name, avatar, familyToken) {
  hideAllAddChildSteps();
  document.getElementById('addChildStep2').style.display = 'block';
  document.getElementById('addChildInfo').textContent = `${avatar} ${name} の登録QR`;

  const qrData = {
    t: 'reg', pid: parentData.parentId, pn: parentData.parentName,
    cid: childId, n: name, a: avatar, ft: familyToken
  };
  setTimeout(() => QR.generate('childRegQRDisplay', qrData, 200), 100);
}

// ========== こども共有QR ==========
function openShareChildModal(index) {
  const child = parentData.children[index];
  document.getElementById('shareChildInfo').textContent = `${child.avatar} ${child.name} の情報を共有`;

  const qrData = {
    t: 'share', cid: child.childId, n: child.name, a: child.avatar, ft: child.familyToken
  };
  document.getElementById('shareChildModal').classList.add('active');
  setTimeout(() => QR.generate('shareChildQRDisplay', qrData, 200), 100);
}

function closeShareChildModal() {
  document.getElementById('shareChildModal').classList.remove('active');
  document.getElementById('shareChildQRDisplay').innerHTML = '';
}

// ========== カスタムお手伝い ==========
function openAddChoreModal() {
  document.getElementById('newChoreIcon').value = '⭐';
  document.getElementById('newChoreName').value = '';
  document.getElementById('newChoreAmount').value = '100';
  document.getElementById('addChoreModal').classList.add('active');
}
function closeAddChoreModal() { document.getElementById('addChoreModal').classList.remove('active'); }

function addCustomChore() {
  const icon = document.getElementById('newChoreIcon').value.trim() || '⭐';
  const name = document.getElementById('newChoreName').value.trim();
  const amount = parseInt(document.getElementById('newChoreAmount').value) || 100;
  if (!name) { showToast('名前を入力してください', 'error'); return; }
  if (!parentData.customChores) parentData.customChores = [];
  parentData.customChores.push({ id: 'c_' + Date.now(), name, icon, amount: Math.max(10, amount) });
  Store.setParentData(parentData);
  closeAddChoreModal();
  showToast(`${icon} ${name}を追加しました`, 'success');
  render();
}

function removeCustomChore(i) {
  if (!confirm('削除しますか？')) return;
  parentData.customChores.splice(i, 1);
  Store.setParentData(parentData);
  render();
}

// ========== 子供削除 ==========
function removeChild(i) {
  const child = parentData.children[i];
  if (!confirm(`${child.name}を削除しますか？`)) return;
  parentData.children.splice(i, 1);
  if (selectedChildId === child.childId) {
    selectedChildId = null;
    document.getElementById('choreSection').style.display = 'none';
  }
  Store.setParentData(parentData);
  render();
}

// ========== その他 ==========
function confirmReset() {
  if (!confirm('すべてのデータを削除しますか？')) return;
  if (!confirm('本当に削除しますか？')) return;
  Store.clearAll();
  location.href = 'index.html';
}

function showTab(tab) {
  ['home','history','settings'].forEach(t => {
    document.getElementById('tab-' + t).style.display = (t === tab) ? 'block' : 'none';
    const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'history') renderHistory();
  if (tab === 'settings') renderSettings();
}

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
