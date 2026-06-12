// qr.js - QR生成・読み取りヘルパー
// QR生成: qrcode.js（ローカル同梱）+ Base64エンコード
// QRスキャン: html5-qrcode (CDN) + Base64デコード

const QR = {
  // --- Base64ユーティリティ（UTF-8対応） ---
  _toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  },
  _fromBase64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  },

  /**
   * QRコードを生成して指定要素に表示
   * データはJSON→Base64エンコードしてASCII化
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
    const b64 = this._toBase64(jsonStr);

    try {
      return new QRCode(el, {
        text: b64,
        width: size,
        height: size,
        typeNumber: 0,
        colorDark: '#2d1b69',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L,
      });
    } catch (e) {
      console.error('QR generation failed:', e.message, 'base64 length:', b64.length);
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.9rem;">QRコードの生成に失敗しました。<br>データが大きすぎる可能性があります。</div>';
    }
  },

  /**
   * QRスキャナーを起動
   * 読み取ったBase64をデコードしてJSONとして返す
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
            // Base64デコード → JSON解析
            const jsonStr = self._fromBase64(decodedText);
            const data = JSON.parse(jsonStr);
            scanner.stop().catch(() => {});
            onSuccess(data);
          } catch (e1) {
            // Base64でなければ直接JSON解析を試す（後方互換）
            try {
              const data = JSON.parse(decodedText);
              scanner.stop().catch(() => {});
              onSuccess(data);
            } catch (e2) {
              // どちらも失敗 → 無視して続行
            }
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
