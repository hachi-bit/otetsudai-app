// parent.js - 親アプリ（バッチ送信・再送対応）

const CHILD_AVATARS = ['🦁','🐱','🐶','🐰','🦊','🐼','🐸','🐧','🦄','🐲','🌟','🚀'];
const MAX_BATCH = 10;

let parentData = null;
let selectedChildId = null;
let selectedChoreId = null;
let currentAmount = 0;
let selectedAvatar = CHILD_AVATARS[0];
let shareScanner = null;
let importScanner = null;

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  parentData = Store.getParentData();
  if (!parentData) { show('setupScreen'); hide('appScreen'); return; }
  parentData = Store.migrateParentData(parentData);
  showApp();
  processParentUrlHash();
});

window.addEventListener('hashchange', () => {
  processParentUrlHash();
});

function processParentUrlHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return;
  history.replaceState(null, '', window.location.pathname);
  try {
    const jsonStr = QR.fromBase64(hash);
    const data = JSON.parse(jsonStr);
    handleIncomingParentQR(data);
  } catch(e) {}
}

// ===== URL経由のQRデータ処理 =====
function handleIncomingParentQR(data) {
  if (!data || !data.t || !parentData) return;

  if (data.t === 'share') {
    onShareChildScanned(data);
    return;
  }

  if (data.t === 'chores') {
    onImportChoresScanned(data);
    return;
  }
}

function completeParentSetup() {
  const n = document.getElementById('setupParentName').value.trim();
  if (!n) { toast('名前を入力してください','error'); return; }
  Store.setRole('parent'); parentData = Store.initParent(n); showApp();
}
function showApp() { hide('setupScreen'); show('appScreen'); render(); }

// ===== 描画 =====
function render() { renderChildren(); renderChores(); renderPending(); renderHistory(); renderSettings(); }

function renderChildren() {
  const c = document.getElementById('childrenList');
  if (!parentData.children.length) {
    c.innerHTML = '<div class="empty-state"><div class="empty-icon">👶</div><p>まだこどもが登録されていません</p></div>';
    hide('choreSection'); return;
  }
  c.innerHTML = parentData.children.map(ch => `
    <div class="card child-card ${selectedChildId===ch.childId?'selected':''}" onclick="selectChild('${ch.childId}')">
      <div class="child-avatar">${ch.avatar}</div>
      <div class="child-info"><div class="child-name">${esc(ch.name)}</div>
        <div class="child-balance">送った合計: ${ch.expectedBalance}円（${ch.sentHistory.length}回）</div></div>
      <div class="child-arrow">›</div>
    </div>`).join('');
}

function renderChores() {
  document.getElementById('choreGrid').innerHTML = parentData.chores.map(ch => `
    <div class="chore-item ${selectedChoreId===ch.id?'selected':''}" onclick="selectChore('${ch.id}')">
      <div class="chore-icon">${ch.icon}</div><div class="chore-name">${esc(ch.name)}</div><div class="chore-amount">${ch.amount}円</div>
    </div>`).join('');
}

function renderPending() {
  const child = getSelectedChild();
  const sec = document.getElementById('pendingSection');
  if (!child || !child.pending || !child.pending.length) { hide('pendingSection'); return; }
  show('pendingSection');
  document.getElementById('pendingList').innerHTML = child.pending.map((p, i) => `
    <div class="pending-item">
      <input type="checkbox" id="pchk${i}" checked onchange="updatePendingCount()">
      <span style="font-size:1.3rem;">${p.icon}</span>
      <div class="item-info">
        <div style="font-weight:600;">${esc(p.chore)}</div>
        <div style="font-size:0.75rem;color:var(--p-text-sub);">${fmtDate(p.addedAt)}</div>
      </div>
      <div class="item-amount">${p.amount}円</div>
      <button class="item-remove" onclick="removePending(${i})">✕</button>
    </div>`).join('');
  updatePendingCount();
}

function updatePendingCount() {
  const child = getSelectedChild();
  if (!child || !child.pending) return;
  const checked = getCheckedPendingIndices();
  const total = checked.reduce((s, i) => s + child.pending[i].amount, 0);
  document.getElementById('pendingCheckCount').textContent =
    `${checked.length}件選択中（合計 ${total}円）${checked.length > MAX_BATCH ? ' ⚠️ 最大'+MAX_BATCH+'件まで' : ''}`;
}

