// qr.js - QR生成・読み取りヘルパー
// QR生成: qrcode.js（ローカル同梱）+ URL方式
// QRスキャン: html5-qrcode (CDN)

const QR = {
  // --- Base64ユーティリティ（UTF-8対応） ---
  toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  },
  fromBase64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  },

  // --- ベースURL取得 ---
  _getBaseUrl() {
    return window.location.href.replace(/[^/]*(\?.*)?(\#.*)?$/, '');
  },

  // --- QRタイプ → 遷移先ページ ---
  _getTargetPage(type) {
    switch (type) {
      case 'share': case 'chores': return 'parent.html';
      default: return 'child.html'; // reg, restore, rwd, batch, levels
    }
  },

  /**
   * QRコードを生成（URL埋め込み方式）
   * スマホの標準カメラでスキャン → ブラウザ/PWAが自動起動
   */
  generate(elementId, data, size = 220) {
    const el = document.getElementById(elementId);
    if (!el) { console.error('QR: element not found:', elementId); return; }
    el.innerHTML = '';

    if (typeof QRCode === 'undefined') {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.9rem;">QRライブラリの読み込みに失敗しました。<br>ページを再読み込みしてください。</div>';
      return;
    }

    const jsonStr = JSON.stringify(data);
    const b64 = this.toBase64(jsonStr);
    const targetPage = this._getTargetPage(data.t);
    const baseUrl = this._getBaseUrl();
    const url = `${baseUrl}${targetPage}#${b64}`;

    try {
      return new QRCode(el, {
        text: url,
        width: size,
        height: size,
        typeNumber: 0,
        colorDark: '#2d1b69',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L,
      });
    } catch (e) {
      console.error('QR generation failed:', e.message, 'url length:', url.length);
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.9rem;">QRコードの生成に失敗しました。<br>データが大きすぎる可能性があります。</div>';
    }
  },

  /**
   * URLまたはBase64からデータを解析
   */
  parseQRText(text) {
    // URL方式: https://...#BASE64
    if (text.startsWith('http') && text.includes('#')) {
      const hash = text.split('#')[1];
      if (hash) {
        const jsonStr = this.fromBase64(hash);
        return JSON.parse(jsonStr);
      }
    }
    // Base64直接
    try {
      const jsonStr = this.fromBase64(text);
      return JSON.parse(jsonStr);
    } catch(e) {}
    // 生JSON（後方互換）
    return JSON.parse(text);
  },

  /**
   * QRスキャナーを起動
   */
  async startScanner(elementId, onSuccess, onError) {
    if (typeof Html5Qrcode === 'undefined') {
      onError('QRスキャンライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
      return null;
    }
    const self = this;
    const scanner = new Html5Qrcode(elementId);
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const data = self.parseQRText(decodedText);
            scanner.stop().catch(() => {});
            onSuccess(data);
          } catch (e) {
            // 解析失敗 → 無視して続行
          }
        },
        () => {}
      );
    } catch (err) {
      onError('カメラの起動に失敗しました。カメラの許可を確認してください。');
    }
    return scanner;
  },

  /**
   * スキャナーを停止
   */
  async stopScanner(scanner) {
    if (scanner) { try { await scanner.stop(); } catch (e) {} }
  }
};
