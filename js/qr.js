// qr.js - QR生成・読み取りヘルパー
// QR生成: qrcode.js（ローカル同梱）
// QRスキャン: html5-qrcode (CDN)

const QR = {
  /**
   * QRコードを生成して指定要素に表示
   */
  generate(elementId, data, size = 220) {
    const el = document.getElementById(elementId);
    if (!el) { console.error('QR: element not found:', elementId); return; }
    el.innerHTML = '';
    const jsonStr = JSON.stringify(data);

    if (typeof QRCode === 'undefined') {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.9rem;">QRライブラリの読み込みに失敗しました。<br>ページを再読み込みしてください。</div>';
      return;
    }

    try {
      return new QRCode(el, {
        text: jsonStr,
        width: size,
        height: size,
        colorDark: '#2d1b69',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L,
      });
    } catch (e) {
      console.error('QR generation failed:', e.message, 'data length:', jsonStr.length);
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.9rem;">QRコードの生成に失敗しました。<br>データが大きすぎる可能性があります。</div>';
    }
  },

  /**
   * QRスキャナーを起動
   */
  async startScanner(elementId, onSuccess, onError) {
    if (typeof Html5Qrcode === 'undefined') {
      onError('QRスキャンライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
      return null;
    }
    const scanner = new Html5Qrcode(elementId);
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            scanner.stop().catch(() => {});
            onSuccess(data);
          } catch (e) { /* JSON解析失敗 → 無視 */ }
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