function getCheckedPendingIndices() {
  const child = getSelectedChild();
  if (!child || !child.pending) return [];
  const indices = [];
  child.pending.forEach((_, i) => { if (document.getElementById('pchk'+i)?.checked) indices.push(i); });
  return indices;
}

function renderHistory() {
  const c = document.getElementById('historyList');
  const all = [];
  parentData.children.forEach(ch => ch.sentHistory.forEach(h => all.push({...h, childName:ch.name, childAvatar:ch.avatar, childId:ch.childId})));
  all.sort((a,b) => b.timestamp - a.timestamp);
  if (!all.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>まだ送信りれきがありません</p></div>'; hide('resendBtn'); return; }
  c.innerHTML = `<div class="card">${all.map((h,i) => `
    <div class="history-check-item">
      <input type="checkbox" id="hchk${i}" data-child="${h.childId}" data-seq="${h.seq}" data-ts="${h.timestamp}" onchange="updateHistoryCount()">
      <div class="history-icon">${h.icon||'⭐'}</div>
      <div class="item-info"><div style="font-weight:600;">${esc(h.chore)}</div>
        <div style="font-size:0.78rem;color:var(--p-text-sub);">${h.childAvatar} ${esc(h.childName)} · ${fmtDate(h.timestamp)}</div></div>
      <div class="item-amount">+${h.amount}円</div>
    </div>`).join('')}</div>`;
  updateHistoryCount();
}

function updateHistoryCount() {
  const checked = getCheckedHistoryItems();
  const el = document.getElementById('historyCheckCount');
  const btn = document.getElementById('resendBtn');
  if (!checked.length) { el.textContent = ''; btn.style.display = 'none'; return; }
  // 同一子チェック
  const childIds = [...new Set(checked.map(c => c.childId))];
  const total = checked.reduce((s, c) => s + c.amount, 0);
  let warn = '';
  if (childIds.length > 1) warn = ' ⚠️ 再送は同じこどもの分だけ選んでください';
  else if (checked.length > MAX_BATCH) warn = ' ⚠️ 最大'+MAX_BATCH+'件まで';
  el.textContent = `${checked.length}件選択中（合計 ${total}円）${warn}`;
  btn.style.display = (childIds.length === 1 && checked.length <= MAX_BATCH) ? 'flex' : 'none';
}

function getCheckedHistoryItems() {
  const items = [];
  document.querySelectorAll('[id^="hchk"]').forEach(el => {
    if (!el.checked) return;
    const childId = el.dataset.child;
    const seq = parseInt(el.dataset.seq);
    const ts = parseInt(el.dataset.ts);
    // 実データから取得
    parentData.children.forEach(ch => {
      if (ch.childId !== childId) return;
      const h = ch.sentHistory.find(x => x.seq === seq && x.timestamp === ts);
      if (h) items.push({...h, childId});
    });
  });
  return items;
}

function renderSettings() {
  document.getElementById('parentNameDisplay').textContent = parentData.parentName;
  document.getElementById('parentIdDisplay').textContent = parentData.parentId;
  document.getElementById('parentVersionDisplay').textContent = `おてつだい手帳 ${APP_VERSION}`;
  const cl = document.getElementById('settingsChildrenList');
  if (!parentData.children.length) { cl.innerHTML = '<p style="color:var(--p-text-sub);font-size:0.9rem;">登録なし</p>'; }
  else { cl.innerHTML = parentData.children.map((ch,i) => `
    <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
      <span style="font-size:1.5rem;">${ch.avatar}</span>
      <span style="flex:1;font-weight:700;">${esc(ch.name)}</span>
      <span style="font-size:0.8rem;color:var(--p-text-sub);">累計 ${ch.expectedBalance}円</span>
      <div style="width:100%;display:flex;gap:8px;margin-top:4px;">
        <button class="btn btn-secondary" style="flex:1;padding:8px;font-size:0.8rem;" onclick="openShareChildModal(${i})">👨‍👩‍👧 共有</button>
        <button class="btn btn-secondary" style="flex:1;padding:8px;font-size:0.8rem;" onclick="openRestoreChildModal(${i})">🔄 復元</button>
        <button class="btn btn-danger" style="padding:8px;font-size:0.8rem;" onclick="deleteChild(${i})">削除</button>
      </div>
      <div style="width:100%;margin-top:4px;">
        <button class="btn btn-secondary btn-block" style="padding:8px;font-size:0.8rem;" onclick="previewChildView(${i})">👀 こどもの見え方を確認</button>
      </div>
    </div>`).join(''); }
  const chl = document.getElementById('settingsChoreList');
  if (!parentData.chores.length) { chl.innerHTML = '<p style="color:var(--p-text-sub);font-size:0.9rem;">テンプレートなし</p>'; }
  else { chl.innerHTML = parentData.chores.map((ch,i) => `
    <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <input type="checkbox" id="chchk${i}" style="width:20px;height:20px;accent-color:var(--p-primary);flex-shrink:0;">
      <span style="font-size:1.3rem;">${ch.icon}</span><span style="flex:1;font-weight:600;">${esc(ch.name)}</span>
      <span style="font-size:0.85rem;color:var(--p-text-sub);">${ch.amount}円</span>
      <button class="header-btn" onclick="openEditChoreModal(${i})" style="color:var(--p-primary);">✎</button>
      <button class="header-btn" onclick="removeChore(${i})" style="color:var(--p-danger);">✕</button>
    </div>`).join(''); }
  // 称号レベルリスト
  const lvl = document.getElementById('settingsLevelList');
  const levels = parentData.levels || Store.DEFAULT_LEVELS;
  lvl.innerHTML = levels.map((lv,i) => `
    <div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <input type="checkbox" id="lvchk${i}" style="width:20px;height:20px;accent-color:var(--p-primary);flex-shrink:0;">
      <span style="font-size:1.3rem;">${lv.icon || '🏆'}</span>
      <span style="font-size:1.1rem;font-weight:800;color:var(--p-primary);min-width:32px;">Lv${lv.level}</span>
      <span style="flex:1;font-weight:600;">${esc(lv.title)}</span>
      <span style="font-size:0.85rem;color:var(--p-text-sub);">${lv.threshold}円〜</span>
      <button class="header-btn" onclick="openEditLevelModal(${i})" style="color:var(--p-primary);">✎</button>
      ${levels.length > 1 ? `<button class="header-btn" onclick="removeLevel(${i})" style="color:var(--p-danger);">✕</button>` : ''}
    </div>`).join('');
}

// ===== 子供選択 & お手伝い =====
function selectChild(id) {
  selectedChildId = id; selectedChoreId = null; currentAmount = 0;
  show('choreSection');
  document.getElementById('choreSectionTitle').textContent = `🧹 ${getSelectedChild().name}のおてつだいを選ぶ`;
  hide('amountSection'); render();
  renderParentCharts();
  document.getElementById('choreSection').scrollIntoView({behavior:'smooth'});
}

function renderParentCharts() {
  const child = getSelectedChild();
  const sec = document.getElementById('parentChartSection');
  if (!child || !child.sentHistory || !child.sentHistory.length) { if(sec) sec.style.display='none'; return; }
  if(sec) sec.style.display='block';
  document.getElementById('parentChartTitle').textContent = `📊 ${child.name}のきろく`;
  Chart.renderWeekly('parentWeeklyChart', 'parentWeeklyChartSummary', child.sentHistory);
  Chart.renderMonthly('parentMonthlyChart', 'parentMonthlyChartSummary', child.sentHistory);
}
function selectChore(id) {
  selectedChoreId = id;
  const ch = parentData.chores.find(c=>c.id===id);
  if(ch){currentAmount=ch.amount;document.getElementById('amountValue').textContent=currentAmount;show('amountSection');}
  renderChores();
}
function adjustAmount(d){currentAmount=Math.max(10,currentAmount+d);document.getElementById('amountValue').textContent=currentAmount;}
function getSelectedChild(){return parentData.children.find(c=>c.childId===selectedChildId);}

// ===== すぐ送る（単品QR） =====
async function generateRewardQR() {
  if(!selectedChildId||!selectedChoreId||currentAmount<=0){toast('子ども・お手伝い・金額を選んでください','error');return;}
  const child=getSelectedChild(), chore=parentData.chores.find(c=>c.id===selectedChoreId);
  if(!child||!chore)return;
  const item = await addToSentHistory(child, chore.name, chore.icon, currentAmount);
  const qr = { t:'rwd', pid:parentData.parentId, pn:parentData.parentName, cid:child.childId,
    ch:chore.name, ci:chore.icon, amt:currentAmount, ts:item.timestamp, seq:item.seq, eb:child.expectedBalance, h:item.hash };
  showRewardQRModal(`<div>${child.avatar} ${esc(child.name)}</div><div style="margin-top:4px;">${chore.icon} ${esc(chore.name)}</div><div class="reward-amount" style="margin-top:8px;">${currentAmount}円</div>`, qr);
  selectedChoreId=null; currentAmount=0; hide('amountSection'); render();
}

// ===== あとで送る（ストック追加） =====
function addToPending() {
  if(!selectedChildId||!selectedChoreId||currentAmount<=0){toast('子ども・お手伝い・金額を選んでください','error');return;}
  const child=getSelectedChild(), chore=parentData.chores.find(c=>c.id===selectedChoreId);
  if(!child||!chore)return;
  if(!child.pending) child.pending=[];
  child.pending.push({chore:chore.name, icon:chore.icon, amount:currentAmount, addedAt:Date.now()});
  Store.setParentData(parentData);
  toast(`📥 ${chore.icon} ${chore.name}をストックに追加`,'success');
  selectedChoreId=null; currentAmount=0; hide('amountSection'); render();
}

function removePending(i) {
  const child=getSelectedChild(); if(!child)return;
  child.pending.splice(i,1);
  Store.setParentData(parentData); render();
}

// ===== バッチQR生成（ストックor履歴から） =====
async function generateBatchQR(source) {
  const child = getSelectedChild();
  let items = [];

  if (source === 'pending') {
    if(!child||!child.pending) return;
    const indices = getCheckedPendingIndices();
    if(!indices.length){toast('送信する項目を選んでください','error');return;}
    if(indices.length > MAX_BATCH){toast(`最大${MAX_BATCH}件までです`,'error');return;}
    // pendingからsentHistoryに移動（addedAtをタイムスタンプとして使用）
    const pendingItems = indices.map(i => child.pending[i]);
    const sentItems = [];
    for(const p of pendingItems){
      sentItems.push(await addToSentHistory(child, p.chore, p.icon, p.amount, p.addedAt));
    }
    // pending から削除（逆順）
    indices.sort((a,b)=>b-a).forEach(i => child.pending.splice(i,1));
    Store.setParentData(parentData);
    items = sentItems;
  } else if (source === 'history') {
    const checked = getCheckedHistoryItems();
    if(!checked.length){toast('再送する項目を選んでください','error');return;}
    if(checked.length > MAX_BATCH){toast(`最大${MAX_BATCH}件までです`,'error');return;}
    const childIds = [...new Set(checked.map(c=>c.childId))];
    if(childIds.length > 1){toast('再送は同じこどもの分だけ選んでください','error');return;}
    items = checked;
  }

  if(!items.length) return;
  const targetChild = (source==='history') ? parentData.children.find(c=>c.childId===items[0].childId) : child;
  const total = items.reduce((s,it)=>s+it.amount,0);
  const batchHash = await OteCrypto.sha256(items.map(it=>`${it.seq}:${it.amount}`).join(',')+parentData.secret);

  const qr = {
    t:'batch', pid:parentData.parentId, pn:parentData.parentName, cid:targetChild.childId,
    items: items.map(it=>({ch:it.chore, ci:it.icon, amt:it.amount, seq:it.seq, ts:it.timestamp})),
    h: batchHash
  };

  const summaryHtml = `<div>${targetChild.avatar} ${esc(targetChild.name)}</div>` +
    items.map(it => `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.9rem;"><span>${it.icon} ${esc(it.chore)}</span><span>${it.amount}円</span></div>`).join('') +
    `<div class="reward-amount" style="margin-top:8px;border-top:1px solid var(--p-border);padding-top:8px;">合計 ${total}円</div>`;
  showRewardQRModal(summaryHtml, qr, source==='history' ? '🔄 再送QR' : '📦 まとめてQR');
  render();
}

async function addToSentHistory(child, chore, icon, amount, customTs) {
  const seq = child.sentHistory.length + 1;
  const ts = customTs || Date.now();
  const hash = await OteCrypto.createRewardHash(parentData.parentId, child.childId, amount, ts, seq, parentData.secret);
  child.expectedBalance += amount;
  const entry = {chore, icon, amount, timestamp:ts, seq, hash};
  child.sentHistory.push(entry);
  Store.setParentData(parentData);
  return entry;
}

function showRewardQRModal(summaryHtml, qrData, title) {
  document.getElementById('rewardQRTitle').textContent = title || '🎁 ごほうびQR';
  document.getElementById('rewardSummary').innerHTML = `<div class="reward-summary">${summaryHtml}</div>`;
  document.getElementById('rewardQRModal').classList.add('active');
  setTimeout(()=>QR.generate('rewardQRDisplay', qrData, 220), 100);
}
function closeRewardQRModal(){document.getElementById('rewardQRModal').classList.remove('active');document.getElementById('rewardQRDisplay').innerHTML='';}

// ===== こども追加 =====
function openAddChildModal(){hideAllSteps();show('addChildStep0');document.getElementById('addChildModal').classList.add('active');}
function closeAddChildModal(){document.getElementById('addChildModal').classList.remove('active');document.getElementById('childRegQRDisplay').innerHTML='';QR.stopScanner(shareScanner);shareScanner=null;document.getElementById('shareChildReader').innerHTML='';}
function backToStep0(){hideAllSteps();show('addChildStep0');QR.stopScanner(shareScanner);shareScanner=null;document.getElementById('shareChildReader').innerHTML='';}
function hideAllSteps(){['addChildStep0','addChildStep1New','addChildStep1Existing','addChildStep2'].forEach(hide);}

function showAddChildNew(){selectedAvatar=CHILD_AVATARS[0];document.getElementById('newChildName').value='';hideAllSteps();show('addChildStep1New');renderAvatarPicker();}
function renderAvatarPicker(){document.getElementById('childAvatarPicker').innerHTML=CHILD_AVATARS.map(a=>`<div style="font-size:1.8rem;width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:${a===selectedAvatar?'var(--p-primary-light)':'var(--p-surface)'};border:2px solid ${a===selectedAvatar?'var(--p-primary)':'var(--p-border)'};border-radius:50%;cursor:pointer;" onclick="pickChildAvatar('${a}')">${a}</div>`).join('');}
function pickChildAvatar(a){selectedAvatar=a;renderAvatarPicker();}

function generateChildRegQR(){
  const name=document.getElementById('newChildName').value.trim();
  if(!name){toast('名前を入力してください','error');return;}
  let cid,att=0; do{cid=OteCrypto.generateId('c');att++;}while(parentData.children.some(c=>c.childId===cid)&&att<100);
  const ft=OteCrypto.generateSecret().substring(0,32);
  parentData.children.push({childId:cid,name,avatar:selectedAvatar,familyToken:ft,registeredAt:new Date().toISOString(),sentHistory:[],expectedBalance:0,pending:[]});
  Store.setParentData(parentData); showRegQR(cid,name,selectedAvatar,ft); render();
}

function showAddChildExisting(){hideAllSteps();show('addChildStep1Existing');
  setTimeout(async()=>{try{shareScanner=await QR.startScanner('shareChildReader',onShareChildScanned,e=>{toast(e,'error');backToStep0();});}catch(e){toast('カメラ起動失敗','error');backToStep0();}},300);}
function cancelExistingScan(){QR.stopScanner(shareScanner);shareScanner=null;document.getElementById('shareChildReader').innerHTML='';backToStep0();}

function onShareChildScanned(data){
  QR.stopScanner(shareScanner);shareScanner=null;document.getElementById('shareChildReader').innerHTML='';
  if(data.t!=='share'){toast('共有QRではありません','error');backToStep0();return;}
  if(parentData.children.some(c=>c.childId===data.cid)){toast(`${data.n}は登録済み`,'error');closeAddChildModal();return;}
  parentData.children.push({childId:data.cid,name:data.n,avatar:data.a,familyToken:data.ft,registeredAt:new Date().toISOString(),sentHistory:[],expectedBalance:0,pending:[]});
  Store.setParentData(parentData); toast(`${data.a} ${data.n}を取得`,'success'); showRegQR(data.cid,data.n,data.a,data.ft); render();
}

function _compactLevels() {
  return (parentData.levels||[]).map(lv => ({l:lv.level, th:lv.threshold, ti:lv.title}));
}

function showRegQR(cid,n,a,ft){document.getElementById('addChildModal').classList.add('active');hideAllSteps();show('addChildStep2');document.getElementById('addChildInfo').textContent=`${a} ${n} の登録QR`;
  setTimeout(()=>QR.generate('childRegQRDisplay',{t:'reg',pid:parentData.parentId,pn:parentData.parentName,cid,n,a,ft},200),100);}

// ===== 共有・復元 =====
// ===== こどもの見え方プレビュー =====
function previewChildView(i) {
  const ch = parentData.children[i];
  if (!ch) return;

  // 親が持つ送信履歴（sentHistory）を子ども目線の履歴フォーマットに変換
  const history = (ch.sentHistory || []).map(h => ({
    chore: h.chore,
    icon: h.icon,
    amount: h.amount,
    timestamp: h.timestamp,
    seq: h.seq,
    parentId: parentData.parentId,
    parentName: parentData.parentName,
  }));

  const snapshot = {
    n: ch.name,
    a: ch.avatar,
    bal: ch.expectedBalance,
    te: ch.expectedBalance, // 累計 = 送金合計として概算（子側の実受取額とズレる場合あり）
    h: history,
    pr: [{ pid: parentData.parentId, name: parentData.parentName }],
    lv: parentData.levels || null,
  };

  const qrData = { t: 'preview', snapshot };
  const jsonStr = JSON.stringify(qrData);
  const b64 = QR.toBase64(jsonStr);
  const baseUrl = window.location.href.replace(/[^/]*(\?.*)?(\#.*)?$/, '');
  const url = `${baseUrl}child.html#${b64}`;

  window.open(url, '_blank');
}

function openShareChildModal(i){const ch=parentData.children[i];document.getElementById('shareChildInfo').textContent=`${ch.avatar} ${ch.name}`;
  document.getElementById('shareChildModal').classList.add('active');setTimeout(()=>QR.generate('shareChildQRDisplay',{t:'share',cid:ch.childId,n:ch.name,a:ch.avatar,ft:ch.familyToken},200),100);}
function closeShareChildModal(){document.getElementById('shareChildModal').classList.remove('active');document.getElementById('shareChildQRDisplay').innerHTML='';}

function openRestoreChildModal(i){const ch=parentData.children[i];document.getElementById('restoreChildInfo').textContent=`${ch.avatar} ${ch.name}（残高: ${ch.expectedBalance}円）`;
  document.getElementById('restoreChildModal').classList.add('active');setTimeout(()=>QR.generate('restoreChildQRDisplay',{t:'restore',pid:parentData.parentId,pn:parentData.parentName,cid:ch.childId,n:ch.name,a:ch.avatar,ft:ch.familyToken,bal:ch.expectedBalance},200),100);}
function closeRestoreChildModal(){document.getElementById('restoreChildModal').classList.remove('active');document.getElementById('restoreChildQRDisplay').innerHTML='';}

// ===== テンプレ管理 =====
function openAddChoreModal(){document.getElementById('editChoreTitle').textContent='✏️ お手伝いを追加';document.getElementById('editChoreId').value='';document.getElementById('editChoreIcon').value='⭐';document.getElementById('editChoreName').value='';document.getElementById('editChoreAmount').value='100';document.getElementById('editChoreModal').classList.add('active');}
function openEditChoreModal(i){const ch=parentData.chores[i];document.getElementById('editChoreTitle').textContent='✏️ お手伝いを編集';document.getElementById('editChoreId').value=i;document.getElementById('editChoreIcon').value=ch.icon;document.getElementById('editChoreName').value=ch.name;document.getElementById('editChoreAmount').value=ch.amount;document.getElementById('editChoreModal').classList.add('active');}
function closeEditChoreModal(){document.getElementById('editChoreModal').classList.remove('active');}
function saveChore(){
  const icon=document.getElementById('editChoreIcon').value.trim()||'⭐',name=document.getElementById('editChoreName').value.trim(),amount=parseInt(document.getElementById('editChoreAmount').value)||100;
  if(!name){toast('名前を入力してください','error');return;}
  const idx=document.getElementById('editChoreId').value;
  if(idx===''){parentData.chores.push({id:'ch_'+Date.now(),name,icon,amount:Math.max(10,amount)});toast(`${icon} ${name}を追加`,'success');}
  else{const i=parseInt(idx);parentData.chores[i].icon=icon;parentData.chores[i].name=name;parentData.chores[i].amount=Math.max(10,amount);toast(`${icon} ${name}を更新`,'success');}
  Store.setParentData(parentData);closeEditChoreModal();render();
}
function removeChore(i){if(!confirm(`${parentData.chores[i].icon} ${parentData.chores[i].name} を削除？`))return;parentData.chores.splice(i,1);Store.setParentData(parentData);render();}

function openShareChoresModal(){
  const checked = [];
  parentData.chores.forEach((ch,i) => {
    if (document.getElementById('chchk'+i)?.checked) checked.push(ch);
  });
  if (!checked.length) { toast('共有するテンプレートにチェックを入れてください','error'); return; }
  document.getElementById('shareChoresModal').classList.add('active');
  setTimeout(()=>QR.generate('shareChoresQRDisplay',{t:'chores',items:checked.map(c=>({n:c.name,i:c.icon,a:c.amount}))},250),100);
}
function closeShareChoresModal(){document.getElementById('shareChoresModal').classList.remove('active');document.getElementById('shareChoresQRDisplay').innerHTML='';}

function openImportChoresModal(){document.getElementById('importChoresModal').classList.add('active');
  setTimeout(async()=>{try{importScanner=await QR.startScanner('importChoresReader',onImportChoresScanned,e=>{toast(e,'error');closeImportChoresModal();});}catch(e){toast('カメラ起動失敗','error');closeImportChoresModal();}},300);}
function closeImportChoresModal(){document.getElementById('importChoresModal').classList.remove('active');QR.stopScanner(importScanner);importScanner=null;document.getElementById('importChoresReader').innerHTML='';}
function onImportChoresScanned(data){closeImportChoresModal();if(data.t!=='chores'||!Array.isArray(data.items)){toast('テンプレートQRではありません','error');return;}
  let added=0;data.items.forEach(it=>{if(!parentData.chores.some(c=>c.name===it.n&&c.icon===it.i)){parentData.chores.push({id:'ch_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),name:it.n,icon:it.i,amount:it.a});added++;}});
  Store.setParentData(parentData);toast(`${added}件インポート（重複スキップ）`,'success');render();}

// ===== 称号レベル管理 =====
function openAddLevelModal() {
  document.getElementById('editLevelTitle').textContent = '🏆 称号を追加';
  document.getElementById('editLevelIndex').value = '';
  document.getElementById('editLevelIcon').value = '🏆';
  document.getElementById('editLevelThreshold').value = '';
  document.getElementById('editLevelTitle2').value = '';
  document.getElementById('editLevelModal').classList.add('active');
}
function openEditLevelModal(i) {
  const lv = parentData.levels[i];
  document.getElementById('editLevelTitle').textContent = '🏆 称号を編集';
  document.getElementById('editLevelIndex').value = i;
  document.getElementById('editLevelIcon').value = lv.icon || '🏆';
  document.getElementById('editLevelThreshold').value = lv.threshold;
  document.getElementById('editLevelTitle2').value = lv.title;
  document.getElementById('editLevelModal').classList.add('active');
}
function closeLevelModal() { document.getElementById('editLevelModal').classList.remove('active'); }
function saveLevel() {
  const icon = document.getElementById('editLevelIcon').value.trim() || '🏆';
  const threshold = parseInt(document.getElementById('editLevelThreshold').value);
  const title = document.getElementById('editLevelTitle2').value.trim();
  if (isNaN(threshold) || threshold < 0) { toast('金額を正しく入力してください','error'); return; }
  if (!title) { toast('称号名を入力してください','error'); return; }
  const idx = document.getElementById('editLevelIndex').value;
  if (idx === '') { parentData.levels.push({ level:0, threshold, title, icon }); toast(`${icon} ${title}を追加`,'success'); }
  else { parentData.levels[parseInt(idx)].threshold = threshold; parentData.levels[parseInt(idx)].title = title; parentData.levels[parseInt(idx)].icon = icon; toast(`${icon} ${title}を更新`,'success'); }
  parentData.levels.sort((a,b) => a.threshold - b.threshold);
  parentData.levels.forEach((lv,j) => lv.level = j + 1);
  Store.setParentData(parentData); closeLevelModal(); render();
}
function removeLevel(i) {
  if (parentData.levels.length <= 1) { toast('最低1つは必要です','error'); return; }
  const lv = parentData.levels[i];
  if (!confirm(`Lv${lv.level} ${lv.icon||''} ${lv.title} を削除？`)) return;
  parentData.levels.splice(i,1);
  parentData.levels.forEach((lv,j) => lv.level = j + 1);
  Store.setParentData(parentData); render();
}
function syncLevelsToChild() {
  const levels = parentData.levels || Store.DEFAULT_LEVELS;
  const checked = [];
  levels.forEach((lv, i) => {
    if (document.getElementById('lvchk'+i)?.checked) checked.push(lv);
  });
  if (!checked.length) { toast('同期する称号を選んでください','error'); return; }
  const items = checked.map(lv => ({th:lv.threshold, ti:lv.title, ic:lv.icon||'🏆'}));
  const qr = { t:'levels', items };
  document.getElementById('syncLevelsModal').classList.add('active');
  setTimeout(() => QR.generate('syncLevelsQRDisplay', qr, 220), 100);
}
function closeSyncLevelsModal() { document.getElementById('syncLevelsModal').classList.remove('active'); document.getElementById('syncLevelsQRDisplay').innerHTML=''; }

// ===== 子供削除 =====
function deleteChild(i){
  const ch=parentData.children[i];
  const input = prompt(`「${ch.name}」を削除するには、こどもの名前を入力してください`);
  if (input === null) return; // キャンセル
  if (input.trim() !== ch.name) { toast('名前が一致しません', 'error'); return; }
  parentData.children.splice(i,1);
  if(selectedChildId===ch.childId){selectedChildId=null;hide('choreSection');hide('parentChartSection');}
  Store.setParentData(parentData); toast(`${ch.avatar} ${ch.name}を削除しました`,'success'); render();
}

// ===== ユーティリティ =====
function confirmReset(){
  const input = prompt(`アカウントを削除するには「${parentData.parentName}」と入力してください`);
  if (input === null) return;
  if (input.trim() !== parentData.parentName) { toast('名前が一致しません','error'); return; }
  Store.clearAll(); location.href='index.html';
}
function showTab(t){['home','history','settings'].forEach(x=>{document.getElementById('tab-'+x).style.display=(x===t)?'block':'none';
  const b=document.getElementById('tab'+x.charAt(0).toUpperCase()+x.slice(1));if(b)b.classList.toggle('active',x===t);});
  if(t==='history')renderHistory();if(t==='settings')renderSettings();}
function show(id){const e=document.getElementById(id);if(e)e.style.display=e.dataset.display||'block';}
function hide(id){const e=document.getElementById(id);if(e)e.style.display='none';}
function toast(m,t='success'){const e=document.getElementById('toast');e.textContent=m;e.className=`toast toast-${t} show`;setTimeout(()=>e.classList.remove('show'),2500);}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function fmtDate(ts){const d=new Date(ts);return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;}
