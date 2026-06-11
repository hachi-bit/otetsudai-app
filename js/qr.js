// qr.js - QR生成・読み取りヘルパー
// QR生成: qrcode.js (CDN) + APIフォールバック
// QRスキャン: html5-qrcode (CDN)

const QR = {
  /**
   * QRコードを生成して指定要素に表示
   * JSライブラリが使えなければ外部APIにフォールバック
   */
  generate(elementId, data, size = 220) {
    const el = document.getElementById(elementId);
    if (!el) {
      console.error('QR: element not found:', elementId);
      return;
    }
    el.innerHTML = '';
    const jsonStr = JSON.stringify(data);

    // 方法1: qrcode.js ライブラリ
    if (typeof QRCode !== 'undefined') {
      try {
        return new QRCode(el, {
          text: jsonStr,
          width: size,
          height: size,
          colorDark: '#2d1b69',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      } catch (e) {
        console.warn('QR: qrcode.js failed, falling back to API', e);
      }
    }

    // 方法2: QR Server API フォールバック
    console.log('QR: using API fallback');
    const encoded = encodeURIComponent(jsonStr);
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=2d1b69&bgcolor=ffffff&data=${encoded}`;
    img.width = size;
    img.height = size;
    img.alt = 'QRコード';
    img.style.borderRadius = '8px';
    img.onerror = () => {
      el.innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.9rem;">
        QRコードの生成に失敗しました。<br>インターネット接続を確認してください。
      </div>`;
    };
    el.appendChild(img);
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
          } catch (e) {
            // JSON解析失敗 → 無視して続行
          }
        },
        () => {} // スキャン中のエラーは無視
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
    if (scanner) {
      try {
        await scanner.stop();
      } catch (e) {
        // すでに停止済みの場合があるので無視
      }
    }
  }
};
