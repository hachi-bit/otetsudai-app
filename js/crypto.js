// crypto.js - ハッシュ生成（不正防止用）

const OteCrypto = {
  /**
   * SHA-256ハッシュを生成
   */
  async sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * 報酬QR用ハッシュを生成
   */
  async createRewardHash(parentId, childId, amount, timestamp, seq, secret) {
    const raw = `${parentId}:${childId}:${amount}:${timestamp}:${seq}:${secret}`;
    return await this.sha256(raw);
  },

  /**
   * 報酬QRデータを検証
   */
  async verifyRewardHash(rewardData, secret) {
    const expected = await this.createRewardHash(
      rewardData.pid,
      rewardData.cid,
      rewardData.amt,
      rewardData.ts,
      rewardData.seq,
      secret
    );
    return expected === rewardData.h;
  },

  /**
   * ランダムID生成
   */
  generateId(prefix) {
    const rand = crypto.getRandomValues(new Uint8Array(8));
    const hex = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
  },

  /**
   * ランダム秘密鍵生成
   */
  generateSecret() {
    const rand = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};
