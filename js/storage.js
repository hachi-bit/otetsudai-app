// storage.js - localStorage ラッパー

const Store = {
  KEYS: {
    ROLE: 'ote_role',
    PARENT_DATA: 'ote_parent',
    CHILD_DATA: 'ote_child',
  },

  // --- 共通 ---
  getRole() {
    return localStorage.getItem(this.KEYS.ROLE);
  },
  setRole(role) {
    localStorage.setItem(this.KEYS.ROLE, role);
  },

  // --- 親側 ---
  getParentData() {
    const raw = localStorage.getItem(this.KEYS.PARENT_DATA);
    return raw ? JSON.parse(raw) : null;
  },
  setParentData(data) {
    localStorage.setItem(this.KEYS.PARENT_DATA, JSON.stringify(data));
  },
  initParent() {
    const data = {
      role: 'parent',
      parentId: OteCrypto.generateId('p'),
      secret: OteCrypto.generateSecret(),
      children: [],
      choreTemplates: [
        { id: 't1', name: '食器洗い', amount: 100, icon: '🍽️' },
        { id: 't2', name: 'お風呂掃除', amount: 150, icon: '🛁' },
        { id: 't3', name: '掃除機がけ', amount: 100, icon: '🧹' },
        { id: 't4', name: '洗濯物たたみ', amount: 80, icon: '👕' },
        { id: 't5', name: 'ゴミ出し', amount: 50, icon: '🗑️' },
        { id: 't6', name: 'ペットの世話', amount: 100, icon: '🐕' },
        { id: 't7', name: '部屋の片づけ', amount: 80, icon: '🧸' },
        { id: 't8', name: 'お買い物手伝い', amount: 100, icon: '🛒' },
      ],
      customChores: [],
    };
    this.setParentData(data);
    return data;
  },

  // --- 子側 ---
  getChildData() {
    const raw = localStorage.getItem(this.KEYS.CHILD_DATA);
    return raw ? JSON.parse(raw) : null;
  },
  setChildData(data) {
    localStorage.setItem(this.KEYS.CHILD_DATA, JSON.stringify(data));
  },
  initChild(name, avatar) {
    const data = {
      role: 'child',
      childId: OteCrypto.generateId('c'),
      name: name,
      avatar: avatar,
      balance: 0,
      totalEarned: 0,
      level: 1,
      history: [],
      parentId: null,
      scannedSeqs: [],  // 重複スキャン防止用
    };
    this.setChildData(data);
    return data;
  },

  // --- 子供のレベル計算 ---
  LEVELS: [
    { level: 1, threshold: 0,     title: 'かけだし' },
    { level: 2, threshold: 500,   title: 'がんばりや' },
    { level: 3, threshold: 1500,  title: 'おてつだいマスター' },
    { level: 4, threshold: 3000,  title: 'スーパーヘルパー' },
    { level: 5, threshold: 5000,  title: 'おてつだいヒーロー' },
    { level: 6, threshold: 10000, title: 'でんせつのヘルパー' },
  ],
  calcLevel(totalEarned) {
    let current = this.LEVELS[0];
    for (const lv of this.LEVELS) {
      if (totalEarned >= lv.threshold) current = lv;
    }
    return current;
  },
  getNextLevel(totalEarned) {
    for (const lv of this.LEVELS) {
      if (totalEarned < lv.threshold) return lv;
    }
    return null; // MAX
  },

  // --- リセット ---
  clearAll() {
    localStorage.removeItem(this.KEYS.ROLE);
    localStorage.removeItem(this.KEYS.PARENT_DATA);
    localStorage.removeItem(this.KEYS.CHILD_DATA);
  }
};
