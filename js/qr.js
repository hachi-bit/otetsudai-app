// qr.js - QR生成・読み取りヘルパー
// 依存: qrcode.min.js, html5-qrcode

const QR = {
  /**
   * QRコードを生成して指定要素に表示
   * @param {string} elementId - 表示先のDOM要素ID
   * @param {object} data - QRに埋め込むデータ
   * @param {number} size - QRコードのサイズ (px)
   * @returns {QRCode} QRCodeインスタンス
   */
  generate(elementId, data, size = 220) {
    const el = document.getElementById(elementId);
    el.innerHTML = '';
    const jsonStr = JSON.stringify(data);
    return new QRCode(el, {
      text: jsonStr,
      width: size,
      height: size,
      colorDark: '#2d1b69',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  },

  /**
   * QRスキャナーを起動
   * @param {string} elementId - スキャナー表示先のDOM要素ID
   * @param {function} onSuccess - 読み取り成功時のコールバック(parsedData)
   * @param {function} onError - エラー時のコールバック(errorMsg)
   * @returns {Html5Qrcode} スキャナーインスタンス
   */
  async startScanner(elementId, onSuccess, onError) {
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
